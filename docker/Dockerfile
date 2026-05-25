FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile

RUN pnpm -C packages/nextclaw-core build \
  && pnpm -C packages/ncp-packages/nextclaw-ncp build \
  && pnpm -C packages/nextclaw-runtime build \
  && pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk build \
  && pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk build \
  && pnpm -C packages/nextclaw-server build \
  && pnpm -C packages/nextclaw-agent-chat build \
  && pnpm -C packages/nextclaw-ui build \
  && pnpm -C packages/nextclaw build

ENV NEXTCLAW_HOME=/data
ENV NEXTCLAW_UI_PORT=55667

VOLUME ["/data"]
EXPOSE 18790 55667

CMD ["sh", "-lc", "node /app/packages/nextclaw/dist/cli/index.js serve --ui-port ${NEXTCLAW_UI_PORT:-55667}"]
