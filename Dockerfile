# Stage 1: Build Stage (Node.js ka istemal karke)
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# --- YAHAN FIX HAI ---
# .env file ko build stage mein copy karein
COPY .env ./
RUN npm run build

# Stage 2: Production Stage (Nginx ka istemal karke)
FROM nginx:alpine

# 1. SSL certificate banane ke liye openssl install karein
RUN apk add --no-cache openssl
# ... (baaki poora SSL aur proxy config code jaisa aapne diya hai) ...
RUN echo 'server { \
    listen 443 ssl; \
    listen [::]:443 ssl; \
    ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt; \
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key; \
    \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api-main/ { \
        proxy_pass http://host.docker.internal:5010/; \
    } \
    location /api-mark/ { \
        proxy_pass http://host.docker.internal:5020/; \
    } \
    location /api-verify/ { \
        proxy_pass http://host.docker.internal:5030/; \
    } \
    location /api-register/ { \
        proxy_pass http://host.docker.internal:5040/; \
    } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 443
