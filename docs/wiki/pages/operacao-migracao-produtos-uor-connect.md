# Operação da Migração UOR Connect v2

Status: ativo
Última atualização: 2026-07-21
Autoridade: síntese informativa do [MIG-001](../../vision/uor-connect-v2/MIG-001-TRANSICAO-PLATAFORMA-ATUAL.md)

## Sequência

1. Governação, contratos e testes de fronteira.
2. Fundação e shell próprios da UOR Estudante.
3. Núcleo académico e Secretaria Integration.
4. Isolamento das rotas/módulos da UOR Eventos.
5. Inteligência e comunidade Estudante.
6. Read models e produto UOR Direção.
7. Separação física somente quando justificada.

## Guardrails

- Não refatorar antes de diagnosticar ownership.
- Não escrever em Secretaria/Moodle sem autorização e ambiente apropriado.
- Novos contratos usam `/api/v1` e IDs opacos.
- Nenhuma nova alteração aumenta divergências conhecidas.
- Redirects antigos permanecem até telemetria e rollback aprovados.
- Admin atual não é tratado como UOR Direção.

## Verificação

Build/typecheck, testes focados, contratos negativos, revisão de links/IDs e atualização da [matriz Estudante](../../vision/uor-connect-v2/requirements/UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md).
