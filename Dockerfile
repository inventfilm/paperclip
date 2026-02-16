FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY server/package.json server/
COPY ui/package.json ui/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules packages/db/node_modules
COPY --from=deps /app/server/node_modules server/node_modules
COPY --from=deps /app/ui/node_modules ui/node_modules
COPY . .
RUN pnpm --filter @paperclip/ui build
RUN pnpm --filter @paperclip/server build

FROM base AS production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules packages/db/node_modules
COPY --from=deps /app/server/node_modules server/node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/packages/db packages/db
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/ui/dist ui/dist
COPY package.json pnpm-workspace.yaml ./

EXPOSE 3100
CMD ["node", "server/dist/index.js"]
