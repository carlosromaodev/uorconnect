# UOR Connect — Desenho da Visão Documental v2

```yaml
document_id: UOR-VISION-V2-DESIGN
status: approved
owner: CAVINOVA
authority: normative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por marco de migração ou alteração de fronteira
next_review: conclusão do diagnóstico documental e técnico inicial
supersedes:
superseded_by:
depends_on:
  - System Design Document — UOR Estudante, versão 1.0, 2026-07-21
```

## 1. Finalidade

Este documento define como reorganizar a visão normativa da UOR Connect e como avaliar o estado real da sua implementação.

A UOR Connect permanece como nome do ecossistema. O ecossistema será composto por três produtos com fronteiras próprias:

1. UOR Estudante.
2. UOR Eventos.
3. UOR Direção.

Esta entrega é documental e diagnóstica. Não autoriza refatoração silenciosa do código, migração de dados, remoção de rotas ou separação física dos serviços.

## 2. Decisões aprovadas

### 2.1 Marca e nomenclatura

- **UOR Connect** identifica o ecossistema e as capacidades partilhadas.
- **UOR Estudante**, **UOR Eventos** e **UOR Direção** são produtos independentes.
- As expressões `UOR Connect Estudante`, `UOR Connect Eventos` e `UOR Connect Direção` não serão usadas como nomes normativos dos produtos.
- Moodle e Secretaria são provedores externos da UOR Estudante, não produtos da UOR Connect.

### 2.2 Estratégia documental

Será criada uma fonte normativa v2 sem apagar os documentos antigos. Documentos anteriores que ditam uma visão substituída receberão metadados explícitos de substituição e ligações para a autoridade nova.

Relatórios históricos, memórias de intervenção, planos concluídos e documentação estritamente operacional serão preservados. Um índice vivo poderá ser atualizado para lhes atribuir a classificação correta.

### 2.3 Estado técnico inicial

A migração poderá começar num monólito modular. Isso não significa partilha indiscriminada de dados ou lógica. A separação lógica exige:

- limites de domínio explícitos;
- módulos e contratos próprios por produto;
- permissões específicas por ação e recurso;
- propriedade explícita dos dados;
- proibição de acesso direto às tabelas privadas de outro domínio;
- comunicação por interfaces, serviços internos ou eventos versionados;
- possibilidade de separação física posterior sem redefinir o negócio.

## 3. Estrutura documental normativa

```text
docs/vision/uor-connect-v2/
├── README.md
├── SDD-000-ECOSSISTEMA-UOR-CONNECT.md
├── SDD-002-UOR-ESTUDANTE.md
├── SDD-003-UOR-EVENTOS.md
├── SDD-004-UOR-DIRECAO.md
├── SDD-005-CAPACIDADES-TRANSVERSAIS.md
├── MIG-001-TRANSICAO-PLATAFORMA-ATUAL.md
├── GLOSSARIO-E-MODELO-CONCEPTUAL.md
│
├── requirements/
│   ├── UOR-ESTUDANTE-RF-RNF-REGRAS-NEGOCIO.md
│   └── UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md
│
└── adrs/
    ├── ADR-001-SEPARACAO-DOS-PRODUTOS.md
    ├── ADR-002-MONOLITO-MODULAR.md
    ├── ADR-003-IDENTIDADE-INSTITUCIONAL.md
    ├── ADR-004-PROPRIEDADE-DOS-DADOS.md
    └── ADR-005-INTEGRACOES-EXTERNAS.md
```

O plano de transição é identificado por `MIG`, e não por `SDD`, para impedir que uma estratégia temporária seja interpretada como arquitetura permanente.

## 4. Metadados documentais

Todo documento normativo v2 deverá começar com metadados equivalentes a:

```yaml
document_id:
status: draft | proposed | approved | deprecated | superseded
owner:
authority: normative | informative | historical
version:
last_reviewed:
approved_by:
approved_at:
review_cycle:
next_review:
supersedes:
superseded_by:
depends_on:
```

Campos de aprovação podem ficar vazios em documentos `draft` ou `proposed`. Documentos substituídos devem declarar `status: superseded` e `superseded_by` no próprio ficheiro.

## 5. Precedência e resolução de conflitos

A precedência normativa é:

1. `SDD-000`: visão, vocabulário, produtos e fronteiras do ecossistema.
2. `SDD-005`: autoridade exclusiva sobre mecanismos transversais.
3. SDD do produto: autoridade exclusiva sobre arquitetura, capacidades e dados do produto.
4. RF/RNF/RN: refinamento verificável dos respetivos SDDs.
5. ADRs: decisões técnicas subordinadas aos documentos anteriores.
6. Matriz de rastreabilidade: estado factual da implementação, sem autoridade comportamental.

Regras de conflito:

- o documento mais específico prevalece dentro do seu âmbito;
- o `SDD-005` e o SDD do produto possuem autoridade equivalente nos respetivos âmbitos;
- quando uma capacidade de produto utiliza um mecanismo transversal, ambos os SDDs devem ser satisfeitos;
- o `SDD-005` não redefine funções, finalidades ou dados próprios de um produto;
- nenhum ADR pode contrariar um requisito aprovado;
- a matriz nunca define o comportamento esperado;
- divergências existentes entre o código e a visão v2 devem ser registadas na matriz e no plano de transição;
- novas alterações não podem aumentar essas divergências nem introduzir comportamento contrário à documentação aprovada sem uma alteração documental explícita;
- conflitos encontrados devem ser registados e resolvidos, nunca interpretados implicitamente pelo agente de implementação.

Exemplo: o `SDD-002` determina se um explicador pode aceder aos dados de uma cadeira; o `SDD-005` determina como sessão, autorização, OTP e auditoria desse acesso funcionam.

### 5.1 Identidade institucional obrigatória

O `SDD-000` e o `ADR-003` deverão formalizar a identidade institucional com as seguintes regras:

- o número de estudante é o identificador académico visível;
- a combinação `institution_id + student_number` é única;
- o sistema utiliza um identificador interno opaco nas relações técnicas;
- uma conta poderá possuir mais de um perfil institucional no futuro;
- o número de estudante não é uma chave global isolada;
- correções do número académico não podem quebrar o histórico;
- URLs, permissões e decisões de acesso não podem depender apenas do número de estudante.

Modelo conceptual:

```text
Conta
└── Perfil institucional
    ├── Instituição
    ├── Número de estudante
    ├── Curso
    └── Estado académico
```

## 6. Fronteiras dos produtos

### 6.1 UOR Estudante

Produto académico individual e principal consumidor das integrações com Secretaria e Moodle.

Capacidades previstas:

- identidade e perfil académico;
- sincronização e proveniência dos dados;
- notas, médias, simulações, dispensa e bolsa;
- rankings privados e cobertura estatística;
- mapa e previsão do percurso curricular;
- horário, exames, agenda e sobrecarga;
- faltas, presenças e validação comunitária;
- docentes e avaliações pedagógicas;
- explicadores e planos de estudo;
- recursos e representação coletiva;
- autorizações, OTP, SMS e responsáveis;
- finanças e partilha de referências;
- mercado académico e moderação.

O produto não altera automaticamente dados oficiais nem processa pagamentos na fase inicial.

### 6.2 UOR Eventos

Produto dedicado à descoberta e operação de eventos, incluindo catálogo, inscrições, projetos, equipas, votação, agenda, QR Codes, passaporte, desafios, pontuação, certificados, formadores, palestrantes e administração operacional.

O produto deve funcionar sem depender da Secretaria ou do Moodle.

O `SDD-003` começará como `draft` e documentará apenas missão, fronteira, propriedade dos dados, dependências permitidas, capacidades confirmadas, exclusões e questões abertas. O detalhe integral depende de uma análise própria.

### 6.3 UOR Direção

Produto institucional protegido para indicadores agregados, qualidade dos dados, relatórios, alertas, auditoria autorizada e análises académicas, financeiras, pedagógicas e de eventos.

Regras obrigatórias:

- não é proprietário das notas individuais;
- não altera diretamente dados transacionais da UOR Estudante ou UOR Eventos;
- recebe dados por contratos e read models autorizados;
- aplica limiares e regras de privacidade aos indicadores agregados;
- acesso individual exige finalidade, permissão e auditoria;
- operações permanecem no produto de origem;
- decisões ou comandos são enviados por contratos explícitos, nunca por edição de tabelas alheias.

O `SDD-004` começará como `draft` com o mesmo nível de prudência do `SDD-003`.

### 6.4 Capacidades transversais

Pertencem ao ecossistema UOR Connect:

- identidade institucional;
- autenticação e sessões;
- autorização;
- instituições e multi-tenancy;
- mecanismo técnico de consentimento;
- notificações;
- auditoria;
- ficheiros;
- observabilidade;
- infraestrutura;
- design system e convenções técnicas.

Uma sessão ou identidade partilhada não concede automaticamente acesso aos três produtos.

A capacidade transversal gere o ciclo técnico do consentimento: registo, OTP, expiração, revogação, auditoria, evidência e notificação. O produto de origem define a finalidade, os dados, os atores, a duração, o recurso, a base funcional e as consequências da revogação.

## 7. Propriedade dos dados

O `SDD-000` deverá conter uma matriz normativa. A base aprovada é:

| Dado ou capacidade | Proprietário | Consumidores permitidos |
| --- | --- | --- |
| Identidade institucional | UOR Connect | Produtos autorizados |
| Sessões e autorização transversal | UOR Connect | Produtos no respetivo contexto |
| Notas normalizadas | UOR Estudante | Titular; Direção por read model autorizado |
| Autorizações académicas | UOR Estudante | Serviços transversais necessários |
| Referências financeiras | UOR Estudante | Titular e representantes autorizados |
| Avaliações de docentes | UOR Estudante | Direção por dados agregados |
| Inscrições em eventos | UOR Eventos | Titular; Direção por indicador autorizado |
| Projetos, votos e passaportes | UOR Eventos | Participantes autorizados; Direção por indicador |
| Configuração académica institucional | UOR Direção | Produtos através de contratos explícitos |
| Configuração de eventos | UOR Eventos | Participantes e operadores autorizados |
| Configuração própria de produto | Produto respetivo | Consumidores definidos pelo produto |
| Configuração transversal de identidade e segurança | UOR Connect | Produtos através de contratos explícitos |
| Infraestrutura e armazenamento da auditoria | UOR Connect | Produtos e segurança autorizados |
| Significado funcional do evento auditado | Produto de origem | Produto de origem e segurança autorizada |
| Política de consulta da auditoria | UOR Connect + produto de origem | Atores com finalidade e permissão explícitas |
| Investigação de segurança | Equipa autorizada | Evidência estritamente necessária à investigação |

`Partilhado` nunca significa que qualquer módulo pode ler ou alterar qualquer dado.

## 8. Autorização e acesso emergencial

É proibida uma permissão genérica de `acesso_completo`. A autorização deve compor permissões específicas por ação, recurso, instituição, titular e finalidade.

Exemplos:

```text
student.grades.read_own
student.finance.read_own
student.payment_reference.share
student.calendar.personal.manage
student.authorization.approve
events.operations.manage
direction.analytics.read
```

Um mecanismo de acesso emergencial, se adotado, exige:

- justificação obrigatória;
- aprovação adicional;
- prazo curto;
- âmbito mínimo;
- auditoria reforçada;
- notificação adequada;
- revogação automática.

## 9. Glossário e modelo conceptual

O glossário deverá definir, no mínimo:

- instituição e universidade;
- conta, utilizador e identidade institucional;
- estudante e número de estudante;
- perfil institucional;
- curso, turma e unidade curricular;
- período académico;
- docente e explicador;
- responsável, representante, titular e beneficiário;
- dado oficial, calculado, estimado e comunitário;
- autorização, permissão e consentimento;
- produto, capacidade transversal, provedor e integração.

Termos relacionados não serão tratados como sinónimos sem definição explícita.

## 10. Requisitos da UOR Estudante

### 10.1 Catálogo normativo

O ficheiro `requirements/UOR-ESTUDANTE-RF-RNF-REGRAS-NEGOCIO.md` será a autoridade detalhada dos requisitos da UOR Estudante.

Identificadores:

- `RF-EST-###`: requisito funcional;
- `RNF-EST-###`: requisito não funcional;
- `RN-EST-###`: regra de negócio.

Cada requisito deverá incluir:

- enunciado inequívoco;
- origem;
- prioridade;
- fase;
- dependências;
- critérios de aceitação;
- relações com outros requisitos;
- dados e permissões envolvidos, quando aplicável.

O catálogo cobrirá integralmente a visão funcional do SDD da UOR Estudante, além de segurança, privacidade, desempenho, disponibilidade, acessibilidade, mobile-first, baixo consumo de dados, escalabilidade, manutenibilidade, interoperabilidade, observabilidade, recuperação e qualidade.

### 10.2 Matriz de rastreabilidade

O estado da implementação ficará em `requirements/UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md`, separado do catálogo normativo.

Estados controlados:

```text
planned
in_analysis
partial
implemented
verified
blocked
deprecated
superseded
```

Regras dos marcadores:

- `[x]` exclusivamente para `verified`;
- `[ ]` para todos os outros estados;
- `implemented` significa que existe implementação, mas a verificação ainda é insuficiente;
- um requisito parcial permanece `[ ]`, mesmo que alguns subitens estejam concluídos.

Cada linha ou bloco da matriz deverá conter:

- ID do requisito;
- checkbox;
- estado controlado;
- evidência no código;
- teste associado;
- nível da evidência;
- responsável pela verificação (`verified_by`);
- ambiente da verificação (`verification_environment`);
- versão ou commit verificado (`verified_commit`);
- data e hora da última verificação (`last_verified_at`);
- observações e lacunas.

Níveis controlados de evidência:

```text
static
automated_test
integration_test
runtime_observed
production_observed
```

Toda conclusão da auditoria deverá indicar o nível de evidência. A existência de código inspecionado corresponde no máximo a `static`; não prova, por si só, comportamento operacional.

Comentários, mocks, páginas estáticas, contratos sem runtime ou endpoints que apenas declaram estado não contam como funcionalidade concluída.

## 11. ADRs iniciais

Os ADRs devem registar contexto, alternativas, decisão, consequências e estado:

1. `ADR-001-SEPARACAO-DOS-PRODUTOS.md`.
2. `ADR-002-MONOLITO-MODULAR.md`.
3. `ADR-003-IDENTIDADE-INSTITUCIONAL.md`.
4. `ADR-004-PROPRIEDADE-DOS-DADOS.md`.
5. `ADR-005-INTEGRACOES-EXTERNAS.md`.

Os ADRs não podem reduzir obrigações definidas pelos SDDs ou requisitos aprovados.

## 12. Questões abertas

O `README.md` manterá um índice de questões abertas. Cada SDD poderá manter questões próprias.

Cada questão terá:

- identificador;
- descrição;
- responsável;
- impacto;
- prazo ou condição de decisão;
- estado;
- documento que será atualizado após a decisão.

Estados recomendados: `open`, `in_analysis`, `decided`, `deferred`, `cancelled`.

## 13. Migração documental

A migração deverá:

1. Inventariar todos os ficheiros Markdown atuais.
2. Classificá-los como normativos, informativos, operacionais ou históricos.
3. Identificar o conteúdo ainda válido.
4. Mapear cada documento antigo para a autoridade v2 correspondente.
5. Marcar documentos substituídos sem apagar o histórico.
6. Atualizar índices vivos e referências internas.
7. Preservar relatórios históricos e planos concluídos.
8. Gerar um relatório de links quebrados, fontes concorrentes e referências contraditórias.

Serão considerados documentos de visão todos os Markdown que definam ou condicionem missão, produtos, fronteiras, arquitetura-alvo, propriedade dos dados, identidade, requisitos, regras de negócio, permissões ou roadmap do ecossistema.

Documentos específicos de UOR Eventos, passaportes, administração e credenciais deverão ser classificados no produto correto. Eles não podem continuar a representar a visão geral da UOR Connect.

## 14. Auditoria do projeto

Antes de qualquer refatoração, a auditoria deverá:

- inspecionar frontend, backend, integrações, base de dados e infraestrutura;
- relacionar módulos, rotas, tabelas e aplicações com os três produtos e as capacidades transversais;
- identificar código misturado entre domínios;
- verificar o que está realmente implementado;
- procurar evidências em código, testes, migrações, rotas e comportamento observável;
- identificar acessos diretos que violem as novas fronteiras;
- produzir divergências entre documentação, código e comportamento;
- preencher a matriz de rastreabilidade conservadoramente;
- não considerar comentários, mocks ou endpoints de estado como implementação concluída;
- não refatorar antes da conclusão do diagnóstico inicial.

Regras de segurança da auditoria:

- começa em modo de leitura;
- não altera dados de produção;
- não executa operações de escrita contra Secretaria ou Moodle;
- testes com efeitos colaterais só podem ocorrer num ambiente explicitamente autorizado;
- toda conclusão indica o nível da evidência utilizada.

O diagnóstico deverá separar:

- reutilizável sem alteração relevante;
- reutilizável após isolamento;
- legado a manter durante a transição;
- incompatível com a visão v2;
- ausente;
- risco ou bloqueio externo.

## 15. Plano de transição

O `MIG-001` deverá distinguir:

- estado atual;
- estado-alvo;
- etapas temporárias;
- compatibilidade e redirects;
- dependências;
- critérios de entrada e saída por fase;
- rollback;
- riscos;
- elementos cuja remoção depende de telemetria.

Uma decisão temporária não poderá migrar para um SDD ou ADR permanente sem revisão explícita.

## 16. Validação

A reorganização documental e o diagnóstico estarão concluídos quando:

- todos os documentos vivos apontarem para a visão v2;
- nenhum documento antigo competir como fonte normativa;
- cada requisito possuir origem e autoridade identificadas;
- cada `[x]` possuir evidência e teste verificável;
- as fronteiras dos três produtos estiverem documentadas;
- as capacidades transversais estiverem isoladas no `SDD-005`;
- a propriedade dos dados estiver explícita;
- não existir permissão genérica de acesso completo;
- o estado atual e o estado-alvo estiverem claramente separados;
- as incompatibilidades conhecidas estiverem registadas;
- as questões abertas possuírem responsável e condição de decisão;
- a documentação passar numa revisão de links, consistência, terminologia e precedência;
- a auditoria não alterar silenciosamente decisões normativas ou código de produção.

## 17. Verificações documentais

A revisão deve incluir:

- pesquisa de placeholders e decisões vagas;
- validação dos IDs documentais e dos requisitos;
- deteção de IDs duplicados;
- validação dos estados controlados;
- validação de links Markdown relativos;
- deteção de nomes de produto substituídos em documentos vivos;
- comparação entre a matriz e o catálogo normativo;
- confirmação de que todo documento `superseded` aponta para uma autoridade existente;
- revisão manual da precedência e da propriedade dos dados.

## 18. Fora do âmbito desta entrega

- separar imediatamente o repositório em três;
- criar microsserviços;
- modificar schemas ou dados;
- remover rotas antigas;
- alterar interfaces de produção;
- implementar funcionalidades ainda ausentes;
- concluir detalhadamente os SDDs de Eventos e Direção sem análise própria;
- promover qualquer requisito para `[x]` sem evidência verificável.

## 19. Entregáveis da execução posterior

1. Pacote normativo em `docs/vision/uor-connect-v2/`.
2. Catálogo completo de RF, RNF e regras de negócio da UOR Estudante.
3. Matriz de rastreabilidade baseada no estado real do projeto.
4. ADRs iniciais.
5. Plano de transição.
6. Inventário e classificação dos Markdown.
7. Relatório do estado arquitetural atual.
8. Relatório de divergências e questões abertas.
9. Atualização das páginas vivas e índices.
10. Relatório de validação documental.

## 20. Ciclo de vida deste documento

Este documento regula a criação inicial da visão documental v2. Depois da aprovação do `README.md`, `SDD-000`, `SDD-005`, SDDs de produto e catálogo de requisitos, deverá:

- passar para `status: superseded`;
- apontar em `superseded_by` para o `README.md` da visão v2 e para o `SDD-000`;
- permanecer preservado como registo histórico da reorganização;
- deixar de competir com os documentos v2 como autoridade normativa operacional.

## 21. Decisão final

A UOR Connect será governada como ecossistema. UOR Estudante, UOR Eventos e UOR Direção serão produtos com responsabilidades e propriedade dos dados distintas. A implementação poderá permanecer fisicamente próxima durante a transição, mas a documentação e os contratos passam a impedir que proximidade técnica seja confundida com ausência de fronteiras.
