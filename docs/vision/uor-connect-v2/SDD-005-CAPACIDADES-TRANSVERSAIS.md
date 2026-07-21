# SDD-005 — Capacidades transversais

```yaml
document_id: SDD-005
status: approved
owner: Plataforma e Segurança UOR Connect
authority: normative
version: 2.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: trimestral e por incidente material
next_review: 2026-10-21
supersedes:
  - ../../wiki/raw/uorconnect-sdd-v1.0/SDD-005-UOR-Connect-Identity-Security-Infrastructure.md
superseded_by:
depends_on:
  - SDD-000-ECOSSISTEMA-UOR-CONNECT.md
```

## 1. Âmbito

Este documento é autoridade sobre mecanismos partilhados. Não decide quais funções um produto oferece nem a finalidade de tratamento dos seus dados.

## 2. Identidade

- Uma conta representa uma pessoa ou identidade técnica controlada.
- Um perfil institucional relaciona conta, instituição, identificador visível e estado.
- `institution_id + student_number` é único; o ID técnico é opaco.
- Identidades externas são vinculadas com prova de controlo e auditoria.
- A desativação preserva histórico conforme retenção aplicável.

## 3. Autenticação e sessões

- Sessões são próprias da UOR Connect e separadas das sessões upstream.
- Cookies usam `HttpOnly`, `Secure` em produção e política `SameSite` adequada.
- Tokens possuem audiência, emissor, expiração e rotação definidos.
- Credenciais da Secretaria/Moodle não chegam ao frontend após submissão.
- MFA é obrigatório para Direção, administração sensível e acesso emergencial.

## 4. Autorização

Combinar RBAC, atributos, ownership, tenant e finalidade. Negar por padrão. IDs fornecidos pelo cliente nunca bastam como autorização.

Permissões usam `produto.recurso.ação[_escopo]`; é proibido `acesso_completo`. Toda elevação possui prazo e auditoria.

## 5. Consentimento e representação

UOR Connect fornece registo, OTP, expiração, revogação, evidência, notificação e auditoria. O produto define finalidade, atores, recurso, dados, duração e consequência da revogação.

Consentimento não substitui outra base legítima nem autoriza uso incompatível. Revogação impede novos acessos e preserva a prova mínima necessária.

## 6. Auditoria

- A infraestrutura e integridade do registo pertencem à UOR Connect.
- O significado do evento pertence ao produto de origem.
- Toda entrada contém ator, ação, recurso, tenant, resultado, tempo e correlação.
- Segredos, cookies e conteúdo excessivo são redigidos.
- Consulta exige finalidade e política conjunta com o produto.
- Investigação de segurança é feita por equipa autorizada e escopo mínimo.

## 7. Segurança de integração

- Adaptadores isolam URLs, HTML, cookies, seletores e IDs upstream.
- Contratos de entrada e saída são validados.
- Sessões externas são cifradas, limitadas e revogáveis.
- Repetições usam backoff, jitter, locks e limites.
- HTTP público sem TLS é bloqueador de produção para dados académicos.
- Escrita externa exige autorização institucional, idempotência, confirmação e reconciliação.

## 8. Dados e privacidade

- Minimização, finalidade e retenção são explícitas.
- Dados sensíveis são cifrados em trânsito e, quando necessário, em repouso.
- Backups são cifrados e restauração é testada.
- Exportação e eliminação respeitam ownership, retenção e dependências legais.
- Agregações aplicam limiares e medidas contra reidentificação.

## 9. APIs e contratos

- Novos contratos públicos usam `/api/v1` e envelope `{ data, meta }`.
- IDs públicos são opacos.
- Erros não expõem stack, segredo ou detalhe upstream.
- Operações longas devolvem `202` com estado consultável.
- Eventos internos têm schema e versão.

## 10. Notificações e ficheiros

- Notificações não incluem conteúdo sensível desnecessário.
- Preferências, consentimento e finalidade são respeitados.
- Uploads validam tipo real, tamanho, malware quando aplicável e ownership.
- Downloads sensíveis exigem autorização no momento do acesso.

## 11. Observabilidade

Logs, métricas e traces incluem produto, domínio, tenant, correlação, duração, resultado e fonte, sem segredos. Alertas cobrem falhas de autenticação, parsing, filas, integrações, autorização e auditoria.

## 12. Infraestrutura

Ambientes são separados; segredos ficam fora do repositório; migrations possuem estratégia; filas são idempotentes; health checks distinguem prontidão e vida; capacidade e custos são monitorizados. Kubernetes não é obrigatório.

## 13. Continuidade

Definir RPO/RTO por produto, backups, ensaios de restauração, resposta a incidentes, rotação de credenciais, rollback e comunicação. Falhas externas preservam último dado válido com indicação `stale`.

## 14. Critérios de aceitação

- Testes negativos cobrem ownership, tenant e finalidade.
- Não há permissão universal.
- Segredos não aparecem em logs ou contratos.
- Produtos não acedem diretamente a dados privados alheios.
- Consentimentos possuem finalidade de produto e mecanismo transversal auditável.
- Integrações são substituíveis sem alterar o domínio.

## Open Questions

| ID | Questão | Responsável | Impacto | Condição | Estado | Atualiza |
| --- | --- | --- | --- | --- | --- | --- |
| OQ-SEC-001 | Qual provedor definitivo de MFA/OTP? | Segurança | operações sensíveis | antes da fase de autorizações | open | SDD-005, ADR futuro |
| OQ-SEC-002 | Quais RPO/RTO por produto? | Operação/Produto | continuidade | antes do piloto de cada produto | open | SDD-005 |
