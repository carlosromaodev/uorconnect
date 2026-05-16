#!/bin/bash

# Script para iniciar ngrok e configurar automaticamente o backend
# Uso: ./scripts/setup-ngrok.sh

set -e

NGROK_PORT=8081
NGROK_REGION="us"  # Altere para "eu", "au", "ap", etc. conforme sua região

echo "🚀 Iniciando Evolution API com ngrok..."
echo ""

# Verifica se ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não encontrado"
    echo "📥 Instale ngrok de: https://ngrok.com/download"
    echo ""
    echo "Depois, configure seu authtoken:"
    echo "  ngrok config add-authtoken <seu-token>"
    exit 1
fi

# Verifica se Evolution API está rodando
echo "🔍 Verificando Evolution API em http://localhost:$NGROK_PORT..."
if ! curl -s "http://localhost:$NGROK_PORT" > /dev/null 2>&1; then
    echo "⚠️  Evolution API não está respondendo em localhost:$NGROK_PORT"
    echo "💡 Inicie a Evolution API primeiro:"
    echo "   cd 'api w' && docker-compose up -d"
    echo ""
    read -p "Pressione Enter para continuar mesmo assim (risco de falha)..."
fi

echo "🌐 Iniciando ngrok em http://localhost:$NGROK_PORT..."
echo ""

# Inicia ngrok em background e captura o PID
ngrok http $NGROK_PORT --region=$NGROK_REGION > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

echo "📌 PID do ngrok: $NGROK_PID"
echo "📊 Dashboard do ngrok: http://localhost:4040"
echo ""

# Aguarda ngrok iniciar (máximo 10 segundos)
echo "⏳ Aguardando ngrok inicializar..."
sleep 2

# Atualiza a URL no .env do backend
echo ""
echo "🔄 Atualizando configuração do backend..."
bash ./scripts/update-ngrok-url.sh

echo ""
echo "✨ Setup completo! ngrok rodando como PID $NGROK_PID"
echo ""
echo "📌 Para parar ngrok:"
echo "   kill $NGROK_PID"
echo ""
echo "💡 Dicas:"
echo "   - Dashboard: http://localhost:4040"
echo "   - Logs: tail -f /tmp/ngrok.log"
echo "   - URL muda sempre que ngrok reinicia"
echo ""
