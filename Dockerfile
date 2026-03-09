FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/client/node_modules ./packages/client/node_modules
COPY . .
RUN pnpm build

FROM base AS server
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
COPY package.json .
RUN mkdir -p /app/data
EXPOSE 8000
CMD ["node", "packages/server/dist/index.js"]

FROM base AS client
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/client/node_modules ./packages/client/node_modules
COPY --from=build /app/packages/client/build ./packages/client/build
COPY packages/client/package.json packages/client/
COPY package.json .
EXPOSE 3000
ENV PORT=3000
CMD ["pnpm", "--filter", "@duet/client", "start"]
