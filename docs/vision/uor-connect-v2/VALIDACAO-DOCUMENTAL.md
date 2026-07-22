# Validação documental da visão UOR Connect v2

```yaml
document_id: UOR-V2-VALIDATION-001
status: approved
owner: Arquitetura UOR Connect
authority: informative
version: 1.2
last_reviewed: 2026-07-22
approved_by: Codex verification
approved_at: 2026-07-21
review_cycle: por alteração normativa material
next_review: piloto da escrita Secretaria sobre TLS
supersedes:
superseded_by:
depends_on:
  - README.md
  - requirements/UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md
```

## Escopo validado

- 101 ficheiros Markdown do projeto, excluindo dependências geradas.
- 15 documentos iniciais na visão v2 antes deste relatório.
- 7 documentos do pacote SDD v1.0 marcados como `superseded` e preservados.
- 199 identificadores normativos/retidos da UOR Estudante: 95 RF (incluindo 2 reservados), 44 RNF e 60 RN.
- 199 entradas correspondentes na matriz, sem omissões ou extras.
- 20 entradas `verified`: 9 RF, 3 RNF e 8 RN.

## Verificações aprovadas

| Verificação | Resultado |
| --- | --- |
| Links Markdown locais na visão v2, páginas vivas e índice | aprovado, zero destino ausente |
| Metadados obrigatórios nos documentos v2 | aprovado |
| IDs do catálogo versus matriz | correspondência 1:1 |
| Checkboxes `[x]` fora do estado `verified` | zero |
| IDs duplicados no catálogo | zero |
| Estados utilizados fora do vocabulário aprovado | zero detetado |
| `git diff --check` | aprovado após correções de whitespace |
| Nomes antigos em documentos vivos | apenas menções explícitas de diagnóstico/substituição |

## Evidência técnica

Em `local-test`, sobre código base `669aed0`:

- backend: 7 ficheiros e 45 testes aprovados para identidade, login e Moodle;
- frontend: 3 ficheiros e 6 testes aprovados para login e apresentação de perfil;
- Secretaria nesta entrega: 5 ficheiros e 18 testes focados aprovados, incluindo revisão de nota, persistência SQLite isolada, build e schema Prisma válidos;
- suite backend: 109 ficheiros/447 testes aprovados de 110/450; as 3 falhas continuam limitadas ao mock preexistente de referrals do Passport;
- nível máximo atribuído conforme cada teste: `automated_test` ou `integration_test`;
- uma prova controlada autorizada gerou somente referência oficial e confirmou sucesso do portal; nenhum checkout ou pagamento foi processado.

## Incompatibilidades conhecidas

- `/estudante`, `/eventos` e `/direcao` são gateways temporários.
- O código ainda usa nomes de produto substituídos.
- Escritas de referência e revisão de nota da Secretaria estão implementadas, mas desligadas por padrão; produção continua bloqueada até HTTPS/túnel TLS e ensaio persistente por capacidade.
- JWT e consultas legadas nem sempre incluem contexto institucional completo.
- Rotas e administração de Eventos ainda ocupam a aplicação geral.
- Ownership lógico não é imposto no acesso à base partilhada.
- Deploys dos três produtos ainda não são independentes.

Estas incompatibilidades estão registadas no [MIG-001](MIG-001-TRANSICAO-PLATAFORMA-ATUAL.md) e impedem promoção otimista na matriz.

## Resultado

A fonte normativa v2 está estruturalmente coerente e pronta para governar o próximo plano técnico. UOR Eventos e UOR Direção permanecem corretamente em `draft`; a validação não os promove a especificações funcionais completas.
