# Relatorios gerais - Estado e calculos

Esta nota descreve o estado atual dos relatórios gerais da admin e a correção recente de cálculos.

## Objetivo

O relatório geral deve dar uma visão confiável da atividade:

- Crescimento.
- Finanças.
- Cursos.
- Projetos.
- Votações.
- Interações dos estudantes.
- Itens recusados ou pendentes.

## Organização do PDF

Estrutura desejada:

1. Capa/visão executiva.
2. Gráficos de crescimento.
3. Gráficos financeiros.
4. Cursos, inscritos e arrecadação.
5. Projetos aprovados.
6. Projetos recusados em página compacta.
7. Estudantes que interagiram nas últimas páginas.

## Correções implementadas

Foi criado um módulo dedicado para cálculos:

- `backend/src/modules/reports/http/report-calculations.ts`

Testes:

- `backend/src/modules/reports/http/report-calculations.spec.ts`
- `backend/src/modules/reports/http/reports-overview-pdf.spec.ts`

Biblioteca adicionada:

- `decimal.js`

Motivo:

- Valores monetários não devem depender de soma com `number` puro quando o relatório precisa ser confiável.
- O PDF mistura valores formatados pelo sistema e valores vindos de submissões/cursos, então a normalização precisa ser cuidadosa.

## Regras de cálculo

- Projetos recusados não entram como aprovados.
- Projetos recusados não entram na receita esperada principal.
- Projetos eliminados não entram nos cálculos principais.
- Valores vazios ou inválidos não devem quebrar o relatório.
- Valores em Kz/AOA devem ser lidos mesmo com formatos diferentes.
- Gráficos devem usar escala coerente e não distorcer visualmente os dados.

## Exemplos de formatos aceitos

- `25000`
- `25.000 Kz`
- `25,000 Kz`
- `25.000,50 Kz`
- `AOA 25.000`

## Última verificação

Data: 2026-05-12

Comandos executados localmente:

```bash
npm test -- src/modules/reports/http/report-calculations.spec.ts src/modules/reports/http/reports-overview-pdf.spec.ts
npm run build
```

Resultado:

- Testes passaram.
- Build passou.

Deploy:

- Backend subiu na nova VPS.
- API respondeu health check.
- Container do backend ficou saudável.

## Próximo cuidado

Validar visualmente um PDF real gerado pela admin com dados atuais, porque testes validam cálculo e estrutura, mas não substituem leitura humana do relatório final.
