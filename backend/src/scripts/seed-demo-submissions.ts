import { prisma } from "../shared/prisma";

const demoLeaderEmail = "demo.leader@uor.edu";

const demoProjects = [
  { name: "SmartCampus", type: "PROJECT" as const, area: "IoT", desc: "Monitoramento inteligente do campus com sensores IoT." },
  { name: "TeleHealth Angola", type: "PROJECT" as const, area: "Telecom", desc: "Telemedicina para zonas rurais usando redes de baixa latência." },
  { name: "SecureNet", type: "PROJECT" as const, area: "Segurança", desc: "Detecção de intrusões em redes corporativas." },
  { name: "EduConnect", type: "PROJECT" as const, area: "Web", desc: "Plataforma de aprendizagem colaborativa." },
  { name: "GreenGrid", type: "PROJECT" as const, area: "IA", desc: "Optimização de consumo energético com IA." },
  { name: "Angola Fresh", type: "BUSINESS" as const, area: "Alimentação", stage: "Funcionando", desc: "Entrega de produtos frescos com logística inteligente." },
  { name: "TechRepair Kit", type: "PRODUCT" as const, area: "Hardware", category: "Hardware", productType: "Físico", desc: "Kit portátil de reparação de equipamentos electrónicos." },
  { name: "QuickPay AO", type: "BUSINESS" as const, area: "Tecnologia", stage: "Funcionando", desc: "Solução de pagamentos móveis para mercados informais." }
];

async function main() {
  const leader = await prisma.user.upsert({
    where: { email: demoLeaderEmail },
    update: {},
    create: { email: demoLeaderEmail }
  });

  for (const [index, project] of demoProjects.entries()) {
    const referenceCode = `DEMO-${index + 1}`;
    await prisma.submission.upsert({
      where: { referenceCode },
      update: {
        type: project.type,
        name: project.name,
        description: project.desc,
        area: project.area,
        course: project.type === "PROJECT" ? "DEMO" : null,
        stage: project.stage ?? null,
        category: project.category ?? null,
        productType: project.productType ?? null,
        teamSize: 1,
        members: "Equipe demo",
        needs: "Demo needs",
        leaderEmail: demoLeaderEmail
      },
      create: {
        referenceCode,
        type: project.type,
        status: "APPROVED",
        name: project.name,
        description: project.desc,
        area: project.area,
        course: project.type === "PROJECT" ? "DEMO" : null,
        stage: project.stage ?? null,
        category: project.category ?? null,
        productType: project.productType ?? null,
        teamSize: 1,
        members: "Equipe demo",
        needs: "Demo needs",
        paymentProof: "demo",
        repoUrl: null,
        websiteUrl: null,
        agreeRules: true,
        leaderEmail: demoLeaderEmail,
        leaderId: leader.id
      }
    });
  }

  console.log("Demo submissions seeded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
