# MIG-001 — Transição da plataforma atual

```yaml
document_id: MIG-001
status: approved
owner: Arquitetura UOR Connect
authority: normative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por fase de migração
next_review: conclusão da fundação UOR Estudante
supersedes:
  - ../../wiki/raw/uorconnect-sdd-v1.0/SDD-001-UOR-Connect-Platform-Migration.md
superseded_by:
depends_on:
  - SDD-000-ECOSSISTEMA-UOR-CONNECT.md
  - SDD-002-UOR-ESTUDANTE.md
```

## 1. Diagnóstico em 2026-07-21

### Frontend

- Uma aplicação React/Vite concentra portal público, eventos, Minha Área e admin.
- `/estudante`, `/eventos` e `/direcao` existem, mas renderizam `ProductGateway` declarativo.
- `/estudante` encaminha a ação principal para a `/minha-area` legada.
- Eventos continuam nas rotas raiz (`/projetos`, `/agenda`, `/cursos`, `/ao-vivo`).
- O código ainda usa os nomes substituídos `UOR Connect Estudante/Eventos/Direção`.

### Backend

- Um backend Fastify regista módulos de autenticação, projetos, eventos, votação, passaporte, certificados, comunicação, relatórios e administração.
- `/api/v1/student`, `/api/v1/events` e `/api/v1/direction` são endpoints de contexto, não APIs funcionais completas.
- Moodle possui sessão, perfil, cursos, secções, materiais, sincronização, persistência, cifragem e testes.
- Secretaria funcional permanece acoplada à autenticação; a API `/api/v1/integrations/secretaria` declara `planned/not_synced`.
- O schema Prisma mistura identidade, Eventos e Moodle na mesma base; ownership lógico ainda não está imposto.
- Não existe domínio funcional de UOR Direção; relatórios/admin atuais são predominantemente operacionais de Eventos.

### Infraestrutura

- Produção usa frontend e backend únicos, PostgreSQL, Redis, Evolution API e Caddy.
- Não existem ciclos de deploy independentes para os três produtos.
- Monólito modular é a transição adequada; microsserviços imediatos aumentariam risco.

## 2. Evidência executada

Em ambiente local de teste, commit de base `669aed0`:

- backend: 7 ficheiros e 45 testes aprovados para identidade, login e Moodle;
- frontend: 3 ficheiros e 6 testes aprovados para login/proveniência de perfil;
- nenhuma operação de escrita foi executada contra Secretaria, Moodle ou produção.

## 3. Classificação do código

| Área atual | Produto alvo | Estado |
| --- | --- | --- |
| auth, perfil, consent records, audit base | transversal + Estudante | reutilizável após separação de finalidade |
| Moodle module e modelos snapshot | Estudante | implementado, sem shell Estudante completo |
| secretaria-client dentro de auth | Estudante | reutilizável após extração para integração própria |
| submissions, votes, passport, attendance, certificates | Eventos | funcional, atualmente espalhado |
| agenda, courses, speakers, trainers | Eventos hoje; possível partilha contratual | requer decisão de ownership |
| reports, analytics, admin | Eventos operacional | não equivalem à UOR Direção |
| platform-context e ProductGateway | migração | declarativos/temporários |

## 4. Divergências prioritárias

1. Nomes antigos dos produtos permanecem no código.
2. Rotas públicas de Eventos ocupam a raiz do ecossistema.
3. `/estudante` não é produto independente.
4. Secretaria Integration API não está ligada ao upstream.
5. Identidade usa `institutionCode + studentNumber`, mas JWT e várias consultas ainda transportam apenas `studentNumber`.
6. Módulos acedem diretamente ao Prisma partilhado, sem contratos de ownership por produto.
7. Admin operacional é apresentado como destino provisório da Direção.
8. Deploy e observabilidade ainda não distinguem produto consistentemente.

## 5. Fases

### Fase 0 — governação e contratos

- aprovar documentação v2;
- criar testes de fronteira e convenções de módulo;
- corrigir nomenclatura em novas alterações;
- criar inventário de ownership de tabelas e rotas.

### Fase 1 — fundação Estudante

- shell e navegação próprios;
- sessão e perfil institucional conscientes da instituição;
- contratos `/api/v1/student` reais;
- separar Moodle e Secretaria do domínio de autenticação;
- proveniência, sincronização e auditoria visíveis.

### Fase 2 — núcleo académico

- notas oficiais, currículo, horário, exames e assiduidade;
- persistência normalizada e histórico;
- médias, simulações e mapa curricular.

### Fase 3 — isolamento Eventos

- mover rotas para `/eventos` com redirects e telemetria;
- agrupar módulos/tabelas sob ownership Eventos;
- separar admin operacional.

### Fase 4 — inteligência e comunidade Estudante

- rankings privados, alertas, explicadores, avaliações, representação e mercado;
- autorizações e OTP por finalidade.

### Fase 5 — Direção

- catálogo de métricas;
- read models agregados;
- shell protegido, MFA, finalidade e auditoria;
- respostas/comandos por contratos.

### Fase 6 — separação física quando justificada

Separar processos, bases ou repositórios apenas quando ownership, carga, segurança ou equipas demonstrarem benefício mensurável.

## 6. Compatibilidade e remoção

Rotas legadas só são removidas após alternativa estável, telemetria sem consumo relevante, testes, comunicação, rollback ensaiado e decisão aprovada. Mudanças de dados usam expand/contract.

## 7. Riscos

| Risco | Mitigação |
| --- | --- |
| quebrar links de eventos publicados | redirects e telemetria |
| tratar admin atual como Direção | fronteira e permissões novas |
| scraping externo instável | adaptadores, contratos e alertas |
| exposição por número académico | identity composta e IDs opacos |
| migração documental sem execução | matriz, critérios de saída e evidência |

## 8. Critérios de conclusão da fase documental

- documentos v2 completos e indexados;
- fontes v1 marcadas como substituídas;
- requisitos e matriz alinhados;
- divergências conhecidas registadas;
- validação de links, IDs, estados e terminologia aprovada.
