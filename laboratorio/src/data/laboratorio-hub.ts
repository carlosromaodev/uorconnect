export type LaboratorioCourseClusterSlug =
  | "tecnologia"
  | "gestao"
  | "artes-comunicacao"
  | "educacao-social"
  | "saude"
  | "juridico-servicos";

export type LaboratorioAgendaStatus = "aberto" | "curadoria" | "reservado" | "encerrado";
export type LaboratorioResourceKind = "kit" | "guia" | "mentoria" | "espaco";

export interface LaboratorioCourseCluster {
  slug: LaboratorioCourseClusterSlug;
  title: string;
  summary: string;
  courses: string[];
}

export interface LaboratorioAgendaItem {
  id: string;
  title: string;
  moduleSlug: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  format: string;
  audience: string;
  summary: string;
  status: LaboratorioAgendaStatus;
  featured?: boolean;
  ctaLabel: string;
  ctaPath: string;
}

export interface LaboratorioOperationalStep {
  id: string;
  title: string;
  owner: string;
  description: string;
  outputs: string[];
}

export interface LaboratorioSpace {
  id: string;
  title: string;
  description: string;
  uses: string[];
  modules: string[];
}

export interface LaboratorioResourceCollection {
  id: string;
  title: string;
  description: string;
  audience: string;
  kind: LaboratorioResourceKind;
  items: string[];
  ctaLabel: string;
  ctaPath: string;
}

export interface LaboratorioMentorProfile {
  id: string;
  name: string;
  area: string;
  focus: string;
  availability: string;
}

export const laboratorioCourseClusters: LaboratorioCourseCluster[] = [
  {
    slug: "tecnologia",
    title: "Tecnologia e sistemas",
    summary: "Cursos com base técnica, lógica, desenvolvimento, infraestrutura e automação.",
    courses: ["Informática", "Engenharia de software", "Telecomunicações"],
  },
  {
    slug: "gestao",
    title: "Gestão e negócio",
    summary: "Perfis focados em operação, produto, negócio, análise e tomada de decisão.",
    courses: ["Gestão", "Contabilidade", "Administração"],
  },
  {
    slug: "artes-comunicacao",
    title: "Arte, media e comunicação",
    summary: "Áreas criativas ligadas a design, comunicação, experiência e narrativa.",
    courses: ["Design", "Comunicação", "Multimédia"],
  },
  {
    slug: "educacao-social",
    title: "Educação e intervenção social",
    summary: "Perfis orientados a facilitação, comunidade, formação e ação cívica.",
    courses: ["Educação", "Serviço social", "Pedagogia"],
  },
  {
    slug: "saude",
    title: "Saúde e cuidado",
    summary: "Áreas com foco em processos assistenciais, comunidade, segurança e serviço.",
    courses: ["Enfermagem", "Saúde pública", "Análises clínicas"],
  },
  {
    slug: "juridico-servicos",
    title: "Jurídico e serviços",
    summary: "Perfis que reforçam conformidade, mediação, gestão documental e atendimento.",
    courses: ["Direito", "Gestão pública", "Serviços administrativos"],
  },
];

export const defaultLaboratorioAgenda: LaboratorioAgendaItem[] = [
  {
    id: "agenda-arena-01",
    title: "Janela principal da Arena",
    moduleSlug: "arena",
    date: "2026-04-12",
    startTime: "09:00",
    endTime: "12:00",
    location: "Sala Arena + acesso online",
    format: "Sessão cronometrada",
    audience: "Estudantes de tecnologia e interessados em lógica",
    summary: "Sessão oficial com sala de espera, catálogo publicado e ranking operacional.",
    status: "aberto",
    featured: true,
    ctaLabel: "Ir para a Arena",
    ctaPath: "/arena",
  },
  {
    id: "agenda-grupo-01",
    title: "Círculo de aprendizagem por projeto",
    moduleSlug: "aprendizagem-em-grupo",
    date: "2026-04-14",
    startTime: "14:00",
    endTime: "16:00",
    location: "Atelier colaborativo",
    format: "Sessão orientada",
    audience: "Turmas mistas com foco em revisão guiada",
    summary: "Bloco com estudo em pares, checkpoints de solução e facilitação por monitor.",
    status: "aberto",
    featured: true,
    ctaLabel: "Ver programa",
    ctaPath: "/programas/aprendizagem-em-grupo",
  },
  {
    id: "agenda-mentoria-01",
    title: "Clínica de mentoria e portfólio",
    moduleSlug: "mentorias-profissionais",
    date: "2026-04-16",
    startTime: "10:30",
    endTime: "12:30",
    location: "Sala de mentoria",
    format: "Sessão por vagas",
    audience: "Estudantes em preparação para estágio ou apresentação",
    summary: "Leitura de percurso, portfólio, apresentação e próximos passos por área.",
    status: "curadoria",
    ctaLabel: "Explorar módulo",
    ctaPath: "/programas/mentorias-profissionais",
  },
  {
    id: "agenda-softskills-01",
    title: "Workshop de comunicação e pitch",
    moduleSlug: "workshops-soft-skills",
    date: "2026-04-18",
    startTime: "15:00",
    endTime: "17:00",
    location: "Auditório laboratório",
    format: "Workshop prático",
    audience: "Todos os cursos",
    summary: "Treino de mensagem, postura e articulação para apresentar ideias e resultados.",
    status: "aberto",
    ctaLabel: "Ver programa",
    ctaPath: "/programas/workshops-soft-skills",
  },
  {
    id: "agenda-hackathon-01",
    title: "Sprint temático de prototipagem",
    moduleSlug: "hackathons-tematicos",
    date: "2026-04-24",
    startTime: "09:30",
    endTime: "18:00",
    location: "Bloco inovação",
    format: "Hackathon temático",
    audience: "Equipas multidisciplinares",
    summary: "Dia intensivo com briefing, construção, pitch e feedback final.",
    status: "reservado",
    ctaLabel: "Explorar módulo",
    ctaPath: "/programas/hackathons-tematicos",
  },
];

export const laboratorioOperationalSteps: LaboratorioOperationalStep[] = [
  {
    id: "descoberta",
    title: "Descoberta e enquadramento",
    owner: "Home + programas",
    description: "O estudante identifica o tipo de experiência que melhor se adequa ao seu curso, ao seu momento e ao objetivo do semestre.",
    outputs: ["Módulo escolhido", "Agenda relevante", "Critérios de entrada claros"],
  },
  {
    id: "triagem",
    title: "Triagem e entrada",
    owner: "Login + agenda + admin",
    description: "O acesso pode ser aberto, curado, por seleção ou competitivo. A triagem respeita vagas, perfis e regras de cada módulo.",
    outputs: ["Inscrição confirmada", "Equipa ou vaga atribuída", "Encaminhamento para a jornada certa"],
  },
  {
    id: "execucao",
    title: "Execução da experiência",
    owner: "Módulo operacional",
    description: "Cada módulo tem o seu formato: sessão guiada, sprint, mentoria, simulação ou prova técnica. A Arena é apenas um desses formatos.",
    outputs: ["Entrega", "Participação", "Registos de progresso"],
  },
  {
    id: "feedback",
    title: "Feedback e leitura",
    owner: "Facilitação + júri + mentores",
    description: "O Laboratório organiza observações, banca, mentoria e leitura de resultado de acordo com cada experiência.",
    outputs: ["Feedback estruturado", "Próximo passo", "Indicadores por módulo"],
  },
  {
    id: "continuidade",
    title: "Continuidade e progressão",
    owner: "Agenda + recursos + admin",
    description: "Depois da experiência, o estudante é encaminhado para novos módulos, recursos ou ciclos de aprofundamento.",
    outputs: ["Percurso contínuo", "Reentrada noutro módulo", "Histórico de participação"],
  },
];

export const laboratorioSpaces: LaboratorioSpace[] = [
  {
    id: "arena",
    title: "Arena de lógica e pseudocódigo",
    description: "Espaço de competição técnica com sala de espera, catálogo, editor e ranking.",
    uses: ["Provas", "Treino técnico", "Sessões cronometradas"],
    modules: ["arena"],
  },
  {
    id: "atelier",
    title: "Atelier colaborativo",
    description: "Espaço para grupos de estudo, revisões partilhadas, mentoria curta e oficinas de soft skills.",
    uses: ["Aprendizagem em grupo", "Workshops", "Mentorias"],
    modules: ["aprendizagem-em-grupo", "workshops-soft-skills", "mentorias-profissionais"],
  },
  {
    id: "hub-inovacao",
    title: "Hub de inovação aplicada",
    description: "Ambiente para sprints, prototipagem, simulações e hackathons com equipas de cursos diferentes.",
    uses: ["Hackathons", "Simulação empresarial", "Protótipos"],
    modules: ["hackathons-tematicos", "simulacao-empresarial", "prototipagem-rapida"],
  },
  {
    id: "impacto",
    title: "Mesa de impacto e integração",
    description: "Frente de trabalho para desafios sociais, articulação comunitária e colaboração interdisciplinar.",
    uses: ["Impacto social", "Desafios interdisciplinares", "Apresentação de solução"],
    modules: ["desafios-impacto-social", "problemas-interdisciplinares"],
  },
];

export const laboratorioResourceCollections: LaboratorioResourceCollection[] = [
  {
    id: "kit-entrada",
    title: "Kit de entrada no Laboratório",
    description: "Resumo do funcionamento, formatos de participação e linguagem comum entre estudantes de cursos diferentes.",
    audience: "Novos participantes",
    kind: "guia",
    items: ["Mapa dos módulos", "Como escolher a experiência certa", "Regras de participação e conduta"],
    ctaLabel: "Ver funcionamento",
    ctaPath: "/funcionamento",
  },
  {
    id: "kit-mentoria",
    title: "Trilha de mentoria e carreira",
    description: "Recursos para preparar sessão de mentoria, apresentação de portfólio e encaminhamento de carreira.",
    audience: "Estudantes em preparação para estágio ou apresentação",
    kind: "mentoria",
    items: ["Checklist de portfólio", "Preparação para reunião", "Objetivos por sessão"],
    ctaLabel: "Explorar mentorias",
    ctaPath: "/programas/mentorias-profissionais",
  },
  {
    id: "kit-equipa",
    title: "Kit para equipas e projetos",
    description: "Materiais de coordenação para grupos, sprints, hackathons e desafios interdisciplinares.",
    audience: "Equipas mistas e coordenadores de grupo",
    kind: "kit",
    items: ["Quadro de papéis", "Rotina de checkpoints", "Modelo de entrega final"],
    ctaLabel: "Ver programas",
    ctaPath: "/programas",
  },
  {
    id: "espacos",
    title: "Mapa de espaços do Laboratório",
    description: "Leitura rápida dos ambientes operacionais e do que acontece em cada um deles.",
    audience: "Todos os cursos",
    kind: "espaco",
    items: ["Arena", "Atelier colaborativo", "Hub de inovação", "Mesa de impacto"],
    ctaLabel: "Ver recursos",
    ctaPath: "/recursos",
  },
];

export const laboratorioMentorRoster: LaboratorioMentorProfile[] = [
  {
    id: "mentor-1",
    name: "Corpo técnico interno",
    area: "Tecnologia e lógica",
    focus: "Arena, estrutura de desafios e revisão de soluções.",
    availability: "Sessões programadas por janela",
  },
  {
    id: "mentor-2",
    name: "Rede de convidados profissionais",
    area: "Produto, negócio e carreira",
    focus: "Mentoria, simulação empresarial, pitch e posicionamento.",
    availability: "Clínicas quinzenais e blocos especiais",
  },
  {
    id: "mentor-3",
    name: "Facilitadores de aprendizagem",
    area: "Comunicação, grupo e progressão",
    focus: "Aprendizagem em grupo, soft skills e mediação de equipas.",
    availability: "Ciclos semanais e workshops",
  },
];

export const laboratorioAgendaStatusLabel: Record<LaboratorioAgendaStatus, string> = {
  aberto: "Aberto",
  curadoria: "Curadoria",
  reservado: "Reservado",
  encerrado: "Encerrado",
};
