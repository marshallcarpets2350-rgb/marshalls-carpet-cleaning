FROM node:22-alpine

WORKDIR /app

RUN npm install -g npm@11 --no-audit --no-fund \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 300000

COPY package.json package-lock.json ./
RUN for i in 1 2 3 4 5; do \
      npm ci --include=dev --no-audit --no-fund && break || { echo "npm ci attempt $i failed, retrying"; sleep 15; }; \
    done

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
