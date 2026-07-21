# UOR Connect — Pacote de Software Design Documents

```yaml
document_id: UOR-SDD-V1-INDEX
status: superseded
owner: CAVINOVA
authority: historical
version: 1.0
last_reviewed: 2026-07-21
superseded_by: ../../../vision/uor-connect-v2/README.md
```

> Preservado como fonte histórica. Não usar para novas decisões normativas.

`ORIGINAL_SHA256SUMS.txt` preserva os checksums da importação; `SHA256SUMS.txt` valida os mesmos documentos após a adição dos cabeçalhos de governação.

**Organização:** CAVINOVA
**Produto:** UOR Connect
**Versão:** 1.0
**Data:** 2026-07-19
**Estado:** Base arquitetural para revisão e implementação

## Conteúdo

Este pacote define a migração da UOR Connect para uma plataforma modular composta por três experiências independentes:

1. **UOR Connect Estudante**
2. **UOR Connect Eventos**
3. **UOR Connect Direção**

A plataforma partilha identidade, autenticação, autorização, auditoria, notificações, observabilidade e infraestrutura, mas mantém fronteiras funcionais, dados, permissões, APIs e interfaces separadas.

## Documentos

- `SDD-001-UOR-Connect-Platform-Migration.md` — arquitetura global, situação atual, arquitetura alvo, fases, compatibilidade, rollout e rollback.
- `SDD-002-UOR-Connect-Student-and-Integrations.md` — UOR Connect Estudante, Moodle Integration Service, Secretaria Integration Service, notas, finanças e sincronização.
- `SDD-003-UOR-Connect-Events.md` — eventos, participantes, projetos, votação, QR Codes, passaporte, gamificação e certificados.
- `SDD-004-UOR-Connect-Direction.md` — indicadores institucionais, relatórios, privacidade, governação e read models.
- `SDD-005-UOR-Connect-Identity-Security-Infrastructure.md` — identidade, RBAC/ABAC, sessões, segurança, PostgreSQL, Redis, filas, CI/CD e recuperação de desastre.
- `ANEXO-Separacao-UOR-Connect-Estudante-Eventos-Direcao.md` — documento funcional de separação dos produtos, quando disponível.

## Hierarquia de autoridade dos dados

```text
Secretaria
└── fonte oficial de dados académicos, administrativos e financeiros

Moodle
└── fonte pedagógica de disciplinas, materiais, atividades e progresso

UOR Connect
└── agregação, normalização, experiência, alertas, análise e orientação
```

## Regra crítica

- **Notas oficiais existem apenas na Secretaria.**
- Resultados do Moodle são pedagógicos.
- A UOR Connect não deve inventar, recalcular ou promover estimativas a dados oficiais.

## Ordem recomendada de execução

1. Aprovar o SDD-001.
2. Implementar a fundação do SDD-005.
3. Separar e estabilizar Eventos pelo SDD-003.
4. Implementar as integrações e a experiência Estudante pelo SDD-002.
5. Criar a Direção pelo SDD-004, depois da governação de dados.

## Convenções

- Diagramas Mermaid.
- APIs versionadas em `/api/v1`.
- IDs públicos opacos.
- Respostas normalizadas em `{ data, meta }`.
- Dados sensíveis nunca são enviados ao frontend.
- Operações demoradas devolvem `202 Accepted`.
- Endpoints antigos só são removidos após telemetria comprovar ausência de utilização.

## Limites desta versão

Este pacote é uma especificação técnica completa de base, mas não substitui a auditoria do repositório, o inventário real das bases de dados, a validação institucional, o pentest ou os testes em staging. Decisões marcadas como pendentes exigem confirmação antes da implementação definitiva.
