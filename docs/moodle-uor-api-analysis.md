# Análise Técnica do Moodle UÓR para API

```yaml
document_id: UOR-MOODLE-ANALYSIS
status: approved
owner: Integrações UOR Estudante
authority: informative
version: 1.0
last_reviewed: 2026-07-21
depends_on:
  - vision/uor-connect-v2/SDD-002-UOR-ESTUDANTE.md
  - vision/uor-connect-v2/adrs/ADR-005-INTEGRACOES-EXTERNAS.md
```

**Data da observação:** 18 de julho de 2026

**Origem:** `https://moodle.uor.edu.ao/`

**Modo:** conta de estudante autorizada, navegação não destrutiva e somente leitura

**Estado:** análise concluída e MVP implementado atrás de feature flag; ativação
de produção requer keyring operacional, migração e validação institucional.

Nenhuma palavra-passe, cookie, `sesskey`, token, QR code, email, nome completo ou
ID real de utilizador foi gravado neste relatório. As rotas usam marcadores como
`<USER_ID>`, `<COURSE_ID>` e `<SESSKEY>`.

## 1. Resumo executivo

O Moodle UÓR expõe três superfícies úteis:

1. Web Services REST e emissão de token existem como endpoints, mas a conta de
   estudante não pode consultar a documentação administrativa e não foi criado
   token. A disponibilidade de funções precisa de confirmação da UÓR.
2. A interface usa AJAX estruturado em `/lib/ajax/service.php`, com funções de
   cursos, calendário, notificações, mensagens, recentes e estado de disciplina.
3. Páginas HTML autenticadas fornecem detalhes de perfil, secções, materiais,
   trabalhos, testes, fóruns, progresso e resultados pedagógicos.

A integração é viável em modo de leitura. A arquitetura recomendada é: serviço
Web Service oficial para a UOR Estudante com escopos mínimos; AJAX como fallback temporário;
HTML apenas onde não houver fonte estruturada. Na modalidade A+B aprovada, a
palavra-passe só existe em envelope AES-256-GCM no backend enquanto a ligação
estiver ativa; nunca aparece em texto simples, logs, frontend ou documentação.
Notas Moodle são resultados pedagógicos provisórios e não substituem a Secretaria.

## 2. Escopo e autorização

Foram executados login/logout, leitura do painel, cursos, três disciplinas
representativas, calendário, notificações, mensagens, perfil, pauta Moodle,
ficheiros privados sem upload, preferências e um exemplo de fórum, recurso PDF,
trabalho, questionário e URL externa.

Não foram executados: submissão, tentativa de quiz, postagem, mensagem, alteração
de perfil/preferência, upload, inscrição, exploração de vulnerabilidade, acesso a
outro estudante, varrimento ou download em massa.

## 3. Fluxo de autenticação

```text
GET /login/index.php -> 303 /home -> 301 /home/ -> 200 formulário
POST /login/index.php (username, password)
  -> 303 /login/index.php?testsession=<USER_ID>
  -> 200 /my/
```

O formulário personalizado possui apenas `username` e `password`; `logintoken`
não foi observado. O sucesso deve ser validado pela URL final, painel e
configuração Moodle, não apenas pelo status `200`.

Detalhes: [moodle-uor-authentication.md](./moodle-uor-authentication.md).

## 4. Cookies, tokens e sessão

- `MoodleSession`: cookie de sessão, `Secure`, `SameSite=None`; `HttpOnly` não
  apareceu na observação.
- `MOODLEID1_`: cookie persistente de memória do identificador; desnecessário à
  integração.
- `M.cfg.sesskey` existe após login.
- formulários mutáveis e logout usam `sesskey`.
- AJAX autenticado usa cookie + `sesskey`.
- REST oficial usa `wstoken`, não a sessão web.

O backend deve isolar e cifrar sessões temporárias; frontend e logs nunca recebem
cookie, `sesskey`, password ou token.

## 5. Mapa completo de URLs

Rotas principais confirmadas:

| Domínio | Rotas |
|---|---|
| Login/painel | `/home/`, `/login/index.php`, `/my/`, `/my/courses.php` |
| Curso | `/course/view.php`, `/course/section.php`, `/course/overview.php`, `/course/index.php` |
| Atividades | `/mod/forum/view.php`, `/mod/resource/view.php`, `/mod/assign/view.php`, `/mod/quiz/view.php`, `/mod/url/view.php` |
| Ficheiros | `/pluginfile.php/...`, `/user/files.php` |
| Agenda | `/calendar/view.php`, `/calendar/managesubscriptions.php` |
| Comunicação | `/message/output/popup/notifications.php`, `/message/index.php`, `/message/notificationpreferences.php` |
| Utilizador | `/user/profile.php`, `/user/preferences.php` |
| Resultados | `/grade/report/overview/index.php`, `/grade/report/index.php` |
| Serviços | `/lib/ajax/service.php`, `/lib/ajax/service-nologin.php`, `/webservice/rest/server.php`, `/login/token.php` |

Métodos, parâmetros e respostas: [moodle-uor-endpoints.md](./moodle-uor-endpoints.md).

## 6. Pedidos de rede

O padrão AJAX autenticado é:

```text
POST /lib/ajax/service.php?sesskey=<SESSKEY>&info=<FUNCTION>
Content-Type: application/json
Cookie: MoodleSession=<SESSION_COOKIE>

[{"index":0,"methodname":"<FUNCTION>","args":{}}]
```

Resposta:

```json
[
  {
    "error": false,
    "data": {}
  }
]
```

Chamadas úteis confirmadas:

- `core_course_get_enrolled_courses_by_timeline_classification`;
- `core_courseformat_get_state`;
- `core_calendar_get_action_events_by_timesort`;
- `block_recentlyaccesseditems_get_recent_items`;
- `message_popup_get_popup_notifications`;
- `core_message_get_conversation_counts`;
- `core_message_get_unread_conversation_counts`;
- `core_message_get_conversations`.

As respostas autenticadas foram JSON `200` com `Cache-Control: no-store,
no-cache, must-revalidate`.

## 7. APIs e Web Services encontrados

| Mecanismo | Observação | Conclusão |
|---|---|---|
| `/webservice/rest/server.php` | `200 application/xml`, erro `invalidtoken` sem token | REST endpoint presente |
| `/login/token.php` | `200 application/json`, `missingparam` sem username | emissão endpoint presente; serviço/capacidade desconhecidos |
| API docs administrativa | acesso negado/404 ao estudante | requer admin |
| Mobile app/QR no perfil | opção visível | forte indício de serviço móvel, não prova de emissão autorizada |
| `/lib/ajax/service.php` | múltiplas funções `core_*`/plugin confirmadas | funcional, mas contrato interno |

Não foi solicitada emissão de token para evitar criar credencial persistente sem
confirmação institucional.

## 8. Estrutura de dados

A normalização cobre `Student`, `Course`, `Section`, `Material`, `Activity`,
`Assignment`, `Quiz`, `CalendarEvent`, `Notification`, `Conversation`,
`Completion` e `PedagogicalResult`.

Ver schemas e mapeamento de campos em
[moodle-uor-data-model.md](./moodle-uor-data-model.md).

## 9. Utilizador

O perfil torna disponíveis ID interno, identificador académico usado no login,
nome, email, país, cidade, timezone, disciplinas, primeiro/último acesso e opção
de aplicação móvel. A API deve devolver apenas os campos mínimos do próprio
estudante e nunca aceitar um `userId` arbitrário.

## 10. Cursos e disciplinas

O AJAX de cursos suporta:

- `offset`/`limit` e `nextoffset`;
- classificação (`inprogress` e outras usadas pelo componente);
- ordenação;
- filtros por custom field;
- nome, shortname, categoria, resumo, datas, visibilidade, imagem, favorito,
  oculto pelo estudante e progresso.

A página observada ofereceu filtros: todas, a decorrer, por iniciar, histórico,
com estrela e removidas da visualização, além de pesquisa, ordenação e modos de
visualização. Foram identificadas dezenas de inscrições na conta de teste; não é
adequado consultar detalhe de todas a cada sincronização.

## 11. Secções e módulos

`/course/view.php?id=<COURSE_ID>` expõe secções ordenadas e links para módulos.
`core_courseformat_get_state(courseid)` devolve estado estruturado dentro de uma
string JSON. Nas amostras foram observadas disciplinas com secções temáticas e
módulos `forum`, `resource`, `assign`, `quiz` e `url`.

O parser deve preservar ordem, visibilidade, disponibilidade, restrições,
conclusão, datas, ID de secção e `cmid`.

## 12. Materiais

Recursos `mod/resource` podem responder `303` para `pluginfile.php`, que devolve
o binário com MIME correto; foi confirmado um PDF sem download em massa. URLs
externas usam `mod/url` e mostram o destino na página.

Tipos previstos: ficheiro, pasta, página, livro, URL, imagem, vídeo, áudio, SCORM,
H5P, LTI e outros. Nem todos apareceram nas três amostras; devem ser suportados
por adapter extensível, não alegados como observados.

## 13. Atividades

Campos comuns disponíveis: título, tipo, disciplina, secção, abertura, fecho,
prazo, disponibilidade, restrições, conclusão e URL. A visão da disciplina já
inclui muitas datas e tipos, evitando abrir cada detalhe em toda sincronização.

## 14. Trabalhos

Em `mod/assign/view.php` foram observados:

- abertura e data limite;
- tentativa atual e máximo permitido;
- estado de submissão;
- estado de avaliação;
- tempo restante/atraso;
- anexos/instruções;
- navegação para atividades adjacentes.

Estes dados foram observados para uma fase posterior. O MVP atual não expõe
endpoints de trabalhos; submissão permanece sempre no Moodle.

## 15. Testes

Em `mod/quiz/view.php` foram observados abertura, fecho, tentativas permitidas e
método de avaliação. A página foi apenas consultada; nenhuma tentativa foi
iniciada. Endpoints de questionários continuam no roadmap e não aparecem como
operações implementadas no Swagger.

## 16. Calendário

O calendário tem vistas por mês/dia/próximos eventos, filtro por disciplina,
navegação temporal e gestão de assinaturas. A função AJAX aceita janela Unix e
limite, devolvendo `events`, `firstid` e `lastid`. Datas devem ser normalizadas em
UTC com timezone de origem `Africa/Luanda`.

## 17. Notificações

`message_popup_get_popup_notifications` aceita `limit`, `offset` e o próprio
utilizador; devolve `notifications[]` e `unreadcount`. Na observação, a conta não
tinha notificações. A Fase 1 não marca como lida.

## 18. Mensagens

Foram observadas contagens por tipo/favoritos/não lidas e paginação de conversas.
Conversas podem incluir membros e mensagens, tornando o recurso altamente
sensível. Prioridade Fase 2, somente leitura e retenção mínima. Envio, delete,
bloqueio, favorito e mute ficam proibidos.

## 19. Progresso

A listagem de cursos devolve `progress` e `hasprogress`. Quando
`hasprogress=false`, a API usa `available=false`, não 0%. Conclusão por atividade
deve preferir funções oficiais; estado/HTML da disciplina são fallback.

## 20. Dados úteis para a UOR Connect

Prioridade alta: disciplinas, secções, materiais, trabalhos, testes, calendário,
prazos, progresso e notificações. Prioridade média: feedback, fóruns, mensagens e
downloads offline controlados.

O mapeamento completo está em
[moodle-uor-uorconnect-mapping.md](./moodle-uor-uorconnect-mapping.md).

## 21. Dados que não devem ser tratados como oficiais

- notas/avaliações Moodle;
- progresso e conclusão Moodle;
- inscrição visível no Moodle como prova de matrícula;
- dados de contacto Moodle como cadastro mestre;
- qualquer informação financeira.

Resultados Moodle devem mostrar: **“Resultado pedagógico do Moodle. Não
corresponde necessariamente à nota oficial da Secretaria.”**

## 22. Comparação entre API oficial, AJAX e scraping

| Estratégia | Segurança | Estabilidade | Custo | Uso |
|---|---|---|---|---|
| Web Service oficial | Alta | Alta | Médio inicial/baixo contínuo | produção |
| Serviço oficial da app | Alta | Alta | Médio | produção se autorizado |
| AJAX interno | Média | Média/baixa | Médio | fallback somente leitura |
| HTML autenticado | Média/baixa | Baixa | Alto contínuo | último recurso |

## 23. Arquitetura implementada no MVP

```text
UOR Estudante
  -> API UOR Connect (auth, autorização, rate limit)
     -> cache normalizada + estado stale
     -> fila de sincronização
     -> MoodleAdapter
        -> WebSessionMoodleGateway
           -> AJAX interno somente leitura
           -> HTML autenticado como fallback
        -. evolução futura .-> OfficialWebServiceMoodleGateway
     -> Moodle UÓR
```

Operações do adapter são tipadas. Existe apenas um proxy controlado por UUID em
`/materials/:materialId/open`; não existe entrada de URL Moodle arbitrária.

## 24. Endpoints implementados da API UOR Connect

Base Fastify `/integrations/moodle` (um proxy público pode acrescentar `/api`):

```text
POST   /session
DELETE /session
GET    /me
GET    /overview
GET    /courses
GET    /courses/:courseId
GET    /courses/:courseId/sections
GET    /courses/:courseId/materials
GET    /materials
GET    /materials/:materialId/open
GET    /sync/status
POST   /sync
```

Atividades, trabalhos, questionários, calendário, notificações e mensagens
continuam catalogados para fases posteriores, mas não são apresentados no
Swagger como operações já disponíveis.

Objetivo, origem, método, parâmetros, autenticação, cache, resposta, erros, riscos
e utilidade de cada endpoint estão em
[moodle-uor-endpoints.md](./moodle-uor-endpoints.md).

## 25. Modelos JSON

Todos os modelos usam UUIDs opacos da UOR Connect, ISO-8601, `lastSyncedAt` e
disponibilidade explícita. URLs e IDs internos Moodle nunca atravessam a API.
Exemplos completos:
[moodle-uor-data-model.md](./moodle-uor-data-model.md).

## 26. Autenticação da API

O utilizador autentica primeiro na UOR Connect. `POST /session` recebe as
credenciais Moodle sob TLS com `rememberCredentials: true`. Credenciais e sessão
ficam em envelopes AES-256-GCM separados e associados ao estudante. Cookies
expirados são renovados automaticamente com lease e CAS. A preferência evolutiva
é trocar o gateway web por token oficial revogável com funções de leitura.

## 27. Cache e sincronização

| Recurso | Frequência |
|---|---:|
| Disciplinas | 6 h |
| Materiais/secções | 2 h |
| Trabalhos/testes/calendário | 30 min |
| Notificações | 10 min |
| Mensagens | 10 min sob demanda |
| Progresso | 1 h |
| Perfil | 24 h |

Implementar ETag próprio, deduplicação, concorrência por estudante, jitter,
backoff, timeout, circuit breaker, fila e stale-while-revalidate.

## 28. Erros

```json
{
  "error": {
    "code": "MOODLE_REAUTH_REQUIRED",
    "message": "Volta a ligar a tua conta Moodle para continuar.",
    "retryable": false,
    "actionRequired": "reauthenticate"
  },
  "meta": { "requestId": "req-1" }
}
```

Códigos: `MOODLE_AUTH_FAILED`, `MOODLE_SESSION_EXPIRED`,
`MOODLE_UNAVAILABLE`, `MOODLE_RATE_LIMITED`, `MOODLE_PARSE_ERROR`,
`MOODLE_RESOURCE_NOT_FOUND`, `MOODLE_PERMISSION_DENIED`,
`MOODLE_UPSTREAM_CHANGED`, `MOODLE_SYNC_FAILED`.

## 29. Segurança

- credenciais e sessão persistidas apenas em envelopes AES-256-GCM separados;
- segredos backend-only, keyring externo, rotação e L1 descifrado com TTL;
- logs redigidos;
- owner scope e validação de inscrição em cada ID;
- allowlist de host/path/método/função;
- CSRF, rate limit, auditoria, logout e revogação;
- prevenção de SSRF, IDOR/BOLA e mistura de sessões;
- nenhuma resposta sensível bruta persistida por padrão.

Detalhes: [moodle-uor-integration-risks.md](./moodle-uor-integration-risks.md).

## 30. Riscos de manutenção

Maior risco: login personalizado, HTML localizado, tema, JSON interno do formato
de curso e funções de mensagens. Mudanças devem ativar
`MOODLE_UPSTREAM_CHANGED`, manter cache anterior como `stale` e desligar apenas o
recurso afetado. Não sobrescrever dados válidos com parse parcial/zero inesperado.

## 31. Estado da implementação

1. Concluído: contrato, threat model, gateway web isolado, schemas e fixtures.
2. Concluído: envelopes cifrados, sessão automática, persistência e snapshots.
3. Concluído: rotas MVP somente leitura, worker, ownership e Swagger.
4. Operacional: aplicar migração, configurar keyring e ativar a feature flag.
5. Institucional: obter Web Service de leitura e substituir o gateway web.
6. Futuro: medir estabilidade antes da Fase 2; escrita continua proibida.

## 32. Critérios de aceitação

- URLs, autenticação e chamadas úteis catalogadas;
- modelos de cursos, materiais, atividades, calendário, notificações e progresso;
- contrato de API com origem, parâmetros, resposta, cache e erros;
- dados oficiais e Moodle separados;
- estratégia/fallback e riscos definidos;
- nenhum segredo em código, docs ou Git;
- testes de owner scope, redaction, sessão expirada, schema quebrado e stale cache;
- sincronização não agressiva e somente leitura.

## 33. Conclusão

A API é tecnicamente viável. O caminho seguro é a UÓR disponibilizar um serviço
Web Service UOR Connect de leitura, com tokens revogáveis e funções mínimas. Os
endpoints REST/token já respondem, mas o serviço e as permissões ainda não foram
confirmados. AJAX e parsing HTML permitem prototipagem controlada, porém têm maior
risco de quebra e não devem tornar-se um contrato silencioso de produção.

## Respostas finais obrigatórias

1. **Quais URLs/endpoints podem ser usados?** As rotas de painel, cursos,
   secções, módulos, calendário, comunicação, perfil e resultados listadas na
   secção 5; para dados estruturados, REST oficial e as funções AJAX da secção 6.
2. **Quais dependem de sessão?** Todas as páginas/dados do estudante,
   `service.php`, `pluginfile.php` e logout. REST usa token em vez de sessão web.
3. **Quais dependem de `sesskey`?** AJAX autenticado, logout e formulários de
   mutação/navegação POST. Páginas GET de leitura não precisaram de `sesskey`
   explícito.
4. **Quais devolvem JSON?** `login/token.php`, `lib/ajax/service.php` e
   `service-nologin.php`; REST pode devolver JSON com `moodlewsrestformat=json`,
   embora sem parâmetros tenha respondido XML.
5. **Quais exigem parsing HTML?** Perfil, detalhes de trabalho/quiz/fórum,
   preferências, pauta e qualquer recurso sem função oficial/AJAX autorizada.
6. **Que dados alimentam a UOR Connect?** Perfil mínimo, disciplinas, secções,
   materiais, atividades, prazos, calendário, notificações, progresso e, na Fase
   2, mensagens/fóruns.
7. **Que dados não são oficiais?** Notas/resultados Moodle, progresso, conclusão,
   inscrição Moodle e dados financeiros inexistentes no Moodle.
8. **Estratégia mais segura/estável?** Web Service oficial de leitura → serviço
   oficial móvel → AJAX interno → HTML.
9. **Como deve ser a API própria?** Backend isolado, endpoints tipados sob
   `/integrations/moodle` (ou `/api/integrations/moodle` através do proxy público),
   modelos normalizados, owner scope, cache, sync,
   proveniência, `stale` e segredos exclusivamente no backend.
10. **Quais integrações apenas de leitura?** Toda a Fase 1 e 2: cursos, conteúdo,
    atividades, calendário, notificações, progresso, mensagens, fóruns e downloads.
11. **O que precisa de apoio administrativo?** Serviço/token oficial, funções e
    escopos, OAuth/SSO, limites, ambiente de teste, documentação e mudanças de
    versão/tema/plugins.
12. **O que mais pode quebrar?** Login personalizado, parsers HTML de detalhes,
    `core_courseformat_get_state`, mensagens AJAX e downloads/redirecionamentos.

## Fontes técnicas externas

- [Moodle: External Services](https://moodledev.io/docs/5.0/apis/subsystems/external)
- [Moodle: Mobile web services](https://docs.moodle.org/502/en/Enable_mobile_web_services)
- [Moodle: AJAX wrapper (`service.php` e `sesskey`)](https://jsdoc.moodledev.io/main/lib_amd_src_ajax.js.html)
- [Moodle: REST server parameters](https://phpdoc.moodledev.io/main/d3/dc4/classwebservice__rest__server.html)

Estas fontes explicam o comportamento padrão do Moodle. A disponibilidade real
na UÓR foi classificada apenas quando observada; o resto permanece dependente de
confirmação administrativa.
