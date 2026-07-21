# SDD-003 — UOR Eventos

```yaml
document_id: SDD-003
status: draft
owner: Produto UOR Eventos
authority: normative
version: 0.1
last_reviewed: 2026-07-21
approved_by:
approved_at:
review_cycle: durante análise própria do produto
next_review: após inventário funcional de Eventos
supersedes:
superseded_by:
depends_on:
  - SDD-000-ECOSSISTEMA-UOR-CONNECT.md
  - SDD-005-CAPACIDADES-TRANSVERSAIS.md
```

## Missão

Permitir descobrir, organizar, operar e participar em eventos universitários com experiências públicas e privadas próprias.

## Capacidades confirmadas no sistema atual

- catálogo, agenda e conteúdo ao vivo;
- inscrições em cursos/atividades;
- projetos, equipas, submissões e votação;
- QR Codes, presença, passaporte, desafios, pontos e ranking;
- credenciais, passes e certificados;
- palestrantes, formadores e comunicação operacional;
- administração, relatórios e auditoria operacional do evento.

## Propriedade

UOR Eventos é proprietário de eventos, inscrições, programação, projetos, equipas de projeto, votos, passaportes, desafios, pontuação e certificados emitidos por evento.

## Dependências permitidas

- mecanismos transversais da UOR Connect;
- gateways autorizados de comunicação e pagamento quando aplicáveis;
- indicadores enviados à UOR Direção por contratos agregados.

UOR Eventos não depende da Secretaria ou do Moodle para funcionar.

## Fora do âmbito

- notas e currículo oficial;
- finanças académicas do estudante;
- avaliação institucional global;
- acesso irrestrito ao perfil académico;
- administração dos dados transacionais de outros produtos.

## Restrições de migração

Os documentos legados de passaporte, credenciais e administração continuam a descrever funções atuais, mas não representam a visão geral da UOR Connect. A análise própria deste produto decidirá o que é mantido, dividido ou descontinuado.

## Open Questions

| ID | Questão | Responsável | Impacto | Condição | Estado | Atualiza |
| --- | --- | --- | --- | --- | --- | --- |
| OQ-EVT-001 | Quais eventos e capacidades são permanentes versus configuráveis por edição? | Produto Eventos | modelo de dados | auditoria funcional | open | SDD-003 |
| OQ-EVT-002 | Administração operacional será app separada? | Arquitetura/Eventos | UX e deploy | desenho próprio | open | SDD-003, ADR futuro |
