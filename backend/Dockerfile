# Multi-stage production Dockerfile for Omran Mall Backend
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist ./dist

ENV NODE_ENV=production
ENV PORT=4000
ENV TZ=Asia/Amman

EXPOSE 4000

CMD ["node", "dist/main"]
