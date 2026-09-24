FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV NODE_USE_ENV_PROXY=1
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY patches ./patches
COPY packages ./packages
COPY apps/bibo-hosted/package.json ./apps/bibo-hosted/package.json
RUN pnpm install --filter '@nextclaw/harness...' --filter @nextclaw/bibo-hosted --frozen-lockfile
RUN pnpm -r --filter '@nextclaw/harness...' build
COPY apps/bibo-hosted ./apps/bibo-hosted
RUN pnpm --registry=https://registry.npmmirror.com --filter @nextclaw/bibo-hosted deploy --prod /out

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=builder /out ./
ENV NEXTCLAW_HOME=/data
ENV NEXTCLAW_APP_NAME=bibo
EXPOSE 8080
CMD ["node", "/app/container/bibo-runner.controller.mjs"]
