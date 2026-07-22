# Implementação contínua do backend UOR Estudante

## Referências

- `docs/superpowers/specs/2026-07-22-uor-estudante-backend-completo-design.md`
- `docs/vision/uor-connect-v2/SDD-002-UOR-ESTUDANTE.md`
- `docs/vision/uor-connect-v2/requirements/UOR-ESTUDANTE-RF-RNF-REGRAS-NEGOCIO.md`
- `docs/vision/uor-connect-v2/requirements/UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md`

## Regras de execução

1. Manter uma única missão, avançando por ondas que deixam o backend executável.
2. Implementar domínio e testes antes de ligar HTTP.
3. Usar portas internas; nenhuma capacidade UOR Estudante lê diretamente tabelas privadas de outro produto.
4. Novos contratos públicos ficam em `/api/v1/student` e usam `{ data, meta }`.
5. Sincronização é automática no backend; leituras nunca contactam upstream.
6. Migrações seguem expand/contract e são verificadas em SQLite local e PostgreSQL quando a semântica exigir.
7. Não marcar `[x]` sem evidência `verified`.
8. Cada checkpoint executa typecheck, testes focados, diff check e atualização da matriz quando a evidência mudar.

## Onda 1 — Fundação, login e sincronização automática

### 1.1 Contratos e fronteiras

- Criar `modules/uor-student` com portas de identidade, Secretaria, Moodle, sync store, relógio e auditoria.
- Definir modelos de proveniência, cobertura, estados de provedor e erros seguros.
- Adicionar testes de fronteira para impedir imports de HTTP/infra no domínio.

### 1.2 Bootstrap do login

- Criar orquestrador pós-login com credenciais Secretaria e Moodle separadas.
- Ligar o orquestrador ao login apenas para origem UOR Estudante.
- Fazer falha Secretaria bloquear e falha Moodle degradar sem bloquear.
- Guardar `Est.2026` cifrada e permitir substituição autenticada.
- Testar ausência de credenciais em respostas, logs e erros.

### 1.3 Jobs automáticos

- Criar modelos Prisma de ciclo agregado e tarefas por provedor/domínio.
- Implementar idempotency key, lease, heartbeat, fence, backoff e reclaim.
- Agendar no login, credencial alterada, snapshot ausente, TTL e retry devido.
- Reutilizar os workers/adaptadores existentes por portas.
- Testar concorrência e publicação parcial.

### 1.4 Read models

- Implementar `/providers`, `/sync`, `/sync/:runId` apenas para consulta.
- Implementar `/today` somente sobre dados locais.
- Garantir `null`, cobertura e `stale` em ausência/falha.
- Implementar perfil, privacidade, exportação e eliminação sob contratos de produto.

### 1.5 Hardening da fundação

- Adicionar dimensões de log `product`, `domain`, `tenant`, `provider` e correlação.
- Testar IDOR/BOLA, mesma matrícula entre instituições, rate limit, CSRF e redaction.
- Atualizar matriz com evidência nova.

## Onda 2 — Núcleo académico e financeiro normalizado

- Persistir catálogo/períodos/unidades/inscrições/notas normalizados com proveniência.
- Implementar médias por unidade, período e percurso com decimal exato e regra versionada.
- Implementar currículo, créditos e precedências.
- Implementar histórico de alterações e agenda unificada.
- Consolidar finanças, referências, pagamentos e recibos em contratos do produto.
- Testar valores nulos, publicação atómica e exclusividade das fontes oficiais.

## Onda 3 — Inteligência e rankings

- Implementar simulações isoladas, nota necessária, dispensa configurável e hipótese de bolsa.
- Implementar evolução, conflitos, sobrecarga e previsão curricular explicável.
- Implementar participação, ranking privado, percentil, empates, cobertura e limiar.
- Testar não inferência e isolamento institucional/contextual.

## Onda 4 — Apoio e representação

- Implementar reportes comunitários, confirmação, contestação e expiração.
- Implementar docentes, elegibilidade, avaliações, agregação e moderação.
- Implementar explicadores, pedidos, relação granular, grants, plano, tarefas, sessões e revogação.
- Implementar rascunhos de recurso, histórico e pedidos coletivos com decisão individual.

## Onda 5 — Finanças delegadas e autorizações

- Implementar partilha mínima de referência e responsável financeiro contextual.
- Implementar autorização, caixa, decisão, usos, expiração e revogação.
- Implementar OTP contextual com hash, tentativas e reenvios atómicos.
- Implementar notificações minimizadas e auditadas.

## Onda 6 — Mercado, administração e escritas externas

- Implementar anúncios, pesquisa, reserva, venda, denúncia e moderação.
- Isolar configuração administrativa UOR Estudante.
- Completar comandos externos somente onde contrato e pós-condição forem verificáveis.
- Manter capacidades sem contrato elegível atrás de flags fail-closed.

## Onda 7 — Verificação integral

- Executar suites unitárias, HTTP, PostgreSQL, segurança, resiliência e performance.
- Validar OpenAPI, paginação, IDs opacos, proveniência e ausência de upstream em GETs do produto.
- Ensaiar backup/restore e runbook de incidente.
- Corrigir regressões preexistentes que impeçam o gate backend.
- Recalcular matriz e validar documentos.
- Auditar requisito por requisito antes de declarar conclusão.

## Checkpoint atual

Começar em `1.1`, seguindo imediatamente para `1.2–1.5` sem pausa quando os testes permanecerem verdes.
