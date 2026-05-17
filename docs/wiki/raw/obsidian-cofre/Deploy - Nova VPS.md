# Deploy - Nova VPS

Esta nota reúne o procedimento operacional atual para trabalhar com a nova VPS do UOR Connect.

## Dados principais

- VPS: `178.105.109.96`
- SSH: `root@178.105.109.96`
- Caminho do projeto: `/opt/uorconnect`
- Compose de produção: `/opt/uorconnect/deploy/docker-compose.prod.yml`
- Ambiente de produção: `/opt/uorconnect/deploy/.env`
- API: `https://api.uorconnect.space`
- Site: `https://uorconnect.space`
- Admin: `https://admin.uorconnect.space`

## Health check

```bash
curl -fsS https://api.uorconnect.space/health
```

Resposta esperada:

```json
{"status":"ok"}
```

## Ver containers

```bash
ssh root@178.105.109.96 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps'
```

## Ver logs do backend

```bash
ssh root@178.105.109.96 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs --tail=120 backend'
```

## Deploy backend por arquivos locais

Usado quando uma correção local precisa subir rapidamente sem refazer todo o projeto.

```bash
rsync -av backend/package.json backend/package-lock.json root@178.105.109.96:/opt/uorconnect/backend/
rsync -av backend/src/modules/reports/http/reports.routes.ts backend/src/modules/reports/http/reports-overview-pdf.spec.ts backend/src/modules/reports/http/report-calculations.ts backend/src/modules/reports/http/report-calculations.spec.ts root@178.105.109.96:/opt/uorconnect/backend/src/modules/reports/http/
ssh root@178.105.109.96 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env build backend && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d backend'
```

Depois do deploy:

```bash
curl -fsS https://api.uorconnect.space/health
```

## Deploy completo por Git

Quando o repositório remoto estiver com a versão final:

```bash
ssh root@178.105.109.96
cd /opt/uorconnect
git pull
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d
```

## Banco de dados

O banco roda dentro do Docker Compose de produção.

Backup manual:

```bash
ssh root@178.105.109.96 '/opt/uorconnect/scripts/backup-postgres.sh'
```

Backups automáticos:

- Agendados diariamente às `02:15`.
- Guardados no servidor, conforme configuração do script de backup.

## Último deploy registado

Data: 2026-05-12

Conteúdo:

- Correções do relatório geral da admin.
- Novo módulo de cálculos com `decimal.js`.
- Testes de cálculo e PDF.
- Build do backend em produção.

Resultado:

- Backend recriado.
- Container ficou `healthy`.
- API respondeu `{"status":"ok"}`.
