import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  atomicWrite,
  createBackup,
  ensureRegularTarget,
  inspectConfigSafety,
  MANAGED_MARKER,
  parseOptions,
  printJson,
  requireOption,
} from "./local-subscription-proxy.utils.mjs";

const DEFAULT_SERVICE_NAME = "cliproxyapi.service";
const SERVICE_NAME_PATTERN = /^[a-zA-Z0-9_.@-]+\.service$/;

function runCommand(command, args, label) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`${label} could not execute ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`${label} failed${detail ? `: ${detail}` : ` with exit code ${result.status}`}`);
  }
  return (result.stdout || "").trim();
}

function requireAbsolutePath(rawPath, optionName) {
  if (!isAbsolute(rawPath)) {
    throw new Error(`${optionName} must be an absolute path`);
  }
  return resolve(rawPath);
}

function normalizeServiceName(rawName = DEFAULT_SERVICE_NAME) {
  if (!SERVICE_NAME_PATTERN.test(rawName)) {
    throw new Error("--service-name must be a systemd .service unit name");
  }
  return rawName;
}

function systemdQuote(value) {
  if (/\r|\n|\0/.test(value)) {
    throw new Error("systemd unit values must not contain control characters");
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildSystemdUnit({ binary, configPath, authDir, serviceUser, home }) {
  return `${MANAGED_MARKER}
[Unit]
Description=CLIProxyAPI for NextClaw local AI subscriptions
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=${serviceUser}
Environment=HOME=${systemdQuote(home)}
WorkingDirectory=${systemdQuote(authDir)}
ExecStart=${systemdQuote(binary)} --config ${systemdQuote(configPath)}
Restart=on-failure
RestartSec=5s
KillMode=control-group
TimeoutStopSec=20s
UMask=0077

[Install]
WantedBy=multi-user.target
`;
}

function inspectSystemdService({ serviceName, systemctl }) {
  runCommand(systemctl, ["is-enabled", "--quiet", serviceName], `systemd service ${serviceName} is not enabled`);
  runCommand(systemctl, ["is-active", "--quiet", serviceName], `systemd service ${serviceName} is not active`);
  const source = runCommand(
    systemctl,
    ["show", serviceName, "--property=MainPID", "--property=ControlGroup", "--no-pager"],
    `systemd service ${serviceName} inspection`,
  );
  const properties = Object.fromEntries(source.split(/\r?\n/)
    .map((line) => line.split("="))
    .filter((parts) => parts.length >= 2)
    .map(([key, ...parts]) => [key, parts.join("=")]));
  const mainPid = Number.parseInt(properties.MainPID || "0", 10);
  const controlGroup = properties.ControlGroup || "";
  if (!Number.isInteger(mainPid) || mainPid <= 0) {
    throw new Error(`systemd service ${serviceName} did not report a live MainPID`);
  }
  if (!controlGroup.endsWith(`/${serviceName}`)) {
    throw new Error(`systemd service ${serviceName} has an unexpected ControlGroup: ${controlGroup || "(missing)"}`);
  }
  if (controlGroup.includes("nextclaw.service")) {
    throw new Error(`CLIProxyAPI must not run inside the NextClaw service cgroup: ${controlGroup}`);
  }
  return {
    manager: "systemd",
    serviceName,
    enabled: true,
    active: true,
    mainPid,
    controlGroup,
    independentFromNextclaw: true,
  };
}

function inspectHomebrewService({ serviceName, brew }) {
  const raw = runCommand(brew, ["services", "list", "--json"], "Homebrew service inspection");
  let services;
  try {
    services = JSON.parse(raw);
  } catch {
    throw new Error("brew services list --json returned invalid JSON");
  }
  const formulaName = serviceName.replace(/\.service$/, "");
  const service = Array.isArray(services)
    ? services.find((entry) => entry?.name === formulaName)
    : null;
  if (!service || service.status !== "started") {
    throw new Error(`Homebrew service ${formulaName} is not started`);
  }
  return {
    manager: "homebrew",
    serviceName: formulaName,
    enabled: true,
    active: true,
    user: service.user || null,
    file: service.file || null,
    independentFromNextclaw: true,
  };
}

export function inspectServiceLifecycle(options) {
  const serviceManager = requireOption(options, "service-manager");
  if (serviceManager === "systemd") {
    return inspectSystemdService({
      serviceName: normalizeServiceName(options["service-name"]),
      systemctl: options.systemctl || "systemctl",
    });
  }
  if (serviceManager === "homebrew") {
    return inspectHomebrewService({
      serviceName: options["service-name"] || "cliproxyapi",
      brew: options.brew || "brew",
    });
  }
  throw new Error("--service-manager must be systemd or homebrew");
}

export function installSystemd(argv) {
  const options = parseOptions(argv, {
    values: [
      "binary",
      "config",
      "auth-dir",
      "service-user",
      "home",
      "service-name",
      "unit-dir",
      "systemctl",
    ],
    booleans: ["force"],
  });
  const binary = requireAbsolutePath(requireOption(options, "binary"), "--binary");
  const configPath = requireAbsolutePath(requireOption(options, "config"), "--config");
  const authDir = requireAbsolutePath(requireOption(options, "auth-dir"), "--auth-dir");
  const home = requireAbsolutePath(requireOption(options, "home"), "--home");
  const serviceUser = requireOption(options, "service-user");
  if (!/^[a-z_][a-z0-9_-]*[$]?$/i.test(serviceUser)) {
    throw new Error("--service-user must be a local account name");
  }
  const serviceName = normalizeServiceName(options["service-name"]);
  const unitDir = requireAbsolutePath(options["unit-dir"] || "/etc/systemd/system", "--unit-dir");
  const systemctl = options.systemctl || "systemctl";
  ensureRegularTarget(binary, "CLIProxyAPI binary");
  if (!existsSync(binary)) {
    throw new Error(`CLIProxyAPI binary does not exist: ${binary}`);
  }
  inspectConfigSafety(configPath);
  const unitPath = join(unitDir, serviceName);
  ensureRegularTarget(unitPath, "systemd unit");
  const currentSource = existsSync(unitPath) ? readFileSync(unitPath, "utf8") : "";
  const currentIsManaged = currentSource.startsWith(MANAGED_MARKER);
  if (currentSource && !currentIsManaged && options.force !== true) {
    throw new Error(`Refusing to overwrite an unmanaged systemd unit without --force: ${unitPath}`);
  }
  const nextSource = buildSystemdUnit({ binary, configPath, authDir, serviceUser, home });
  const backupPath = currentSource && currentSource !== nextSource ? createBackup(unitPath) : null;
  const changed = currentSource !== nextSource;
  if (changed) atomicWrite(unitPath, nextSource, 0o644);
  runCommand(systemctl, ["daemon-reload"], "systemd daemon reload");
  runCommand(systemctl, ["enable", "--now", serviceName], "systemd service enable/start");
  const lifecycle = inspectSystemdService({ serviceName, systemctl });
  printJson({
    ok: true,
    changed,
    serviceManager: "systemd",
    serviceName,
    unitPath,
    backupPath,
    binary,
    configPath,
    authDir,
    serviceUser,
    home,
    lifecycle,
  });
}

export function restartManagedService(options) {
  const serviceManager = requireOption(options, "service-manager");
  if (serviceManager === "systemd") {
    const serviceName = normalizeServiceName(options["service-name"]);
    runCommand(options.systemctl || "systemctl", ["restart", serviceName], `systemd service ${serviceName} restart`);
    return;
  }
  if (serviceManager === "homebrew") {
    const serviceName = (options["service-name"] || "cliproxyapi").replace(/\.service$/, "");
    runCommand(options.brew || "brew", ["services", "restart", serviceName], `Homebrew service ${serviceName} restart`);
    return;
  }
  throw new Error("--service-manager must be systemd or homebrew");
}
