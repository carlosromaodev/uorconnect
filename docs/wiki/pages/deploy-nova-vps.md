# Deploy na Nova VPS

Status: ativo
Última atualização: 2026-05-17
Fontes principais: `raw/obsidian-cofre/Deploy - Nova VPS.md`, `docs/DEPLOY_NOVA_VPS.md`, `DEPLOY_VPS_ONLY.md`

## Dados Principais

- VPS: `178.105.109.96`
- SSH: `root@178.105.109.96`
- Projeto: `/opt/uorconnect`
- Compose: `/opt/uorconnect/deploy/docker-compose.prod.yml`
- Ambiente: `/opt/uorconnect/deploy/.env`
- API: `https://api.uorconnect.space`
- Site: `https://uorconnect.space`
- Admin: `https://admin.uorconnect.space`

## Health Check

```bash
curl -fsS https://api.uorconnect.space/health
```

Resposta esperada:

```json
{"status":"ok"}
```

## Ver Containers

```bash
ssh root@178.105.109.96 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps'
```

## Ver Logs do Backend

```bash
ssh root@178.105.109.96 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=120 backend'
```

## Fluxo Recomendado

1. Garantir commit local e push para GitHub.
2. Fazer backup do Postgres antes de alterações de schema.
3. Sincronizar ou puxar código na VPS.
4. Recriar containers com Docker Compose.
5. Confirmar containers `healthy`.
6. Executar smoke check público.

## Cuidado Com Banco de Dados

Antes de deploys que alteram Prisma schema, fazer backup:

```bash
ssh root@178.105.109.96 'APP_ROOT=/opt/uorconnect /opt/uorconnect/deploy/scripts/backup-postgres.sh'
```

Nunca forçar migração com perda de dados sem verificar duplicados, constraints e impacto real.

## Fonte Bruta

Ver nota original preservada em [`raw/obsidian-cofre/Deploy - Nova VPS.md`](../raw/obsidian-cofre/Deploy%20-%20Nova%20VPS.md).
