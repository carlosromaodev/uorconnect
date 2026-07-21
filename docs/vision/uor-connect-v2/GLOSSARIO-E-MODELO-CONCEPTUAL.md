# Glossário e modelo conceptual

```yaml
document_id: UOR-V2-GLOSSARY
status: approved
owner: Arquitetura de Produto
authority: normative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por novo conceito transversal
next_review: 2026-10-21
supersedes:
superseded_by:
depends_on:
  - SDD-000-ECOSSISTEMA-UOR-CONNECT.md
```

## Termos institucionais

**Instituição:** organização académica identificada de forma estável no ecossistema.

**Universidade:** tipo de instituição de ensino superior. Não é sinónimo obrigatório de tenant técnico.

**Conta:** identidade de autenticação da pessoa na UOR Connect.

**Perfil institucional:** relação entre conta, instituição, identificador académico, curso e estado. Uma conta poderá possuir vários perfis.

**Número de estudante:** identificador académico visível atribuído por uma instituição. Não é chave global nem mecanismo de autorização.

**Estudante:** ator que possui um perfil institucional de estudante.

**Curso:** programa académico ao qual o perfil institucional está associado num período.

**Turma:** agrupamento académico contextual a curso, período e instituição.

**Unidade curricular ou cadeira:** componente curricular. A documentação normativa prefere `unidade curricular`; a interface pode usar `cadeira` conforme o público.

**Período académico:** intervalo institucional como ano letivo, semestre ou época.

**Docente:** pessoa associada institucionalmente ao ensino de uma unidade curricular.

**Explicador:** utilizador validado que presta apoio académico dentro de uma relação e âmbito autorizados.

## Atores e acesso

**Titular:** pessoa a quem os dados ou a ação dizem respeito.

**Beneficiário:** pessoa em cujo interesse uma operação é executada; pode coincidir com o titular.

**Representante:** ator autorizado a executar uma ação específica em nome do titular.

**Responsável:** pessoa associada pelo estudante para finalidades delimitadas, sem acesso geral automático.

**Permissão:** capacidade técnica concedida a um ator para uma ação/recurso sob condições.

**Autorização:** delegação contextual entre atores, com ação, recurso, dados, duração, usos e estado.

**Consentimento:** manifestação registada para uma finalidade e âmbito definidos. Não é sinónimo de permissão técnica.

**Acesso emergencial:** elevação excecional, justificada, aprovada, curta, auditada e automaticamente revogada.

## Dados

**Dado oficial:** recebido de uma fonte institucional com autoridade sobre o facto.

**Dado calculado:** resultado determinístico produzido pela UOR Estudante a partir de entradas identificadas.

**Dado estimado:** previsão não oficial com método, incerteza e atualização identificáveis.

**Dado comunitário:** informação fornecida por utilizadores e não confirmada pela fonte oficial.

**Proveniência:** origem, momento, método, cobertura e transformação de um dado.

**Cobertura:** grau em que uma resposta representa o universo esperado: `exact`, `partial`, `not_synced`, `unsupported`, `stale` ou `failed`.

**Read model:** representação derivada e orientada a consulta, criada por contrato sem transferir propriedade do dado de origem.

## Arquitetura

**Produto:** experiência com missão, público, regras, dados, permissões e roadmap próprios.

**Ecossistema:** conjunto de produtos e capacidades partilhadas sob UOR Connect.

**Capacidade transversal:** mecanismo técnico comum cuja finalidade funcional permanece no produto de origem.

**Domínio:** fronteira coerente de conceitos e regras de negócio.

**Monólito modular:** implantação física conjunta com módulos, contratos e propriedade isolados.

**Provedor:** sistema externo que fornece ou recebe dados por integração.

**Integração:** adaptador que traduz transporte e formatos externos para contratos internos.

**Fonte autoritativa:** sistema responsável pelo valor oficial de um tipo de dado.

## Modelo conceptual

```text
Conta 1 ── N Perfil institucional N ── 1 Instituição
                         │
                         ├── Curso / Turma / Estado académico
                         ├── Dados oficiais sincronizados
                         └── Capacidades próprias do produto

UOR Estudante ── usa ── Secretaria Integration / Moodle Integration
UOR Eventos   ── publica indicadores ──> UOR Direção
UOR Estudante ── publica read models ──> UOR Direção
Todos os produtos ── usam mecanismos ──> UOR Connect
```
