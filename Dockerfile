# --- Stage 1: Builder ---
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat openssl

COPY package.json package-lock.json .npmrc ./
# prisma/ install'dan ÖNCE kopyalanmalı: postinstall `prisma generate` çalıştırır ve schema ister
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --legacy-peer-deps

COPY . .
RUN npm run build

# Prune dev dependencies for lean production runner
RUN npm prune --production --legacy-peer-deps

# --- Stage 2: Production Runner ---
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl curl

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]

# --- Dev Stage: Live Reload (used by docker-compose.dev.yml) ---
FROM node:20-alpine AS development
WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat openssl curl

COPY package.json package-lock.json .npmrc ./
# prisma/ install'dan ÖNCE kopyalanmalı: postinstall `prisma generate` çalıştırır ve schema ister
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --legacy-peer-deps

COPY . .
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=development
ENV PORT=4000

EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start:dev"]
