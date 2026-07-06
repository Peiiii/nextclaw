#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const distDir = path.join(repoRoot, 'apps/docs/.vitepress/dist');
const nginxConfigPath = path.join(scriptDir, 'docs-nextclaw-net.nginx.conf');
const archivePath = path.join(os.tmpdir(), 'nextclaw-docs-dist.tgz');

const host = process.env.NEXTCLAW_DOCS_ECS_HOST ?? '8.154.43.167';
const user = process.env.NEXTCLAW_DOCS_ECS_USER ?? 'root';
const remoteRoot = process.env.NEXTCLAW_DOCS_ECS_ROOT ?? '/var/www/docs.nextclaw.net';
const shouldForceNginxConfig = process.env.NEXTCLAW_DOCS_ECS_FORCE_NGINX_CONFIG === '1';
const remote = `${user}@${host}`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
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

if (!existsSync(distDir)) {
  console.error(`Docs build output does not exist: ${distDir}`);
  console.error('Run pnpm --filter @nextclaw/docs build before deploying.');
  process.exit(1);
}

if (!existsSync(nginxConfigPath)) {
  console.error(`Nginx config does not exist: ${nginxConfigPath}`);
  process.exit(1);
}

run('ssh', [
  remote,
  'mkdir',
  '-p',
  remoteRoot,
  '/tmp/nextclaw-docs-mirror',
]);

run('tar', [
  '-czf',
  archivePath,
  '-C',
  distDir,
  '.',
], {
  env: {
    COPYFILE_DISABLE: '1',
  },
});

run('scp', [
  archivePath,
  `${remote}:/tmp/nextclaw-docs-mirror/docs-dist.tgz`,
]);

run('scp', [
  nginxConfigPath,
  `${remote}:/tmp/nextclaw-docs-mirror/docs-nextclaw-net.nginx.conf`,
]);

run('ssh', [
  remote,
  [
    `rm -rf ${remoteRoot}/*`,
    `tar -xzf /tmp/nextclaw-docs-mirror/docs-dist.tgz -C ${remoteRoot}`,
    shouldForceNginxConfig
      ? 'cp /tmp/nextclaw-docs-mirror/docs-nextclaw-net.nginx.conf /etc/nginx/conf.d/docs.nextclaw.net.conf'
      : 'if [ ! -f /etc/nginx/conf.d/docs.nextclaw.net.conf ]; then cp /tmp/nextclaw-docs-mirror/docs-nextclaw-net.nginx.conf /etc/nginx/conf.d/docs.nextclaw.net.conf; fi',
    'nginx -t',
    'systemctl reload nginx',
  ].join(' && '),
]);

console.log(`Deployed docs mirror to ${remote}:${remoteRoot}`);
