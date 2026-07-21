# SDD-004 — UOR Direção

```yaml
document_id: SDD-004
status: draft
owner: Produto UOR Direção
authority: normative
version: 0.1
last_reviewed: 2026-07-21
approved_by:
approved_at:
review_cycle: durante análise própria do produto
next_review: após catálogo institucional de indicadores
supersedes:
superseded_by:
depends_on:
  - SDD-000-ECOSSISTEMA-UOR-CONNECT.md
  - SDD-005-CAPACIDADES-TRANSVERSAIS.md
```

## Missão

Disponibilizar informação institucional confiável e acionável a decisores autorizados, com privacidade, finalidade e qualidade mensuráveis.

## Capacidades iniciais

- indicadores académicos, pedagógicos, financeiros e de eventos;
- relatórios versionados e exportações autorizadas;
- alertas de qualidade, risco e operação;
- catálogo de métricas e proveniência;
- auditoria de consultas sensíveis;
- comandos ou decisões institucionais por contratos explícitos.

## Fronteira obrigatória

- Não é proprietário das notas individuais.
- Não altera diretamente dados da UOR Estudante ou UOR Eventos.
- Consome read models e agregações autorizadas.
- Indicadores aplicam limiar mínimo e proteção contra reidentificação.
- Drill-down individual exige finalidade, permissão, justificação e auditoria.
- Uma resposta institucional não transfere a propriedade do processo original.

## Propriedade

UOR Direção é proprietário do catálogo institucional de métricas, configuração académica institucional, relatórios derivados, alertas institucionais e decisões emitidas. Os factos de origem permanecem no produto proprietário.

## Fora do âmbito

- super-admin universal;
- edição de tabelas transacionais alheias;
- operação diária de eventos;
- exposição de rankings individuais ou dados sem finalidade;
- substituição da Secretaria como fonte oficial.

## Open Questions

| ID | Questão | Responsável | Impacto | Condição | Estado | Atualiza |
| --- | --- | --- | --- | --- | --- | --- |
| OQ-DIR-001 | Qual catálogo de métricas terá aprovação institucional? | Direção | escopo do produto | workshop de governação | open | SDD-004 |
| OQ-DIR-002 | Qual limiar mínimo protege cada agregação? | Privacidade | reidentificação | DPIA/análise equivalente | open | SDD-004, SDD-005 |
