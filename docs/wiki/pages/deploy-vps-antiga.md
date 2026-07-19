# Deploy na VPS Antiga

Status: fallback historico
Ultima atualizacao: 2026-05-27
Fonte principal: `docs/DEPLOY_VPS_ANTIGA.md`

## Dados Principais

- VPS antiga: `135.181.47.46`
- SSH: `root@135.181.47.46`
- Projeto: `/opt/uorconnect`
- Compose: `/opt/uorconnect/deploy/docker-compose.prod.yml`
- Ambiente: `/opt/uorconnect/deploy/.env`
- VPS principal atual: `178.105.109.96`

## Uso Recomendado

Usar a VPS antiga apenas para fallback, recuperacao de dados, comparacao de estado anterior ou publicacao temporaria. O DNS principal atual aponta para a nova VPS, por isso a validacao publica so prova a VPS antiga se o DNS tiver sido mudado.

## Comandos Base

Ver estado:

```bash
ssh root@135.181.47.46 'cd /opt/uorconnect && git status --short && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps'
```

Backup:

```bash
ssh root@135.181.47.46 'APP_ROOT=/opt/uorconnect /opt/uorconnect/deploy/scripts/backup-postgres.sh'
```

Subir stack:

```bash
ssh root@135.181.47.46 'cd /opt/uorconnect && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build'
```

## Cuidados

- Nao copiar `deploy/.env` local para a VPS.
- Antes de `git pull` ou `rsync --delete`, confirmar se a VPS antiga nao tem alteracoes locais que precisam ser preservadas.
- Preferir deploy seletivo por pacote quando a mudanca for pequena.

## Guia Completo

Ver [`docs/DEPLOY_VPS_ANTIGA.md`](../../DEPLOY_VPS_ANTIGA.md).
