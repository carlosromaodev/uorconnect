# Autenticação Moodle UÓR

Análise realizada em 18 de julho de 2026 com uma conta de estudante autorizada.
Todos os valores de palavra-passe, cookie, `sesskey`, token, nome, email e ID de
utilizador foram omitidos ou substituídos por marcadores.

## Fluxo observado

1. `GET https://moodle.uor.edu.ao/login/index.php` devolve `303` para `/home`.
2. `GET /home` devolve `301` para `/home/`.
3. `GET /home/` devolve a página de login personalizada (`200`, HTML).
4. O formulário executa `POST /login/index.php` com
   `application/x-www-form-urlencoded`.
5. O Moodle valida a sessão por um redirecionamento intermédio equivalente a
   `/login/index.php?testsession=<USER_ID>`.
6. Em sucesso, o navegador chega a `GET /my/` (`200`, HTML).
7. A presença do painel e de `M.cfg.sesskey` confirma a sessão autenticada.

```text
GET /login/index.php
  -> 303 /home
  -> 301 /home/
  -> 200 formulário personalizado

POST /login/index.php
  username=<TEST_USERNAME>&password=<PASSWORD>
  -> 303 /login/index.php?testsession=<USER_ID>
  -> 303 /my/
  -> 200 painel autenticado
```

## Formulário

| Elemento | Valor observado |
|---|---|
| Action | `/login/index.php` |
| Método | `POST` |
| Campo de utilizador | `username` |
| Campo de palavra-passe | `password` |
| `logintoken` | Não observado na página personalizada |
| Outros campos ocultos | Nenhum observado |
| Erro visível | Query string com `errorcode`; a página mostra credenciais incorretas |

A ausência observada de `logintoken` descreve apenas este tema/página em 18 de
julho de 2026. Não deve ser assumida como contrato permanente.

## Cookies e sessão

| Cookie | Finalidade provável | Propriedades observadas | Tratamento na UOR Connect |
|---|---|---|---|
| `MoodleSession` | Sessão autenticada | `Secure`, `SameSite=None`, sessão; `HttpOnly` não foi observado | Guardar apenas no backend, cifrado em repouso se persistir temporariamente; nunca devolver ao frontend |
| `MOODLEID1_` | Memória do identificador de login | `Secure`, `SameSite=Lax`, persistente; `HttpOnly` não foi observado | Não é necessário para sincronização; descartar |

O valor de cada cookie foi redigido. Como `HttpOnly` não apareceu nos cookies
observados, um XSS no contexto do Moodle teria impacto acrescido; isto reforça a
necessidade de nunca expor a sessão dentro do frontend da UOR Connect.

## `sesskey` e CSRF

- Após autenticação, `M.cfg.sesskey` existe.
- Formulários que alteram estado incluem um campo oculto `sesskey`.
- O logout observado usa `GET /login/logout.php?sesskey=<SESSKEY>`.
- Chamadas autenticadas a `/lib/ajax/service.php` usam
  `?sesskey=<SESSKEY>&info=<FUNCTION>` e enviam cookie de sessão.
- Páginas GET de leitura, como `/course/view.php?id=<COURSE_ID>`, não exigiram
  `sesskey` explícito; exigiram apenas a sessão.
- `service-nologin.php` foi observado para templates, ícones e strings públicas;
  isso não significa que dados do estudante possam ser consultados sem sessão.

## Falha, expiração e logout

| Situação | Comportamento esperado/observado | Código UOR Connect |
|---|---|---|
| Credenciais inválidas | Regressa à página personalizada com `errorcode`; não chega a `/my/` | `MOODLE_AUTH_FAILED` |
| Cookie ausente/expirado | Uma rota protegida redireciona para o fluxo de login | `MOODLE_SESSION_EXPIRED` |
| `sesskey` inválido | AJAX/formulário falha; a sessão pode continuar válida para GET | `MOODLE_SESSION_EXPIRED` ou `MOODLE_UPSTREAM_CHANGED` após validação |
| Logout | `GET /login/logout.php?sesskey=<SESSKEY>` encerra a sessão upstream | sessão local eliminada |
| Moodle indisponível | timeout, 5xx ou erro de rede | `MOODLE_UNAVAILABLE` |

O adaptador não deve inferir autenticação apenas de `200`: a página de login
personalizada também devolve `200`. Deve validar URL final, presença esperada do
painel e ausência do formulário de login.

## Opções de autenticação

| Opção | Segurança | Estabilidade | Dependência da UÓR | Facilidade | Recomendação |
|---|---|---|---|---|---|
| Web Services com token de serviço limitado | Alta | Alta | Alta: serviço e funções configurados por admin | Média | Preferida |
| Serviço móvel oficial/token por utilizador | Alta | Alta | Média/alta: serviço móvel e capacidade de criar token | Média | Avaliar imediatamente |
| OAuth2/OpenID Connect/SSO institucional | Alta | Alta | Alta: IdP e Moodle configurados | Média | Preferida para médio prazo |
| Autenticação delegada com sessão e credenciais cifradas, mediante consentimento | Média | Média | Baixa | Média | Fallback implementado e substituível |
| Scraping com sessão web | Baixa/média | Baixa | Baixa inicialmente | Alta no protótipo, baixa na manutenção | Último recurso |
| Palavra-passe Moodle em texto simples ou exposta ao frontend/logs | Muito baixa | Baixa | Baixa | Aparente facilidade | Proibida |

## Web Services observados

- `GET /webservice/rest/server.php` respondeu `200 application/xml` com
  `invalidtoken`. O endpoint REST existe, mas nenhuma função autorizada foi
  confirmada.
- `GET /login/token.php` respondeu `200 application/json` com `missingparam`
  para `username`. Não foi enviado `POST` de credenciais nem criado token.
- `/admin/webservice/documentation.php` devolveu acesso negado/`404` para a conta
  de estudante, como esperado.
- O perfil oferece QR code para aplicação móvel e informa que a aplicação móvel
  pode aceder ao site. Isto é um indício forte, mas não uma prova suficiente de
  que a conta possa emitir token para um serviço específico.

A documentação oficial do Moodle informa que o serviço móvel habilita o sistema
de Web Services, o serviço externo móvel, o protocolo REST e a capacidade REST
para utilizadores autenticados. A confirmação final requer o administrador da
UÓR: [Mobile web services](https://docs.moodle.org/502/en/Enable_mobile_web_services)
e [External Services](https://moodledev.io/docs/5.0/apis/subsystems/external).

## Contrato recomendado para a UOR Connect

### `POST /integrations/moodle/session`

Recebe credenciais sobre TLS e exige consentimento explícito. O backend autentica
no Moodle e guarda dois envelopes AES-256-GCM separados: credenciais e sessão.
Isso permite renovar automaticamente o cookie expirado sem devolver a palavra-
passe, cookies ou `sesskey` ao frontend. Ambos são eliminados ao desligar a
integração ou desativar o estudante.

```json
{
  "username": "<TEST_USERNAME>",
  "password": "<PASSWORD>",
  "rememberCredentials": true
}
```

```json
{
  "data": {
    "connection": {
      "status": "CONNECTED",
      "connected": true,
      "credentialsStored": true,
      "actionRequired": "none",
      "retryable": false,
      "lastAuthenticatedAt": "2026-07-18T23:00:00Z",
      "lastSuccessfulSyncAt": null
    },
    "initialSyncRunId": "550e8400-e29b-41d4-a716-446655440010"
  },
  "meta": {
    "requestId": "req-1",
    "syncedAt": null,
    "stale": false
  }
}
```

### `DELETE /integrations/moodle/session`

Executa logout upstream, revoga o material de sessão local e invalida jobs
pendentes daquele utilizador. A operação deve ser idempotente.

## Requisitos obrigatórios

- envelopes AES-256-GCM distintos para credenciais e sessão, com AAD por
  estudante/finalidade e keyring rotativo fora da base de dados;
- credenciais descifradas apenas durante login/renovação e sessão descifrada em
  cache privado por no máximo cinco minutos;
- isolamento por utilizador e por job;
- TTL curto, renovação automática single-flight e lease atómico entre instâncias;
- redaction de `Cookie`, `Set-Cookie`, `Authorization`, `sesskey`, `wstoken`,
  corpo do login e parâmetros de QR code;
- proteção CSRF na sessão da UOR Connect;
- rate limit por utilizador e por origem;
- validação de propriedade em todos os IDs para evitar IDOR/BOLA;
- allowlist estrita de host, paths e métodos Moodle;
- nenhum proxy arbitrário de URL;
- logout upstream quando a ligação for removida;
- métricas e logs sem conteúdo pessoal, mensagens ou respostas Moodle completas.

## Decisão implementada

Foi aprovada a modalidade híbrida: cookies e credenciais ficam cifrados no
backend enquanto a ligação estiver ativa; quando a sessão expira, a API obtém um
lease, volta a autenticar uma única vez e substitui atomicamente o envelope de
sessão. Credenciais rejeitadas suspendem a renovação e pedem ação ao estudante.
O Web Service oficial somente de leitura continua a ser a evolução preferida e
poderá substituir o gateway web sem alterar o contrato público.
