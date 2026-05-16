# Configuração de ngrok para Evolution API

Guia para executar a Evolution API atrás de um túnel ngrok durante desenvolvimento local e em produção.

## Por que ngrok?

A Evolution API (WhatsApp) precisa de uma URL pública para webhooks e callbacks. Usar ngrok permite:
- Expor sua API local para a internet
- Receber webhooks do WhatsApp
- Simular produção no desenvolvimento
- Testar integrações WhatsApp

## Opção 1: Setup Rápido (recomendado para desenvolvimento)

### 1. Instale ngrok

```bash
# macOS
brew install ngrok/ngrok/ngrok

# Linux (Ubuntu/Debian)
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok

# Windows (com Chocolatey)
choco install ngrok
```

### 2. Configure authtoken (gratuito em https://ngrok.com)

```bash
ngrok config add-authtoken <seu-token>
```

### 3. Inicie Evolution API + ngrok

```bash
# Terminal 1: Inicie Evolution API
cd "api w"
docker-compose up -d

# Terminal 2: Inicie ngrok e configure automaticamente
cd ..
chmod +x scripts/setup-ngrok.sh
bash scripts/setup-ngrok.sh
```

**Pronto!** O script:
- ✅ Detecta a URL do ngrok automaticamente
- ✅ Atualiza `backend/.env` com `EVOLUTION_API_BASE_URL`
- ✅ Exibe o dashboard em http://localhost:4040

### 4. Use a URL do ngrok

Cada vez que reinicia ngrok, a URL muda. Para obter a URL atual:
```bash
bash scripts/update-ngrok-url.sh
```

---

## Opção 2: Domínio Permanente (recomendado para staging/testes)

Se tiver plano ngrok Pro ou quiser um domínio permanente:

### 1. Reserve um domínio em https://dashboard.ngrok.com/reserved

### 2. Inicie com domínio

```bash
bash scripts/setup-ngrok-domain.sh seu-dominio.ngrok-free.app
```

**Benefício:** O domínio nunca muda, ideal para webhooks persistentes.

---

## Opção 3: Manual (controle total)

Se preferir iniciar ngrok manualmente:

```bash
# Terminal 1: Evolution API
cd "api w"
docker-compose up -d

# Terminal 2: ngrok (detecção automática)
ngrok http 8081

# Terminal 3: Atualize .env do backend com a URL exibida
EVOLUTION_API_BASE_URL=https://seu-url.ngrok-free.dev
```

---

## Verificação Rápida

```bash
# Teste se Evolution API está acessível via ngrok
curl https://seu-url.ngrok-free.dev

# Resposta esperada:
# {"status":200,"message":"Welcome to the Evolution API..."}

# Dashboard do ngrok (logs em tempo real)
open http://localhost:4040
```

---

## Troubleshooting

### ❌ "ngrok não encontrado"
- Instale conforme instruções acima
- Verifique: `ngrok version`

### ❌ "Evolution API não está respondendo"
```bash
# Inicie Evolution API primeiro
cd "api w"
docker-compose up -d
docker-compose logs -f
```

### ❌ "EVOLUTION_API_BASE_URL não atualiza"
```bash
# Atualize manualmente
bash scripts/update-ngrok-url.sh

# Ou edite diretamente
nano backend/.env
# Mude: EVOLUTION_API_BASE_URL=https://seu-url.ngrok-free.dev
```

### ❌ "Webhook não recebe eventos"
- Verifique URL no dashboard ngrok: http://localhost:4040
- Logs dos eventos em tempo real lá

---

## Environment Variables

Arquivo: `backend/.env`

```env
# URL do ngrok (muda cada vez que reinicia sem domínio permanente)
EVOLUTION_API_BASE_URL=https://seu-url.ngrok-free.dev

# Chave da API
EVOLUTION_API_KEY=mude-me
```

**⚠️ Importante:** A chave deve ser a mesma em:
- `backend/.env` (EVOLUTION_API_KEY)
- `api w/.env` (AUTHENTICATION_API_KEY)

---

## Fluxo Completo de Setup

```bash
# 1. Clone/prepare o projeto
git clone ...
cd uorconnect

# 2. Instale ngrok (primeira vez)
# [Siga instruções de instalação acima]

# 3. Configure authtoken (primeira vez)
ngrok config add-authtoken <seu-token>

# 4. Inicie Evolution API
cd "api w"
docker-compose up -d
cd ..

# 5. Inicie ngrok + configure backend
bash scripts/setup-ngrok.sh

# 6. Instale dependências do backend (se não fez)
cd backend
npm install
npm run prisma:prepare:postgres
npm run dev

# 7. Em outro terminal, frontend
cd frontend
npm install
npm run dev

# ✨ Pronto! Acesse http://localhost:8082
```

---

## Opções Avançadas

### Usar ngrok com token em CI/CD

```bash
# Para deployment automático
export NGROK_AUTHTOKEN=<seu-token>
bash scripts/setup-ngrok.sh
```

### Monitorar ngrok em produção

```bash
# Ver logs em tempo real
tail -f /tmp/ngrok.log

# Ver status do túnel
curl http://localhost:4040/api/tunnels

# Formatado
curl http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'
```

### Usar ngrok apenas para testes específicos

```bash
# Se só precisa testar um endpoint, use sem atualizar .env
ngrok http 8081 --inspect=false --log=stdout
```

---

## Referências

- **ngrok Docs:** https://ngrok.com/docs
- **Evolution API:** https://doc.evolution-api.com
- **Dashboard ngrok:** http://localhost:4040

---

**Última atualização:** 10 de maio de 2026
