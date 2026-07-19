# Mapeamento Moodle → UOR Connect

## Separação de responsabilidades

```text
Secretaria
  notas, matrícula e dados académicos/financeiros oficiais

Moodle
  conteúdos, atividades, materiais, progresso e comunicação pedagógica

API UOR Connect
  autenticação segura, transformação, cache, sincronização e auditoria

UOR Connect Estudante
  experiência integrada, organização, alertas, análise e orientação
```

## Informação e produto

| Informação | Fonte Moodle observada | Uso UOR Connect | Prioridade | Oficial? |
|---|---|---|---|---:|
| Perfil mínimo | Perfil HTML/Web Service | validar ligação e personalização | Alta | Identidade Moodle, não cadastro oficial |
| Disciplinas | AJAX de cursos + páginas | Aprendizagem | Alta | Não substitui matrícula oficial |
| Secções/módulos | estado do formato + HTML | índice da disciplina | Alta | Pedagógico |
| Materiais | módulos + `pluginfile.php` | biblioteca de conteúdos | Alta | Pedagógico |
| Trabalhos | `assign` + calendário | agenda e prioridades | Alta | Pedagógico |
| Questionários | `quiz` + calendário | agenda e alertas | Alta | Pedagógico |
| Calendário | AJAX temporal | agenda unificada | Alta | Pedagógico |
| Progresso | cursos/conclusão | Radar Académico | Alta | Indicador Moodle |
| Notificações | AJAX popup | centro de alertas | Alta | Comunicação Moodle |
| Feedback/rubricas | trabalho/gradebook | contexto pedagógico | Média | Provisório |
| Fóruns/anúncios | `forum` | comunicação | Média | Pedagógico |
| Mensagens | AJAX de conversas | caixa unificada | Média/Fase 2 | Comunicação privada |
| Resultados Moodle | gradebook/atividades | acompanhamento com aviso | Média | **Não** oficial |
| Notas oficiais | Secretaria | pauta oficial | Crítica | Sim, fora do Moodle |
| Pagamentos | Secretaria | finanças | Crítica | Sim, fora do Moodle |

## Estratégia por recurso

| Recurso | 1.ª escolha | 2.ª escolha | Último recurso |
|---|---|---|---|
| Perfil | função oficial de utilizador | perfil HTML | — |
| Cursos | Web Service oficial | AJAX `core_course_get_enrolled_courses_by_timeline_classification` | HTML de `/my/courses.php` |
| Secções/módulos | função oficial de conteúdo | `core_courseformat_get_state` | HTML da disciplina |
| Materiais | função oficial de conteúdo/ficheiros | estado da disciplina | HTML + HEAD/download controlado |
| Trabalhos | funções oficiais `mod_assign_*` | calendário/estado | HTML `mod/assign/view.php` |
| Questionários | funções oficiais `mod_quiz_*` somente leitura | calendário/estado | HTML `mod/quiz/view.php` |
| Calendário | função oficial de calendário | AJAX observado | HTML |
| Notificações | função oficial | AJAX popup observado | HTML |
| Mensagens | função oficial | AJAX observado | HTML, somente Fase 2 |
| Progresso | funções oficiais de completion | campos de progresso AJAX | HTML |

## Frequência e cache

| Recurso | Sincronização | TTL sugerido | Política offline |
|---|---:|---:|---|
| Perfil | 24 h | 24 h | servir stale por 7 dias |
| Disciplinas | 6 h | 6 h | servir stale por 48 h |
| Secções/materiais | 2 h | 2 h | servir stale por 24 h |
| Trabalhos | 30 min | 15–30 min | servir stale com aviso |
| Questionários | 30 min | 15–30 min | servir stale com aviso |
| Calendário/prazos | 30 min | 15–30 min | servir stale com aviso |
| Notificações | 10 min | 5–10 min | não alegar “ao vivo” |
| Mensagens | 10 min sob demanda | 5–10 min | minimizar retenção |
| Progresso | 1 h | 1 h | servir stale por 24 h |

Usar `ETag`/`Last-Modified` da própria API com base na versão normalizada, mesmo
quando a origem Moodle não os fornecer. Jobs usam jitter, backoff exponencial,
timeout, circuit breaker e uma execução concorrente por estudante.

## Fases

### Fase 1 — leitura essencial

- ligação/autenticação efémera;
- perfil mínimo;
- disciplinas, secções e materiais;
- atividades, trabalhos e questionários sem tentativa;
- calendário e prazos;
- progresso;
- notificações;
- estado de sincronização;
- métricas, auditoria e centro de inconsistências básico.

Critério de saída: serviço Web Service definido ou adaptador AJAX/HTML coberto por
fixtures anonimizadas, schemas, alertas de quebra e opção de desligar por recurso.

### Fase 2 — comunicação e offline

- mensagens e fóruns somente leitura;
- downloads controlados;
- favoritos locais (não escritos no Moodle);
- modo offline com TTL/frescura visível;
- alertas personalizados;
- comparação explícita Moodle × Secretaria sem mesclar autoridade.

### Fase 3 — escrita institucional

Submissões, mensagens, conclusão manual, respostas e outras mutações só podem
entrar nesta fase com API oficial, escopos mínimos, autorização institucional,
consentimento, auditoria, idempotência, revisão de segurança e testes completos.

## Apoio necessário da UÓR

1. Confirmar versão e janela de suporte do Moodle.
2. Confirmar se “Mobile web services” está habilitado para estudantes.
3. Criar um serviço externo UOR Connect somente de leitura.
4. Autorizar apenas as funções necessárias de utilizador, cursos, conteúdo,
   calendário, completion, assignment, quiz, fórum, notificações e mensagens.
5. Definir emissão, expiração, rotação e revogação de tokens por utilizador ou
   integração.
6. Disponibilizar ambiente/conta de teste sem dados pessoais reais.
7. Avisar alterações de versão, tema, plugins e política de autenticação.
8. Definir limites de requisição, suporte e resposta a incidente.
9. Confirmar a fronteira normativa: notas e finanças oficiais continuam na
   Secretaria.

## Critérios de aceitação da implementação

- nenhuma palavra-passe persistida;
- cookies/tokens nunca chegam ao frontend ou aos logs;
- utilizador só consulta recursos já associados à sua própria sessão;
- sincronização respeita frequências e backoff;
- cada parser tem fixture redigida e teste de contrato;
- alterações upstream produzem `MOODLE_UPSTREAM_CHANGED`, não dados errados;
- disponibilidade de progresso é distinta de 0%;
- resultados Moodle aparecem sempre como provisórios/não oficiais;
- todas as integrações da Fase 1 e 2 são somente leitura;
- logout revoga sessão local mesmo se o upstream falhar;
- fontes, data de sincronização e estado `stale` aparecem em todas as respostas.
