# ── Build stage ──
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build:widget && npm run build:standalone

# ── Serve stage ──
FROM nginx:alpine
# Widget bundle (widget.js)
COPY --from=build /app/dist /usr/share/nginx/html
# Standalone page (standalone.html + assets)
COPY --from=build /app/dist-standalone /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
