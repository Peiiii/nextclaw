#!/usr/bin/env node
import { existsSync } from 'node:fs';

import { getDocsMirrorConfig } from './docs-mirror-config.mjs';
import { joinRemoteCommands, runScp, runSsh } from './docs-mirror-runner.mjs';

const config = getDocsMirrorConfig();
const remoteTemplatePath = `${config.remoteStagingDir}/docs-nextclaw-net.nginx.conf`;

if (!existsSync(config.nginxConfigPath)) {
  console.error(`Nginx config does not exist: ${config.nginxConfigPath}`);
  process.exit(1);
}

runSsh(
  config,
  joinRemoteCommands([
    `mkdir -p ${config.remoteRoot} ${config.remoteStagingDir}`,
  ]),
);

runScp(config, config.nginxConfigPath, remoteTemplatePath);

runSsh(
  config,
  joinRemoteCommands([
    'if ! command -v nginx >/dev/null 2>&1; then apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx; fi',
    'if ! command -v certbot >/dev/null 2>&1; then apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx; fi',
    `if [ ! -f ${config.remoteConfigPath} ]; then cp ${remoteTemplatePath} ${config.remoteConfigPath}; fi`,
    'nginx -t',
    'systemctl enable --now nginx',
    'systemctl reload nginx',
    `if [ ! -f ${config.certPath} ]; then certbot --nginx -d ${config.domain} --non-interactive --agree-tos --register-unsafely-without-email --redirect; fi`,
    'nginx -t',
    'systemctl reload nginx',
  ]),
);

console.log(`Bootstrapped docs mirror host ${config.remote} for ${config.domain}`);
