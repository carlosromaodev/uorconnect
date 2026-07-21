# SDD-000 — Ecossistema UOR Connect

```yaml
document_id: SDD-000
status: approved
owner: CAVINOVA
authority: normative
version: 2.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por alteração de produto ou fronteira
next_review: 2026-10-21
supersedes:
  - ../../wiki/raw/uorconnect-sdd-v1.0/ANEXO-Separacao-UOR-Connect-Estudante-Eventos-Direcao.md
superseded_by:
depends_on:
  - GLOSSARIO-E-MODELO-CONCEPTUAL.md
```

## 1. Visão

UOR Connect é um ecossistema digital universitário composto por três produtos:

- **UOR Estudante**: jornada académica individual.
- **UOR Eventos**: descoberta, participação e operação de eventos.
- **UOR Direção**: análise e decisão institucional autorizada.

Os produtos partilham mecanismos técnicos quando isso reduz risco e duplicação, mas não partilham indiscriminadamente funções, dados, menus ou permissões.

## 2. Princípios

1. Produto antes de módulo: cada experiência tem missão, público, dados, permissões e roadmap próprios.
2. Negação por padrão: identidade partilhada não implica acesso partilhado.
3. Propriedade explícita: todo dado e capacidade possuem um dono.
4. Contratos em vez de tabelas: domínios não leem diretamente tabelas privadas alheias.
5. Proveniência: dado oficial, calculado, estimado e comunitário são distinguíveis.
6. Migração incremental: o legado permanece disponível enquanto houver dependência comprovada.
7. Privacidade por finalidade: acesso exige necessidade, âmbito e auditoria.
8. Monólito modular primeiro: separação lógica precede separação física.

## 3. Produtos e exclusões

| Produto | Missão | Não é |
| --- | --- | --- |
| UOR Estudante | organizar, interpretar e apoiar a vida académica individual | cópia da Secretaria/Moodle ou administração de eventos |
| UOR Eventos | gerir experiências e operações de eventos | portal académico permanente ou analytics institucional geral |
| UOR Direção | disponibilizar indicadores e decisões por contratos autorizados | super-admin irrestrito ou editor direto de dados transacionais |

## 4. Capacidades transversais

UOR Connect é proprietário dos mecanismos comuns de identidade, autenticação, sessão, autorização, auditoria técnica, notificações, ficheiros, observabilidade, segurança, infraestrutura e design system.

O produto de origem continua proprietário da finalidade funcional. Exemplo: Estudante define por que e quais notas um explicador recebe; UOR Connect executa o ciclo técnico de consentimento, OTP, expiração e auditoria.

## 5. Propriedade dos dados

| Dado/capacidade | Proprietário | Consumo permitido |
| --- | --- | --- |
| Conta e identidade institucional | UOR Connect | produtos autorizados |
| Perfil académico, notas e percurso normalizados | UOR Estudante | titular; Direção por read model autorizado |
| Referências e visão financeira do estudante | UOR Estudante | titular e representantes especificamente autorizados |
| Avaliações pedagógicas | UOR Estudante | estudante; Direção apenas agregada |
| Autorizações académicas | UOR Estudante | mecanismo transversal necessário |
| Eventos, inscrições, projetos, votos e passaportes | UOR Eventos | participantes; Direção por indicadores |
| Configuração académica institucional | UOR Direção | produtos por contratos explícitos |
| Configuração de eventos | UOR Eventos | operadores autorizados |
| Configuração própria de produto | produto respetivo | consumidores declarados |
| Configuração transversal de identidade/segurança | UOR Connect | produtos por contratos explícitos |
| Infraestrutura do registo de auditoria | UOR Connect | produtos e segurança autorizada |
| Significado do evento auditado | produto de origem | produto e segurança autorizada |
| Política de consulta da auditoria | UOR Connect + produto | atores com finalidade e permissão |

`Partilhado` não significa acesso universal.

## 6. Identidade institucional

```text
Conta
└── Perfil institucional
    ├── Instituição
    ├── Número de estudante
    ├── Curso
    └── Estado académico
```

- O número académico é visível e pesquisável.
- `institution_id + student_number` é único.
- Relações técnicas usam identificador interno opaco.
- Uma conta poderá ter vários perfis institucionais.
- Mudanças no número académico preservam o histórico.
- URLs e decisões de acesso nunca dependem apenas do número académico.

## 7. Interação entre produtos

- Chamadas síncronas usam interfaces ou APIs versionadas.
- Processos demorados usam eventos/tarefas idempotentes.
- Eventos internos possuem versão, origem, tenant e correlação.
- UOR Direção consome read models e agregações; não edita tabelas alheias.
- Comandos institucionais voltam ao produto proprietário por contrato explícito.

## 8. Autorização

Não existe `acesso_completo`. Permissões são compostas por ação, recurso, titular, instituição e finalidade. Acesso emergencial exige justificação, aprovação adicional, prazo curto, escopo mínimo, auditoria reforçada e revogação automática.

## 9. Estado atual e alvo

O estado atual é uma aplicação principal orientada sobretudo a Eventos, com autenticação estudantil, integrações e administração partilhadas. O alvo são produtos logicamente isolados, inicialmente no mesmo repositório e runtime quando adequado. O [MIG-001](MIG-001-TRANSICAO-PLATAFORMA-ATUAL.md) governa a transição.

## 10. Critérios de aceitação

- Nome e navegação próprios por produto.
- Contratos e permissões específicos.
- Propriedade dos dados documentada e aplicada.
- Integrações externas isoladas.
- Direção baseada em read models autorizados.
- Auditoria com significado definido pelo produto de origem.
- Legado sem autoridade normativa concorrente.

## Open Questions

As questões transversais são mantidas no [índice](README.md#open-questions).
