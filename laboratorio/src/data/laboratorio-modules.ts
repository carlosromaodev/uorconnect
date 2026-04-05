export type LaboratorioModuleStatus = "operacional" | "piloto" | "curadoria" | "planeado";
export type LaboratorioModuleTrack = "competicao" | "aprendizagem" | "inovacao" | "impacto";
export type LaboratorioModuleIcon =
  | "arena"
  | "group-learning"
  | "business-simulation"
  | "hackathon"
  | "mentoring"
  | "impact"
  | "prototyping"
  | "soft-skills"
  | "interdisciplinary";

export interface LaboratorioModule {
  slug: string;
  title: string;
  summary: string;
  description: string;
  status: LaboratorioModuleStatus;
  statusLabel: string;
  track: LaboratorioModuleTrack;
  icon: LaboratorioModuleIcon;
  featured?: boolean;
  primaryLabel: string;
  primaryPath: string;
  format: string;
  outcomes: string[];
}

export const laboratorioModules: LaboratorioModule[] = [
  {
    slug: "arena",
    title: "Arena",
    summary: "Desafios de pseudocódigo, sala de espera, ranking e prova com controlo de tempo.",
    description:
      "A Arena é o núcleo competitivo do Laboratório. Centraliza os exercícios de programação, a preparação da sessão, a prova principal e o acompanhamento do desempenho.",
    status: "operacional",
    statusLabel: "Operacional",
    track: "competicao",
    icon: "arena",
    featured: true,
    primaryLabel: "Ir para a arena",
    primaryPath: "/arena",
    format: "Sessão competitiva com VisuAlg, ranking e gestão técnica da prova.",
    outcomes: [
      "Treino técnico em algoritmia e lógica.",
      "Leitura imediata de erros, progresso e ranking.",
      "Execução com identidade própria do Laboratório.",
    ],
  },
  {
    slug: "aprendizagem-em-grupo",
    title: "Aprendizagem em Grupo",
    summary: "Sessões colaborativas para estudo orientado, revisão de soluções e trabalho em pares.",
    description:
      "Módulo desenhado para equipas pequenas com ciclos curtos de estudo, revisão guiada e resolução de problemas em conjunto.",
    status: "piloto",
    statusLabel: "Piloto",
    track: "aprendizagem",
    icon: "group-learning",
    featured: true,
    primaryLabel: "Ver programa",
    primaryPath: "/programas/aprendizagem-em-grupo",
    format: "Blocos guiados por tema, revisão de soluções e trabalho colaborativo.",
    outcomes: [
      "Melhoria da comunicação técnica entre colegas.",
      "Partilha de estratégias de resolução.",
      "Acompanhamento por objetivos de aprendizagem.",
    ],
  },
  {
    slug: "simulacao-empresarial",
    title: "Simulação Empresarial",
    summary: "Desafios orientados a produto, negócio e tomada de decisão com contexto empresarial.",
    description:
      "Experiência prática focada em cenários de operação, métricas, negócio e resposta técnica sob pressão controlada.",
    status: "curadoria",
    statusLabel: "Curadoria",
    track: "inovacao",
    icon: "business-simulation",
    primaryLabel: "Explorar módulo",
    primaryPath: "/programas/simulacao-empresarial",
    format: "Casos de estudo, decisões por sprint e avaliação por cenário.",
    outcomes: [
      "Visão mais clara entre tecnologia, produto e mercado.",
      "Treino de decisão com restrições reais.",
      "Leitura de impacto técnico e operacional.",
    ],
  },
  {
    slug: "hackathons-tematicos",
    title: "Hackathons Temáticos",
    summary: "Ciclos intensivos focados por área, com entrega final, pitch e demonstração prática.",
    description:
      "Formato rápido para reunir equipas multidisciplinares e acelerar soluções em torno de um tema concreto do laboratório.",
    status: "piloto",
    statusLabel: "Piloto",
    track: "inovacao",
    icon: "hackathon",
    featured: true,
    primaryLabel: "Ver programa",
    primaryPath: "/programas/hackathons-tematicos",
    format: "Sprints concentrados com entrega, pitch e feedback técnico.",
    outcomes: [
      "Aceleração de ideias em ambiente prático.",
      "Protótipos com orientação temática.",
      "Maior integração entre criatividade e execução.",
    ],
  },
  {
    slug: "mentorias-profissionais",
    title: "Mentorias com Profissionais",
    summary: "Conexão com profissionais de diferentes áreas para orientação de carreira e projeto.",
    description:
      "Espaço para sessões assistidas por convidados externos e internos, com leitura de portfólio, carreira e maturidade técnica.",
    status: "curadoria",
    statusLabel: "Curadoria",
    track: "aprendizagem",
    icon: "mentoring",
    featured: true,
    primaryLabel: "Ver programa",
    primaryPath: "/programas/mentorias-profissionais",
    format: "Sessões de orientação com profissionais e trilhas por perfil.",
    outcomes: [
      "Maior clareza de percurso profissional.",
      "Feedback direto sobre postura técnica e entrega.",
      "Ligação entre laboratório e mercado.",
    ],
  },
  {
    slug: "desafios-impacto-social",
    title: "Desafios de Impacto Social",
    summary: "Problemas reais com foco em comunidade, acesso, inclusão e utilidade pública.",
    description:
      "Trilha para projetos aplicados a contextos sociais concretos, com foco em relevância, responsabilidade e execução útil.",
    status: "planeado",
    statusLabel: "Planeado",
    track: "impacto",
    icon: "impact",
    primaryLabel: "Explorar módulo",
    primaryPath: "/programas/desafios-impacto-social",
    format: "Problemas aplicados com avaliação por utilidade e viabilidade.",
    outcomes: [
      "Aplicação do conhecimento a desafios reais.",
      "Sensibilidade para impacto e inclusão.",
      "Projetos com valor além da componente técnica.",
    ],
  },
  {
    slug: "prototipagem-rapida",
    title: "Prototipagem Rápida",
    summary: "Ciclos curtos para construir MVPs, validar hipóteses e testar solução em pouco tempo.",
    description:
      "Fluxo orientado a experimentação de produto, validação de hipótese e entrega de versões rápidas com foco em aprendizagem.",
    status: "piloto",
    statusLabel: "Piloto",
    track: "inovacao",
    icon: "prototyping",
    featured: true,
    primaryLabel: "Ver programa",
    primaryPath: "/programas/prototipagem-rapida",
    format: "MVPs rápidos, testes e iteração curta.",
    outcomes: [
      "Capacidade de validar soluções sem sobreconstrução.",
      "Menor tempo entre ideia e teste.",
      "Aprendizagem orientada por feedback.",
    ],
  },
  {
    slug: "workshops-soft-skills",
    title: "Workshops de Soft Skills",
    summary: "Blocos práticos de liderança, comunicação, organização e colaboração em equipa.",
    description:
      "Módulo pensado para reforçar competências de comunicação, liderança e capacidade de apresentação em ambiente profissional.",
    status: "piloto",
    statusLabel: "Piloto",
    track: "aprendizagem",
    icon: "soft-skills",
    primaryLabel: "Explorar módulo",
    primaryPath: "/programas/workshops-soft-skills",
    format: "Oficinas práticas com simulação, feedback e trabalho em equipa.",
    outcomes: [
      "Melhoria da comunicação oral e escrita.",
      "Liderança mais clara em contexto de equipa.",
      "Preparação melhor para apresentação de soluções.",
    ],
  },
  {
    slug: "problemas-interdisciplinares",
    title: "Resolução Interdisciplinar",
    summary: "Competições e exercícios que juntam tecnologia, gestão, comunicação e criatividade.",
    description:
      "Formato de desafio transversal para equipas com perfis diferentes, reforçando raciocínio, negociação e execução integrada.",
    status: "curadoria",
    statusLabel: "Curadoria",
    track: "impacto",
    icon: "interdisciplinary",
    primaryLabel: "Explorar módulo",
    primaryPath: "/programas/problemas-interdisciplinares",
    format: "Desafios em equipa com múltiplas dimensões de avaliação.",
    outcomes: [
      "Colaboração entre perfis diferentes.",
      "Leitura mais ampla do problema.",
      "Maior robustez na solução final.",
    ],
  },
];

export function getLaboratorioModule(slug?: string) {
  return laboratorioModules.find((item) => item.slug === slug);
}

export const featuredLaboratorioModules = laboratorioModules.filter((item) => item.featured);
