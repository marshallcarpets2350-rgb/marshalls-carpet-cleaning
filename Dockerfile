FROM node:22-alpine

WORKDIR /app

RUN npm install -g npm@11 --no-audit --no-fund

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
