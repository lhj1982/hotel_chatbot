# ---- build stage ----
FROM node:22-slim AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Delete lock file and install fresh (npm is crashing with existing lock)
RUN rm -f package-lock.json && npm install --no-audit

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ---- run stage ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
