FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ARG VITE_AMAP_KEY
ARG VITE_AMAP_SECURITY_CODE

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_AMAP_KEY=${VITE_AMAP_KEY} \
    VITE_AMAP_SECURITY_CODE=${VITE_AMAP_SECURITY_CODE}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Certs are mounted at runtime from host ./frontend/certs (see docker-compose.yml).
# Generate with: bash scripts/gen-ssl-cert.sh <public-ip>
RUN mkdir -p /etc/nginx/certs

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
