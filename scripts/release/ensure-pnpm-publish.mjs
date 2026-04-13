const userAgent = process.env.npm_config_user_agent ?? "";
const packageName = process.env.npm_package_name ?? "this package";

if (userAgent.includes("pnpm/")) {
  process.exit(0);
}

console.error(
  [
    `Refusing to publish ${packageName} with npm.`,
    "This workspace uses workspace:* internal dependencies.",
    "Direct npm publish keeps workspace:* in the registry manifest and breaks installs.",
    "Use pnpm publish or the repo-root release flow: pnpm release:publish."
  ].join("\n")
);
process.exit(1);
