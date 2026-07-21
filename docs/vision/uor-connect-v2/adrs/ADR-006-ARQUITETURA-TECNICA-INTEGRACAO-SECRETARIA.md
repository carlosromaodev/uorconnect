# ADR-006 — Arquitetura técnica da integração Secretaria

```yaml
document_id: ADR-006
status: accepted
owner: Arquitetura UOR Estudante
authority: informative_until_approved
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por alteração de arquitetura/provedor
next_review: piloto da escrita Secretaria sobre TLS
supersedes:
superseded_by:
depends_on:
  - ../SDD-002-UOR-ESTUDANTE.md
  - ../SDD-005-CAPACIDADES-TRANSVERSAIS.md
  - ADR-002-MONOLITO-MODULAR.md
  - ADR-003-IDENTIDADE-INSTITUCIONAL.md
  - ADR-004-PROPRIEDADE-DOS-DADOS.md
  - ADR-005-INTEGRACOES-EXTERNAS.md
  - ../../../superpowers/specs/2026-07-21-secretaria-uor-estudante-api-design.md
```

## Contexto

O repositório atual usa backend Fastify, schemas Zod, Prisma e persistência SQLite/PostgreSQL conforme o ambiente. A integração Moodle estabeleceu padrões para gateway web, envelopes cifrados, sessão, snapshots, leases, workers, schemas HTTP e testes. A nova integração Secretaria está isolada em módulo próprio, com fundação de sessão/leitura/snapshot e primeiro comando financeiro implementado; a migração do acoplamento legado de autenticação continua separada.

A especificação da API Secretaria → UOR Estudante define comportamentos obrigatórios, mas não deve eternizar tecnologias ou caminhos físicos. Este ADR registra as escolhas técnicas propostas após a auditoria inicial do repositório.

## Decisão

### 1. Implantação e fronteira

- Manter a integração no monólito modular durante a transição, conforme ADR-002.
- Isolar o código em `backend/src/modules/secretaria` com limites de domínio, aplicação, infraestrutura e HTTP.
- Expor uma porta de identidade institucional ao módulo de autenticação; `auth` deixa de importar diretamente o cliente netPA.
- Permitir futura extração para serviço separado sem alterar o contrato HTTP ou os casos de uso.

### 2. Contratos HTTP

- Manter Fastify por ser o composition root vigente.
- Usar Zod e o type provider já adotado para validação e schemas OpenAPI.
- Manter `/api/v1/integrations/secretaria` como rota canónica interna.
- Representar erros com Problem Details e códigos seguros do domínio.

### 3. Persistência

- Usar Prisma nos repositórios de aplicação, sem expô-lo ao domínio ou às rotas.
- Usar PostgreSQL em produção e nos testes que dependam de concorrência, locks, leases, decimal, constraints ou publicação atómica.
- Permitir memória/SQLite apenas em testes que não dependam dessas semânticas.
- Persistir ligação, referências públicas, snapshots, sync runs, comandos, tentativas, evidências e pedidos de eliminação em modelos próprios da UOR Estudante.

### 4. Cifragem e chaves

- Generalizar a primitiva AES-256-GCM validada no módulo Moodle para uma biblioteca interna de envelopes, sem tornar o módulo Secretaria dependente do Moodle.
- Usar envelopes distintos para credencial, sessão, payloads/locators sensíveis e resultados financeiros.
- Incluir AAD com versão, finalidade, instituição, estudante e geração.
- Derivar `chargeRef` por HMAC com domínio próprio e aceitar candidatos de chaves ainda vigentes durante rotação; IDs upstream nunca entram no contrato público.
- Configurar keyring por segredo externo à base de dados, com rotação na leitura, revogação e inventário por `keyId`.
- Nunca armazenar a senha descifrada no cache de aplicação.

KMS/cofre dedicado permanece a implantação preferencial de produção quando disponível. O formato de envelope deve permitir a migração sem alterar o contrato do produto.

### 5. Sessão e cache

- Manter apenas sessões descifradas num cache privado L1 curto, proposto em até cinco minutos.
- Consultar a geração/versão persistida antes de reutilizar a sessão em operações sensíveis.
- Descodificar a credencial somente durante autenticação ou renovação; o plaintext não entra no L1.
- Usar single-flight por estudante dentro da instância.

O TTL exato será configuração operacional, não invariante do produto.

### 6. Concorrência e tarefas

- Usar compare-and-swap, geração e leases duráveis para coordenação entre instâncias.
- Usar hora da base para validade de lease.
- Implementar workers embutidos para sincronizações, reconciliações e eliminações enquanto a escala não justificar fila externa.
- Aplicar heartbeat, reclaim de lease expirado e fence por geração.
- Separar exclusão por estudante/agregado para impedir escritas concorrentes incompatíveis.

### 7. Adaptador netPA

- Implementar gateway com cookie jar isolado, redirects manuais, host allowlist, budgets, limites de bytes e content type.
- Manter parsers puros e contratos upstream versionados por capacidade.
- Capturar somente fixtures anonimizadas.
- Não devolver HTML, cookies, URLs internas ou IDs upstream à aplicação.
- Permitir substituição pelo gateway de API oficial no futuro.

### 8. Feature flags e circuit breakers

- Configuração global habilita/desabilita a integração.
- Cada escrita possui feature flag e circuit breaker próprios.
- O catálogo calcula `available`, `disabled`, `degraded`, `changed` ou `unsupported` a partir da configuração, contrato e saúde.
- Contract drift numa capacidade não derruba leituras independentes.

### 9. Configuração proposta

- base URL e permissão explícita de HTTP somente fora de produção;
- timeouts e limites de resposta/ficheiro;
- keyring e chave ativa;
- TTL de sessão L1;
- concorrência de sync/comandos;
- habilitação de workers;
- allowlist de hosts;
- flags por capacidade de escrita.

Em produção, base HTTP, keyring inválido ou configuração crítica ausente impedem a ativação da integração.

### 10. Testes e CI

- Unitários para domínio, parsers, envelopes, redaction e cookie jar.
- Integração HTTP com dependências injetáveis e gateway falso.
- Repositório e concorrência em PostgreSQL real e descartável.
- Contrato netPA com fixtures anonimizadas e fetch controlado.
- Ponta a ponta autorizado por capacidade; mutação começa desligada e só recebe `verified` após evidência.

## Alternativas consideradas

### Proxy direto

Rejeitado porque expõe fragilidade upstream ao contrato, impede fallback consistente e torna escritas ambíguas perigosas.

### Microserviço imediato

Adiado. Aumentaria operação e consistência distribuída antes de a fronteira funcional estabilizar. A modularização preserva uma rota de extração futura.

### Sessão sem credencial persistida

Reduz o impacto de comprometimento, mas impede renovação e sincronização automática autorizadas. Continua válida como modo operacional caso a aprovação institucional da persistência não seja concedida.

### KMS e fila externa obrigatórios desde a primeira entrega

Oferecem isolamento superior, mas dependem de infraestrutura ainda não confirmada. O desenho mantém compatibilidade com ambos sem os tornar pré-requisito de desenvolvimento.

## Consequências

- A integração aproveita padrões já testados sem acoplamento ao módulo Moodle.
- PostgreSQL torna-se obrigatório para validar os aspetos concorrentes reais.
- A credencial persistida eleva o risco operacional e exige threat model e aprovação antes da produção.
- Workers embutidos simplificam a primeira implantação, mas precisam de leases corretos.
- Cada mutação tem custo explícito de contrato, teste e manutenção.
- Alterar framework, base, key management ou fila exigirá revisão deste ADR, não alteração dos requisitos funcionais.

## Critérios para aprovação do ADR

- Auditoria do código confirma compatibilidade com o composition root e o Prisma vigentes.
- Threat model e política de chaves/credenciais são aceites.
- Estratégia PostgreSQL descartável está disponível em CI.
- Fronteiras com `auth`, auditoria, consentimento e UOR Direção estão validadas.
- Não há exposição direta de envelopes, tabelas ou modelos upstream.
