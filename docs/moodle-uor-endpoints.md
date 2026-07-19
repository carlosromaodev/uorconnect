# Endpoints Moodle UÓR e API UOR Connect

**Estado:** 12 operações MVP implementadas e documentadas no
[OpenAPI/Swagger](../api-moodle/openapi.yaml).

Base direta do Fastify: `/integrations/moodle`. Em produção, o proxy público pode
acrescentar `/api`, sem mudar os paths do backend.

## Superfícies Moodle observadas

| Área | Origem principal | Estado da integração |
|---|---|---|
| Login | `/login/index.php`, `/my/`, `/user/profile.php` | implementado |
| Disciplinas | AJAX `core_course_get_enrolled_courses_by_timeline_classification`; fallback `/my/courses.php` | implementado |
| Secções/conteúdo | AJAX `core_courseformat_get_state`; fallback `/course/view.php` | implementado |
| Ficheiros | `/mod/resource/view.php`, `/pluginfile.php/...` | proxy controlado implementado |
| Calendário/prazos | `core_calendar_get_action_events_by_timesort` | observado, não implementado |
| Notificações | `message_popup_get_popup_notifications` | observado, não implementado |
| Mensagens | funções `core_message_*` | observado, não implementado |
| Trabalhos/questionários/fóruns | páginas `/mod/assign`, `/mod/quiz`, `/mod/forum` | observado, não implementado |
| Web Service oficial | `/webservice/rest/server.php`, `/login/token.php` | endpoints existem; funções/tokens dependem da TI UÓR |

## Regras comuns

- sessão UOR Connect e estudante UOR ativo obrigatórios;
- `studentId` do token é revalidado na base de dados em cada pedido;
- IDs públicos são UUIDs opacos e cada lookup inclui o proprietário;
- respostas pessoais usam `Cache-Control: private, no-store`;
- nenhum cookie, `sesskey`, token, URL ou ID Moodle atravessa a API;
- totais usam `exact|partial|not_synced|unsupported`;
- paginação usa cursor HMAC ligado ao estudante, coleção, filtro e snapshot;
- upstream incompleto preserva o snapshot anterior como `stale`, sem publicar
  zeros ou apagar silenciosamente dados válidos.

## Operações implementadas

### `POST /session`

Liga ou substitui a conta Moodle.

```json
{
  "username": "<O_PRÓPRIO_STUDENT_NUMBER>",
  "password": "<PASSWORD>",
  "rememberCredentials": true
}
```

O `username` deve ser o próprio número UOR autenticado. Divergência é rejeitada
localmente antes de qualquer pedido Moodle, evitando usar a integração como
oráculo de credenciais. Após login, o perfil upstream é comparado novamente.

Credenciais e sessão são cifradas em envelopes separados. Retorna `201` na
primeira ligação e `200` ao substituir uma ligação. Credenciais inválidas retornam
`422`; identidade divergente, `403`; ligação concorrente, `409`.

### `DELETE /session`

Tenta logout upstream em best effort e purga localmente credenciais, sessão,
snapshots e jobs. É idempotente e a purga local funciona mesmo com a feature flag
desativada ou Moodle indisponível.

### `GET /me`

Retorna UUID público, número académico confirmado, nome, email, timezone e data
da última sincronização do perfil. Não aceita `userId` do cliente.

### `GET /overview`

Retorna estado da ligação, métricas de disciplinas/materiais, cobertura e
progresso quando disponível. Recursos não implementados são marcados
`unsupported`, nunca convertidos em zero.

### `GET /courses`

Lista disciplinas do snapshot publicado.

Parâmetros: `limit` (1–100) e `cursor` assinado. O total é exato apenas quando o
AJAX chegou comprovadamente ao fim e todas as disciplinas foram processadas.

### `GET /courses/:courseId`

Retorna uma disciplina do próprio estudante por UUID UOR Connect. Um UUID
ausente ou de outro proprietário produz o mesmo `404`.

### `GET /courses/:courseId/sections`

Lista secções ordenadas. No MVP, `modules` contém apenas materiais persistidos da
secção; não promete fóruns, trabalhos ou questionários.

Parâmetros: `limit` e `cursor` ligado àquela disciplina.

### `GET /courses/:courseId/materials`

Lista materiais de uma disciplina. Atividades Moodle (`assign`, `quiz`, `forum`)
não entram na lista nem no total de materiais.

### `GET /materials`

Lista materiais de todas as disciplinas no snapshot ativo, com paginação opaca e
cobertura explícita.

### `GET /materials/:materialId/open`

Abre somente um locator previamente sincronizado e cifrado. O cliente nunca envia
URL. O gateway aceita apenas origem Moodle, tipos passivos permitidos, limites de
tamanho e `Range` válido. A resposta é sempre attachment com `nosniff`, CSP
sandbox e nome RFC 5987; suporta `200` e `206`.

### `POST /sync`

Cria ou reutiliza uma sincronização durável e retorna `202`. Limite inicial: três
pedidos por dez minutos por estudante e IP. Só existe um job ativo por ligação.

### `GET /sync/status`

Retorna a execução mais recente com estado `QUEUED`, `RUNNING`, `COMPLETED`,
`PARTIAL`, `FAILED` ou `CANCELLED`, além de cobertura e erro seguro.

## Envelope de erro

```json
{
  "error": {
    "code": "MOODLE_CONNECTION_REQUIRED",
    "message": "Liga a tua conta Moodle para continuar.",
    "retryable": false,
    "actionRequired": "connect"
  },
  "meta": { "requestId": "req-1" }
}
```

Códigos documentados incluem erros de autenticação UOR/CSRF, pedido inválido,
credenciais, identidade, ligação, recurso, cursor/snapshot, rate limit, tipo de
material, indisponibilidade, mudança upstream e configuração operacional.

## Roadmap não implementado

Atividades, trabalhos, questionários, calendário, prazos, notificações,
mensagens, fóruns, progresso por atividade e resultados pedagógicos permanecem
fora do Swagger executável. A exploração técnica destas fontes está no
[relatório principal](./moodle-uor-api-analysis.md); ela não constitui promessa
de endpoint.
