# ============================================================
# BJJ Procesador — React Frontend
# ============================================================
# Build:  docker build -t bjj-frontend ./processor-frontend
# Run:    docker run -p 3000:80 bjj-frontend
# ============================================================

# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund --legacy-peer-deps
COPY . .
RUN npm run build

# --- Production stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
