#!/bin/bash

# Script para iniciar ngrok com domínio customizado (requer ngrok Pro ou pago)
# Uso: ./scripts/setup-ngrok-domain.sh <seu-dominio-ngrok>

set -e

DOMAIN=${1:-""}
NGROK_PORT=8081

if [ -z "$DOMAIN" ]; then
    echo "❌ Domínio do ngrok não fornecido"
    echo ""
    echo "Uso: ./scripts/setup-ngrok-domain.sh seu-dominio.ngrok-free.app"
    echo ""
    echo "Para obter um domínio customizado:"
    echo "  1. Crie conta em https://ngrok.com"
    echo "  2. Acesse https://dashboard.ngrok.com/reserved"
    echo "  3. Reserve um domínio (plano gratuito oferece 1)"
    echo "  4. Configure seu authtoken: ngrok config add-authtoken <token>"
    exit 1
fi

echo "🚀 Iniciando ngrok com domínio: $DOMAIN"
echo ""

# Verifica ngrok
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não encontrado"
    exit 1
fi

# Verifica Evolution API
if ! curl -s "http://localhost:$NGROK_PORT" > /dev/null 2>&1; then
    echo "⚠️  Evolution API não está em localhost:$NGROK_PORT"
    echo "💡 Inicie: cd 'api w' && docker-compose up -d"
fi

# Inicia ngrok com domínio
echo "🌐 Conectando ngrok ao domínio $DOMAIN..."
ngrok http $NGROK_PORT --domain=$DOMAIN &
NGROK_PID=$!

sleep 2

echo ""
echo "📝 Atualizando backend..."
bash ./scripts/update-ngrok-url.sh

echo ""
echo "✅ Configurado com domínio permanente: https://$DOMAIN"
echo "📌 PID: $NGROK_PID"
echo ""
echo "Para parar: kill $NGROK_PID"
