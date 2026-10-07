FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server.js app.js index.html login.html ./
COPY --chown=node:node public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
