export type ChallengeCategory = "Logica" | "Portugol";
export type ChallengeDifficulty = "Baixo" | "Medio" | "Elevado";

export type ChallengeItem = {
  id: string;
  slug: string;
  title: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  points: number;
  rating: number;
  timeLimit: string;
  submissions: number;
  summary: string;
  prompt: string;
  tags: string[];
  featured?: boolean;
};

export type ChallengeRankingEntry = {
  position: number;
  studentNumber: string;
  name: string;
  course: string;
  score: number;
  solved: number;
  streak: string;
  solvedByLevel: {
    baixo: number;
    medio: number;
    elevado: number;
  };
  finishedAt: string;
};

export type ChallengeContestConfig = {
  contestName: string;
  subtitle: string;
  course: string;
  scheduledStartAt: string;
  durationMinutes: number;
  venue: string;
  generalRules: string[];
  levelScoring: Array<{
    difficulty: ChallengeDifficulty;
    pointsLabel: string;
    tone: string;
    icon: string;
  }>;
  onlineParticipants: number;
  waitingMessages: string[];
};

export type ChallengeStudentProgress = {
  studentNumber: string;
  displayName: string;
  score: number;
  solvedCount: number;
  completedSlugs: string[];
  attemptedSlugs: string[];
  currentPosition: number;
  solvedByLevel: {
    baixo: number;
    medio: number;
    elevado: number;
  };
};

export type ChallengeQuestionConfig = {
  slug: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  hints: string[];
  evaluation: string[];
  sampleCases: {
    input: string;
    output: string;
    explanation: string;
  }[];
  allowedLanguages: string[];
  status: "published" | "draft";
};

export type ChallengeSubmissionEntry = {
  id: string;
  challengeSlug: string;
  studentName: string;
  studentNumber: string;
  language: string;
  status: "accepted" | "review" | "rejected";
  score: number;
  runtime: string;
  submittedAt: string;
};

export type ChallengeResultSummary = {
  champion: string;
  championScore: number;
  acceptanceRate: string;
  publishedAt: string;
  totalQuestions: number;
  totalSubmissions: number;
  averageScore: number;
};

export const challengeContestConfig: ChallengeContestConfig = {
  contestName: "Laboratório de Programação Competitiva",
  subtitle: "Concurso técnico para estudantes do 1º ano de Informática, com pseudocódigo, Portugol e validação por score em tempo real.",
  course: "1º Ano de Informática",
  scheduledStartAt: "2026-04-15T18:00:00.000Z",
  durationMinutes: 120,
  venue: "UOR Connect Laboratório",
  generalRules: [
    "Acesso apenas com número de estudante e senha da Secretaria UOR.",
    "Os desafios podem ser resolvidos em qualquer ordem.",
    "O ranking soma score e desempata pelo tempo da última submissão pontuável.",
    "A arena fecha automaticamente quando o tempo oficial termina.",
  ],
  levelScoring: [
    { difficulty: "Baixo", pointsLabel: "90-110 pts", tone: "#22C55E", icon: "</>" },
    { difficulty: "Medio", pointsLabel: "170-190 pts", tone: "#F59E0B", icon: "{}" },
    { difficulty: "Elevado", pointsLabel: "280-310 pts", tone: "#EF4444", icon: "#" },
  ],
  onlineParticipants: 47,
  waitingMessages: [
    "$ auth.session --scope laboratorio",
    "> participante autenticado e elegibilidade confirmada",
    "> a aguardar libertação oficial da janela do concurso",
    "> websocket standby :: leaderboard.sync :: pending",
  ],
};

export const challengeDeadlineIso = new Date(
  new Date(challengeContestConfig.scheduledStartAt).getTime() + challengeContestConfig.durationMinutes * 60 * 1000,
).toISOString();

export const challengeItems: ChallengeItem[] = [
  {
    id: "LOG-101",
    slug: "ponte-das-decisoes",
    title: "Ponte das Decisoes",
    category: "Logica",
    difficulty: "Baixo",
    points: 90,
    rating: 4.6,
    timeLimit: "15 min",
    submissions: 102,
    summary: "Analisa regras simples de entrada e decide qual ação executar sem falhar a ordem dos testes.",
    prompt: "Excelente para validar leitura de condições, encadeamento de if/else e raciocínio sequencial.",
    tags: ["Condicionais", "Fluxo", "Base"],
    featured: true,
  },
  {
    id: "PTG-108",
    slug: "media-da-turma",
    title: "Media da Turma em Portugol",
    category: "Portugol",
    difficulty: "Baixo",
    points: 110,
    rating: 4.7,
    timeLimit: "20 min",
    submissions: 89,
    summary: "Lê notas, calcula a média e informa se o estudante está aprovado, em recurso ou reprovado.",
    prompt: "O foco é entrada, variáveis, operações aritméticas e escrita correta em Portugol.",
    tags: ["Portugol", "Variaveis", "Entrada e Saida"],
  },
  {
    id: "LOG-202",
    slug: "urna-das-hipoteses",
    title: "Urna das Hipoteses",
    category: "Logica",
    difficulty: "Medio",
    points: 170,
    rating: 4.8,
    timeLimit: "30 min",
    submissions: 63,
    summary: "Recebes pistas parciais sobre preferências e tens de deduzir a única ordem válida entre vários candidatos.",
    prompt: "Trabalha dedução, eliminação de cenários impossíveis e organização do raciocínio passo a passo.",
    tags: ["Deducao", "Tabelas", "Analise de Casos"],
    featured: true,
  },
  {
    id: "PTG-214",
    slug: "contador-de-vogais",
    title: "Contador de Vogais em Portugol",
    category: "Portugol",
    difficulty: "Medio",
    points: 190,
    rating: 4.8,
    timeLimit: "35 min",
    submissions: 51,
    summary: "Percorre uma palavra ou frase e devolve quantas vogais de cada tipo aparecem, ignorando maiúsculas.",
    prompt: "Mede domínio de repetição, acumuladores, comparação de caracteres e escrita limpa em Portugol.",
    tags: ["Portugol", "Repeticao", "Strings"],
  },
  {
    id: "LOG-307",
    slug: "grade-de-observacao",
    title: "Grade de Observacao",
    category: "Logica",
    difficulty: "Elevado",
    points: 280,
    rating: 5,
    timeLimit: "50 min",
    submissions: 24,
    summary: "Uma grelha muda de estado a cada ronda. Tens de prever a evolução e decidir em que passo a configuração alvo aparece.",
    prompt: "É um problema de modelação lógica e simulação, pensado para separar quem lê regras de quem realmente as entende.",
    tags: ["Simulacao", "Estados", "Raciocinio Avancado"],
  },
  {
    id: "PTG-322",
    slug: "folha-de-pagamento",
    title: "Folha de Pagamento em Portugol",
    category: "Portugol",
    difficulty: "Elevado",
    points: 310,
    rating: 4.9,
    timeLimit: "55 min",
    submissions: 18,
    summary: "Calcula salário bruto, descontos, imposto progressivo e salário líquido com várias faixas e exceções.",
    prompt: "Combina Portugol, decomposição em etapas, validação de regras e organização de saída formatada.",
    tags: ["Portugol", "Funcoes", "Calculo", "Formatacao"],
  },
];

export const challengeRanking: ChallengeRankingEntry[] = [
  {
    position: 1,
    studentNumber: "20242099",
    name: "Carlos Romao",
    course: "Informática",
    score: 1180,
    solved: 6,
    streak: "+180",
    solvedByLevel: { baixo: 2, medio: 2, elevado: 2 },
    finishedAt: "2026-04-15T19:41:00.000Z",
  },
  {
    position: 2,
    studentNumber: "20240660",
    name: "Clamilsa Boa",
    course: "Informática",
    score: 1125,
    solved: 5,
    streak: "+120",
    solvedByLevel: { baixo: 2, medio: 2, elevado: 1 },
    finishedAt: "2026-04-15T19:47:00.000Z",
  },
  {
    position: 3,
    studentNumber: "20240066",
    name: "Denilson Neves",
    course: "Informática",
    score: 1040,
    solved: 5,
    streak: "+95",
    solvedByLevel: { baixo: 2, medio: 2, elevado: 1 },
    finishedAt: "2026-04-15T19:53:00.000Z",
  },
  {
    position: 4,
    studentNumber: "20251466",
    name: "Hermenegildo Costa",
    course: "Informática",
    score: 920,
    solved: 4,
    streak: "+74",
    solvedByLevel: { baixo: 2, medio: 1, elevado: 1 },
    finishedAt: "2026-04-15T20:02:00.000Z",
  },
  {
    position: 5,
    studentNumber: "20240565",
    name: "Vanira Xamiquelengue",
    course: "Informática",
    score: 865,
    solved: 4,
    streak: "+61",
    solvedByLevel: { baixo: 1, medio: 2, elevado: 1 },
    finishedAt: "2026-04-15T20:06:00.000Z",
  },
];

export const challengeStudentProgress: ChallengeStudentProgress = {
  studentNumber: "20240565",
  displayName: "Vanira Xamiquelengue",
  score: 475,
  solvedCount: 3,
  completedSlugs: ["ponte-das-decisoes", "media-da-turma", "contador-de-vogais"],
  attemptedSlugs: ["urna-das-hipoteses", "folha-de-pagamento"],
  currentPosition: 5,
  solvedByLevel: {
    baixo: 2,
    medio: 1,
    elevado: 0,
  },
};

export const challengeQuestionConfigs: ChallengeQuestionConfig[] = [
  {
    slug: "ponte-das-decisoes",
    statement:
      "Recebes três indicadores inteiros: chuva, transito e energia. Seguindo a prioridade das regras apresentadas, determina se o estudante deve SAIR, ESPERAR ou REMARCAR.",
    inputFormat: "Três inteiros em uma linha representando chuva, transito e energia.",
    outputFormat: "Uma única palavra: SAIR, ESPERAR ou REMARCAR.",
    constraints: ["Cada indicador vale 0 ou 1.", "As regras devem ser avaliadas na ordem definida.", "A primeira regra válida termina o processo."],
    hints: ["Organiza as condições por prioridade.", "Evita repetir a mesma verificação.", "Pensa primeiro na regra crítica."],
    evaluation: ["Ordem correta das condições", "Legibilidade", "Cobertura de cenários base"],
    sampleCases: [
      {
        input: "1 1 0",
        output: "REMARCAR",
        explanation: "A falta de energia é crítica e bloqueia qualquer outra decisão.",
      },
    ],
    allowedLanguages: ["Pseudocodigo", "Portugol", "Fluxograma"],
    status: "published",
  },
  {
    slug: "media-da-turma",
    statement:
      "Lê o nome de um estudante e três notas. Escreve a média final e a situação do estudante segundo as regras do concurso.",
    inputFormat: "Uma linha com o nome e outra linha com três notas reais.",
    outputFormat: "Nome, média com uma casa decimal e situação final.",
    constraints: ["0 <= nota <= 20", "Usar apenas estruturas básicas de Portugol.", "A saída deve respeitar o formato indicado."],
    hints: ["Guarda a média numa variável própria.", "Separa cálculo de decisão final.", "Revisa a formatação da saída."],
    evaluation: ["Corretude aritmética", "Uso coerente de Portugol", "Formatação da resposta"],
    sampleCases: [
      {
        input: "Marta\n12 14 10",
        output: "Marta 12.0 APROVADO",
        explanation: "A média das três notas é 12.0 e cumpre a regra de aprovação.",
      },
    ],
    allowedLanguages: ["Portugol Studio", "Visualg"],
    status: "published",
  },
  {
    slug: "urna-das-hipoteses",
    statement:
      "Quatro estudantes apresentaram hipóteses sobre a posição final de três caixas numeradas. Apenas uma hipótese é totalmente verdadeira. Determina a ordem correta das caixas.",
    inputFormat: "Conjunto fixo de hipóteses descritas no enunciado.",
    outputFormat: "A ordem final das caixas, da esquerda para a direita.",
    constraints: ["Só uma hipótese completa é verdadeira.", "As restantes podem estar totalmente ou parcialmente erradas."],
    hints: ["Lista cenários possíveis.", "Elimina contradições cedo.", "Confirma no fim com todas as hipóteses."],
    evaluation: ["Capacidade de dedução", "Justificação lógica", "Coerência final"],
    sampleCases: [
      {
        input: "Hipoteses do enunciado",
        output: "2 1 3",
        explanation: "É a única ordem que satisfaz a hipótese verdadeira sem validar totalmente as restantes.",
      },
    ],
    allowedLanguages: ["Pseudocodigo", "Portugol", "Fluxograma"],
    status: "published",
  },
  {
    slug: "contador-de-vogais",
    statement:
      "Recebe uma frase e conta quantas vezes cada vogal aparece. A comparação deve ignorar letras maiúsculas e espaços.",
    inputFormat: "Uma linha de texto.",
    outputFormat: "Cinco linhas indicando A, E, I, O e U.",
    constraints: ["A frase pode conter letras, espaços e pontuação.", "A solução deve usar repetição.", "Não usar funções externas de contagem."],
    hints: ["Converte a frase para minúsculas.", "Usa acumuladores separados.", "Percorre a string uma única vez."],
    evaluation: ["Uso de repetição", "Tratamento correto de caracteres", "Clareza do algoritmo"],
    sampleCases: [
      {
        input: "UOR Connect",
        output: "A=0 E=1 I=0 O=2 U=1",
        explanation: "As vogais são contabilizadas sem diferenciar maiúsculas.",
      },
    ],
    allowedLanguages: ["Portugol Studio", "Visualg"],
    status: "published",
  },
  {
    slug: "grade-de-observacao",
    statement:
      "Uma grelha de 0 e 1 muda a cada ronda: células vivas podem desligar e células desligadas podem ativar segundo um conjunto de regras. Descobre em que ronda a configuração alvo aparece.",
    inputFormat: "Dimensão da grelha, estado inicial, regras de transição e estado alvo.",
    outputFormat: "Número da ronda ou -1 caso o alvo não apareça dentro do limite.",
    constraints: ["2 <= n, m <= 30", "Máximo de 100 rondas observadas.", "O estado deve ser atualizado em simultâneo."],
    hints: ["Separa leitura e atualização.", "Compara a grelha inteira a cada ronda.", "Controla bem a cópia do estado seguinte."],
    evaluation: ["Modelação do processo", "Precisão da simulação", "Capacidade de parar no momento certo"],
    sampleCases: [
      {
        input: "3 3 ...",
        output: "4",
        explanation: "A configuração alvo surge exatamente na quarta atualização.",
      },
    ],
    allowedLanguages: ["Pseudocodigo", "Portugol", "Portugol Studio"],
    status: "published",
  },
  {
    slug: "folha-de-pagamento",
    statement:
      "Lê salário base, número de horas extra e valor de subsídio. Depois calcula bruto, descontos e salário líquido segundo as faixas do enunciado.",
    inputFormat: "Três valores numéricos: salarioBase, horasExtra e subsidio.",
    outputFormat: "Bruto, desconto e liquido em linhas separadas.",
    constraints: ["Usar sub-rotinas ou blocos bem separados.", "As faixas de desconto seguem o enunciado.", "A saída deve estar formatada com duas casas decimais."],
    hints: ["Parte o problema em etapas.", "Calcula o bruto antes do desconto.", "Não mistures as regras de imposto."],
    evaluation: ["Estrutura em Portugol", "Corretude das faixas", "Qualidade da decomposição"],
    sampleCases: [
      {
        input: "50000 6 3500",
        output: "BRUTO=57500.00 DESCONTO=5175.00 LIQUIDO=52325.00",
        explanation: "O bruto considera base, horas extra e subsídio; o líquido resulta após o desconto.",
      },
    ],
    allowedLanguages: ["Portugol Studio", "Visualg"],
    status: "draft",
  },
];

export const challengeSubmissions: ChallengeSubmissionEntry[] = [
  {
    id: "SUB-1001",
    challengeSlug: "ponte-das-decisoes",
    studentName: "Carlos Romao",
    studentNumber: "20242099",
    language: "Portugol",
    status: "accepted",
    score: 90,
    runtime: "0.09s",
    submittedAt: "2026-03-24 18:40",
  },
  {
    id: "SUB-1002",
    challengeSlug: "urna-das-hipoteses",
    studentName: "Clamilsa Boa",
    studentNumber: "20240660",
    language: "Pseudocodigo",
    status: "review",
    score: 150,
    runtime: "0.31s",
    submittedAt: "2026-03-24 19:08",
  },
  {
    id: "SUB-1003",
    challengeSlug: "contador-de-vogais",
    studentName: "Denilson Neves",
    studentNumber: "20240066",
    language: "Portugol Studio",
    status: "accepted",
    score: 190,
    runtime: "0.15s",
    submittedAt: "2026-03-24 19:22",
  },
  {
    id: "SUB-1004",
    challengeSlug: "folha-de-pagamento",
    studentName: "Vanira Xamiquelengue",
    studentNumber: "20240565",
    language: "Visualg",
    status: "rejected",
    score: 60,
    runtime: "0.84s",
    submittedAt: "2026-03-24 20:03",
  },
];

export const challengeResultsSummary: ChallengeResultSummary = {
  champion: "Carlos Romao",
  championScore: 1180,
  acceptanceRate: "71%",
  publishedAt: "2026-03-25 09:00",
  totalQuestions: challengeItems.length,
  totalSubmissions: challengeSubmissions.length,
  averageScore: 122,
};
