# Padrão de Documentação Normativa UOR Connect

Status: ativo
Última atualização: 2026-07-21
Autoridade: [README da visão v2](../../vision/uor-connect-v2/README.md)

## Metadados obrigatórios

```yaml
document_id:
status: draft | proposed | approved | deprecated | superseded
owner:
authority: normative | informative | historical
version:
last_reviewed:
approved_by:
approved_at:
review_cycle:
next_review:
supersedes:
superseded_by:
depends_on:
```

## Regras

- Identificar produto, domínio, finalidade, ownership e fora do âmbito.
- UOR Connect significa ecossistema; usar UOR Estudante/Eventos/Direção para produtos.
- Separar estado atual, transição e alvo.
- Distinguir oficial, calculado, estimado e comunitário.
- Usar `/api/v1`, IDs opacos e `{ data, meta }` em contratos novos.
- Não incluir segredos, cookies, URLs privadas ou IDs técnicos sensíveis.
- ADR não contraria SDD/requisito aprovado.
- Matriz relata implementação, sem definir comportamento.
- Questão aberta tem ID, responsável, impacto, condição, estado e destino.
- Documento substituído declara `superseded_by` no próprio ficheiro.

## Aceitação

Documento novo passa por links, IDs, estados, terminologia, precedência, critérios verificáveis e revisão de conflitos.
