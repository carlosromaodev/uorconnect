# ODIN Forense Operacional

## Objetivo

Transformar o ODIN de um sistema de alertas em um sistema de investigação comandada. O sistema deve continuar a apoiar decisão humana, mas precisa entregar uma fila de urgência, prova ordenada, protocolo de ação, critérios de falso positivo e separação clara entre fraude provável e fragilidade estrutural da base de dados.

## Problemas a Resolver

1. O relatório atual pode mostrar `riskScore` alto e `fraudProbability` baixa, criando mensagens contraditórias.
2. Casos diferentes recebem recomendações parecidas, mesmo quando representam padrões operacionais diferentes.
3. O relatório não diz claramente o que fazer primeiro durante o evento.
4. Contas com dados inválidos aparecem misturadas com fraude, contaminando a leitura investigativa.
5. O payload AI ainda é genérico para casos complexos e não aproveita completamente comentários, membros, timestamps e contexto humano.
6. A marcação de falso positivo não tem critérios auditáveis.

## Escopo por Fase

### Fase 1 — Dossiê Forense

Esta fase altera backend, motor AI e relatório PDF.

O relatório passa a abrir com uma página de triagem operacional, antes dos detalhes:

- Ação imediata.
- Investigar em 24h.
- Pode esperar.

Cada caso de triagem deve mostrar:

- tipo do padrão;
- urgência;
- votos a rever;
- contas a rever;
- próximo passo sequenciado;
- condição que tornaria falso positivo improvável;
- se deve ou não contactar expositor.

O PDF deve continuar com o design institucional ODIN/UOR Connect, mas a estrutura muda de relatório narrativo para dossiê operacional.

### Fase 2 — Painel Operacional

Esta fase altera a experiência admin.

O painel ODIN passa a funcionar como uma sala de operações:

- esquerda: fila de prioridade;
- centro: dossiê do caso ativo;
- direita: ações permitidas para o estado atual.

Um admin só pode ter um caso ativo por vez. Ao abrir um caso, ele fica locked para os outros admins, com identificação do responsável e prazo.

## Score Unificado e Consistência AI

O ODIN mantém o `riskScore` determinístico por regras. A análise AI passa a ser tratada como contexto, não como autoridade independente.

O backend deve calcular:

- `ruleRiskScore`: score mínimo garantido pelas regras;
- `aiFraudProbability`: probabilidade devolvida pelo ODIN AI;
- `unifiedRiskScore`: leitura final exibida ao admin;
- `consistencyCheck`: estado da análise;
- `consistencyReason`: motivo quando houver inconsistência.

Regra de consistência inicial:

- se `ruleRiskScore >= 90` e `aiFraudProbability < 50`, a análise é inconsistente;
- se `ruleRiskScore >= 75` e `aiFraudProbability < 35`, a análise é inconsistente;
- se `confidenceLevel = HIGH` e a probabilidade contradiz o score, a análise é inconsistente;
- análise inconsistente não deve aparecer como recomendação válida no PDF;
- deve aparecer como "análise inconsistente detectada — reanalisar".

O sistema deve guardar a resposta inconsistente para auditoria.

## Tipos de Padrão

### TIPO-A — Operação por Credenciais em Escala

Indicadores:

- mais de 10 contas no mesmo dispositivo;
- mais de 60% das contas frágeis, temporárias ou incompletas;
- tempo mediano login→voto inferior a 45 segundos;
- pelo menos 3 trocas de conta em menos de 90 segundos.

Protocolo:

1. Congelar votos associados ao padrão.
2. Cruzar timestamps com logs do servidor.
3. Não notificar suspeitos até a confirmação interna.
4. Priorizar se alterar top 3 ou envolver mais de 20 contas.

### TIPO-B — Dispositivo Partilhado em Laboratório

Indicadores:

- 3 a 10 contas;
- tempo médio acima de 60 segundos;
- maioria das contas com origem oficial;
- sem trocas rápidas sistemáticas.

Protocolo:

1. Não congelar automaticamente.
2. Gerar checklist de presença física.
3. Bloquear ações destrutivas até checklist concluído.

### TIPO-C — Expositor com Telefone Emprestado

Indicadores:

- dispositivo associado a membro do projeto beneficiado;
- contas com origem oficial;
- tempo variável, mas com pelo menos uma conversão rápida.

Protocolo:

1. Contactar expositor de forma interna e não punitiva.
2. Dar prazo curto para explicação.
3. Guardar resposta como evidência.
4. Só depois rever votos ou escalar.

## Fila de Prioridade

### Ação Imediata

Critérios:

- TIPO-A com mais de 20 contas;
- qualquer caso em que votos congelados alterem top 3;
- score unificado crítico.

Prazo operacional: 30 minutos durante o evento.

Se expirar, o sistema deve escalar para super admin via canais existentes.

### Investigar em 24h

Critérios:

- TIPO-B;
- TIPO-C com resposta inconclusiva;
- casos que não alteram ranking imediato mas podem afetar premiação.

### Pode Esperar

Critérios:

- menos de 3 contas no dispositivo;
- baixa plausibilidade de fraude após score unificado;
- casos documentais sem impacto imediato.

## Integridade de Dados Separada de Fraude

O relatório de fraude não deve tratar 1.866 contas inválidas como fraude direta.

O ODIN deve criar um bloco separado chamado Motor de Integridade de Dados, com:

- total de contas sem curso;
- total de contas sem universidade válida;
- total de contas temporárias;
- total de contas criadas recentemente;
- lista de universidades inválidas ou suspeitas;
- recomendação de produto/secretariado.

No ranking e no relatório, votos dessas contas podem aparecer como "qualidade de dados não verificada".

## Payload Forense do ODIN AI

O payload deve conter cinco blocos fixos:

1. Contexto imutável do sistema.
2. Factos matemáticos do caso.
3. Contexto humano.
4. Sinais qualitativos.
5. Pedido direto de classificação e protocolo.

Campos obrigatórios para cada caso:

- `device_id`;
- número de contas;
- lista de contas com nome, curso e origem;
- timestamps de login, voto e comentário;
- projeto dominante;
- trocas de conta em menos de 90 segundos;
- comentários das contas envolvidas;
- relação com membros do projeto;
- histórico de falso positivo quando existir;
- limitações conhecidas, incluindo NAT partilhado e laboratórios.

Se um bloco não existir, enviar `null` com nota explicativa. Não omitir campos.

## Resposta JSON do ODIN AI

O ODIN AI deve responder apenas com:

```json
{
  "pattern_type": "TIPO-A | TIPO-B | TIPO-C",
  "evidence_summary": "texto curto",
  "comment_analysis": "texto curto",
  "alternative_scenario": "texto curto",
  "alternative_plausibility": "ALTA | MEDIA | BAIXA",
  "recommended_action": "passo 1, passo 2, passo 3",
  "action_urgency": "IMEDIATA | 24H | PODE_ESPERAR",
  "votes_to_review": 0,
  "accounts_to_review": 0,
  "notify_expositor": false,
  "confidence": "HIGH | MEDIUM | LOW",
  "cannot_be_false_positive_if": "condição matemática verificável"
}
```

O sistema pode manter campos antigos por compatibilidade, mas o PDF e o painel devem priorizar os campos novos.

## Comentários como Prova Qualitativa

O ODIN deve cruzar comentário, voto e tempo:

- comentário superficial após voto rápido é sinal de engajamento artificial;
- comentário com compreensão real é sinal legítimo;
- ausência de comentário é neutra.

O comentário nunca deve ser prova isolada, apenas reforço contextual.

## Falso Positivo

Falso positivo passa a ser uma classificação auditável.

Para TIPO-A, um falso positivo só pode ser simples se:

- presença física documentada de pelo menos 80% das contas;
- nenhuma conta criada nas 48 horas anteriores ao evento;
- tempo mediano login→voto superior a 120 segundos.

Se apenas uma ou duas condições forem verificadas, exige dois admins e justificativa escrita.

Para TIPO-B e TIPO-C:

- confirmação de presença física;
- ausência de contas frágeis relevantes;
- nota de justificativa do admin.

## Estados Operacionais

Estados mínimos da Fase 1:

- `OPEN`;
- `ANALYSIS_INCONSISTENT`;
- `FROZEN_REVIEW`;
- `AWAITING_PHYSICAL_CHECK`;
- `AWAITING_EXHIBITOR_RESPONSE`;
- `READY_FOR_DECISION`;
- `RESOLVED_CONFIRMED`;
- `RESOLVED_FALSE_POSITIVE`.

Na Fase 1, esses estados podem ser calculados e exibidos no PDF. Persistência completa e lock de admin ficam para a Fase 2.

## Não Objetivos

- Não remover votos automaticamente sem decisão humana.
- Não chamar estudante de culpado, criminoso ou sentenciado.
- Não expor análise AI ao estudante.
- Não transformar dado inválido em fraude automática.
- Não bloquear ranking público sem decisão da organização.

## Testes

Testes obrigatórios da Fase 1:

- `riskScore 100` + probabilidade baixa vira inconsistência;
- TIPO-A é classificado como urgência imediata;
- TIPO-B não congela automaticamente;
- TIPO-C recomenda contacto com expositor;
- comentários superficiais em voto rápido entram na análise qualitativa;
- relatório PDF contém página de triagem;
- relatório PDF separa integridade de dados de fraude;
- campos antigos continuam compatíveis com endpoints existentes.

## Critério de Aceitação

A Fase 1 está completa quando:

- o relatório começa com triagem operacional;
- cada caso crítico tem tipo, urgência e próximo passo;
- análises contraditórias deixam de aparecer como recomendação válida;
- TIPO-A, TIPO-B e TIPO-C aparecem como campos estruturais;
- integridade de dados aparece separada;
- testes e build passam;
- VPS recebe a versão sem quebrar endpoints existentes.
