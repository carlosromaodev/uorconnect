const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const members = await prisma.juryMember.findMany();
  console.log(members);
}
main().catch(console.error).finally(() => prisma.$disconnect());
