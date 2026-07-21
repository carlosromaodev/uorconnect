# SDD-002 — UOR Estudante

```yaml
document_id: SDD-002
status: approved
owner: Produto UOR Estudante
authority: normative
version: 1.0
last_reviewed: 2026-07-21
approved_by: Product Owner
approved_at: 2026-07-21
review_cycle: por fase do roadmap ou alteração académica material
next_review: conclusão da Fase 1
supersedes:
  - ../../wiki/raw/uorconnect-sdd-v1.0/SDD-002-UOR-Connect-Student-and-Integrations.md
superseded_by:
depends_on:
  - SDD-000-ECOSSISTEMA-UOR-CONNECT.md
  - SDD-005-CAPACIDADES-TRANSVERSAIS.md
  - GLOSSARIO-E-MODELO-CONCEPTUAL.md
```

## 1. Finalidade

UOR Estudante acompanha o estudante ao longo da jornada académica. Reúne dados dispersos, explica desempenho, antecipa riscos, organiza prazos e facilita colaboração segura.

Secretaria e Moodle são provedores. A experiência, normalização, histórico, cálculos, rankings, autorizações e comunidade pertencem à UOR Estudante.

## 2. Princípios

- Produto independente, mobile-first e adequado a ligações instáveis.
- Dados externos ficam isolados em adaptadores.
- Todo valor apresenta origem e atualização.
- Dado oficial nunca é confundido com cálculo, estimativa ou comunidade.
- Consulta e organização precedem escrita em sistemas externos.
- Acesso a dados de terceiros exige finalidade e autorização específicas.
- Falha nunca é silenciosamente convertida em zero ou ausência.

## 3. Utilizadores

### Estudante

Sincroniza os próprios dados, consulta desempenho e finanças, usa análises, participa em rankings privados, solicita apoio, cria pedidos e controla autorizações.

### Explicador

Utilizador validado que acompanha uma relação `estudante + explicador + unidade curricular`, limitada aos dados e período autorizados.

### Responsável ou representante

Pessoa autorizada para ações/dados concretos, como referência de pagamento, alerta ou processo. Não recebe acesso geral.

### Moderador

Atua em conteúdo comunitário, avaliações e mercado. Não recebe automaticamente notas ou finanças.

## 4. Identidade

A identidade visível usa número de estudante; a unicidade usa `institution_id + student_number`; relações usam ID interno opaco. Uma conta poderá conter múltiplos perfis institucionais.

## 5. Provedores

### Secretaria

Fonte oficial de perfil académico, curso, turma, matrícula, currículo, unidades curriculares, notas, horários, exames, faltas, presenças, propinas, dívidas, referências, pagamentos e processos administrativos disponíveis.

A integração conhecida usa formulário, cookies e HTML/AJAX sem API pública documentada. HTTP sem TLS é bloqueador de produção.

### Moodle

Fonte pedagógica de cadeiras, secções, materiais, atividades, questionários, progresso, prazos, eventos e avisos. Resultados Moodle não substituem notas oficiais da Secretaria.

### UOR Estudante

Fonte de rankings, percentis, simulações, previsões, histórico detetado, avaliações pedagógicas, planos de estudo, autorizações, representação, comunidade, mercado e preferências.

## 6. Proveniência

Todo dado sincronizado inclui origem, momento, período, estado, cobertura, stale e correlação. Estados semânticos incluem `official`, `calculated`, `estimated`, `community` e `pending_confirmation`; estados operacionais incluem `exact`, `partial`, `not_synced`, `unsupported`, `stale` e `failed`.

## 7. Capacidades

### 7.1 Perfil e visão Hoje

- Perfil institucional e dados de contacto com fonte por campo.
- Resumo de prioridades, alterações, prazos, risco, finanças e sincronização.
- Controlo de visibilidade, consentimento e eliminação.

### 7.2 Desempenho académico

- Notas oficiais por unidade curricular e avaliação.
- Média por cadeira, período e percurso.
- Simulação de notas futuras.
- Nota necessária para aprovação ou dispensa.
- Média necessária e possível elegibilidade para bolsa.
- Evolução temporal e explicação das regras utilizadas.

Regras académicas são configuráveis e versionadas. Média 16 para bolsa é hipótese inicial, não confirmação institucional.

### 7.3 Rankings privados

Rankings podem usar instituição, curso, turma, cadeira, avaliação, período e média. Mostram posição, percentil, amostra, cobertura e atualização. Não exibem nomes/notas de colegas nem apresentam amostra parcial como universo completo.

### 7.4 Percurso curricular

Mapa interativo de cadeiras concluídas, atuais, pendentes, reprovadas e bloqueadas, créditos, precedências e percentagem. Previsão de conclusão é estimativa explicável baseada em estado, oferta, precedências, reprovações e ritmo conhecido.

### 7.5 Histórico de alterações

Detetar nova/alterada nota, média, falta, presença, horário, sala, estado curricular, dívida e referência. Preservar valor anterior, atual, deteção, fonte e confirmação.

### 7.6 Agenda e sobrecarga

Combinar horários/exames da Secretaria, Moodle, sessões com explicador, eventos pessoais e lembretes. Detetar sobreposição e sobrecarga por proximidade, peso e risco, sempre como recomendação.

### 7.7 Validação comunitária

Estudantes reportam sala, horário, cancelamento, reposição e docente. A interface distingue oficial, comunitário, confirmado por múltiplos, contestado e expirado. Comunidade não substitui silenciosamente o oficial.

### 7.8 Docentes

Avaliação ligada a docente, cadeira, turma e período; elegibilidade por associação académica; identidade privada; agregação mínima; critérios configuráveis; comentários moderados e direito de contestação conforme política.

### 7.9 Explicadores

Pesquisa, disponibilidade, pedido, relação, avaliação, revogação, plano de estudo, tarefas e sessões. O explicador vê somente a cadeira e os dados autorizados; não vê finanças, outras cadeiras ou dados fora do período.

### 7.10 Recursos e pedidos coletivos

Preparar e acompanhar recursos, sem assumir escrita externa. Pedido coletivo exige conteúdo integral e aprovação individual; participantes podem rejeitar ou retirar antes da submissão e acompanham estado/resultado.

### 7.11 Financeiro e responsáveis

Consultar propinas, dívidas, referências, pagamentos e vencimentos oficiais. Partilhar uma referência sem expor toda a situação. Responsável recebe apenas alertas/dados autorizados. UOR Estudante não movimenta dinheiro.

### 7.12 Autorizações, OTP e SMS

Autorizações definem titular, representante, ação, recurso, dados, início, expiração, usos e confirmação. Estados: pendente, aprovada, rejeitada, ativa, utilizada, expirada e cancelada.

Operações sensíveis usam OTP ligado ao ator, ação, recurso, valor/contexto e prazo. SMS contém apenas tipo, partes, estado, tempo e referência interna, sem notas/dívidas completas ou segredos.

### 7.13 Mercado académico

Anúncios de livros, calculadoras, batas, equipamentos e materiais; pesquisa, filtros, contacto, reserva, venda, gestão e denúncia. Usa identidade validada com minimização de dados.

## 8. Sincronização

- Nunca sincronizar a cada renderização.
- Persistir modelos normalizados e snapshots necessários.
- Atualização manual limitada e periódica conforme sensibilidade.
- Locks, idempotência, backoff e reconciliação.
- Último dado válido permanece visível como `stale`.
- Estudante vê origem, última atualização, cobertura e falhas.
- Mudança inesperada de contrato gera alerta e não publica snapshot corrompido.

## 9. Segurança e privacidade

- Frontend não recebe cookies, HTML ou credenciais upstream.
- Ownership e tenant são validados no servidor.
- Proteção contra IDOR/BOLA, CSRF, reutilização de OTP e escalada.
- Dados sensíveis, sessões e segredos são cifrados conforme SDD-005.
- Rankings aplicam consentimento, cobertura, limiar e proteção contra inferência.
- Auditoria regista sincronização, acesso delegado, OTP, partilha financeira, recurso, moderação e alteração de estado.

## 10. Falhas

| Falha | Comportamento |
| --- | --- |
| Secretaria indisponível | último dado válido + stale + tentativa controlada |
| Moodle indisponível | agenda/local preservada + estado parcial |
| parsing mudou | rejeitar snapshot, alertar e manter versão anterior |
| SMS falhou | operação pendente, reenvio limitado e auditoria |
| OTP expirou | não executar, emitir novo e invalidar conforme regra |
| operação externa inconclusiva | estado desconhecido/pendente, sem duplicação |

## 11. Experiência e acessibilidade

Mobile-first, responsivo, baixo consumo de dados, navegação simples, skeleton/estado vazio útil, foco visível, teclado, contraste AA, texto escalável, rótulos acessíveis e mensagens claras. O laranja `#FF5C20` é acento, não preenchimento indiscriminado.

## 12. Desempenho e escala

Paginar listas, cache privado, evitar chamadas duplicadas, processamento pesado assíncrono, limites por utilizador/provedor e metas observáveis. Crescimento não justifica microsserviços prematuros.

## 13. Observabilidade

Monitorar integrações, sincronizações, parsing, autenticação, tempo, cache, rankings, OTP, SMS, autorizações, filas, erros de frontend e ações críticas. Toda operação relevante possui trace/correlation ID.

## 14. Testes

- Domínio: médias, bolsa, rankings, empates, currículo, autorização e expiração.
- Contrato: HTML/API alterado, campos ausentes, sessão expirada e resposta parcial.
- Integração: Secretaria, Moodle, persistência, SMS e tarefas.
- Segurança: IDOR/BOLA, revogação, OTP, tenant, logs e rate limit.
- Experiência: mobile, ligação lenta, falha, vazio e acessibilidade.

## 15. Roadmap

1. Fundação: identidade, sessão, integrações, normalização, proveniência, auditoria.
2. Núcleo: notas, médias, ranking, currículo, histórico, horário e agenda.
3. Inteligência: dispensa, bolsa, sobrecarga e alertas.
4. Apoio: explicadores, planos e avaliação pedagógica.
5. Autorizações: caixa, OTP, SMS, responsáveis e referências.
6. Comunidade: validação, representação coletiva, mercado e moderação.
7. Escrita externa: apenas com autorização, idempotência e reconciliação.

## 16. Critérios de piloto

- Frontend/backend lógico próprios e executáveis.
- Dados com origem e atualização.
- Identidade institucional composta.
- Acesso indevido impedido por testes.
- Rankings privados e cobertura explícita.
- Autorizações específicas, revogáveis e auditadas.
- Operações externas de escrita desativadas.
- Monitorização e testes críticos ativos.

## Open Questions

| ID | Questão | Responsável | Impacto | Condição | Estado | Atualiza |
| --- | --- | --- | --- | --- | --- | --- |
| OQ-EST-001 | Regras oficiais por curso para aprovação/dispensa/bolsa | Direção Académica | cálculos | antes da Fase 3 | open | SDD-002, RN |
| OQ-EST-002 | API/HTTPS oficial da Secretaria | Instituição/Fornecedor | produção | antes de dados reais | open | ADR-005 |
| OQ-EST-003 | Política e limiar de avaliações pedagógicas | Produto/Privacidade | moderação | antes da Fase 4 | open | RF/RN |
| OQ-EST-004 | Modelo económico permitido para explicadores/mercado | Produto/Legal | pagamentos e responsabilidade | antes da Fase 4/6 | open | SDD-002 |
