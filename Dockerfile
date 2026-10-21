FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install --platform=linux --libc=musl
COPY . .
RUN ls -la /app/src/network/
RUN find /app/src -type f
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Crear usuario no root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copiar archivos y establecer permisos
COPY --chown=appuser:appgroup package*.json ./
RUN npm install --only=production --platform=linux --libc=musl
COPY --chown=appuser:appgroup --from=builder /app/dist ./dist
COPY --chown=appuser:appgroup server.js .
COPY --chown=appuser:appgroup server ./server

# Dar permisos necesarios
RUN chown -R appuser:appgroup /app && \
    chmod -R 755 /app

USER appuser
EXPOSE 3000
CMD ["npm", "start"]