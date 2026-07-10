import { spawnSync } from 'node:child_process';

export function run(config, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: config.repoRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function runScp(config, source, remoteDestination) {
  run(config, 'scp', [source, `${config.remote}:${remoteDestination}`]);
}

export function runSsh(config, remoteCommand) {
  run(config, 'ssh', [config.remote, remoteCommand]);
}

export function joinRemoteCommands(commands) {
  return ['set -e', ...commands].join(' && ');
}
