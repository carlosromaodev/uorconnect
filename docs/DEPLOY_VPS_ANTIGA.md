# Deploy na VPS Antiga

Este guia descreve como publicar ou recuperar o UOR Connect na VPS antiga.

## Dados da VPS

- IP antigo: `135.181.47.46`
- SSH: `root@135.181.47.46`
- Pasta do projeto: `/opt/uorconnect`
- Compose de producao: `/opt/uorconnect/deploy/docker-compose.prod.yml`
- Env de producao: `/opt/uorconnect/deploy/.env`

Nao colocar segredos neste ficheiro. O `.env` real deve ficar apenas na VPS.

## Contexto

- A VPS principal atual e a nova: `178.105.109.96`.
- A VPS antiga fica como fallback historico, recuperacao de dados ou publicacao temporaria.
- O DNS principal atual aponta para a VPS nova. Para usar a antiga publicamente, e preciso apontar DNS para `135.181.47.46` ou validar por IP/hosts temporarios.
- Historicamente, a VPS antiga tinha alteracoes locais no repositório remoto. Antes de usar `git pull` ou `rsync --delete`, verificar o estado remoto para nao apagar trabalho que so existe no servidor.

## Diagnostico inicial

```bash
ssh root@135.181.47.46 'cd /opt/uorconnect && pwd && git status --short && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps'
```

Ver logs principais:

```bash
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=120 backend'
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=120 frontend'
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=120 caddy'
```

## Antes de publicar

1. Confirmar que a alteracao local esta pronta.
2. Rodar testes/build local quando possivel.
3. Fazer backup na VPS antiga:

```bash
ssh root@135.181.47.46 'APP_ROOT=/opt/uorconnect /opt/uorconnect/deploy/scripts/backup-postgres.sh'
```

4. Confirmar que o backup foi criado:

```bash
ssh root@135.181.47.46 'ls -lh /opt/uorconnect/backups/postgres 2>/dev/null | tail || find /opt/uorconnect -maxdepth 3 -type f -name "*.dump" | tail'
```

## Opção A: deploy seletivo por ficheiros

Usar quando a VPS antiga tem alteracoes locais ou quando queres subir apenas uma correcao pequena.

Exemplo para frontend:

```bash
tar -czf /tmp/uorconnect-vps-antiga-frontend.tgz \
  frontend/package.json \
  frontend/package-lock.json \
  frontend/src \
  frontend/public \
  frontend/index.html \
  frontend/vite.config.ts

scp -o StrictHostKeyChecking=accept-new \
  /tmp/uorconnect-vps-antiga-frontend.tgz \
  root@135.181.47.46:/tmp/uorconnect-vps-antiga-frontend.tgz

ssh root@135.181.47.46 'cd /opt/uorconnect && tar -xzf /tmp/uorconnect-vps-antiga-frontend.tgz && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build frontend && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps frontend'
```

Exemplo para backend:

```bash
tar -czf /tmp/uorconnect-vps-antiga-backend.tgz \
  backend/package.json \
  backend/package-lock.json \
  backend/Dockerfile \
  backend/prisma \
  backend/src

scp -o StrictHostKeyChecking=accept-new \
  /tmp/uorconnect-vps-antiga-backend.tgz \
  root@135.181.47.46:/tmp/uorconnect-vps-antiga-backend.tgz

ssh root@135.181.47.46 'cd /opt/uorconnect && tar -xzf /tmp/uorconnect-vps-antiga-backend.tgz && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build backend && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps backend'
```

## Opção B: sincronizar projeto completo

Usar apenas quando o projeto local e a fonte correta para substituir o estado da VPS antiga.

Executar a partir da raiz local do projeto:

```bash
rsync -az \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'backend/node_modules/' \
  --exclude 'frontend/node_modules/' \
  --exclude 'dist/' \
  --exclude 'tmp/' \
  --exclude 'backend/storage/' \
  --exclude 'backend/public/live-chat/' \
  --exclude 'deploy/.env' \
  --exclude 'deploy/backups/' \
  --exclude 'backups/' \
  ./ root@135.181.47.46:/opt/uorconnect/
```

Se for mesmo necessario espelhar removendo ficheiros apagados localmente, adicionar `--delete` depois de revisar o `git status` na VPS antiga.

Depois:

```bash
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build'
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps'
```

## Opção C: deploy por Git

Usar apenas se o repositório remoto na VPS antiga estiver limpo ou se as alteracoes locais do servidor ja tiverem sido preservadas.

```bash
ssh root@135.181.47.46 'cd /opt/uorconnect && git status --short && git pull && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build'
```

## Validacao

Se o DNS estiver apontado para a VPS antiga:

```bash
curl -fsS https://api.uorconnect.space/health
curl -I https://uorconnect.space
curl -I https://admin.uorconnect.space
```

Se o DNS continuar na VPS nova, validar pela propria VPS antiga:

```bash
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec -T backend node -e "fetch(\"http://127.0.0.1:3333/health\").then(async r=>{console.log(r.status, await r.text()); process.exit(r.ok?0:1)}).catch(e=>{console.error(e); process.exit(1)})"'
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps'
```

Tambem podes rodar o smoke check local contra os dominios ativos:

```bash
FRONTEND_URL=https://uorconnect.space \
API_URL=https://api.uorconnect.space \
bash deploy/scripts/smoke-check.sh
```

## Rollback rapido

1. Ver logs:

```bash
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=200 backend'
```

2. Recriar a versao anterior que ja esta no servidor, se o codigo remoto ainda estiver bom:

```bash
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build'
```

3. Se a falha envolver banco, restaurar apenas depois de escolher o dump correto:

```bash
ssh root@135.181.47.46 'find /opt/uorconnect -maxdepth 4 -type f -name "*.dump" -o -name "*.sql" | sort | tail'
```

## Checklist final

- [ ] Backup feito antes do deploy.
- [ ] `deploy/.env` nao foi sobrescrito.
- [ ] Containers `backend`, `frontend`, `postgres`, `redis`, `evolution-api` e `caddy` estao `Up` ou `healthy`.
- [ ] Health check do backend respondeu `ok`.
- [ ] Frontend/admin abrem sem erro 5xx.
- [ ] Logs do backend nao mostram erro de schema, CORS ou banco.
