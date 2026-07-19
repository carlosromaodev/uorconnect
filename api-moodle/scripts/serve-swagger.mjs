#!/usr/bin/env node

import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const apiDirectory = join(scriptDirectory, '..');
const swaggerDirectory = join(apiDirectory, 'node_modules', 'swagger-ui-dist');
const documentationPort = Number.parseInt(process.env.SWAGGER_PORT ?? '18080', 10);
const documentationHost = process.env.SWAGGER_HOST ?? '127.0.0.1';

if (!existsSync(swaggerDirectory)) {
  console.error('Swagger UI não está instalado. Execute `npm install` em api-moodle.');
  process.exit(1);
}

if (!Number.isInteger(documentationPort) || documentationPort < 1 || documentationPort > 65535) {
  console.error('SWAGGER_PORT deve ser uma porta TCP válida.');
  process.exit(1);
}

const swaggerAssets = new Map([
  ['/swagger-ui/swagger-ui.css', ['swagger-ui.css', 'text/css; charset=utf-8']],
  ['/swagger-ui/swagger-ui-bundle.js', ['swagger-ui-bundle.js', 'text/javascript; charset=utf-8']],
  ['/swagger-ui/swagger-ui-standalone-preset.js', ['swagger-ui-standalone-preset.js', 'text/javascript; charset=utf-8']],
]);

const indexHtml = `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>API Moodle — UOR Connect</title>
    <link rel="stylesheet" href="/swagger-ui/swagger-ui.css">
    <style>
      body { margin: 0; background: #f6f7f9; }
      .swagger-ui .topbar { background: #172554; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/swagger-ui/swagger-ui-bundle.js"></script>
    <script src="/swagger-ui/swagger-ui-standalone-preset.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
        filter: true,
        persistAuthorization: false,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout'
      });
    </script>
  </body>
</html>`;

function sendText(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function streamFile(response, filePath, contentType) {
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': contentType.startsWith('text/yaml') ? 'no-store' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'text/plain; charset=utf-8', 'Método não permitido.');
    return;
  }

  if (requestUrl.pathname === '/') {
    response.writeHead(302, { Location: '/docs/' });
    response.end();
    return;
  }

  if (requestUrl.pathname === '/docs' || requestUrl.pathname === '/docs/') {
    sendText(response, 200, 'text/html; charset=utf-8', indexHtml);
    return;
  }

  if (requestUrl.pathname === '/openapi.yaml') {
    streamFile(response, join(apiDirectory, 'openapi.yaml'), 'text/yaml; charset=utf-8');
    return;
  }

  if (requestUrl.pathname === '/favicon.ico') {
    response.writeHead(204);
    response.end();
    return;
  }

  const asset = swaggerAssets.get(requestUrl.pathname);
  if (asset) {
    streamFile(response, join(swaggerDirectory, asset[0]), asset[1]);
    return;
  }

  sendText(response, 404, 'text/plain; charset=utf-8', 'Não encontrado.');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${documentationPort} já está em uso. Defina outra com SWAGGER_PORT.`);
    process.exit(1);
  }
  throw error;
});

server.listen(documentationPort, documentationHost, () => {
  console.log(`Swagger UI: http://${documentationHost}:${documentationPort}/docs/`);
});
