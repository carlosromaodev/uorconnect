const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  const env = { JWT_SECRET: "dev-secret-change-me" };
  const member = await prisma.juryMember.findFirst();
  if (!member) {
    console.log("No jury member found");
    return;
  }
  console.log("Found jury member:", member.name);
  
  // Generate a code
  const code = "123456";
  const codeHash = crypto.createHash('sha256').update(`${env.JWT_SECRET}:${member.id}:${code}`).digest('hex');
  
  await prisma.juryAccessCode.create({
    data: {
      juryMemberId: member.id,
      codeHash: codeHash,
      codeLast4: code.slice(-4),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      createdByStudentNumber: "system",
      deliveryStatus: "DELIVERED"
    }
  });
  
  console.log(`Created code for ${member.phone}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
