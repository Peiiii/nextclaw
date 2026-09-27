FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV NODE_USE_ENV_PROXY=1
RUN corepack enable && \
    (timeout 45s corepack prepare pnpm@9.15.1 --activate || timeout 45s corepack prepare pnpm@9.15.1 --activate)
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY patches ./patches
COPY packages ./packages
COPY apps/bibo-hosted/package.json ./apps/bibo-hosted/package.json
RUN for build_attempt in 1 2; do \
      timeout 120s pnpm --registry=https://registry.npmjs.org install \
        --filter '@nextclaw/harness...' --filter @nextclaw/bibo-hosted \
        --frozen-lockfile --fetch-timeout=30000 --network-concurrency=4 && exit 0; \
    done; exit 1
RUN pnpm -r --filter '@nextclaw/harness...' build
COPY apps/bibo-hosted ./apps/bibo-hosted
RUN pnpm -C apps/bibo-hosted build:runner
# pnpm 9 deploy resolves every workspace manifest, including unrelated dev dependencies.
# Restrict its build-stage workspace to Bibo's production dependency closure.
RUN pnpm --filter-prod '@nextclaw/bibo-hosted...' list --depth -1 --json > /tmp/bibo-runtime-projects.json
RUN node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const projects = JSON.parse(fs.readFileSync('/tmp/bibo-runtime-projects.json', 'utf8'));
for (const directory of ['/app', ...projects.map(project => project.path)]) {
  const manifestPath = path.join(directory, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  delete manifest.devDependencies;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
}
const workspacePath = '/app/pnpm-workspace.yaml';
const workspace = fs.readFileSync(workspacePath, 'utf8');
const packages = projects.map(project => `  - ${JSON.stringify(path.relative('/app', project.path))}`).join('\n');
fs.writeFileSync(workspacePath, workspace.replace(/^packages:\n(?:[ \t]+[^\n]*\n)*/, `packages:\n${packages}\n`));
NODE
RUN pnpm --registry=https://registry.npmjs.org --filter @nextclaw/bibo-hosted deploy --prod /out

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=builder /out ./
ENV NEXTCLAW_HOME=/data
ENV NEXTCLAW_APP_NAME=bibo
EXPOSE 8080
CMD ["node", "/app/dist/container/bibo-runner.controller.mjs"]
