# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

RUN --mount=type=cache,id=nextclaw-pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm fetch --frozen-lockfile

COPY docs/USAGE.md ./docs/USAGE.md
COPY docs/usage ./docs/usage
COPY packages ./packages

RUN --mount=type=cache,id=nextclaw-pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm install --frozen-lockfile --offline

RUN pnpm -r --filter "nextclaw..." build

ENV NEXTCLAW_HOME=/data
ENV NEXTCLAW_UI_PORT=18891

VOLUME ["/data"]
EXPOSE 18790 18891

CMD ["sh", "-lc", "node /app/packages/nextclaw/dist/cli/app/index.js serve --ui-port ${NEXTCLAW_UI_PORT:-18891}"]
