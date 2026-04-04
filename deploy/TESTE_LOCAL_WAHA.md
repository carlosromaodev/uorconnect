# Teste Local WAHA + n8n

## Problema Identificado

O motor GOWS está a falhar com erro `websocket: close 1006 (abnormal closure)`. Isto pode ser:
- Firewall bloqueando conexão aos servidores WhatsApp
- Bug na versão atual do GOWS
- Problema de rede/DNS

## Solução: Testar com WEBJS

O motor WEBJS é mais estável e maduro. Já ajustei a configuração local para usar WEBJS.

## Passos para Teste Limpo

### 1. Matar processos travados

```bash
sudo kill -9 171826 171827 172122 172225
```

### 2. Limpar containers e volumes

```bash
docker container prune -f
docker volume rm deploy_waha_sessions deploy_waha_media
```

### 3. Subir stack limpa com WEBJS

```bash
cd /home/cr/Documentos/Documents/coding/uorProject

docker-compose \
  -f deploy/docker-compose.automation.yml \
  -f deploy/docker-compose.automation.local.yml \
  --env-file deploy/.env.automation.local \
  up -d
```

### 4. Verificar logs do WAHA

```bash
docker-compose \
  -f deploy/docker-compose.automation.yml \
  -f deploy/docker-compose.automation.local.yml \
  --env-file deploy/.env.automation.local \
  logs -f waha
```

### 5. Criar sessão WhatsApp

```bash
# Criar sessão
curl -X POST http://127.0.0.1:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name":"default","start":true}'

# Aguardar 5 segundos
sleep 5

# Ver estado
curl http://127.0.0.1:3000/api/sessions/default
```

### 6. Obter QR Code

Com WEBJS, o QR deve aparecer nos logs. Também podes tentar:

```bash
# Método 1: Ver nos logs
docker-compose \
  -f deploy/docker-compose.automation.yml \
  -f deploy/docker-compose.automation.local.yml \
  --env-file deploy/.env.automation.local \
  logs waha | grep -A 20 "QR"

# Método 2: API
curl http://127.0.0.1:3000/api/sessions/default/auth/qr

# Método 3: Dashboard
# Abrir http://127.0.0.1:3000
# Login: admin / change-me-strong-password
```

## Diferenças WEBJS vs GOWS

| Característica | WEBJS | GOWS |
|----------------|-------|------|
| Estabilidade | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Performance | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Recursos | Mais pesado | Mais leve |
| Maturidade | Muito maduro | Mais recente |
| QR Code | Sempre funciona | Pode falhar |

## Estados Esperados

1. **STOPPED** → Sessão criada mas não iniciada
2. **STARTING** → A iniciar motor WhatsApp
3. **SCAN_QR_CODE** → Aguardando leitura do QR
4. **WORKING** → Conectado e funcional
5. **FAILED** → Erro (não deve acontecer com WEBJS)

## Troubleshooting

### Se continuar FAILED com WEBJS

1. Verificar se há firewall bloqueando:
```bash
# Testar conectividade aos servidores WhatsApp
curl -v https://web.whatsapp.com
```

2. Tentar com imagem específica do WAHA:
```bash
# No docker-compose.automation.local.yml, trocar:
# image: devlikeapro/waha:latest
# por:
# image: devlikeapro/waha:2024.10
```

3. Verificar logs completos:
```bash
docker logs deploy-waha-1 --tail=200
```

### Se o QR não aparecer

1. Verificar se WAHA_PRINT_QR está ativo nos logs
2. Tentar obter via API: `/api/sessions/default/auth/qr`
3. Abrir dashboard: http://127.0.0.1:3000

## Próximos Passos (depois de conectar)

1. Ativar webhook para n8n
2. Criar primeiro workflow no n8n
3. Testar envio de mensagem
4. Integrar com backend UOR Connect
