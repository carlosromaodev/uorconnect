const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
