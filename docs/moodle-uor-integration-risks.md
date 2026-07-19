# Riscos da integração Moodle UÓR

## Registo de riscos

| Risco | Prob. | Impacto | Evidência | Mitigação |
|---|---:|---:|---|---|
| Tema/HTML muda | Alta | Alta | Login personalizado e tema `moove`; dados de detalhe vêm de HTML | Web Service primeiro; parsers por versão, fixtures, canário e kill switch |
| Função AJAX interna muda | Média/alta | Alta | `/lib/ajax/service.php` e `core_courseformat_get_state` não são contrato público | schema estrito, adapter isolado, fallback e pedido de serviço oficial |
| Sessão expira durante sync | Alta | Média | autenticação por `MoodleSession` | detecção de redirect/login, reautenticação automática single-flight, lease e apenas uma repetição |
| Base de dados expõe credenciais cifradas | Baixa/média | Crítica | fallback aprovado precisa renovar sessões sem interação | AES-256-GCM, AAD por estudante/finalidade, keyring externo, rotação, redaction e purga transacional |
| Exposição de cookie/`sesskey` | Média | Crítica | sessão e AJAX dependem destes segredos | backend-only, cifragem, redaction e proibição no frontend/logs |
| Cookie não `HttpOnly` | Observada | Alta | propriedades do navegador em 18/07/2026 | não executar integração no browser; reportar à UÓR e reforçar XSS controls |
| IDOR/BOLA entre estudantes | Média | Crítica | rotas usam IDs Moodle previsíveis | owner scope em DB, validar inscrição e não confiar no ID do cliente |
| SSRF/proxy aberto | Média | Crítica | materiais e URLs externas | allowlist de host/path, resolver por ID interno, bloquear URL arbitrária |
| Download excessivo | Média | Alta | `pluginfile.php` serve binários | streaming, limites, HEAD, quota, antivírus conforme necessidade, sem massa |
| Dados pessoais em mensagens/logs | Alta | Alta | AJAX pode devolver membros e mensagens | minimização, retenção curta, campos permitidos e logs estruturados sem payload |
| Nota Moodle tratada como oficial | Média | Crítica | grade overview acessível | modelo `official:false`, disclaimer obrigatório, domínio Secretaria separado |
| Datas/fuso interpretados mal | Média | Alta | UI localizada; timezone observado `Africa/Luanda` | preferir timestamps, normalizar UTC e guardar timezone de origem |
| Curso sem tracking vira 0% | Alta | Média | resposta possui `hasprogress` | modelar `progressAvailable` separadamente |
| Rate limit/sobrecarga Moodle | Média | Alta | muitas disciplinas e detalhes por página | cache, lote limitado, jitter, backoff, circuit breaker, sincronização incremental |
| Conta bloqueada por automação | Baixa/média | Alta | sessão web não é API contratada | autorização formal, baixa frequência, User-Agent identificável, serviço oficial |
| Web Service exposto mas sem função | Alta | Média | REST/token respondem, documentação negada | não assumir disponibilidade; inventário/admin e testes em ambiente de teste |
| QR/token móvel exposto | Média | Crítica | perfil oferece QR de login válido por tempo curto | nunca capturar/guardar QR; preferir fluxo oficial dedicado |
| Operação de leitura causa escrita | Baixa/média | Alta | GETs podem atualizar “último acesso” e recentes | documentar telemetria implícita; limitar visitas; preferir API oficial |
| Concorrência mistura sessões | Baixa | Crítica | jobs multiutilizador no mesmo serviço | cookie jar isolado, worker/job por owner, testes de isolamento |
| Mudança de permissões | Média | Alta | recursos variam por inscrição e contexto | tratar 403/404 como estado, invalidar cache e nunca contornar |

## Comparação de estratégias

| Critério | Web Services oficiais | AJAX interno | HTML autenticado |
|---|---|---|---|
| Estrutura | JSON/XML documentado por função | JSON estruturado, contrato interno | HTML localizado/tema |
| Autenticação | token/serviço | cookie + `sesskey` | cookie |
| Estabilidade | Alta | Média/baixa | Baixa |
| Apoio administrativo | Necessário | Não para protótipo | Não para protótipo |
| Segurança operacional | Alta com escopos mínimos | Média | Média/baixa |
| Custo de parsing | Baixo | Médio | Alto |
| Detecção de mudança | schema de função | schema + nomes internos | DOM/texto/redirects |
| Recomendação | Produção | fallback temporário de leitura | último recurso |

Ordem obrigatória: Web Services oficiais → serviço/app oficial → AJAX interno
somente leitura → scraping autenticado.

## Controles de arquitetura

```text
Cliente UOR Connect
  -> API autenticada UOR Connect
     -> autorização por owner/tenant
     -> cache normalizada + estado stale
     -> fila com limite por estudante
     -> WebSessionMoodleGateway (implementado)
        -> AJAX interno somente leitura
        -> HTML autenticado (último fallback)
     -. evolução futura .-> OfficialWebServiceMoodleGateway
```

O cliente nunca fala diretamente com Moodle. O adaptador não recebe URLs livres;
recebe operações tipadas como `listCourses()` e `getAssignment(id)`.

## Segurança de sessão

- credenciais e material de sessão usam envelopes AES-256-GCM separados;
- password descifrada existe apenas durante autenticação/renovação; strings não
  oferecem garantia de apagamento físico em JavaScript, por isso nunca entram em logs;
- chave e keyring são fornecidos externamente e não ficam na base de dados;
- cookie jars são isolados por estudante e não reutilizados entre jobs;
- cookies, `sesskey`, `wstoken`, QR e headers de autorização são sempre redigidos;
- L1 descifrado tem TTL máximo de cinco minutos; logout/desativação incrementa a
  geração e purga envelopes, snapshots e jobs na mesma transação;
- CSRF na API UOR Connect e `SameSite` adequado na sua própria sessão;
- token oficial, quando existir, tem funções somente leitura e pode ser revogado;
- rotação e resposta a incidente são acordadas com a UÓR.

## Resiliência

- timeout separado para conexão, headers e corpo;
- no máximo uma sincronização ativa por estudante;
- lotes pequenos e limite global de concorrência;
- retry apenas para falhas transitórias, com jitter; nunca repetir login inválido;
- circuit breaker por recurso e por origem;
- cache stale-while-revalidate com frescura explícita;
- checksum/schema de respostas e seletores sentinela;
- kill switch para mensagens, downloads, AJAX ou HTML separadamente;
- métricas de latência, erro, redirect inesperado e taxa de parse, sem payload.

## Detecção de quebra upstream

Sinais:

- URL final volta a `/home/` ou contém formulário `username/password`;
- `M.cfg` desaparece ou muda de forma;
- função AJAX devolve `error=true` ou schema incompatível;
- content type muda de JSON/HTML/binário;
- quantidade de cursos cai anormalmente para zero;
- campos críticos (`id`, `fullname`, `viewurl`) desaparecem;
- parser encontra múltiplos elementos onde esperava um;
- REST/token passam a 404/5xx.

Resposta: interromper apenas o recurso afetado, manter dados anteriores como
`stale`, criar alerta `MOODLE_UPSTREAM_CHANGED` e impedir que parse parcial
sobrescreva dados válidos.

## Privacidade e retenção

| Dado | Retenção proposta |
|---|---|
| Palavra-passe | enquanto a ligação estiver ativa, apenas no envelope cifrado; purga imediata no logout/desativação |
| Cookie/`sesskey` web | TTL da ligação, cifrado, apagar no logout |
| Token oficial | até revogação/expiração, cifrado e com rotação |
| Perfil mínimo | enquanto integração ativa + política institucional |
| Conteúdo de mensagens | evitar; cache curta sob demanda |
| Metadados de cursos/atividades | enquanto integração ativa; apagar a pedido |
| HTML/evidência bruta | desativado em produção; diagnóstico redigido com TTL curto |
| Logs de auditoria | IDs internos pseudonimizados, sem payload/segredo |

## Operações proibidas na Fase 1 e 2

- submeter ou apagar trabalho;
- iniciar/continuar tentativa de questionário;
- publicar/responder/apagar fórum;
- enviar/apagar mensagem;
- marcar notificação, favorito ou conclusão no Moodle;
- alterar perfil, senha, preferências ou ficheiros privados;
- inscrever/remover estudante;
- fazer proxy de URL externa;
- consultar um `userId`, `courseId` ou `cmId` que não pertence à ligação;
- varrer recursos ou descarregar materiais em massa.

## Risco residual e decisão

AJAX/HTML podem sustentar uma prova de conceito pequena, mas não são a base ideal
de produção. O maior risco de quebra está no login personalizado, nos seletores
de detalhe de trabalhos/questionários, no JSON serializado do formato da
disciplina e nas funções de mensagens. Produção deve depender de um serviço
oficial UOR Connect, somente leitura e administrado pela UÓR.
