#!/bin/bash

echo "🔍 Testando PWA do UOR Connect..."
echo ""

# Verificar se os arquivos PWA foram gerados
echo "📁 Verificando arquivos PWA:"
if [ -f "dist/manifest.webmanifest" ]; then
    echo "✅ manifest.webmanifest encontrado"
else
    echo "❌ manifest.webmanifest não encontrado"
fi

if [ -f "dist/sw.js" ]; then
    echo "✅ sw.js encontrado"
else
    echo "❌ sw.js não encontrado"
fi

if [ -f "dist/workbox-8c29f6e4.js" ]; then
    echo "✅ workbox encontrado"
else
    echo "❌ workbox não encontrado"
fi

echo ""
echo "🌐 Verificando conteúdo do manifest:"
if [ -f "dist/manifest.webmanifest" ]; then
    cat dist/manifest.webmanifest | jq '.name, .short_name, .start_url, .display'
fi

echo ""
echo "✅ PWA configurado com sucesso!"
echo "📱 Para testar: abra http://localhost:4173 no Chrome/Edge"
echo "💡 O prompt deve aparecer automaticamente após alguns segundos"