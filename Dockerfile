# Stage 1: Build Stage (Node.js ka istemal karke)
# Yahan 'node:18-alpine' ek chhota aur fast Node.js image hai
FROM node:18-alpine AS build

# App ka code copy karne ke liye working directory set karein
WORKDIR /app

# Pehle package.json copy karein taaki dependencies cache ho sakein
COPY package*.json ./

# Dependencies install karein
RUN npm install

# Baaki ka saara source code copy karein
COPY . .

# App ko production ke liye build karein
# (Aamtaur par yeh 'dist' ya 'build' folder banata hai)
RUN npm run build

# Stage 2: Production Stage (Nginx ka istemal karke)
# Ek halka web server image
FROM nginx:alpine

# Nginx ko configure karein taaki woh Single Page Applications (SPAs) ko handle kar sake
# Yeh sabhi requests ko index.html par bhej dega
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Build stage se banayi gayi static files ko Nginx ke folder mein copy karein
# --- FIX ---
# Yahan '/app/dist' ko '/app/build' se badal diya hai
# Kyunki aapka project 'build' folder banata hai, 'dist' nahi.
COPY --from=blog /app/build /usr/share/nginx/html

# Container port 80 expose karega (jise hum baad mein 4200 se map karenge)
EXPOSE 80
