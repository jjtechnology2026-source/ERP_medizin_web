# --- ETAPA 1: Dependencias ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm i --frozen-lockfile

# --- ETAPA 2: Build ---
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate

# Build args for NEXT_PUBLIC_* vars (inlined at build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MQTT_BROKER_HOST
ARG NEXT_PUBLIC_MQTT_BROKER_PORT
ARG NEXT_PUBLIC_MQTT_PROTOCOL
ARG NEXT_PUBLIC_MQTT_USERNAME
ARG NEXT_PUBLIC_MQTT_PASSWORD
ARG NEXT_PUBLIC_MQTT_CLIENT_ID_PREFIX
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL

# Pass as ENV so Next.js inlines them during build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://medizins.com}
ENV NEXT_PUBLIC_MQTT_BROKER_HOST=${NEXT_PUBLIC_MQTT_BROKER_HOST:-v1106ae1.ala.us-east-1.emqxsl.com}
ENV NEXT_PUBLIC_MQTT_BROKER_PORT=${NEXT_PUBLIC_MQTT_BROKER_PORT:-8084}
ENV NEXT_PUBLIC_MQTT_PROTOCOL=${NEXT_PUBLIC_MQTT_PROTOCOL:-wss}
ENV NEXT_PUBLIC_MQTT_USERNAME=${NEXT_PUBLIC_MQTT_USERNAME:-inventario_medizin}
ENV NEXT_PUBLIC_MQTT_PASSWORD=${NEXT_PUBLIC_MQTT_PASSWORD:-prueba1234}
ENV NEXT_PUBLIC_MQTT_CLIENT_ID_PREFIX=${NEXT_PUBLIC_MQTT_CLIENT_ID_PREFIX:-medizin_terminal_}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build
RUN rm -rf .next/cache

# --- ETAPA 3: Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

# Runtime env vars (for server-side code that reads process.env)
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://medizins.com}
ENV NEXT_PUBLIC_MQTT_BROKER_HOST=${NEXT_PUBLIC_MQTT_BROKER_HOST:-v1106ae1.ala.us-east-1.emqxsl.com}
ENV NEXT_PUBLIC_MQTT_BROKER_PORT=${NEXT_PUBLIC_MQTT_BROKER_PORT:-8084}
ENV NEXT_PUBLIC_MQTT_PROTOCOL=${NEXT_PUBLIC_MQTT_PROTOCOL:-wss}
ENV NEXT_PUBLIC_MQTT_USERNAME=${NEXT_PUBLIC_MQTT_USERNAME:-inventario_medizin}
ENV NEXT_PUBLIC_MQTT_PASSWORD=${NEXT_PUBLIC_MQTT_PASSWORD:-prueba1234}
ENV NEXT_PUBLIC_MQTT_CLIENT_ID_PREFIX=${NEXT_PUBLIC_MQTT_CLIENT_ID_PREFIX:-medizin_terminal_}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["node", "server.js"]
