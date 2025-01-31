FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts --platform=linux --libc=musl # Agregamos flags para ignorar plataforma
COPY . .
RUN ls -la /app/src/network/
RUN find /app/src -type f
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --chown=appuser:appgroup package*.json ./
RUN npm install --only=production --ignore-scripts --platform=linux --libc=musl
COPY --chown=appuser:appgroup --from=builder /app/dist ./dist
COPY --chown=appuser:appgroup server.js .
USER appuser
EXPOSE 3000
CMD ["npm", "start"]