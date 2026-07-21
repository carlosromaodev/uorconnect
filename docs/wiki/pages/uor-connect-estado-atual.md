# Estado Atual do UOR Connect

Status: ativo
Última atualização: 2026-07-21
Fontes: código atual e [MIG-001](../../vision/uor-connect-v2/MIG-001-TRANSICAO-PLATAFORMA-ATUAL.md)

## Visão factual

O sistema implantado continua orientado sobretudo à UOR Eventos: portal, projetos, votação, passaportes, certificados, comunicação e administração partilham frontend, backend e base.

## Separação iniciada

- `/estudante`, `/eventos` e `/direcao` existem como gateways, não produtos completos.
- `/api/v1/student`, `/events` e `/direction` são endpoints de contexto.
- Moodle possui integração robusta e testada, ainda consumida fora de um shell Estudante completo.
- Secretaria possui parsing no login; a API própria ainda está `planned/not_synced`.
- UOR Direção funcional ainda não existe; admin/relatórios atuais são operacionais de Eventos.

## Fundação disponível

- identidade composta `institutionCode + studentNumber` no schema;
- autenticação institucional, perfis, consentimentos e auditoria parcial;
- snapshots, sessão cifrada e sincronização Moodle;
- PostgreSQL, Redis, Caddy, Evolution API e observabilidade operacional existente.

## Divergências

- nomes antigos dos produtos ainda no código;
- JWT/consultas legadas nem sempre carregam contexto institucional completo;
- rotas de Eventos permanecem na raiz;
- módulos partilham Prisma sem enforcement de ownership;
- deploy não é independente por produto.

A visão normativa está em [UOR Connect v2](../../vision/uor-connect-v2/README.md).
