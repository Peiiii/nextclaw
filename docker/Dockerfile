FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY docs/USAGE.md ./docs/USAGE.md
COPY docs/usage ./docs/usage
COPY packages ./packages

RUN pnpm install --frozen-lockfile

RUN pnpm -r --filter "nextclaw..." build

ENV NEXTCLAW_HOME=/data
ENV NEXTCLAW_UI_PORT=55667

VOLUME ["/data"]
EXPOSE 18790 18891

CMD ["sh", "-lc", "node /app/packages/nextclaw/dist/cli/app/index.js serve --ui-port ${NEXTCLAW_UI_PORT:-55667}"]
