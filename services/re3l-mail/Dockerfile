FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
USER node
EXPOSE 3001
CMD ["node","server.mjs"]
