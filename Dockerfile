# Stage 1: Build Stage (Node.js ka istemal karke)
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# .env file ko build stage mein copy karein
COPY .env ./
RUN npm run build

# Stage 2: Production Stage (Nginx ka istemal karke)
FROM nginx:alpine

# 1. SSL certificate banane ke liye openssl install karein
RUN apk add --no-cache openssl

# 2. SSL certificate store karne ke liye directory banayein
RUN mkdir -p /etc/nginx/ssl

# 3. 365 dino ke liye ek self-signed certificate aur key banayein
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx-selfsigned.key \
    -out /etc/nginx/ssl/nginx-selfsigned.crt \
    -subj "/C=IN/ST=Delhi/L=Delhi/O=SelfSigned/OU=IT/CN=localhost"

# 4. Nginx ko HTTPS aur REVERSE PROXY ke liye configure karein
# --- YAHAN FIX HAI ---
# Hum ab 'echo' ki jagah seedhe config file ko copy kar rahe hain
COPY nginx.conf /etc/nginx/conf.d/default.conf
# --- YAHAN TAK FIX HAI ---

# Build stage se banayi gayi static files ko Nginx ke folder mein copy karein
COPY --from=build /app/build /usr/share/nginx/html

# Container port 443 expose karega
EXPOSE 443
