#!/usr/bin/env node
import { existsSync } from 'node:fs';

import { getDocsMirrorConfig } from './docs-mirror-config.mjs';
import { joinRemoteCommands, run, runScp, runSsh } from './docs-mirror-runner.mjs';

const config = getDocsMirrorConfig();
const remoteArchivePath = `${config.remoteStagingDir}/docs-dist.tgz`;
const remoteTemplatePath = `${config.remoteStagingDir}/docs-nextclaw-net.nginx.conf`;

if (!existsSync(config.distDir)) {
  console.error(`Docs build output does not exist: ${config.distDir}`);
  console.error('Run pnpm --filter @nextclaw/docs build before deploying.');
  process.exit(1);
}

if (!existsSync(config.nginxConfigPath)) {
  console.error(`Nginx config does not exist: ${config.nginxConfigPath}`);
  process.exit(1);
}

runSsh(config, joinRemoteCommands([`mkdir -p ${config.remoteRoot} ${config.remoteStagingDir}`]));

run(config, 'tar', [
  '-czf',
  config.archivePath,
  '-C',
  config.distDir,
  '.',
], {
  env: {
    COPYFILE_DISABLE: '1',
  },
});

runScp(config, config.archivePath, remoteArchivePath);
runScp(config, config.nginxConfigPath, remoteTemplatePath);

runSsh(
  config,
  joinRemoteCommands([
    `rm -rf ${config.remoteRoot}/*`,
    `tar -xzf ${remoteArchivePath} -C ${config.remoteRoot}`,
    config.forceNginxConfig
      ? `cp ${remoteTemplatePath} ${config.remoteConfigPath}`
      : `if [ ! -f ${config.remoteConfigPath} ]; then cp ${remoteTemplatePath} ${config.remoteConfigPath}; fi`,
    'nginx -t',
    'systemctl reload nginx',
  ]),
);

console.log(`Deployed docs mirror to ${config.remote}:${config.remoteRoot}`);
