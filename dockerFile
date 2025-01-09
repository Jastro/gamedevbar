# Usa la imagen oficial de Node.js como base
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./

COPY . .

RUN chown -R appuser:appgroup /app

RUN npm install

USER appuser

EXPOSE 3000

CMD ["npm", "start"]
