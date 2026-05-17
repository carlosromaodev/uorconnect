# Formadores - Link generico

Estado: especificado, ainda não implementado em código.

## Objetivo

Criar um fluxo estável e confortável para formadores se cadastrarem por um link genérico, sem depender de cadastro manual direto na admin.

## Fluxo desejado

1. Admin gera ou partilha um link genérico de cadastro de formador.
2. Formador abre o link.
3. Sistema mostra uma tela profissional de boas-vindas.
4. Formador faz login por SMS de confirmação.
5. Formador completa o perfil.
6. Formador escolhe o curso que vai formar entre os cursos disponíveis no sistema.
7. Admin valida ou aprova o vínculo.
8. Formador ganha acesso a uma área limitada.

## Acesso do formador

O formador não deve ter acesso total à admin.

Ele deve ver apenas:

- Curso(s) associados a ele.
- Quantidade de estudantes inscritos.
- Lista básica dos estudantes quando isso for necessário operacionalmente.
- Eventuais materiais ou comunicados do curso.

Não deve ver:

- Finanças gerais.
- Todos os projetos.
- Dados sensíveis de outros cursos.
- Configurações globais.
- Votos globais.
- Relatórios administrativos completos.

## Informações a solicitar

Campos principais:

- Nome completo.
- Telefone.
- Email, se tiver.
- Área de formação.
- Link do LinkedIn, opcional.
- Pequena bio profissional.
- Experiência relevante.
- Curso que vai ministrar.

Campos que devem ser evitados:

- Dados pessoais sensíveis sem necessidade.
- Documentos que não serão usados.
- Perguntas longas ou invasivas.

## Experiência desejada

- Tela simples.
- Linguagem profissional.
- Poucos passos.
- Confirmação clara após cada etapa.
- Login por SMS sem fricção.
- Perfil incompleto deve poder ser retomado.
- Erros devem explicar exatamente o que falta.

## Decisão pendente

Antes de implementar, decidir:

- Se o formador fica ativo imediatamente após escolher o curso ou se precisa aprovação manual.
- Se um formador pode estar ligado a mais de um curso.
- Se o link genérico é público permanente ou se expira.
- Se será possível gerar links com pré-seleção de curso.
