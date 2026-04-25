# --- ETAPA 1: Dependencias ---
FROM node:20-alpine AS deps
# Agregamos libc6-compat solo si es necesario para dependencias específicas (opcional)
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml* ./
# Instalamos solo las dependencias necesarias para el build
RUN pnpm i --frozen-lockfile

# --- ETAPA 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_PUBLIC_API_URL="https://medizins.com"
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm run build

# --- ETAPA 3: Limpieza (El truco maestro) ---
# Eliminamos todo lo que no sea estrictamente necesario antes de copiar al runner
RUN rm -rf .next/cache

# --- ETAPA 4: Runner (Ultra light) ---
# Usamos la imagen más pequeña posible de Node
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

# Creamos usuario de sistema para seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiamos solo los artefactos finales del modo standalone
# server.js es el punto de entrada generado por Next.js
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]