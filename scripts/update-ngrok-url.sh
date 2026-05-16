#!/bin/bash

# Script para atualizar automaticamente a URL do ngrok no .env do backend
# Detecta a URL atual do ngrok via API e atualiza EVOLUTION_API_BASE_URL

set -e

BACKEND_ENV="./backend/.env"
NGROK_API_URL="http://localhost:4040/api/tunnels"
TIMEOUT=10

echo "🔍 Detectando URL do ngrok..."

# Tenta detectar a URL do ngrok via API local
if ! command -v curl &> /dev/null; then
    echo "❌ curl não encontrado. Instale com: sudo apt-get install curl"
    exit 1
fi

# Aguarda o ngrok ficar disponível (até 10 segundos)
NGROK_URL=""
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    if RESPONSE=$(curl -s "$NGROK_API_URL" 2>/dev/null); then
        NGROK_URL=$(echo "$RESPONSE" | grep -o 'http[s]*://[^"]*ngrok[^"]*' | head -1)
        if [ -n "$NGROK_URL" ]; then
            echo "✅ URL do ngrok detectada: $NGROK_URL"
            break
        fi
    fi
    echo "⏳ Aguardando ngrok (${ELAPSED}s/${TIMEOUT}s)..."
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

if [ -z "$NGROK_URL" ]; then
    echo "❌ Não foi possível detectar ngrok em $NGROK_API_URL"
    echo "💡 Certifique-se que:"
    echo "   1. ngrok está rodando com: ngrok http 8081"
    echo "   2. ngrok está acessível em http://localhost:4040"
    exit 1
fi

# Remove trailing slash
NGROK_URL="${NGROK_URL%/}"

# Verifica se o arquivo existe
if [ ! -f "$BACKEND_ENV" ]; then
    echo "❌ Arquivo $BACKEND_ENV não encontrado"
    exit 1
fi

# Atualiza ou cria a linha EVOLUTION_API_BASE_URL
if grep -q "^EVOLUTION_API_BASE_URL=" "$BACKEND_ENV"; then
    sed -i "s|^EVOLUTION_API_BASE_URL=.*|EVOLUTION_API_BASE_URL=$NGROK_URL|" "$BACKEND_ENV"
    echo "✅ EVOLUTION_API_BASE_URL atualizado em $BACKEND_ENV"
else
    echo "EVOLUTION_API_BASE_URL=$NGROK_URL" >> "$BACKEND_ENV"
    echo "✅ EVOLUTION_API_BASE_URL adicionado a $BACKEND_ENV"
fi

# Exibe o valor atualizado
echo ""
echo "📝 Configuração atual:"
grep "^EVOLUTION_API_BASE_URL=" "$BACKEND_ENV"
echo ""
echo "✨ Pronto! A Evolution API está acessível em: $NGROK_URL"
