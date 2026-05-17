# Relatórios Gerais da Admin

Status: ativo
Última atualização: 2026-05-17
Fontes principais: `raw/obsidian-cofre/Relatorios gerais - Estado e calculos.md`

## Objetivo

O relatório geral da admin deve dar uma visão confiável da atividade, cobrindo crescimento, finanças, cursos, projetos, votações, interações, pendências e recusas.

## Estrutura Esperada do PDF

1. Capa e visão executiva.
2. Gráficos de crescimento.
3. Gráficos financeiros.
4. Cursos, inscritos e arrecadação.
5. Projetos aprovados.
6. Projetos recusados em página compacta.
7. Estudantes que interagiram nas últimas páginas.

## Cálculos

O backend usa um módulo dedicado para cálculos:

- `backend/src/modules/reports/http/report-calculations.ts`

Testes principais:

- `backend/src/modules/reports/http/report-calculations.spec.ts`
- `backend/src/modules/reports/http/reports-overview-pdf.spec.ts`

## Regras Importantes

- Projetos recusados não entram como aprovados.
- Projetos recusados não entram na receita esperada principal.
- Projetos eliminados não entram nos cálculos principais.
- Valores vazios ou inválidos não quebram o relatório.
- Valores em Kz/AOA precisam aceitar formatos diferentes.
- Gráficos devem ter escala coerente.

## Próximo Cuidado

Testes validam cálculo e estrutura, mas PDFs oficiais ainda devem ser lidos visualmente com dados reais antes de envio.

## Fonte Bruta

Ver nota original preservada em [`raw/obsidian-cofre/Relatorios gerais - Estado e calculos.md`](../raw/obsidian-cofre/Relatorios%20gerais%20-%20Estado%20e%20calculos.md).
