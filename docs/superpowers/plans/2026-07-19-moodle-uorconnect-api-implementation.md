# Implementação da API Moodle → UOR Connect

## Referência

Implementar a especificação aprovada em `docs/superpowers/specs/2026-07-19-moodle-uorconnect-api-integration-design.md` sem expor credenciais, sessões, IDs ou URLs Moodle.

## Sequência

### 1. Fundação e configuração

- Adicionar configuração Moodle tipada em `backend/src/config/env.ts` e placeholders em `backend/.env.example`.
- Tipar `AppDependencies` e encaminhar dependências Moodle no registo de rotas.
- Criar domínio de erros, modelos, gateway e repositório injetáveis.
- Garantir redaction de campos sensíveis no logger.

Verificação: testes de env e `npm run lint`.

### 2. Persistência e cifragem

- Adicionar `MoodleConnection`, `MoodleEntityRef`, snapshots versionados e `MoodleSyncRun` ao Prisma.
- Gerar schema deploy PostgreSQL e client.
- Implementar AES-256-GCM com keyring, AAD e rotação na leitura.
- Implementar tombstone, gerações, CAS de ligação, lease de reauth e ponteiro de sync ativo.

Verificação: testes de tamper/rotação, isolamento por estudante e corridas CAS.

### 3. Gateway Moodle

- Implementar cookie jar isolado e serializável.
- Implementar login web com página personalizada e `logintoken` opcional.
- Validar sessão por identidade autenticada, não apenas status HTTP.
- Obter perfil, cursos, secções e materiais com AJAX validado e fallback HTML.
- Normalizar texto, progresso e locators sem expor dados upstream.

Verificação: fixtures anonimizadas e fetch mockado para login, expiração, upstream alterado e timeout.

### 4. Aplicação e sincronização

- Implementar ligar/desligar, sessão L1, single-flight e reauth automática.
- Implementar fila embutida, lease/heartbeat/reclaim e `activeSyncRunId` idempotente.
- Gravar staging por `snapshotVersion` e publicar ponteiro atomicamente.
- Calcular contagens `exact|partial|not_synced|unsupported` e cobertura.

Verificação: concorrência local, worker antigo após logout, sync duplicado e snapshot estável.

### 5. HTTP e segurança

- Registar `/integrations/moodle` com `authGuard` e pre-handler de estudante UOR ativo.
- Implementar session, me, overview, courses, sections, materials, open e sync/status.
- Usar cursor assinado, ownership em todo lookup, respostas `private, no-store` e erros seguros.
- Fazer proxy apenas de ficheiros permitidos, sempre attachment, sem redirects/HTML/headers upstream.

Verificação: `app.inject` para auth, IDOR, códigos de erro, headers, paginação e ausência de segredos.

### 6. OpenAPI/Swagger

- Corrigir servers e paths.
- Adicionar exemplos 2xx, totais, cobertura, progresso anulável e schemas de erro.
- Remover `sourceUrl`, IDs Moodle e placeholders ruidosos.
- Marcar como `implemented` apenas rotas reais ligadas no composition root.

Verificação: Redocly, exemplos contra schemas e teste de paridade com rotas.

### 7. Verificação final

- Executar testes Moodle focados.
- Executar suite backend proporcional, `npm run lint` e `npm run build`.
- Validar Prisma SQLite temporário e schema PostgreSQL gerado.
- Iniciar backend local com integração desabilitada e testar health/rotas protegidas.
- Rever diff para preservar alterações preexistentes e remover artefactos temporários.

## Critério de conclusão

Todos os endpoints MVP existem, o contrato Swagger corresponde às rotas, a sessão cifrada renova automaticamente sem corridas conhecidas, snapshots não misturam versões, dados de outro estudante não são acessíveis e as verificações automatizadas passam ou têm bloqueio externo documentado com evidência.
