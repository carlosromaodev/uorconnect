---
document_id: UOR-ESTUDANTE-BRAND-001
title: Identidade visual da UOR Estudante
status: draft
owner: UOR Connect
approved_by:
approved_at:
review_cycle: annual
next_review:
last_updated: 2026-07-22
---

# Identidade visual da UOR Estudante

Este documento regista a interpretação operacional da marca recebida para uso consistente no produto e nos documentos da UOR Estudante. Os valores digitais abaixo são aproximações técnicas extraídas da referência visual; a definição final deve ser confirmada quando os ficheiros vetoriais oficiais forem entregues.

## Conceito da marca

O símbolo combina um `E` aberto e arredondado, um traço central e um ponto laranja. A forma aberta comunica acesso e continuidade; o ponto funciona como presença humana e foco; as linhas orbitais representam ligação ao ecossistema UOR Connect. O espaço negativo é parte essencial da marca e não deve ser preenchido com elementos decorativos.

## Paleta operacional

| Token | Valor | Função |
| --- | --- | --- |
| `ink` | `#050505` | Marca, títulos e texto principal |
| `orange` | `#FF5A00` | Ação, foco, traço da marca e pequenos destaques |
| `paper` | `#FAF7F3` | Fundo marfim quente |
| `surface` | `#FFFFFF` | Cartões e áreas de leitura |
| `stone` | `#ECE8E3` | Divisores e elementos fantasma |
| `muted` | `#6F6963` | Metadados e texto secundário |

O laranja não deve ser usado em parágrafos extensos. Estados nunca dependem apenas da cor: devem incluir sempre um rótulo textual.

## Forma, composição e respiro

- O símbolo deve manter os terminais arredondados e a relação entre preto e laranja.
- A área de proteção mínima deve corresponder ao diâmetro do ponto laranja em todos os lados.
- A versão principal usa o símbolo com a palavra `Estudante` e a assinatura `by UOR Connect`.
- Em fundos claros, usar preto e laranja. Não aplicar sombras, contornos ou gradientes ao símbolo.
- A marca fantasma pode ser usada entre 2% e 4% de opacidade, apenas como elemento atmosférico.
- Órbitas decorativas devem ser finas, incompletas e afastadas do conteúdo crítico.

## Documentos financeiros

Os documentos devem privilegiar leitura e confiança: título forte, identidade do estudante, entidade, referência, montante e validade claramente separados. O documento deve declarar a origem dos dados e esclarecer que a UOR Estudante não processa a transação bancária e que o documento não substitui recibo fiscal nem comprovativo bancário.

## Implementação

- Símbolo vetorial: `frontend/public/uor-estudante-mark.svg`.
- Tokens e templates financeiros: `backend/src/modules/secretaria/http/uor-estudante-finance-pdf.ts`.
- PDF de validação visual: `docs/samples/uor-estudante-referencias-pagamento.pdf`.

## Open Questions

- [ ] **BRAND-OQ-001 — Vetor mestre:** obter o ficheiro SVG/AI oficial para confirmar proporções e curvas. Responsável: Marca UOR Connect. Impacto: precisão final do símbolo. Estado: `planned`. Atualiza este documento e o ativo vetorial.
- [ ] **BRAND-OQ-002 — Cores homologadas:** confirmar valores Pantone, CMYK, RGB e HEX oficiais. Responsável: Marca UOR Connect. Impacto: consistência entre impressão e ecrã. Estado: `planned`. Atualiza a paleta operacional.
- [ ] **BRAND-OQ-003 — Tipografia licenciada:** confirmar a família tipográfica oficial. Responsável: Marca UOR Connect. Impacto: lockup e comunicação. Estado: `planned`. Atualiza regras tipográficas e templates.
