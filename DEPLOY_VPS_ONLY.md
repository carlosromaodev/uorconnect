# Deploy: Frontend + Backend na Mesma VPS

## DNS

Configura estes registos:

- `@` -> `A` -> IP da VPS
- `www` -> `CNAME` -> `uorconnect.space`
- `api` -> `A` -> IP da VPS

## `.env`

No servidor, em `deploy/.env`:

```env
FRONTEND_DOMAIN=uorconnect.space, www.uorconnect.space
API_DOMAIN=api.uorconnect.space
POSTGRES_DB=uorconnect
POSTGRES_USER=uorconnect
POSTGRES_PASSWORD=change-me
JWT_SECRET=change-me-with-at-least-16-characters
CORS_ORIGIN=https://uorconnect.space,https://www.uorconnect.space
PUBLIC_API_URL=https://api.uorconnect.space
BACKUP_DIR=/opt/uorconnect/backups
```

Se a password do Postgres tiver caracteres reservados como `#`, `@`, `/` ou `:`, define também `DATABASE_URL` com a password codificada.

## Subir a stack

```bash
cd /opt/uorconnect/deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml --env-file .env ps
```

## Resultado esperado

- `https://uorconnect.space` -> frontend
- `https://www.uorconnect.space` -> frontend
- `https://api.uorconnect.space` -> backend

## Smoke check

Validação rápida depois de qualquer deploy:

```bash
cd /opt/uorconnect
bash deploy/scripts/smoke-check.sh
```

Validação completa com login admin:

```bash
cd /opt/uorconnect
ADMIN_STUDENT_NUMBER=20242099 \
ADMIN_PASSWORD='troca-esta-password-pela-atual' \
bash deploy/scripts/smoke-check.sh
```
