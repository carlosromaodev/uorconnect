FROM node:22-alpine AS build

WORKDIR /app/laboratorio

COPY laboratorio/package*.json ./
RUN npm ci

WORKDIR /app
RUN ln -s /app/laboratorio/node_modules /app/node_modules

COPY frontend/ ./frontend/
COPY laboratorio/ ./laboratorio/

ARG VITE_API_BASE_URL
ARG VITE_LAB_BASE_PATH=/desafios

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_LAB_BASE_PATH=${VITE_LAB_BASE_PATH}

WORKDIR /app/laboratorio
RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/frontend.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/laboratorio/dist /usr/share/nginx/html
