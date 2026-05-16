# Conteúdo oficial do Workshop Alusivo ao Dia das Telecomunicações

Este documento resume onde entram, no UOR Connect, as informações extraídas do programa fotografado do workshop.

## Onde cada informação deve aparecer

- **Agenda** (`/agenda`): recebe o programa completo dos dias 18 e 19 de maio de 2026, incluindo abertura, credenciamento, painéis, momentos culturais, visita aos stands, desafio académico, premiação e encerramento.
- **Evento ao vivo** (`/ao-vivo`): usa a agenda publicada para mostrar a sessão atual, a próxima sessão e o programa completo em tempo real.
- **Palestrantes** (`/palestrantes`): recebe os perfis dos convidados identificados nas páginas do programa: Sandra Catrio, Carlos Caetano, Mário Zerqueira, Paulo Silva, Florips Assis Quixito, Manuel Muenho e Rabin Kiketu.
- **Home** (`/`): reaproveita automaticamente os dados da agenda e dos palestrantes para preencher os blocos “Palestrantes” e “Painéis & Agenda”.
- **Cursos e treinamentos**: os treinamentos foram publicados como sessões do tipo `Workshop` dentro da agenda, para ficarem visíveis na programação e no acompanhamento ao vivo.
- **Desafio académico / concurso**: entra como sessão oficial do dia 19, com tema `Concurso`, para orientar estudantes e público sobre a dinâmica dos finalistas.

## Programa principal

### 18/05/2026

- 08:30-09:00: Chegada e acomodação dos participantes e convidados — Protocolo.
- 09:00-09:20: Credenciamento — Protocolo.
- 09:20-09:30: Momento cultural — Coral Vozes da UÓR, Álvaro Nsunda.
- 09:30-09:40: Abertura e apresentação dos convidados — Prof. Doutor André Pedro Neto.
- 09:40-09:50: Palavras de circunstância — Mário Augusto da Silva Oliveira.
- 09:50-10:05: Discurso motivacional — Prof. Doutor Diosnorides Carbonell Torreblanca.
- 10:05-10:20: Apresentação do tema e objetivo do workshop — M.Sc. Madalena Janota Justo.
- 10:20-10:25: Apresentação dos projetos — NEIC, Hilquias Prody.
- 10:25-10:30: Momento cultural — Coral Vozes da UÓR, Álvaro Nsunda.
- 10:30-12:00: Visita aos stands — organização e expositores.
- 14:00-16:00: Marca pessoal: como se tornar referência antes de terminar o curso — Florips Assis Quixito, Manuel Muenho e Rabin Kiketu.
- 16:00-16:05: Momento cultural, mágica e foto de família.
- 16:05-16:20: Encerramento do primeiro dia — M.Sc. Madalena Janota Justo.

### 19/05/2026

- 13:30-13:40: Chegada e acomodação dos participantes e convidados — Protocolo.
- 13:40-13:45: Momento cultural — Coral Vozes da UÓR, Álvaro Nsunda.
- 13:45-13:50: Palavras de circunstância — Prof. Doutor Eugénio de Carvalho.
- 13:50-13:55: Apresentação das empresas parceiras — Prof. Doutor Diosnorides Carbonell Torreblanca.
- 13:55-14:00: Abertura e apresentação dos convidados — M.Sc. Madalena Janota Justo.
- 14:00-15:30: Transformação de projetos académicos em oportunidades reais — Sandra Catrio, Carlos Caetano, Mário Zerqueira e Paulo Silva.
- 15:30-15:35: Momento cultural — Coral Vozes da UÓR, Álvaro Nsunda.
- 15:35-16:40: Desafio académico — estudantes finalistas da FCT, DEI-IC / UÓR.
- 16:40-17:00: Premiação — M.Sc. Madalena Janota Justo.
- 17:00-17:20: Encerramento e discurso final — Prof. Doutor Diosnorides Carbonell Torreblanca.

## Treinamentos publicados como workshops

- Eletrónica e Arduino — Márcio Faria — Lab. Eletrónica — 08:00-12:00.
- Informática Avançada — Eduardo Muima — Lab. 2 — 08:00-12:00.
- Programação — Biachel António / Moisés — Lab. 3 — 08:00-12:00.
- Cyber Security — New Teach — Lab. Eletrónica — 08:00-12:00.
- Fibra Óptica — Euclides Agapito — Lab. Eletrónica e Pátio da Instituição — 13:00-17:00.
- Inteligência Artificial — Betuel Cambuta — Lab. 3 — 17:00-21:00.
- Filmagem e Edição de Vídeo — Augusto Boano — Lab. 2 — 13:00-17:00.
- Reparação e Manutenção de Computadores — Josefa Garcia — Lab. 1 — 08:00-12:00.
- Redes de Telecomunicações — João Graça — Lab. Eletrónica e Pátio da Instituição — 10:00-14:00.

## Observações de implementação

- O conteúdo oficial é sincronizado pelo script `npm run content:sync-telecom-workshop` dentro do backend.
- O script remove os dados demo antigos de agenda/palestrantes e faz upsert dos novos dados, evitando duplicação quando executado mais de uma vez.
- A página de agenda foi ajustada para agrupar sessões por `DAY1` e `DAY2`, não por prefixo de hora.
