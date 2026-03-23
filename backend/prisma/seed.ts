import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const defaultCourses = [
    {
      name: "Eng. Informática",
      description: "Formação prática orientada a software, arquitetura de sistemas e produtos digitais.",
      preview: "Curso gerido por parceiro tecnológico.",
      communityUrl: "https://chat.whatsapp.com/example-informatica",
      companyName: "Parceiro Tech AO",
      companyCategory: "Tecnologia",
      isPaid: false,
      priceLabel: "Gratuito",
      accentColor: "#2563eb",
      accentColorSecondary: "#38bdf8",
      courseColor: "#2563eb",
      sortOrder: 0,
      isPublished: true,
    },
    {
      name: "Eng. Telecomunicações",
      description: "Infraestrutura, redes modernas e operações digitais aplicadas ao mercado.",
      preview: "Curso gerido por parceiro de telecom.",
      communityUrl: "https://chat.whatsapp.com/example-telecom",
      companyName: "Parceiro Connect AO",
      companyCategory: "Telecomunicações",
      isPaid: true,
      priceLabel: "Pago",
      accentColor: "#f97316",
      accentColorSecondary: "#fb923c",
      courseColor: "#d97706",
      sortOrder: 1,
      isPublished: true,
    },
    {
      name: "Eng. Eletrotécnica",
      description: "Aplicações de energia, automação e integração técnica com foco em execução.",
      preview: "Curso orientado a operações e sistemas.",
      communityUrl: "https://chat.whatsapp.com/example-eletrotecnica",
      companyName: "Parceiro Power AO",
      companyCategory: "Energia e automação",
      isPaid: false,
      priceLabel: "Gratuito",
      accentColor: "#16a34a",
      accentColorSecondary: "#4ade80",
      courseColor: "#15803d",
      sortOrder: 2,
      isPublished: true,
    },
    {
      name: "Ciências Computação",
      description: "Base computacional com foco em algoritmos, dados e construção de soluções digitais.",
      preview: "Curso orientado à base científica da computação.",
      communityUrl: "https://chat.whatsapp.com/example-computacao",
      companyName: "Parceiro Compute AO",
      companyCategory: "Educação tecnológica",
      isPaid: true,
      priceLabel: "Pago",
      accentColor: "#9333ea",
      accentColorSecondary: "#c084fc",
      courseColor: "#7c3aed",
      sortOrder: 3,
      isPublished: true,
    }
  ];

  await prisma.speaker.createMany({
    data: [
      {
        name: "Ana Silva",
        bio: "Especialista em 5G e redes móveis.",
        specialty: "Telecomunicações",
        talk: "5G e o futuro das cidades conectadas",
        day: "Dia 1 — 10:00",
        linkedin: "https://linkedin.com/in/ana-silva"
      },
      {
        name: "Carlos Mendes",
        bio: "Fundador de startup de IoT industrial.",
        specialty: "IoT",
        talk: "Indústria 4.0 aplicada",
        day: "Dia 2 — 11:30",
        linkedin: "https://linkedin.com/in/carlos-mendes"
      }
    ]
  });

  await prisma.agendaItem.createMany({
    data: [
      {
        day: "DAY1",
        date: new Date("2026-05-17T08:30:00.000Z"),
        startTime: "08:30",
        endTime: "09:30",
        title: "Credenciamento e Abertura",
        local: "Auditório Principal",
        speaker: "Comissão Organizadora",
        description: "Abertura oficial do evento",
        type: "CEREMONY",
        theme: "Geral"
      },
      {
        day: "DAY1",
        date: new Date("2026-05-17T10:00:00.000Z"),
        startTime: "10:00",
        endTime: "11:00",
        title: "Painel 5G",
        local: "Auditório Principal",
        speaker: "Ana Silva",
        description: "Painel sobre o futuro das redes 5G",
        type: "PANEL",
        theme: "Telecomunicações"
      }
    ]
  });

  for (const course of defaultCourses) {
    await prisma.course.upsert({
      where: { name: course.name },
      update: course,
      create: course
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
