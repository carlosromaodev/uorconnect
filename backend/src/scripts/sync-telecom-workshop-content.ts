import { prisma } from "../shared/prisma";
import type { PrismaClient } from "@prisma/client";

type AgendaSeedItem = {
  day: "DAY1" | "DAY2";
  date: Date;
  startTime: string;
  endTime: string;
  title: string;
  local: string;
  speaker: string;
  description: string;
  type: "PANEL" | "WORKSHOP" | "PRESENTATION" | "CEREMONY" | "BREAK";
  theme: string;
};

type SpeakerSeedItem = {
  name: string;
  bio: string;
  specialty: string;
  talk: string;
  day: string;
  linkedin: string;
  avatarUrl?: string | null;
};

const eventDateDay1 = new Date("2026-05-18T00:00:00.000Z");
const eventDateDay2 = new Date("2026-05-19T00:00:00.000Z");

const officialSpeakers: SpeakerSeedItem[] = [
  {
    name: "Sandra Catrio",
    specialty: "Negócios digitais e empreendedorismo",
    talk: "Transformação de projetos académicos em oportunidades reais",
    day: "Dia 2 — 14:00",
    linkedin: "#",
    bio: "Licenciada em Ciências da Computação, consultora em negócios digitais e fundadora da KukulaLink e do projeto Angola Conecta Elas. Atua na promoção da empregabilidade juvenil, inclusão de mulheres na tecnologia e mentoria de iniciativas inovadoras.",
  },
  {
    name: "Carlos Caetano",
    specialty: "Finanças, gestão e capital de risco",
    talk: "Transformação de projetos académicos em oportunidades reais",
    day: "Dia 2 — 14:00",
    linkedin: "#",
    bio: "Jovem empreendedor e gestor formado em Administração de Empresas com foco em Finanças. Tem experiência em capital de risco, gestão de património familiar, carteira digital e desenvolvimento de negócios.",
  },
  {
    name: "Mário Zerqueira",
    specialty: "Finanças corporativas e mercados emergentes",
    talk: "Transformação de projetos académicos em oportunidades reais",
    day: "Dia 2 — 14:00",
    linkedin: "#",
    bio: "Profissional de finanças corporativas com atuação em mercados emergentes. Participou em projetos nos setores de turismo, fintech, logística, alimentação e serviços, dedicando-se ao fortalecimento do ecossistema empreendedor angolano.",
  },
  {
    name: "Paulo Silva",
    specialty: "Engenharia informática, software e investigação",
    talk: "Transformação de projetos académicos em oportunidades reais",
    day: "Dia 2 — 14:00",
    linkedin: "#",
    bio: "Docente do Departamento desde 2009, doutorando em Engenharia Informática e mestre em Ensino da Matemática e Arquitetura de Software. Participa em projetos científicos e iniciativas ligadas a TIC, software e capacitação tecnológica.",
  },
  {
    name: "Florips Assis Quixito",
    specialty: "Marca pessoal e posicionamento profissional",
    talk: "Dia 18 Marca pessoal: como se tornar referência antes de terminar o curso",
    day: "Dia 1 — 14:00",
    linkedin: "#",
    bio: "Convidado para a sessão de marca pessoal dedicada ao posicionamento de estudantes antes da conclusão do curso.",
  },
  {
    name: "Manuel Muenho",
    specialty: "Marca pessoal e carreira",
    talk: "Dia 18 Marca pessoal: como se tornar referência antes de terminar o curso",
    day: "Dia 1 — 14:00",
    linkedin: "#",
    bio: "Convidado para a conversa sobre reputação profissional, referências de carreira e preparação para o mercado de trabalho.",
  },
  {
    name: "Rabin Kiketu",
    specialty: "Marca pessoal e carreira",
    talk: "Dia 18 Marca pessoal: como se tornar referência antes de terminar o curso",
    day: "Dia 1 — 14:00",
    linkedin: "#",
    bio: "Convidado para a sessão dedicada a marca pessoal, networking e posicionamento de estudantes no mercado.",
  },
];

const officialAgenda: AgendaSeedItem[] = [
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "08:30",
    endTime: "09:00",
    title: "Chegada e acomodação dos participantes e convidados",
    local: "Receção / Protocolo",
    speaker: "Protocolo",
    description: "Receção inicial dos participantes e convidados do Workshop alusivo ao Dia das Telecomunicações.",
    type: "CEREMONY",
    theme: "Geral",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "09:00",
    endTime: "09:20",
    title: "Credenciamento",
    local: "Receção / Protocolo",
    speaker: "Protocolo",
    description: "Confirmação de presença, orientação de participantes e apoio inicial aos convidados.",
    type: "CEREMONY",
    theme: "Geral",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "09:20",
    endTime: "09:30",
    title: "Momento cultural",
    local: "Auditório Principal",
    speaker: "Coral Vozes da UÓR - Álvaro Nsunda",
    description: "Abertura cultural do programa.",
    type: "BREAK",
    theme: "Cultura",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "09:30",
    endTime: "09:40",
    title: "Abertura e apresentação dos convidados",
    local: "Auditório Principal",
    speaker: "Magnífico Reitor da Universidade Óscar Ribas, Prof. Doutor André Pedro Neto",
    description: "Abertura oficial e apresentação institucional dos convidados.",
    type: "CEREMONY",
    theme: "Geral",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "09:40",
    endTime: "09:50",
    title: "Palavras de circunstância",
    local: "Auditório Principal",
    speaker: "Mário Augusto da Silva Oliveira",
    description: "Intervenção do Ministro das Telecomunicações, Tecnologias de Informação e Comunicação.",
    type: "CEREMONY",
    theme: "Telecomunicações",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "09:50",
    endTime: "10:05",
    title: "Discurso motivacional",
    local: "Auditório Principal",
    speaker: "Prof. Doutor Diosnorides Carbonell Torreblanca",
    description: "Intervenção do Decano da Faculdade de Ciência e Tecnologias.",
    type: "CEREMONY",
    theme: "Carreira",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "10:05",
    endTime: "10:20",
    title: "Apresentação do tema e objetivo do workshop",
    local: "Auditório Principal",
    speaker: "M.Sc. Madalena Janota Justo",
    description: "Contextualização do Workshop alusivo ao Dia das Telecomunicações e da Sociedade de Informação.",
    type: "PRESENTATION",
    theme: "Telecomunicações",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "10:20",
    endTime: "10:25",
    title: "Apresentação dos projetos",
    local: "Auditório Principal",
    speaker: "NEIC - Hilquias Prody",
    description: "Apresentação geral dos projetos participantes.",
    type: "PRESENTATION",
    theme: "Projetos",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "10:25",
    endTime: "10:30",
    title: "Momento cultural",
    local: "Auditório Principal",
    speaker: "Coral Vozes da UÓR - Álvaro Nsunda",
    description: "Intervenção cultural antes da visita aos stands.",
    type: "BREAK",
    theme: "Cultura",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "10:30",
    endTime: "12:00",
    title: "Visita aos stands",
    local: "Zona de Exposição",
    speaker: "Organização e expositores",
    description: "Percurso pelos stands para conhecer projetos, equipas e demonstrações.",
    type: "PRESENTATION",
    theme: "Projetos",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "14:00",
    endTime: "16:00",
    title: "Dia 18 Marca pessoal: como se tornar referência antes de terminar o curso",
    local: "Auditório Principal",
    speaker: "Florips Assis Quixito, Manuel Muenho e Rabin Kiketu",
    description: "Sessão sobre marca pessoal, reputação, referências profissionais e preparação para o mercado antes da conclusão do curso.",
    type: "PANEL",
    theme: "Carreira",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "16:00",
    endTime: "16:05",
    title: "Momento cultural, mágica e foto de família",
    local: "Auditório Principal",
    speaker: "Coral Vozes da UÓR - Álvaro Nsunda",
    description: "Momento cultural e registo de fotografia de família.",
    type: "BREAK",
    theme: "Cultura",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "16:05",
    endTime: "16:20",
    title: "Encerramento do primeiro dia",
    local: "Auditório Principal",
    speaker: "M.Sc. Madalena Janota Justo",
    description: "Encerramento do primeiro dia do programa oficial.",
    type: "CEREMONY",
    theme: "Geral",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "13:30",
    endTime: "13:40",
    title: "Chegada e acomodação dos participantes e convidados",
    local: "Receção / Protocolo",
    speaker: "Protocolo",
    description: "Receção e acomodação dos participantes e convidados do segundo dia.",
    type: "CEREMONY",
    theme: "Geral",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "13:40",
    endTime: "13:45",
    title: "Momento cultural",
    local: "Auditório Principal",
    speaker: "Coral Vozes da UÓR - Álvaro Nsunda",
    description: "Abertura cultural do segundo dia.",
    type: "BREAK",
    theme: "Cultura",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "13:45",
    endTime: "13:50",
    title: "Palavras de circunstância",
    local: "Auditório Principal",
    speaker: "Prof. Doutor Eugénio de Carvalho",
    description: "Intervenção do Vice-Reitor para os Assuntos Científicos e Pós-Graduação.",
    type: "CEREMONY",
    theme: "Geral",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "13:50",
    endTime: "13:55",
    title: "Apresentação das empresas parceiras",
    local: "Auditório Principal",
    speaker: "Prof. Doutor Diosnorides Carbonell Torreblanca",
    description: "Apresentação das empresas parceiras pelo Decano da Faculdade de Ciência e Tecnologias.",
    type: "PRESENTATION",
    theme: "Projetos",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "13:55",
    endTime: "14:00",
    title: "Abertura e apresentação dos convidados",
    local: "Auditório Principal",
    speaker: "M.Sc. Madalena Janota Justo",
    description: "Abertura institucional e apresentação dos convidados do segundo dia.",
    type: "CEREMONY",
    theme: "Geral",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "14:00",
    endTime: "15:30",
    title: "Transformação de projetos académicos em oportunidades reais",
    local: "Auditório Principal",
    speaker: "Sandra Catrio, Carlos Caetano, Mário Zerqueira e Paulo Silva",
    description: "Painel sobre como transformar projetos académicos em oportunidades reais, da sala de aula ao mercado.",
    type: "PANEL",
    theme: "Projetos",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "15:30",
    endTime: "15:35",
    title: "Momento cultural",
    local: "Auditório Principal",
    speaker: "Coral Vozes da UÓR - Álvaro Nsunda",
    description: "Intervenção cultural antes do desafio académico.",
    type: "BREAK",
    theme: "Cultura",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "15:35",
    endTime: "16:40",
    title: "Desafio académico",
    local: "Auditório Principal",
    speaker: "Estudantes finalistas da FCT - DEI-IC / UÓR",
    description: "Demonstração de áreas de atuação, perfis de saída e oportunidades nas áreas de Programação, Redes, Eletrónica e Telecomunicações.",
    type: "PRESENTATION",
    theme: "Concurso",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "16:40",
    endTime: "17:00",
    title: "Premiação",
    local: "Auditório Principal",
    speaker: "M.Sc. Madalena Janota Justo",
    description: "Momento de premiação e reconhecimento dos participantes.",
    type: "CEREMONY",
    theme: "Concurso",
  },
  {
    day: "DAY2",
    date: eventDateDay2,
    startTime: "17:00",
    endTime: "17:20",
    title: "Encerramento e discurso final",
    local: "Auditório Principal",
    speaker: "Prof. Doutor Diosnorides Carbonell Torreblanca",
    description: "Encerramento oficial do workshop.",
    type: "CEREMONY",
    theme: "Geral",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "08:00",
    endTime: "12:00",
    title: "Treinamento: Eletrónica e Arduino",
    local: "Lab. Eletrónica",
    speaker: "Márcio Faria",
    description: "Treinamento de curta duração para estudantes inscritos, com foco em eletrónica e Arduino.",
    type: "WORKSHOP",
    theme: "Formação",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "08:00",
    endTime: "12:00",
    title: "Treinamento: Informática Avançada",
    local: "Lab. 2",
    speaker: "Eduardo Muima",
    description: "Treinamento prático de informática avançada para estudantes participantes.",
    type: "WORKSHOP",
    theme: "Formação",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "08:00",
    endTime: "12:00",
    title: "Treinamento: Programação",
    local: "Lab. 3",
    speaker: "Biachel António / Moisés",
    description: "Treinamento prático de programação.",
    type: "WORKSHOP",
    theme: "Formação",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "08:00",
    endTime: "12:00",
    title: "Treinamento: Cyber Security",
    local: "Lab. Eletrónica",
    speaker: "New Teach",
    description: "Treinamento de introdução e prática em segurança cibernética.",
    type: "WORKSHOP",
    theme: "Formação",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "13:00",
    endTime: "17:00",
    title: "Treinamento: Fibra Óptica",
    local: "Lab. Eletrónica e Pátio da Instituição",
    speaker: "Euclides Agapito",
    description: "Treinamento sobre fibra óptica com componente prática em laboratório e pátio.",
    type: "WORKSHOP",
    theme: "Formação",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "17:00",
    endTime: "21:00",
    title: "Treinamento: Inteligência Artificial",
    local: "Lab. 3",
    speaker: "Betuel Cambuta",
    description: "Treinamento de curta duração em inteligência artificial.",
    type: "WORKSHOP",
    theme: "Formação",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "13:00",
    endTime: "17:00",
    title: "Treinamento: Filmagem e Edição de Vídeo",
    local: "Lab. 2",
    speaker: "Augusto Boano",
    description: "Treinamento de filmagem e edição de vídeo.",
    type: "WORKSHOP",
    theme: "Formação",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "08:00",
    endTime: "12:00",
    title: "Treinamento: Reparação e Manutenção de Computadores",
    local: "Lab. 1",
    speaker: "Josefa Garcia",
    description: "Treinamento prático em reparação e manutenção de computadores.",
    type: "WORKSHOP",
    theme: "Formação",
  },
  {
    day: "DAY1",
    date: eventDateDay1,
    startTime: "10:00",
    endTime: "14:00",
    title: "Treinamento: Redes de Telecomunicações",
    local: "Lab. Eletrónica e Pátio da Instituição",
    speaker: "João Graça",
    description: "Treinamento de redes de telecomunicações com demonstrações práticas.",
    type: "WORKSHOP",
    theme: "Formação",
  },
];

const demoSpeakerNames = ["Ana Silva", "Carlos Mendes"];
const demoAgendaTitles = [
  "Credenciamento e Abertura",
  "Painel 5G",
  "Da Sala de aula até ao mercado",
  "Da Sala de aula até ao mercado ",
];

async function upsertSpeaker(client: PrismaClient, speaker: SpeakerSeedItem) {
  const existing = await client.speaker.findFirst({ where: { name: speaker.name } });
  if (existing) {
    return client.speaker.update({ where: { id: existing.id }, data: speaker });
  }
  return client.speaker.create({ data: speaker });
}

async function upsertAgendaItem(client: PrismaClient, item: AgendaSeedItem) {
  const existing = await client.agendaItem.findFirst({
    where: {
      day: item.day,
      startTime: item.startTime,
      title: item.title,
    },
  });

  if (existing) {
    return client.agendaItem.update({ where: { id: existing.id }, data: item });
  }

  return client.agendaItem.create({ data: item });
}

export async function syncTelecomWorkshopContent(client: PrismaClient = prisma) {
  await client.speaker.deleteMany({ where: { name: { in: demoSpeakerNames } } });
  await client.agendaItem.deleteMany({ where: { title: { in: demoAgendaTitles } } });
  await client.liveContentConfig.upsert({
    where: { key: "default" },
    update: {
      mode: "AGENDA",
      title: null,
      local: null,
      speaker: null,
      description: null,
      type: null,
      theme: null,
      day: null,
      date: null,
      startTime: null,
      endTime: null,
    },
    create: { key: "default", mode: "AGENDA" },
  });

  for (const speaker of officialSpeakers) {
    await upsertSpeaker(client, speaker);
  }

  for (const item of officialAgenda) {
    await upsertAgendaItem(client, item);
  }

  return {
    speakers: officialSpeakers.length,
    agendaItems: officialAgenda.length,
  };
}

if (require.main === module) {
  let exitCode = 0;

  syncTelecomWorkshopContent()
    .then((result) => {
      console.log(`Conteúdo oficial sincronizado: ${result.speakers} palestrantes, ${result.agendaItems} itens de agenda.`);
    })
    .catch((error) => {
      console.error(error);
      exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
      process.exit(exitCode);
    });
}
