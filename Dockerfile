FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system app && useradd --system --gid app app
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist

USER app
EXPOSE 8080
CMD ["node", "dist/index.js"]
