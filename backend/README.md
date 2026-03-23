# UOR Connect API (Fastify + Zod + Prisma)

Back-end enxuto para cumprir os requisitos do documento **REQUISITOS.md** usando conceitos de SOLID e arquitetura limpa.

## Scripts
- `npm run dev` – servidor em desenvolvimento (tsx watch).
- `npm run build` – compila para `dist`.
- `npm start` – roda buildado.
- `npm test` – Vitest (inclui caso para criação de submissão).
- `npm run prisma generate` – gera Prisma Client.
- `npm run prisma db push` – aplica o schema no SQLite.
- `npm run prisma db seed` – popula agenda e palestrantes iniciais.
- `npm run lint` – tsc --noEmit.

## Endpoints principais
- `POST /submissions` – cria submissão (Projeto/Negócio/Produto) com validações de domínio do email, lista de membros, comprovativo, etc.
- `GET /submissions` – lista com filtros por status/tipo.
- `GET /submissions/:id/summary` – votos, média de rating e reviews.
- `POST /submissions/:id/vote` – voto único por estudante (email institucional).
- `POST /submissions/:id/review` – rating 1-5 + comentário (mín. 10 chars, um por estudante).
- `GET /agenda` – itens de agenda (2 dias).
- `GET /speakers` – palestrantes.
- `GET /stats` – KPIs (participantes, submissões, aprovados, votos, média rating).
- `GET /health` – health check.

## Estrutura SOLID / Clean
- `src/modules/submission` – domínio, casos de uso, repositórios Prisma, rotas HTTP.
- `src/modules/agenda`, `src/modules/speaker`, `src/modules/stats` – consultas de leitura.
- `src/shared/prisma.ts` – Prisma Client com adapter better-sqlite3.
- `src/config/env.ts` – validação de env com Zod.
- `src/core/routes` – orquestração de rotas.

## Banco local
- `.env` já aponta para SQLite: `DATABASE_URL="file:./dev.db"`.
- Criar/atualizar schema: `npm run prisma db push`.
- Semear dados básicos: `npm run prisma db seed`.

## Observações
- Regras de negócio implementadas: email institucional obrigatório, 1-5 membros calculados a partir dos nomes submetidos, duplicado (nome + líder) bloqueado, voto único, rating único e editável, comentário mínimo 10 caracteres, submissão só votável se aprovada.
- Status de submissão default `PENDING`; endpoint para aprovação pode ser adicionado em `/admin` futuramente.
