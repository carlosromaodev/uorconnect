import { PrismaClient } from "@prisma/client";
import { syncTelecomWorkshopContent } from "../src/scripts/sync-telecom-workshop-content";

const prisma = new PrismaClient();

async function main() {
  const defaultCourses = [
    {
      name: "Eng. Informática",
      description: "Formação prática orientada a software, arquitetura de sistemas e produtos digitais.",
      preview: "Curso gerido por parceiro tecnológico.",
      communityUrl: null,
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
      communityUrl: null,
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
      communityUrl: null,
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
      communityUrl: null,
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

  await syncTelecomWorkshopContent(prisma);

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
