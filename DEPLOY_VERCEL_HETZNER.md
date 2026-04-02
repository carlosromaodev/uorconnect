# Deploy: Vercel + Hetzner VPS

## Arquitetura

- `frontend/` no `Vercel`
- `backend/` num `Hetzner VPS`
- `Postgres` no mesmo VPS
- `Caddy` como reverse proxy HTTPS para `api.seu-dominio.com`

## 1. Preparação de domínio

- frontend: `uorconnect.ao` ou `www.uorconnect.ao` no Vercel
- backend: `api.uorconnect.ao` apontado para o IP da VPS

## 2. Frontend no Vercel

### Variáveis

- `VITE_API_BASE_URL=https://api.uorconnect.ao`

### Build

- framework: `Vite`
- root directory: `frontend`
- build command: `npm run build`
- output directory: `dist`

O ficheiro [`frontend/vercel.json`](./frontend/vercel.json) já trata o fallback de SPA.

## 3. Backend no Hetzner

### Requisitos na VPS

- Ubuntu 24.04 LTS
- Docker
- Docker Compose plugin
- `2 GB` de swap

### Ficheiros usados

- [`backend/Dockerfile`](./backend/Dockerfile)
- [`deploy/docker-compose.prod.yml`](./deploy/docker-compose.prod.yml)
- [`deploy/Caddyfile`](./deploy/Caddyfile)
- [`deploy/.env.example`](./deploy/.env.example)
- [`deploy/postgres/postgresql.conf`](./deploy/postgres/postgresql.conf)
- [`deploy/scripts/setup-cpx11.sh`](./deploy/scripts/setup-cpx11.sh)
- [`deploy/scripts/backup-postgres.sh`](./deploy/scripts/backup-postgres.sh)
- [`deploy/scripts/install-backup-cron.sh`](./deploy/scripts/install-backup-cron.sh)

### Passos

1. preparar a VPS:

```bash
sudo mkdir -p /opt/uorconnect
sudo chown -R $USER:$USER /opt/uorconnect
```

2. copiar o projeto para `/opt/uorconnect`
3. executar o setup base:

```bash
sudo APP_ROOT=/opt/uorconnect bash /opt/uorconnect/deploy/scripts/setup-cpx11.sh
```

4. entrar em `deploy/`
5. criar `.env` a partir de `.env.example`
6. definir `APP_DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET` e URLs reais
   se `POSTGRES_PASSWORD` tiver caracteres reservados de URL como `#`, `@`, `/` ou `:`,
   também define `DATABASE_URL` com a password em formato URL-encoded
7. arrancar:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

8. instalar backup diário:

```bash
sudo APP_ROOT=/opt/uorconnect bash /opt/uorconnect/deploy/scripts/install-backup-cron.sh
```

## 4. Banco de dados

O projeto agora aceita:

- `SQLite` no schema local de desenvolvimento
- `Postgres` no deploy, através de um schema de produção gerado automaticamente

Para produção:

No container do backend, o Dockerfile já executa:

- `npm run prisma:generate:postgres`
- `npm run prisma:push:postgres`

## 5. Migração de SQLite para Postgres

O projeto já tem um script de migração de dados:

```bash
cd backend
DATABASE_URL=postgresql://uorconnect:senha@localhost:5432/uorconnect?schema=public \
DATABASE_PROVIDER=postgresql \
SQLITE_SOURCE_PATH=./dev.db \
npm run prisma:push:postgres && npm run migrate:data:postgres
```

O comando:

- cria/alinha o schema `Postgres`
- lê os dados de `dev.db`
- copia todas as tabelas na ordem correta
- preserva os `ids`
- atualiza as sequências do `Postgres`

Se precisares de uma base diferente para migração, podes usar `POSTGRES_MIGRATION_URL`.

## 6. CORS

No backend, configura:

```env
CORS_ORIGIN=https://uor-connect.vercel.app,https://www.uorconnect.ao
```

## 7. Variáveis principais

### Backend

- `NODE_ENV`
- `PORT`
- `DATABASE_PROVIDER`
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `PUBLIC_API_URL`

### Frontend

- `VITE_API_BASE_URL`

## 8. Observações

- PDFs usam `Playwright`, por isso o backend foi preparado para rodar em container com browsers instalados
- no `CPX11`, o `docker-compose` já limita memória e CPU para reduzir risco de pressão na RAM
- o `Postgres` foi afinado para `2 GB RAM`, com `max_connections=30` e buffers conservadores
- o backup mínimo configurado é um `pg_dump` diário com retenção local de `7` dias
