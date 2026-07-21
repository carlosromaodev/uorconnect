# Arquitetura do Ecossistema UOR Connect

Status: ativo
Última atualização: 2026-07-21
Autoridade: síntese informativa de [`docs/vision/uor-connect-v2/`](../../vision/uor-connect-v2/README.md)

## Decisão

UOR Connect é o ecossistema. UOR Estudante, UOR Eventos e UOR Direção são produtos com contratos, permissões, dados e evolução próprios. A transição usa monólito modular: implantação conjunta não permite acesso direto entre dados privados de domínios.

## Contextos

| Contexto | Responsabilidade |
| --- | --- |
| UOR Estudante | jornada académica individual e integrações Secretaria/Moodle |
| UOR Eventos | eventos, projetos, votação, QR, passaporte e certificados |
| UOR Direção | indicadores/read models institucionais autorizados |
| UOR Connect transversal | identidade, sessão, autorização, auditoria técnica, notificações, ficheiros, segurança e infraestrutura |

## Contratos-alvo

```text
/api/v1/student
/api/v1/events
/api/v1/direction
/api/v1/integrations/moodle
/api/v1/integrations/secretaria
```

## Estado real

- Os três endpoints de produto são ainda declarativos.
- Moodle possui integração funcional em `/integrations/moodle`.
- Secretaria API declara `planned/not_synced`; parsing funcional permanece em autenticação.
- Frontend/backend/deploy são aplicações únicas.
- Direção ainda não possui domínio funcional próprio.

Detalhes: [SDD-000](../../vision/uor-connect-v2/SDD-000-ECOSSISTEMA-UOR-CONNECT.md), [SDD-005](../../vision/uor-connect-v2/SDD-005-CAPACIDADES-TRANSVERSAIS.md) e [MIG-001](../../vision/uor-connect-v2/MIG-001-TRANSICAO-PLATAFORMA-ATUAL.md).
