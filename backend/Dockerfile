FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

ARG DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public
ENV DATABASE_URL=${DATABASE_URL}
ENV DATABASE_PROVIDER=postgresql

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts

COPY scripts ./scripts
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY src ./src

RUN npm run prisma:generate:postgres
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3333

CMD ["sh", "-c", "npm run prisma:push:postgres && node dist/src/server.js"]
