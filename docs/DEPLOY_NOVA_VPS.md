# Deploy na Nova VPS

Este guia descreve como publicar novas atualizacoes do projeto na VPS nova.

## Dados da VPS

- IP: `178.105.109.96`
- SSH: `root@178.105.109.96`
- Pasta do projeto: `/opt/uorconnect`
- Compose de producao: `/opt/uorconnect/deploy/docker-compose.prod.yml`
- Env de producao: `/opt/uorconnect/deploy/.env`

Nao colocar segredos neste ficheiro. O `.env` de producao deve ficar apenas na VPS.

## Antes de publicar

1. Confirmar que a alteracao local esta pronta.
2. Rodar testes/build local quando possivel.
3. Fazer backup na VPS:

```bash
ssh root@178.105.109.96 'APP_ROOT=/opt/uorconnect /opt/uorconnect/deploy/scripts/backup-postgres.sh'
```

4. Confirmar que o backup foi criado:

```bash
ssh root@178.105.109.96 'ls -lh /opt/uorconnect/backups/postgres | tail'
```

## Sincronizar o codigo local

Executar a partir da raiz do projeto local:

```bash
rsync -az --delete \
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
  ./ root@178.105.109.96:/opt/uorconnect/
```

O `--delete` remove da VPS ficheiros que foram removidos localmente. Por isso, confere sempre se a alteracao local e mesmo a fonte correta antes de correr o comando.

## Subir a atualizacao

Na VPS:

```bash
ssh root@178.105.109.96 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build'
```

Verificar containers:

```bash
ssh root@178.105.109.96 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps'
```

## Validar depois do deploy

Smoke publico:

```bash
FRONTEND_URL=https://uorconnect.space \
API_URL=https://api.uorconnect.space \
bash deploy/scripts/smoke-check.sh
```

Checks rapidos:

```bash
curl -fsS https://api.uorconnect.space/health
curl -I https://uorconnect.space
curl -I https://admin.uorconnect.space
```

## Rollback rapido

Se a nova versao falhar:

1. Entrar na VPS:

```bash
ssh root@178.105.109.96
```

2. Ver logs:

```bash
cd /opt/uorconnect
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=120 backend
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=120 frontend
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=120 caddy
```

3. Restaurar o dump mais recente se a falha envolver dados:

```bash
APP_ROOT=/opt/uorconnect /opt/uorconnect/deploy/scripts/restore-postgres.sh /opt/uorconnect/backups/postgres/postgres-YYYY-MM-DD-HHMMSS.dump
```

4. Reiniciar:

```bash
cd /opt/uorconnect
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
```

## Notas importantes

- O DNS atual aponta para `178.105.109.96`.
- O backup automatico roda diariamente as `02:15`.
- O subdominio `laboratorio.uorconnect.space` foi mantido como redirect para `https://uorconnect.space/minha-area?tab=desafio`.
- Nao copiar `deploy/.env` local para a VPS; manter o ficheiro real da producao no servidor.
