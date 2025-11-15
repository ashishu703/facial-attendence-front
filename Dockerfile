# Stage 1: Build Stage (Node.js ka istemal karke)
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Stage (Nginx ka istemal karke)
# Ek halka web server image
FROM nginx:alpine

# --- YAHAN SE FIX SHURU HAI ---

# 1. SSL certificate banane ke liye openssl install karein
RUN apk add --no-cache openssl

# 2. SSL certificate store karne ke liye directory banayein
RUN mkdir -p /etc/nginx/ssl

# 3. 365 dino ke liye ek self-signed certificate aur key banayein
# Yeh non-interactive mode mein chalega
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx-selfsigned.key \
    -out /etc/nginx/ssl/nginx-selfsigned.crt \
    -subj "/C=IN/ST=Delhi/L=Delhi/O=SelfSigned/OU=IT/CN=localhost"

# 4. Nginx ko port 443 (SSL/HTTPS) par sunne ke liye configure karein
# Yeh pichhli config ko replace kar dega
RUN echo 'server { \
    listen 443 ssl; \
    listen [::]:443 ssl; \
    \
    # Certificate aur Key ka path batayein
    ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt; \
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key; \
    \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# --- YAHAN TAK FIX HAI ---

# Build stage se banayi gayi static files ko Nginx ke folder mein copy karein
COPY --from=build /app/build /usr/share/nginx/html

# Container port 443 expose karega (80 ki jagah)
EXPOSE 443
