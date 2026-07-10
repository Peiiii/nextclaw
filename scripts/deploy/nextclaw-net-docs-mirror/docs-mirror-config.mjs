import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const domain = 'docs.nextclaw.net';
const nginxConfigFile = `${domain}.conf`;

export function getDocsMirrorConfig() {
  const host = process.env.NEXTCLAW_DOCS_ECS_HOST ?? '8.154.43.167';
  const user = process.env.NEXTCLAW_DOCS_ECS_USER ?? 'root';

  return {
    archivePath: path.join(os.tmpdir(), 'nextclaw-docs-dist.tgz'),
    certPath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
    distDir: path.join(repoRoot, 'apps/docs/.vitepress/dist'),
    domain,
    expectedARecord: process.env.NEXTCLAW_DOCS_EXPECTED_A_RECORD ?? host,
    forceNginxConfig: process.env.NEXTCLAW_DOCS_ECS_FORCE_NGINX_CONFIG === '1',
    host,
    nginxConfigPath: path.join(scriptDir, 'docs-nextclaw-net.nginx.conf'),
    remote: `${user}@${host}`,
    remoteConfigPath: `/etc/nginx/conf.d/${nginxConfigFile}`,
    remoteRoot: process.env.NEXTCLAW_DOCS_ECS_ROOT ?? `/var/www/${domain}`,
    remoteStagingDir:
      process.env.NEXTCLAW_DOCS_ECS_STAGING_DIR ?? '/tmp/nextclaw-docs-mirror',
    repoRoot,
    user,
  };
}
