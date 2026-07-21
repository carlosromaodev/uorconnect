# Especificação Técnica Completa - UOR Connect
## Dia das Telecomunicações - Universidade Óscar Ribas

> **Classificação v2:** especificação histórica da aplicação que dá origem à UOR Eventos. Não é a visão normativa do ecossistema. Ver [`SDD-003-UOR-EVENTOS.md`](../docs/vision/uor-connect-v2/SDD-003-UOR-EVENTOS.md).

**Versão:** 1.0  
**Data:** 18 de Março de 2026  
**Organização:** Universidade Óscar Ribas (UOR) - NEIC  
**Objetivo:** Plataforma digital para gestão, divulgação e interação em torno do evento "Dia das Telecomunicações 2026"

---

## 📋 ÍNDICE

1. [Visão Geral do Projeto](#visão-geral-do-projeto)
2. [Arquitetura e Tecnologias](#arquitetura-e-tecnologias)
3. [Requisitos Funcionais](#requisitos-funcionais)
4. [Requisitos Não-Funcionais](#requisitos-não-funcionais)
5. [Regras de Negócio](#regras-de-negócio)
6. [Fluxos de Dados e Processos](#fluxos-de-dados-e-processos)
7. [Mapeamento de Funcionalidades por Página](#mapeamento-de-funcionalidades-por-página)

---

## 🎯 Visão Geral do Projeto

### Descrição
**UOR Connect** é uma plataforma web responsiva que permite a gestão integrada do evento "Dia das Telecomunicações" da Universidade Óscar Ribas. O evento celebra o Dia Mundial das Telecomunicações e da Sociedade da Informação, conectando estudantes, professores e profissionais através de painéis, workshops, apresentações de projetos e atividades de networking.

### Contexto
- **Duração do Evento:** 2 dias (17-18 de Maio de 2026)
- **Local:** Campus da Universidade Óscar Ribas, Luanda
- **Público-alvo:** Estudantes da UOR, Professores, Profissionais, Comunidade Académica
- **Temas Principais:** Telecomunicações, IoT, 5G, IA, Segurança, Desenvolvimento Web, Marca Pessoal, Empreendedorismo

### Objetivos da Plataforma
1. Centralizar todas as informações sobre o evento
2. Permitir inscrição e submissão de projetos
3. Facilitar a votação e avaliação de projetos
4. Fornecer experiência ao vivo durante o evento
5. Registar e gerenciar participações
6. Gerar estatísticas e rankings

---

## 🛠️ Arquitetura e Tecnologias

### Stack Tecnológico
- **Frontend:** React 18+ com TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + PostCSS
- **UI Components:** shadcn-ui (baseado em Radix UI)
- **Roteamento:** React Router v6
- **Animações:** Framer Motion
- **State Management:** React Query (TanStack Query)
- **Formulários:** React Hook Form com Zod validation
- **Notificações:** Sonner Toast
- **Testing:** Vitest + Playwright
- **Linting:** ESLint
- **Ícones:** Lucide React

### Arquitetura de Componentes
```
App (Root)
├── Layout (Navbar + Footer)
├── Router
│   ├── Index (Página Principal/Início)
│   ├── Agenda (Programação dos 2 Dias)
│   ├── Submeter (Inscrição e Submissão)
│   ├── Projetos (Catálogo e Votação)
│   ├── Palestrantes (Informações dos Palestrantes)
│   ├── FAQ (Perguntas Frequentes)
│   ├── Guia (Guia do Participante)
│   ├── Regras (Normas e Critérios)
│   ├── Sobre (Informações do Evento)
│   ├── EventoAoVivo (Transmissão ao Vivo)
│   ├── Admin (Painel de Administração)
│   └── NotFound (Página 404)
└── Global Providers (QueryClient, TooltipProvider, Sonner)
```

---

## 📝 Requisitos Funcionais

### 1️⃣ RF001 - PÁGINA INICIAL (INDEX)

#### RF001.1 - Hero Section com Apresentação do Evento
**Descrição:** Exibir banner principal com informações principais do evento.

**Funcionalidades:**
- Apresentação visual atraente do evento
- Data, local e tema principal do evento
- Botões de ação (CTA) para navegar para agenda e submissão
- Logos dos organizadores (UOR e NEIC)
- Animações de entrada e hover effects
- Design responsivo (mobile, tablet, desktop)

**Dados Necessários:**
- Datas do evento (17-18 Maio 2026)
- Local (Campus UOR, Luanda)
- Tema dos dias

**Critério de Aceitação:**
- ✅ Banner exibido corretamente em todas as resoluções
- ✅ Animações executadas suavemente (60fps)
- ✅ Textos legíveis com contraste adequado
- ✅ Botões CTA funcionais e navegam corretamente

---

#### RF001.2 - Seção de Agenda em Tempo Real
**Descrição:** Mostrar preview das atividades do dia em decorrer.

**Funcionalidades:**
- Exibir próximas atividades em card expandível
- Mostrar horário, local, tipo de atividade e descrição
- Badge visual com tipo de atividade (Painel, Workshop, Apresentação, Cerimónia)
- Cores diferenciadas por tipo
- Link para página de agenda completa
- Atualização em tempo real se integrado com backend

**Dados Exibidos:**
- Hora de início e fim
- Título da atividade
- Local/Sala
- Tipo de atividade
- Descrição breve

**Critério de Aceitação:**
- ✅ Dados exibidos no formato correto
- ✅ Badges com cores apropriadas
- ✅ Link funciona e navega para /agenda
- ✅ Responsivo em todos os tamanhos

---

#### RF001.3 - Seção de Projetos em Destaque
**Descrição:** Showcasing dos melhores projetos com sistema de votação inline.

**Funcionalidades:**
- Exibir top 8 projetos em grid
- Mostar informações: nome, área, equipa, descrição
- Botões de ação (👁️ View, ⭐ Rate, 👍 Vote)
- Card interativo com hover effects
- Badge de tipo de projeto (Projeto, Negócio, Produto)
- Cores temáticas por área (IoT, Telecom, Segurança, Web, IA, etc)
- Contador de votos e rating visual (estrelas)
- Modal para visualização detalhada
- Sistema de votação (requer autenticação)

**Dados Exibidos:**
- Nome do projeto
- Área/Tema
- Equipa responsável
- Descrição resumida
- Número de votos
- Rating (1-5 estrelas)
- Tipo (projeto/negócio/produto)

**Critério de Aceitação:**
- ✅ Cards carregam corretamente
- ✅ Votação funciona (com validação de autenticação)
- ✅ Cores por área aplicadas corretamente
- ✅ Modal abre/fecha sem problemas
- ✅ Dados atualizam após votação

---

#### RF001.4 - Seção de Palestrantes
**Descrição:** Preview dos palestrantes principais com acesso a detalhes.

**Funcionalidades:**
- Exibir 4-5 palestrantes principais
- Foto de perfil (avatar)
- Nome, especialidade, tema da palestra
- Dia e horário
- Botão para página completa de palestrantes
- Animações ao scroll (fade in)

**Dados Exibidos:**
- Foto/Avatar
- Nome completo
- Bio resumida
- Especialidade
- Tema da palestra
- Dia e hora

**Critério de Aceitação:**
- ✅ Imagens carregam corretamente
- ✅ Animações executam ao entrar na viewport
- ✅ Links funcionam corretamente
- ✅ Responsivo em mobile

---

#### RF001.5 - Seção de Estatísticas e Curiosidades
**Descrição:** Exibir KPIs interessantes do evento.

**Funcionalidades:**
- Cards com números de impacto
- Estatísticas em tempo real ou hardcoded
- Animação de contagem progressiva
- Informações como: # Participantes, # Projetos, # Palestrantes, # Votações

**Critério de Aceitação:**
- ✅ Números exibidos corretamente
- ✅ Animação de contagem funciona
- ✅ Valores atualizáveis

---

#### RF001.6 - Call-to-Actions Distribuídos
**Descrição:** Botões estratégicos para conversão em toda a página.

**Funcionalidades:**
- "Ver Agenda Completa"
- "Submeter Projeto/Negócio/Produto"
- "Ver Todos os Projetos"
- "Conhecer Palestrantes"
- "Ler Guia de Participação"
- Links com destinos corretos

**Critério de Aceitação:**
- ✅ Todos os botões navegam para páginas corretas
- ✅ Estilos visuais consistentes
- ✅ Hover states funcionam

---

### 2️⃣ RF002 - PÁGINA DE AGENDA

#### RF002.1 - Programação por Dias
**Descrição:** Exibir agenda detalhada dos 2 dias do evento.

**Funcionalidades:**
- Tabs para Dia 1 (17 Mai) e Dia 2 (18 Mai)
- Lista de atividades cronológica
- Cada atividade mostra: hora, título, local, palestrante, descrição
- Cards expandíveis com mais detalhes
- Timeline visual
- Tema/tópico principal do dia exibido no topo

**Dados Estruturados:**
```typescript
{
  day: "Dia 1",
  date: "17 Mai",
  dayTheme: "Da sala de aula ao mercado: transformar projetos académicos em oportunidades",
  events: [
    {
      time: "08:30",
      endTime: "09:30",
      title: "Credenciamento e Abertura",
      local: "Auditório Principal",
      speaker: "Comissão Organizadora",
      desc: "Abertura oficial...",
      type: "Cerimónia",
      theme: "Geral"
    },
    // ... mais eventos
  ]
}
```

**Critério de Aceitação:**
- ✅ Agenda dos 2 dias carrega corretamente
- ✅ Horas exibidas em formato 24h
- ✅ Cards expandem/contraem suavemente
- ✅ Tema do dia visível e destacado

---

#### RF002.2 - Filtros de Agenda
**Descrição:** Permitir filtrar atividades por tipo e tema.

**Funcionalidades:**
- Dropdown "Filtrar por Tipo" (Todos, Painel, Workshop, Apresentação, Intervalo, Cerimónia)
- Dropdown "Filtrar por Tema" (Todos, Telecomunicações, Tecnologia, Carreira, Projetos, Geral)
- Resultados filtrados atualizam em tempo real
- Contador de atividades filtradas
- Opção de limpar filtros

**Tipos Disponíveis:**
- Painel (cor: primary)
- Workshop (cor: accent)
- Apresentação (cor: secondary)
- Intervalo (cor: neutral)
- Cerimónia (cor: primary)

**Critério de Aceitação:**
- ✅ Filtros funcionam independentemente
- ✅ Combinação de filtros funciona corretamente
- ✅ Atividades corretas exibidas após filtrar
- ✅ Contador atualiza com precisão

---

#### RF002.3 - Ícones Temáticos de Padrão
**Descrição:** Animações visuais com ícones de telecom/tech.

**Funcionalidades:**
- Padrão decorativo com ícones: Wifi, Radio, Globe, Smartphone, CPU, Monitor, Signal, Zap, MessageSquare, Lightbulb
- Ícones animados em background subtle
- Trocam aleatoriamente ou em sequência
- Não interferem com leitura do conteúdo

**Critério de Aceitação:**
- ✅ Ícones giram/animam continuamente
- ✅ Não causam overhead de performance
- ✅ Não interferem com acessibilidade

---

### 3️⃣ RF003 - PÁGINA DE SUBMISSÃO

#### RF003.1 - Seleção de Tipo de Submissão
**Descrição:** Interface para escolher tipo de participação.

**Funcionalidades:**
- 3 cards clicáveis para seleção:
  1. **Expor Projeto** (ícone Lightbulb) - "Projeto académico ou tecnológico"
  2. **Expor Negócio** (ícone Store) - "Startup, empresa ou ideia de negócio"
  3. **Expor Produto** (ícone Package) - "Produto físico ou digital"
- Cards com hover effects
- Animação ao selecionar
- Descrição de cada tipo
- Após seleção, exibir formulário específico

**Critério de Aceitação:**
- ✅ Seleção clara e intuitiva
- ✅ Feedback visual ao selecionar
- ✅ Transição suave para formulário

---

#### RF003.2 - Formulário de Projeto
**Descrição:** Formulário para submeter um projeto académico/tecnológico.

**Campos:**
- **Nome do Projeto** (texto, obrigatório, máx 100 caracteres)
- **Descrição** (textarea, obrigatório, máx 500 caracteres)
- **Área do Projeto** (select, obrigatório)
  - Opções: Engenharia, Tecnologia, Sustentabilidade, Inovação, Ciências Aplicadas, Outra
- **Curso** (select, obrigatório)
  - Opções: Eng. Informática, Eng. Telecomunicações, Eng. Eletrotécnica, Ciências Computação, Outro
- **Tamanho da Equipa** (number, obrigatório, 1-5)
- **Nomes dos Membros** (textarea, obrigatório, separados por virgula)
- **Email do Líder** (email, obrigatório, deve ser @secretaria.uor.edu.ao)
- **Necessidades Técnicas** (checkboxes, múltipla seleção)
  - Opções: Tomada elétrica, Projetor multimédia, Ligação internet, Mesa exposição, Espaço extra
- **Comprovativo de Pagamento** (file upload, obrigatório)
- **Link do Repositório** (URL, opcional - GitHub, GitLab, etc)
- **Concordo com as Regras** (checkbox, obrigatório)

**Validações:**
- Email deve ser do domínio institucional (@secretaria.uor.edu.ao)
- Tamanho equipa: 1-5 membros
- Descrição mínimo 20 caracteres
- Arquivo upload: PDF, PNG, JPG (máx 5MB)

**Critério de Aceitação:**
- ✅ Validações funcionam corretamente
- ✅ Mensagens de erro claras
- ✅ Form salva dados localmente antes de submeter
- ✅ Loading state durante submissão
- ✅ Toast de sucesso após submissão

---

#### RF003.3 - Formulário de Negócio
**Descrição:** Formulário para submeter um negócio/startup.

**Campos:**
- **Nome do Negócio** (texto, obrigatório, máx 100 caracteres)
- **Descrição da Ideia** (textarea, obrigatório, máx 500 caracteres)
- **Área do Negócio** (select, obrigatório)
  - Opções: Tecnologia, Comércio, Serviços, Alimentação, Educação, Saúde, Outra
- **Estágio** (select, obrigatório)
  - Opções: Ideia, Protótipo, MVP, Funcionando, Já no Mercado
- **Tamanho da Equipa** (number, obrigatório, 1-5)
- **Nomes dos Membros** (textarea, obrigatório)
- **Email do Líder** (email, obrigatório, @secretaria.uor.edu.ao)
- **Necessidades Técnicas** (checkboxes)
- **Comprovativo de Pagamento** (file upload, obrigatório)
- **Website/Link** (URL, opcional)
- **Concordo com as Regras** (checkbox, obrigatório)

**Validações:** Similar ao formulário de projeto

**Critério de Aceitação:**
- ✅ Todas as validações funcionam
- ✅ Submissão funciona corretamente
- ✅ Feedback visual após submissão

---

#### RF003.4 - Formulário de Produto
**Descrição:** Formulário para submeter um produto.

**Campos:**
- **Nome do Produto** (texto, obrigatório, máx 100 caracteres)
- **Descrição** (textarea, obrigatório, máx 500 caracteres)
- **Categoria** (select, obrigatório)
  - Opções: Hardware, Software, Alimentar, Artesanato, Vestuário, Outro
- **Tipo de Produto** (select, obrigatório)
  - Opções: Físico, Digital, Híbrido
- **Tamanho da Equipa** (number, obrigatório, 1-5)
- **Nomes dos Membros** (textarea, obrigatório)
- **Email do Líder** (email, obrigatório, @secretaria.uor.edu.ao)
- **Necessidades Técnicas** (checkboxes)
- **Comprovativo de Pagamento** (file upload, obrigatório)
- **Link para Visualizar** (URL, opcional)
- **Concordo com as Regras** (checkbox, obrigatório)

**Critério de Aceitação:**
- ✅ Formulário valida corretamente
- ✅ Submissão processa normalmente
- ✅ Confirmação exibida ao user

---

#### RF003.5 - Tela de Confirmação
**Descrição:** Feedback de submissão bem-sucedida.

**Funcionalidades:**
- Ícone de sucesso (CheckCircle animado)
- Mensagem de confirmação
- Número de referência/ID (gerado)
- Instruções próximas (ex: data de confirmação da aprovação)
- Botão para retornar ao início
- Botão para submeter outro projeto

**Critério de Aceitação:**
- ✅ Exibido após submissão bem-sucedida
- ✅ Botões navegam corretamente
- ✅ Animações suaves

---

### 4️⃣ RF004 - PÁGINA DE PROJETOS

#### RF004.1 - Catálogo de Projetos
**Descrição:** Exibir todos os projetos submetidos com opções de interação.

**Funcionalidades:**
- Grid responsivo de cards de projetos
- Cada card mostra:
  - Barra colorida no topo (cor por área)
  - Nome do projeto
  - Área/tema (badge)
  - Equipa
  - Descrição resumida
  - Rating (estrelas)
  - Número de votos
  - Status (aprovado/pendente/recusado)
- Cards expandíveis para detalhes completos
- Animações ao carregar e ao interagir

**Dados Exibidos por Card:**
```typescript
{
  id: number,
  name: string,
  area: "IoT" | "Telecom" | "Segurança" | "Web" | "IA" | "Negócio" | "Produto",
  team: string,
  desc: string,
  approved: boolean,
  votes: number,
  rating: number (1-5),
  comments: Comment[]
}
```

**Critério de Aceitação:**
- ✅ Cards carregam corretamente
- ✅ Cores aplicadas por área
- ✅ Animações funcionam
- ✅ Responsivo em mobile

---

#### RF004.2 - Sistema de Votação
**Descrição:** Permitir estudantes votarem em projetos.

**Funcionalidades:**
- Botão "👍 Vote" ou contador de votos clicável
- Requer autenticação com email institucional (@secretaria.uor.edu.ao)
- Modal de login aparece se não autenticado
- Cada estudante pode votar uma vez por projeto
- Validação do email
- Toast de confirmação após voto
- Votos armazenados localmente (ou sincronizados com backend)

**Modal de Login:**
- Campo de email (validar domínio)
- Campo de senha (mock, para frontend)
- Botão de login
- Mensagem de erro se credenciais inválidas
- Link "Não tens conta?" (informativo)

**Critério de Aceitação:**
- ✅ Login funciona com email válido
- ✅ Voto registado após login
- ✅ Contador atualiza
- ✅ Mensagem de sucesso exibida
- ✅ Não permite segundo voto no mesmo projeto

---

#### RF004.3 - Sistema de Rating (Estrelas)
**Descrição:** Avaliação de projetos com rating de 1-5 estrelas.

**Funcionalidades:**
- 5 estrelas clicáveis/interativas
- Exibir rating atual em decimal (ex: 4.2)
- Hover effects nas estrelas
- Requer autenticação
- Cada avaliação pesa no rating médio
- Animação ao submeter rating

**Critério de Aceitação:**
- ✅ Rating calcula corretamente
- ✅ Média atualiza após nova avaliação
- ✅ Validação de autenticação funciona
- ✅ Hover state funciona

---

#### RF004.4 - Seção de Comentários
**Descrição:** Permitir comentários e feedback sobre projetos.

**Funcionalidades:**
- Exibir comentários existentes em ordem cronológica
- Cada comentário mostra: autor, texto, rating dado, data
- Campo de texto para adicionar novo comentário
- Requer autenticação
- Validação: mínimo 10 caracteres
- Botão "Enviar" com loading state
- Toast de sucesso

**Estrutura de Comentário:**
```typescript
{
  user: string,
  text: string,
  rating: number,
  date?: string,
  avatar?: string
}
```

**Critério de Aceitação:**
- ✅ Comentários carregam corretamente
- ✅ Novo comentário se submete
- ✅ Validação funciona
- ✅ Animação de entrada suave

---

#### RF004.5 - Filtros e Busca
**Descrição:** Facilitar encontrar projetos específicos.

**Funcionalidades:**
- Campo de busca por nome do projeto ou equipa
- Filtro por área (IoT, Telecom, Segurança, Web, IA, Negócio, Produto, Todos)
- Ordenação por: Relevância, Mais Votados, Melhor Rating, Mais Recentes
- Número de resultados exibido
- Opção de "Limpar Filtros"

**Critério de Aceitação:**
- ✅ Busca funciona em tempo real
- ✅ Filtros trabalham juntos
- ✅ Ordenação funciona
- ✅ Resultados atualizam

---

### 5️⃣ RF005 - PÁGINA DE PALESTRANTES

#### RF005.1 - Catálogo de Palestrantes
**Descrição:** Exibir informações detalhadas dos palestrantes.

**Funcionalidades:**
- Grid de cards de palestrantes
- Cada card exibe:
  - Foto/Avatar
  - Nome
  - Especialidade
  - Bio resumida (2-3 linhas)
  - Tema da palestra
  - Dia e horário
  - Link LinkedIn (ícone clicável)

**Dados por Palestrante:**
```typescript
{
  name: string,
  bio: string (parágrafo completo),
  specialty: string,
  talk: string,
  day: string (ex: "Dia 1 — 09:30"),
  linkedin: string (URL)
}
```

**Critério de Aceitação:**
- ✅ Cards carregam com informações corretas
- ✅ Imagens redimensionam responsivamente
- ✅ Links LinkedIn abrem em nova aba
- ✅ Layout responsivo

---

#### RF005.2 - Detalhes Expandidos
**Descrição:** Visualizar bio completa ao clicar em palestrante.

**Funcionalidades:**
- Modal ao clicar no card
- Exibir bio completa
- Maior imagem do palestrante
- Horário exato da palestra
- Sala/local
- Botão para voltar à agenda nesse horário
- Compartilhar no LinkedIn ou por email

**Critério de Aceitação:**
- ✅ Modal abre/fecha suavemente
- ✅ Todas as informações legíveis
- ✅ Botões funcionam

---

### 6️⃣ RF006 - PÁGINA DE FAQ

#### RF006.1 - Accordion de Perguntas
**Descrição:** Exibir respostas a perguntas frequentes.

**Funcionalidades:**
- Lista de 12+ FAQs em accordion (expand/collapse)
- Ícone de pergunta em cada item
- Pergunta em texto grande, resposta em texto menor
- Transição suave ao expandir
- Apenas 1 item aberto por vez (ou permitir múltiplos)
- Pesquisável (opcional)

**FAQs Cobertas:**
1. Preciso registar para assistir?
2. Onde será o evento?
3. Quantas pessoas por grupo?
4. Como submeto o meu projeto?
5. Qual é o custo de participação?
6. Posso assistir sem apresentar projeto?
7. Haverá certificado de participação?
8. Que materiais devo levar?
9. Como funciona a avaliação dos projetos?
10. Posso participar em mais de um grupo?
11. Existe ligação à internet no local?
12. Até quando posso submeter o projeto?

**Critério de Aceitação:**
- ✅ Accordion funciona corretamente
- ✅ Transições suaves
- ✅ Todos os FAQs legíveis
- ✅ Responsivo em mobile

---

### 7️⃣ RF007 - PÁGINA DE GUIA DO PARTICIPANTE

#### RF007.1 - Passos Numerados
**Descrição:** Guia interativo passo-a-passo para participação.

**Funcionalidades:**
- 4 passos claros:
  1. **Regista-te** → Link para /submeter
  2. **Consulta a Agenda** → Link para /agenda
  3. **Prepara o teu Projeto** → Link para /regras
  4. **Participa e Vota** → Informações sobre participação
- Cada passo com ícone temático
- Descrição de 1-2 linhas
- CTA button para ação correspondente
- Animações ao entrar na viewport

**Critério de Aceitação:**
- ✅ Links funcionam corretamente
- ✅ Ícones exibem adequadamente
- ✅ Animações suaves
- ✅ Responsivo

---

#### RF007.2 - Informações Práticas
**Descrição:** Dicas úteis e checklist para o participante.

**Funcionalidades:**
- Checklist de preparação
- Tempo recomendado para cada atividade
- Dicas de sucesso
- Contatos de suporte
- FAQ quick reference

**Critério de Aceitação:**
- ✅ Informações claras e úteis
- ✅ Layout limpo e organizado

---

### 8️⃣ RF008 - PÁGINA DE REGRAS

#### RF008.1 - Cards de Regras
**Descrição:** Exibir regras e critérios de avaliação.

**Funcionalidades:**
- 6 cards com regras principais:
  1. **Participação** - Requisitos para participar
  2. **Grupos** - Tamanho e composição de grupos
  3. **Apresentação** - Tempo e formato
  4. **Avaliação** - Critérios e pesos
  5. **Regras Gerais** - Originalidade, plágio, decisões
  6. **Submissão** - Requisitos de entrega
- Ícones representativos
- Listas de pontos
- Cores temáticas
- Cards com hover effects

**Conteúdo Específico:**
- **Participação:** Ser estudante UOR, matrícula 2025/2026, individual ou grupo
- **Grupos:** Máx 5 membros, 1 grupo por estudante, indicar líder
- **Apresentação:** 10 min apresentação + 5 min perguntas, pontualidade obrigatória
- **Avaliação:** Inovação 30%, Viabilidade técnica 25%, Impacto social 25%, Apresentação 20%
- **Regras Gerais:** Projetos originais, plágio = desclassificação, decisão do júri é final
- **Submissão:** Formulário completo, descrição detalhada, link repositório (opcional)

**Critério de Aceitação:**
- ✅ Todos os cards exibem corretamente
- ✅ Critérios claros e bem organizados
- ✅ Cores aplicadas consistentemente
- ✅ Responsivo em todos os tamanhos

---

### 9️⃣ RF009 - PÁGINA SOBRE

#### RF009.1 - Informações Sobre o Evento
**Descrição:** Apresentar contexto e objectivos do evento.

**Funcionalidades:**
- Título: "Dia das Telecomunicações UOR"
- Descrição do evento
- Missão da organização
- Logos dos organizadores (UOR e NEIC)
- Tema dos dias
- Importância da celebração (Dia Mundial Telecomunicações)

**Conteúdo:**
- Evento académico celebrando Dia Mundial Telecomunicações
- Dois dias de painéis, workshops e apresentações
- Reúne estudantes, professores e profissionais
- Missão: Conectar conhecimento académico ao mercado, incentivando inovação
- Organizadores: UOR (Universidade Óscar Ribas) + NEIC

**Critério de Aceitação:**
- ✅ Todas as informações exibidas
- ✅ Logos de boa qualidade
- ✅ Texto bem formatado
- ✅ Responsivo

---

### 🔟 RF010 - PÁGINA AO VIVO

#### RF010.1 - Transmissão em Direto
**Descrição:** Exibir atividades em decorrer em tempo real.

**Funcionalidades:**
- Indicador visual "🔴 AO VIVO" destacado
- Exibir atividade atual em grande destaque
- Horário, local, palestrante, descrição
- Próximas atividades listadas
- Atualização automática conforme o tempo passa
- Badge "Ao Vivo" com cor destacada
- Contador de tempo até próxima atividade

**Estrutura:**
- Atividade Principal (grande)
- Próximas 3 atividades (lista)
- Atualizar conforme horários mudam

**Critério de Aceitação:**
- ✅ Horários atualizados corretamente
- ✅ Atividade certa exibida no horário
- ✅ Animações suaves
- ✅ Responsivo

---

#### RF010.2 - Informações de Locais
**Descrição:** Mapear locais do evento com capacidades.

**Funcionalidades:**
- Cards com informações de cada sala:
  - Nome do local
  - Descrição
  - Capacidade
  - Piso/Localização
- Ícone representativo
- Layout para navegação do campus

**Locais:**
1. Auditório Principal - 250 lugares - Piso 0
2. Sala B2 - 60 lugares - Piso 1
3. Sala C1 - 80 lugares - Piso 1
4. Lab Informática - 40 lugares - Piso 2
5. Átrio - Espaço aberto - Piso 0

**Critério de Aceitação:**
- ✅ Informações legíveis
- ✅ Cards carregam bem
- ✅ Responsive design

---

### 1️⃣1️⃣ RF011 - PAINEL DE ADMINISTRAÇÃO

#### RF011.1 - Autenticação Admin
**Descrição:** Controle de acesso à área administrativa.

**Funcionalidades:**
- Login com email institucional (@secretaria.uor.edu.ao)
- Senha (mock para protótipo)
- Validação de credentials
- Session management
- Logout button
- Redirect se não autenticado
- Token/Session storage local

**Critério de Aceitação:**
- ✅ Login funciona com credentials corretos
- ✅ Rejeita credenciais inválidas
- ✅ Sessão persiste ao recarregar
- ✅ Logout limpa sessão

---

#### RF011.2 - Visão Geral (Overview)
**Descrição:** Dashboard com estatísticas gerais do evento.

**Funcionalidades:**
- Cards com KPIs:
  - Total de candidaturas (projeto/negócio/produto)
  - Candidaturas aprovadas/pendentes/recusadas
  - Total de palestrantes
  - Total de estudantes participantes
  - Total de votos registados
  - Projeto com mais votos
  - Avaliação média geral
- Gráficos (Charts):
  - Distribuição de candidaturas por tipo
  - Candidaturas ao longo do tempo
  - Distribuição por área temática
- Trending projects
- Atividade recente

**Critério de Aceitação:**
- ✅ Números atualizados corretamente
- ✅ Gráficos rendem sem erros
- ✅ Dados refletem estado real

---

#### RF011.3 - Gestão de Candidaturas
**Descrição:** Revisar e aprovar/rejeitar submissões.

**Funcionalidades:**
- Tabela com todas as candidaturas
- Colunas: ID, Nome, Tipo, Área, Equipa, Email, Data, Status
- Filtros: Por status (Pendente, Aprovado, Recusado), Por tipo
- Busca por nome ou email
- Ações por candidatura:
  - 👁️ Ver detalhes (modal)
  - ✅ Aprovar
  - ❌ Rejeitar
  - ✏️ Editar (nome, descrição, etc)
- Bulk actions (selecionar múltiplas e aprovar/rejeitar)
- Status visual com cores (Pendente: amarelo, Aprovado: verde, Recusado: vermelho)

**Campos Visíveis:**
- Nome da submissão
- Tipo (Projeto, Negócio, Produto)
- Área
- Equipa
- Email do líder
- Data da submissão
- Status atual

**Modal de Detalhes:**
- Todas as informações da candidatura
- Descrição completa
- Necessidades técnicas
- Upload preview (comprovativo)
- Link repositório (se houver)
- Botões de ação (Aprovar/Rejeitar)

**Critério de Aceitação:**
- ✅ Lista carrega todas as candidaturas
- ✅ Filtros funcionam
- ✅ Busca funciona
- ✅ Aprovar/Rejeitar atualiza status
- ✅ Modal exibe detalhes completos
- ✅ Ações geram confirmação

---

#### RF011.4 - Gestão de Palestrantes
**Descrição:** Adicionar/editar/remover palestrantes.

**Funcionalidades:**
- Tabela de palestrantes
- Colunas: ID, Nome, Tema, Horário, Dia, Local
- Botões de ação:
  - 👁️ Ver detalhes
  - ✏️ Editar
  - 🗑️ Remover
- Botão "Adicionar Palestrante" (abre formulário modal)
- Formulário com campos: Nome, Bio, Especialidade, Tema, Dia, Horário, Local, LinkedIn

**Critério de Aceitação:**
- ✅ Tabela exibe palestrantes
- ✅ Formulário valida dados
- ✅ Adicionar cria novo palestrante
- ✅ Editar atualiza informações
- ✅ Remover com confirmação

---

#### RF011.5 - Gestão de Horário
**Descrição:** Gerenciar agenda do evento.

**Funcionalidades:**
- Tabela com atividades por dia
- Colunas: ID, Título, Horário, Dia, Local, Tipo
- Filtrar por dia
- Ações:
  - 👁️ Ver detalhes
  - ✏️ Editar
  - 🗑️ Remover (com confirmação)
- Adicionar nova atividade (modal formulário)
- Arrastar e soltar para reordenar (nice-to-have)

**Formulário:**
- Título, Hora início, Hora fim, Dia, Local, Tipo, Descrição, Palestrante

**Critério de Aceitação:**
- ✅ Agenda carrega corretamente
- ✅ Adicionar nova atividade funciona
- ✅ Editar atualiza dados
- ✅ Remover com confirmação

---

#### RF011.6 - Monitoramento Ao Vivo (Live Monitoring)
**Descrição:** Track de atividades em tempo real durante o evento.

**Funcionalidades:**
- Visualização em tempo real das atividades
- Atividade atual destacada
- Próximas atividades
- Botão para marcar como "iniciado"
- Botão para marcar como "finalizado"
- Contador de tempo restante
- Notificações de atrasos

**Critério de Aceitação:**
- ✅ Atividade certa exibida no horário
- ✅ Botões funcionam
- ✅ Estado atualiza em tempo real

---

#### RF011.7 - Gestão de Votações
**Descrição:** Visualizar e validar votos registados.

**Funcionalidades:**
- Tabela de votos
- Colunas: ID, Estudante, Email, Projeto, Rating, Data/Hora
- Filtrar por projeto
- Buscar por email do estudante
- Visualizar estatísticas de cada projeto:
  - Total de votos
  - Rating médio
  - Número de comentários
- Validação de votos duplicados
- Opção de anular voto (com confirmação)

**Critério de Aceitação:**
- ✅ Votos carregam corretamente
- ✅ Filtros funcionam
- ✅ Estatísticas calculadas corretamente
- ✅ Anular voto funciona

---

#### RF011.8 - Gestão de Estudantes
**Descrição:** Visualizar perfis e atividade de participantes.

**Funcionalidades:**
- Tabela de estudantes
- Colunas: ID, Nome, Email, Votos, Comentários, Rating Médio, Interações Totais
- Ordenar por: Nome, Votos, Atividade
- Filtrar por engajamento (Activo, Inativo, Não votou)
- Visualizar detalhes:
  - Email
  - Votos dados
  - Comentários feitos
  - Projetos votados
  - Rating médio dado
- Exportar lista (CSV)

**Critério de Aceitação:**
- ✅ Tabela carrega todos os estudantes
- ✅ Filtros e ordenação funcionam
- ✅ Detalhes mostram informações corretas
- ✅ Export funciona

---

#### RF011.9 - Gestão de Vencedores
**Descrição:** Selecionar e registar projetos vencedores.

**Funcionalidades:**
- Ranking automático baseado em:
  - Votos totais
  - Rating médio
  - Feedback qualitativo
- Top 3 em cada categoria:
  - Melhor Projeto
  - Melhor Negócio
  - Melhor Produto
  - Prémio Popular (mais votado)
  - Prémio Inovação
- Cards com informações do vencedor
- Publicar vencedores (toggle)
- Gerar certificados (botão)
- Badge de vencedor (estrela/troféu)

**Critério de Aceitação:**
- ✅ Ranking calcula automaticamente
- ✅ Publicar/despublicar funciona
- ✅ Certificados geram corretamente

---

### 1️⃣2️⃣ RF012 - NAVEGAÇÃO E COMPONENTES GLOBAIS

#### RF012.1 - Navbar/Header
**Descrição:** Navegação principal da aplicação.

**Funcionalidades:**
- Logo clickável (volta à home)
- Menu items: Início, Agenda, Palestrantes, Submeter, Projetos, FAQ, Guia, 🔴 Ao Vivo
- Ícone de busca (abre SearchDialog)
- Menu hambúrguer em mobile
- Active state visual para rota atual
- Sticky/fixed ao topo da página
- Backdrop blur effect
- Responsivo

**Critério de Aceitação:**
- ✅ Todos os links navegam corretamente
- ✅ Hamburger menu funciona em mobile
- ✅ Active state correto
- ✅ Sticky funciona

---

#### RF012.2 - Footer
**Descrição:** Rodapé com informações gerais.

**Funcionalidades:**
- Logos (UOR, NEIC)
- Links rápidos (Home, Agenda, Submeter, etc)
- Informações de contato
- Data/hora do evento
- Links de redes sociais (opcional)
- Copyright

**Critério de Aceitação:**
- ✅ Layout limpo
- ✅ Links funcionam
- ✅ Responsivo

---

#### RF012.3 - Search Dialog
**Descrição:** Busca global na plataforma.

**Funcionalidades:**
- Abre ao clicar no ícone de lupa ou com Ctrl+K (nice-to-have)
- Campo de busca com placeholder
- Resultados em tempo real:
  - Projetos
  - Palestrantes
  - FAQs
  - Páginas
- Atalhos de teclado
- Fechar com Escape
- Exibir histórico de buscas recentes

**Critério de Aceitação:**
- ✅ Dialog abre/fecha
- ✅ Busca funciona
- ✅ Resultados relevantes
- ✅ Navegação de resultados funciona

---

#### RF012.4 - Notificações (Toast)
**Descrição:** Sistema de notificações não-intrusivo.

**Funcionalidades:**
- Toast notifications usando Sonner
- Tipos: Success, Error, Warning, Info
- Posição: Top-right (default)
- Duração: 3-5 segundos (auto-dismiss)
- Botão de fechar manual
- Stacking automático
- Ícones representativos

**Casos de Uso:**
- Sucesso ao votar
- Erro na submissão
- Sucesso ao submeter projeto
- Validação de formulário
- Login bem-sucedido
- Confirmação de ações

**Critério de Aceitação:**
- ✅ Toasts exibem corretamente
- ✅ Auto-dismiss funciona
- ✅ Múltiplos toasts stackam bem
- ✅ Fechar manual funciona

---

#### RF012.5 - 404 Page
**Descrição:** Página de erro para rotas não encontradas.

**Funcionalidades:**
- Ícone de erro (404)
- Mensagem amigável
- Botão para voltar à home
- Suggestões de navegação
- Layout consistente com resto da app

**Critério de Aceitação:**
- ✅ Exibido para rotas inválidas
- ✅ Botão funciona
- ✅ Design consistente

---

## ⚙️ Requisitos Não-Funcionais

### RNF001 - Performance

#### RNF001.1 - Tempo de Carregamento
- **Requirement:** Tempo de primeira carga < 3 segundos em conexão 4G
- **Métrica:** Lighthouse Performance Score > 85
- **Implementação:**
  - Code splitting com Vite
  - Lazy loading de componentes/páginas
  - Compressão de imagens
  - Caching de assets
  - Minificação de CSS/JS

#### RNF001.2 - Animações Fluidas
- **Requirement:** Animações a 60 FPS mínimo
- **Métrica:** Sem jank ou stuttering
- **Implementação:**
  - Usar `transform` e `opacity` em animações
  - Evitar layout thrashing
  - Usar `will-change` estrategicamente com Framer Motion
  - Otimizar re-renders com React.memo e useCallback

#### RNF001.3 - Responsividade
- **Requirement:** Tempo de resposta de interações < 100ms
- **Métrica:** TTI (Time to Interactive) < 3.5s
- **Implementação:**
  - Event handlers otimizados
  - Debounce/Throttle em busca
  - React Query para data fetching eficiente

---

### RNF002 - Segurança

#### RNF002.1 - Validação de Input
- **Requirement:** Todas as entradas validadas no frontend e backend
- **Implementação:**
  - React Hook Form + Zod para validações client-side
  - Sanitização de inputs
  - Type safety com TypeScript
  - CSRF protection (se integrado com backend)

#### RNF002.2 - Autenticação
- **Requirement:** Autenticação segura para área admin e votações
- **Implementação:**
  - Email validation (@secretaria.uor.edu.ao)
  - Session management seguro
  - Logout automático após inatividade
  - Proteção contra brute force (rate limiting)

#### RNF002.3 - HTTPS
- **Requirement:** Toda comunicação em HTTPS
- **Implementação:**
  - SSL/TLS obrigatório
  - HSTS headers
  - Secure cookies

---

### RNF003 - Usabilidade

#### RNF003.1 - Acessibilidade
- **Requirement:** WCAG 2.1 Level AA compliance
- **Implementação:**
  - Semantic HTML
  - ARIA labels e roles apropriados
  - Contraste de cores (4.5:1 para texto)
  - Keyboard navigation completa
  - Focus indicators visíveis
  - Alt text para imagens
  - Form labels associadas

#### RNF003.2 - Design Responsivo
- **Requirement:** Suportar resoluções de 320px a 4K
- **Breakpoints:**
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px
- **Implementação:**
  - Mobile-first approach
  - Tailwind CSS responsive classes
  - Flexible layouts com flexbox/grid

#### RNF003.3 - Internacionalização (i18n)
- **Requirement:** Interface totalmente em português (Angola)
- **Implementação:**
  - Texto em pt-AO
  - Datas em formato DD/MM/YYYY
  - Horários em formato 24h
  - Moeda em AOA (se aplicável)

---

### RNF004 - Confiabilidade

#### RNF004.1 - Error Handling
- **Requirement:** Todos os erros tratados gracefully
- **Implementação:**
  - Try-catch blocks estratégicos
  - Error boundaries em React
  - Fallback UI em casos de erro
  - Logging de erros (para futuro backend)
  - User-friendly mensagens de erro

#### RNF004.2 - Data Persistence
- **Requirement:** Dados persitem durante sessão e entre recarregamentos
- **Implementação:**
  - LocalStorage para dados não-críticos
  - SessionStorage para dados temporários
  - React Query para cache de dados
  - Fallback em caso de perda de dados

#### RNF004.3 - Validação de Dados
- **Requirement:** Integridade de dados garantida
- **Implementação:**
  - Validações duplas (client + server futuro)
  - Type safety com TypeScript
  - Schemas com Zod
  - Verificação de dados antes de render

---

### RNF005 - Compatibilidade

#### RNF005.1 - Browsers Suportados
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (Safari iOS 14+, Chrome Android)

#### RNF005.2 - Testes
- **Requirement:** Cobertura mínima de testes > 70%
- **Implementação:**
  - Unit tests com Vitest
  - E2E tests com Playwright
  - Manual testing em diferentes browsers
  - Accessibility testing

---

### RNF006 - Escalabilidade

#### RNF006.1 - Preparação para Backend
- **Requirement:** Arquitetura pronta para integração com API REST/GraphQL
- **Implementação:**
  - React Query para data fetching
  - Environment variables para URLs
  - Abstração de chamadas API
  - Tipo-safe requests com TypeScript

#### RNF006.2 - Gerenciamento de Estado
- **Requirement:** Estado escalável e manutenível
- **Implementação:**
  - React Context para estado global mínimo
  - React Query para server state
  - Props drilling evitado
  - Custom hooks para lógica reutilizável

---

### RNF007 - Manutenibilidade

#### RNF007.1 - Código Limpo
- **Requirement:** Código followings best practices
- **Implementação:**
  - ESLint configurado e enforçado
  - Prettier para formatação
  - Component composition pattern
  - Custom hooks para lógica reutilizável
  - Comentários em código complexo

#### RNF007.2 - Documentação
- **Requirement:** README completo e inline docs
- **Implementação:**
  - README com instruções de setup
  - Comentários em funções complexas
  - Storybook (nice-to-have)
  - Architecture documentation

---

### RNF008 - Disponibilidade

#### RNF008.1 - Uptime
- **Requirement:** 99.5% uptime durante evento
- **Implementação:**
  - Deployment em CDN/hosting robusto
  - Monitoring e alertas
  - Fallback pages
  - Graceful degradation

#### RNF008.2 - Offline Support (Nice-to-have)
- **Requirement:** Funcionalidade básica offline
- **Implementação:**
  - Service workers
  - Local storage para dados críticos
  - Sync quando reconectar

---

## 📊 Regras de Negócio

### RN001 - ELEGIBILIDADE DE PARTICIPANTES

#### RN001.1 - Critérios de Participação
**Regra:** Para participar do evento, o estudante DEVE:
- Ser estudante matriculado da Universidade Óscar Ribas
- Estar regularizado no ano letivo 2025/2026
- Ter email institucional válido (@secretaria.uor.edu.ao)
- Aceitar as regras do evento

**Impacto:** Validação de email na submissão

---

#### RN001.2 - Participação em Grupos
**Regra:** 
- Tamanho mínimo: 1 estudante (individual)
- Tamanho máximo: 5 estudantes por grupo
- Um estudante NÃO pode estar em 2+ grupos simultaneamente
- Todo grupo DEVE ter um líder indicado na submissão
- O líder é responsável pela comunicação

**Impacto:** Validação no formulário de submissão

---

### RN002 - TIPOS DE SUBMISSÃO

#### RN002.1 - Categorias Aceites
**Regra:** O sistema aceita 3 tipos de submissão:

1. **Projeto Académico/Tecnológico**
   - Áreas: Engenharia, Tecnologia, Sustentabilidade, Inovação, Ciências Aplicadas, Outra
   - Descrição obrigatória
   - Curso de origem obrigatório

2. **Negócio/Startup**
   - Áreas: Tecnologia, Comércio, Serviços, Alimentação, Educação, Saúde, Outra
   - Estágio: Ideia, Protótipo, MVP, Funcionando, Já no Mercado
   - Pode ou não ter website

3. **Produto (Físico ou Digital)**
   - Categorias: Hardware, Software, Alimentar, Artesanato, Vestuário, Outro
   - Tipo: Físico, Digital, Híbrido
   - Link de visualização opcional

**Impacto:** 3 formulários diferentes, validação de campos específicos

---

#### RN002.2 - Comprovativo de Pagamento
**Regra:**
- OBRIGATÓRIO fazer upload do comprovativo de pagamento
- Formatos aceitos: PDF, PNG, JPG
- Tamanho máximo: 5 MB
- Sem comprovativo = submissão INCOMPLETA e REJEITADA

**Impacto:** Validação de file upload no formulário

---

### RN003 - PROCESSAMENTO DE SUBMISSÕES

#### RN003.1 - Estados de Submissão
**Regra:** Toda submissão passa por 3 estados:

1. **PENDENTE** (Estado inicial)
   - Submissão recebida
   - Aguardando revisão do admin
   - Visível apenas para admin

2. **APROVADO** (Após revisão admin)
   - Projeto aceito no evento
   - Visível para todos os participantes
   - Pode receber votos e comentários
   - Incluído em relatórios finais

3. **RECUSADO** (Após revisão admin)
   - Projeto não aceito (motivo opcional)
   - Notificação ao líder (futuro: email)
   - Visível apenas para admin e líder
   - Não pode receber votos

**Impacto:** Lógica de aprovação no Admin Panel

---

#### RN003.2 - Prazo de Submissão
**Regra:**
- Submissões abertas desde: 1 de Março de 2026
- Prazo final: 15 de Maio de 2026 às 23:59
- Após deadline: submissões BLOQUEADAS
- Admin pode abrir período extraordinário se necessário

**Impacto:** Validação de data/hora no backend (futuro)

---

### RN004 - AVALIAÇÃO E VOTAÇÃO

#### RN004.1 - Sistema de Votação
**Regra:**
- Qualquer estudante autenticado pode votar
- Email institucional obrigatório
- Um voto POR PROJETO por estudante (não pode votar 2x)
- Votos anónimos (apenas admin vê quem votou)
- Voto = +1 no contador

**Impacto:** Login validation, validação de voto único

---

#### RN004.2 - Sistema de Rating
**Regra:**
- Rating de 1-5 estrelas por projeto
- Um rating POR PROJETO por estudante
- Rating substitui anterior do mesmo estudante (update, não append)
- Rating médio calcula-se como: soma de ratings / número de raters
- Rating exibido com 1 casa decimal (ex: 4.2)

**Impacto:** Cálculo de média, prevent duplicate ratings

---

#### RN004.3 - Comentários e Feedback
**Regra:**
- Comentários DEVEM ter mínimo 10 caracteres
- Um comentário POR PROJETO por estudante (múltiplos comentários = atualizar anterior)
- Comentários aparecem apenas após aprovação do projeto
- Estudante pode editar seu próprio comentário
- Admin pode apagar comentários ofensivos/spam
- Comentário associado a um rating (1-5 estrelas)

**Impacto:** Validação de comentário, storage de comentários

---

### RN005 - CRITÉRIOS DE AVALIAÇÃO (RUBRICA DO JÚRI)

#### RN005.1 - Distribuição de Pontos
**Regra:** Os projetos são avaliados pelo júri com ponderação:

| Critério | Peso | Descrição |
|----------|------|-----------|
| **Inovação** | 30% | Originalidade, criatividade, novidade |
| **Viabilidade Técnica** | 25% | Execução técnica, funcionalidade |
| **Impacto Social** | 25% | Benefício para comunidade, sustentabilidade |
| **Apresentação** | 20% | Clareza, profissionalismo, timing |

**Escala:** 1-5 por critério
**Fórmula:** (Inovação × 0.30) + (Técnica × 0.25) + (Impacto × 0.25) + (Apresentação × 0.20)

**Impacto:** Cálculo no Admin Panel para ranking

---

### RN006 - REGRAS DE APRESENTAÇÃO

#### RN006.1 - Tempo de Apresentação
**Regra:**
- Duração: 10 minutos EXATOS
- Q&A (Perguntas): 5 minutos ADICIONAIS
- Ultrapassar tempo: -5% na nota de apresentação
- Menos de 5 minutos: -10% na nota

**Impacto:** Timer na página ao vivo (futuro)

---

#### RN006.2 - Pontos Obrigatórios
**Regra:** Toda apresentação DEVE cobrir:
1. Problema/Necessidade identificada
2. Solução proposta
3. Como funciona (Demo breve ou explicação)
4. Diferenciais/Vantagens
5. Próximos passos (se aplicável)

**Impacto:** Guia visual para apresentantes

---

#### RN006.3 - Materiais Permitidos
**Regra:**
- Slides (PowerPoint, Google Slides, etc)
- Demo ao vivo do projeto
- Vídeo pré-gravado (máx 3 minutos)
- Hardware/protótipo físico (se for produto)
- Projetor e laptop fornecidos pela organização

**Impacto:** Info na página de Guia

---

### RN007 - CONTROLO DE QUALIDADE

#### RN007.1 - Originalidade
**Regra:**
- Projetos DEVEM ser originais e desenvolvidos pelos autores indicados
- Plágio detectado = DESCLASSIFICAÇÃO IMEDIATA
- Código copiado (sem atribuição) = DESCLASSIFICAÇÃO
- Reutilizar trabalho prévio = PERMITIDO COM DISCLOSED

**Impacto:** Aviso destacado em Regras

---

#### RN007.2 - Decisão Irrevogável
**Regra:**
- Decisão do júri é FINAL e IRREVERSÍVEL
- Sem direito a reclamação formal
- Feedback dado em caso de rejeição

**Impacto:** Constar em Regras e FAQ

---

### RN008 - PRÉMIOS E RECONHECIMENTO

#### RN008.1 - Categorias de Prémios
**Regra:** Os projetos concorrem em categorias:

| Categoria | Critério | Prémio |
|-----------|----------|--------|
| Melhor Projeto Técnico | Maior score júri (projetos) | Certificado + Reconhecimento |
| Melhor Negócio | Maior score júri (negócios) | Certificado + Reconhecimento |
| Melhor Produto | Maior score júri (produtos) | Certificado + Reconhecimento |
| Prémio Popular | Mais votos dos estudantes | Badge + Certificado |
| Prémio Inovação | Nota máxima em Inovação | Certificado |

**Impacto:** Ranking no Admin, exibição de vencedores

---

#### RN008.2 - Anúncio de Vencedores
**Regra:**
- Vencedores anunciados no último dia (18 Mai) às 15:30
- Cerimónia de premiação na sessão de encerramento
- Todos os participantes recebem certificado de presença
- Vencedores recebem certificado especial de prémio

**Impacto:** Data fixa, página de vencedores

---

### RN009 - SEGURANÇA E VALIDAÇÃO

#### RN009.1 - Validações Obrigatórias
**Regra:**
- Email institucional (@secretaria.uor.edu.ao) validado por regex
- Nomes de membros validados (mínimo 3 caracteres)
- Descrição com mínimo 20 caracteres
- Arquivo upload máximo 5 MB
- Links (GitHub, website) validam URL format
- Campos required não podem estar vazios

**Impacto:** Validações Zod no formulário

---

#### RN009.2 - Prevenção de Duplicatas
**Regra:**
- Um estudante NÃO pode submeter o mesmo projeto 2x
- Mesmo email + mesmo nome projeto = BLOQUEADO
- Admin pode permitir override em casos especiais

**Impacto:** Validação antes de submit

---

### RN010 - COMUNICAÇÃO E NOTIFICAÇÕES

#### RN010.1 - Confirmação de Submissão
**Regra:**
- Ao submeter: Toast de sucesso no frontend
- Número de referência gerado (ex: UOR-2026-0001)
- Aviso: "Aprovação será comunicada até [data]"

**Impacto:** Modal de confirmação após submissão

---

#### RN010.2 - Notificações de Aprovação (Futuro)
**Regra:**
- Admin aprova submissão
- Email enviado para líder do grupo
- Email contém: Número de referência, data/hora da apresentação, sala
- Prazo para confirmação presença: 48h

**Impacto:** Integração com backend/email service

---

### RN011 - PARTICIPAÇÃO E NETWORKING

#### RN011.1 - Attendência Requerida
**Regra:**
- Estudantes com projeto DEVEM estar presentes no horário da apresentação
- Não-presença = Desclassificação automática
- Justificação prévia ao admin = possível rescisão

**Impacto:** Info em Regras e Guia

---

#### RN011.2 - Certificados
**Regra:**
- Todos que se registarem e comparecerem = Certificado digital
- Formato: PDF digital (futuro: online portal)
- Nome, tipo participação (Presenter/Attendee), datas
- Assinado digitalmente

**Impacto:** Info em FAQ

---

### RN012 - NECESSIDADES TÉCNICAS

#### RN012.1 - Solicitações de Infraestrutura
**Regra:** Na submissão, podem indicar necessidades:
- Tomada elétrica (para laptop/equipamentos)
- Projetor multimédia
- Ligação à internet (Wi-Fi garantida, mas podem pedir reforço)
- Mesa de exposição (para produtos)
- Espaço extra

**Impacto:** Checkboxes no formulário, report no Admin

---

#### RN012.2 - Garantias de Infraestrutura
**Regra:**
- Wi-Fi disponível em todo campus
- Projetor em todas as salas de apresentação
- Tomadas em salas principais
- Mesas em Átrio para exposição de produtos

**Impacto:** Info em Guia e EventoAoVivo

---

### RN013 - ESTRUTURA DO EVENTO

#### RN013.1 - Dois Temas Principais
**Regra:**
- **Dia 1 (17 Mai):** "Da sala de aula ao mercado: como transformar projetos académicos em oportunidades reais"
  - Foco: Inovação técnica, viabilidade de soluções
  
- **Dia 2 (18 Mai):** "Marca pessoal, networking e posicionamento profissional"
  - Foco: Carreira, desenvolvimento pessoal, networking

**Impacto:** Descrição em Agenda, tema visual diferenciado

---

#### RN013.2 - Locais e Capacidades
**Regra:** Eventos decorrem em locais específicos com capacidades:

| Local | Capacidade | Tipo | Piso |
|-------|-----------|------|------|
| Auditório Principal | 250 | Painéis, Cerimônias | 0 |
| Sala B2 | 60 | Workshops | 1 |
| Sala C1 | 80 | Apresentações projetos | 1 |
| Lab Informática | 40 | Workshops tech | 2 |
| Átrio | Aberto | Networking, coffee break, exposição | 0 |

**Impacto:** Info em EventoAoVivo, Admin pode modificar

---

#### RN013.3 - Duração e Horários
**Regra:**
- Dia 1: 08:30 - 17:00 (com intervalo almoço)
- Dia 2: 09:00 - 17:00 (com intervalo almoço)
- Cerimónia abertura: Dia 1 08:30-09:30
- Cerimónia encerramento: Dia 2 15:30-17:00

**Impacto:** Agenda fixa no sistema

---

### RN014 - DADOS ESTATÍSTICOS E RELATÓRIOS

#### RN014.1 - KPIs do Evento
**Regra:** Sistema deve rastrear:
- Total de participantes registados
- Total de submissões por tipo
- Submissões aprovadas/recusadas
- Total de votos registados
- Rating médio geral
- Projeto mais votado
- Participante mais activo

**Impacto:** Dashboard Admin, gráficos

---

#### RN014.2 - Relatórios Finais
**Regra:**
- Após evento: Relatório com estatísticas
- Incluir: Top projetos, engagement estudantes, feedback
- Exportável em PDF/Excel (futuro)

**Impacto:** Admin pode gerar relatórios

---

---

## 🔄 Fluxos de Dados e Processos

### Fluxo 1: SUBMISSÃO DE PROJETO

```
1. Estudante acede a /submeter
2. Seleciona tipo (Projeto/Negócio/Produto)
3. Preenche formulário com validações
4. Faz upload de comprovativo de pagamento
5. Clica "Enviar"
   ├─ Frontend valida dados
   ├─ Toast de loading
   ├─ Dados salvos em estado local (sessionStorage)
   └─ Simulação de envio (1-2s)
6. Exibir modal de confirmação com:
   ├─ ✅ Sucesso
   ├─ Número de referência
   ├─ Data esperada de aprovação
   └─ Botões: Voltar ao Início / Submeter Outro
```

---

### Fluxo 2: VOTAÇÃO EM PROJETO

```
1. Estudante navega para /projetos
2. Localiza projeto de interesse
3. Clica em "👍 Vote" ou "⭐ Rate" ou "💬 Comment"
4. Se não autenticado:
   ├─ Modal de login aparece
   ├─ Preenche email + senha
   ├─ Sistema valida @secretaria.uor.edu.ao
   └─ SessionStorage salva "autenticado = true"
5. Após autenticação:
   ├─ Voto/Rating/Comentário é processado
   ├─ Frontend valida se já votou (localStorage)
   ├─ Se já votou: erro "Já votaste este projeto"
   └─ Se não: registar voto, atualizar contador
6. Toast de sucesso
7. Contador/Rating atualiza imediatamente no card
```

---

### Fluxo 3: PROCESSO DE APROVAÇÃO (ADMIN)

```
1. Admin acede /admin (autenticado)
2. Navega para tab "Candidaturas"
3. Vê tabela com todas as submissões pendentes
4. Clica em submissão para visualizar detalhes
5. Modal abre com:
   ├─ Todos os dados do projeto
   ├─ Preview do comprovativo
   ├─ Botões: Aprovar / Rejeitar / Editar
6. Admin clica "Aprovar"
7. Status muda para "Aprovado" na tabela
8. Projeto agora visível em /projetos para todos
9. Toast de confirmação ao admin
```

---

### Fluxo 4: NAVEGAÇÃO DURANTE EVENTO (AO VIVO)

```
1. Durante evento: atividade inicia conforme horário
2. Sistema detecta horário atual (via clock do browser)
3. Em /ao-vivo, atividade certa é exibida como "🔴 AO VIVO"
4. Próximas 3 atividades listadas abaixo
5. Cada 5 min, verificar se mudar de atividade
6. Quando atividade termina: passar para próxima
7. Admin pode forçar atualização (botão "Iniciar" / "Finalizar")
```

---

### Fluxo 5: VISUALIZAÇÃO DE DETALHE DE PROJETO

```
1. Estudante clica num card de projeto em /projetos ou /index
2. Modal abre com detalhes completos:
   ├─ Nome, descrição, área
   ├─ Equipa
   ├─ Rating e votos
   ├─ Comentários
   └─ Botões de ação (Vote, Rate, Comment)
3. Pode interagir com projeto dentro modal
4. Fechar modal com X ou click fora
5. Volta a /projetos
```

---

---

## 🗂️ Mapeamento de Funcionalidades por Página

### MAPA DE FUNCIONALIDADES

| Página | URL | Funcionalidades | Componentes |
|--------|-----|-----------------|------------|
| **Index** | `/` | Hero, Agenda Preview, Top Projects, Speakers, Stats, CTAs | Index.tsx |
| **Agenda** | `/agenda` | Programação 2 dias, Filtros por tipo/tema, Timeline | Agenda.tsx |
| **Submeter** | `/submeter` | Formulários (3 tipos), Upload arquivo, Validações | Submeter.tsx |
| **Projetos** | `/projetos` | Catálogo, Votação, Rating, Comentários, Filtros | Projetos.tsx |
| **Palestrantes** | `/palestrantes` | Cards palestrantes, Detalhes expandidos | Palestrantes.tsx |
| **FAQ** | `/faq` | Accordion de perguntas | FAQ.tsx |
| **Guia** | `/guia` | 4 passos guiados, Links de ação | Guia.tsx |
| **Regras** | `/regras` | 6 cards com regras e critérios | Regras.tsx |
| **Sobre** | `/sobre` | Info evento, Missão, Logos | Sobre.tsx |
| **Ao Vivo** | `/ao-vivo` | Atividade atual, Próximas atividades, Locais | EventoAoVivo.tsx |
| **Admin** | `/admin` | Tabs: Overview, Candidaturas, Palestrantes, Horário, etc | Admin.tsx |
| **Not Found** | `*` | Erro 404, Link home | NotFound.tsx |

---

### MATRIZ DE COMPONENTES REUTILIZÁVEIS

| Componente | Usado em | Propriedades |
|-----------|---------|-------------|
| Button | Todas | variant, size, disabled, loading |
| Input | Submeter, Admin | type, placeholder, validation |
| Textarea | Submeter, Projetos | placeholder, maxLength |
| Select | Submeter, Admin | options, onChange, value |
| Checkbox | Submeter, Admin | checked, onChange, label |
| Dialog/Modal | Múltiplas | open, onClose, title, content |
| Badge | Index, Agenda, Projetos | color, text |
| Card | Múltiplas | title, content, hover effects |
| Toast | Todas | message, type, duration |
| Tab | Admin, Agenda | tabs, activeTab, onChange |

---

### FLUXO DE ESTADO (STATE MANAGEMENT)

```
App (Root)
├── sessionState
│   ├── isAuthenticated: boolean
│   ├── userEmail: string | null
│   └── submissionId: string | null
├── localState (localStorage)
│   ├── votes: Project[]
│   ├── ratings: { projectId: rating }
│   └── comments: { projectId: Comment[] }
└── React Query (Server State)
    ├── projects (cache)
    ├── agenda
    └── speakers
```

---

## 📝 RESUMO EXECUTIVO

A plataforma **UOR Connect** é uma solução completa para gestão e interação em torno do evento "Dia das Telecomunicações 2026". 

**Públicos-alvo:**
- ✅ Estudantes (submissão, votação, participação)
- ✅ Palestrantes (apresentação, feedback)
- ✅ Administradores (gestão completa)
- ✅ Comunidade (visualização de projetos)

**Principais funcionalidades:**
1. **Submissão de Projetos** - 3 tipos (Projeto, Negócio, Produto)
2. **Sistema de Votação** - Votos + Rating + Comentários
3. **Gestão de Agenda** - Programação de 2 dias
4. **Painel Admin** - Aprovação, estatísticas, vencedores
5. **Transmissão Ao Vivo** - Acompanhamento em tempo real
6. **Informações** - Regras, FAQ, Guia, Palestrantes

**Tecnologia:**
- React + TypeScript + Vite
- Tailwind CSS + shadcn-ui
- Framer Motion para animações
- React Query para dados
- Responsivo e acessível

**Cronograma:**
- Submissões: 1 Mar - 15 Mai 2026
- Evento: 17-18 Mai 2026
- Cerimónia encerramento: 18 Mai 15:30

---

**Versão:** 1.0  
**Última atualização:** 18 de Março de 2026  
**Status:** Documento completo pronto para desenvolvimento
