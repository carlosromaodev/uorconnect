const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

async function testFlow() {
  const prisma = new PrismaClient();
  const member = await prisma.juryMember.findFirst({ where: { isActive: true } });
  if (!member) {
    console.log("No active jury member");
    return;
  }
  
  // 1. Generate Token
  const env = { JWT_SECRET: "dev-secret-change-me" };
  const payload = { sub: member.id, juryPhone: member.phone, role: "jury" };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "12h" });
  
  console.log("Generated Token:", token);
  
  // 2. Test /interactions/me
  try {
    const res = await fetch("http://localhost:3000/api/interactions/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    console.log("/interactions/me status:", res.status);
    console.log(await res.json());
  } catch (e) {
    console.error(e);
  }

  // 3. Test /auth/security
  try {
    const res = await fetch("http://localhost:3000/api/auth/security", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    console.log("/auth/security status:", res.status);
    console.log(await res.json());
  } catch (e) {
    console.error(e);
  }

  await prisma.$disconnect();
}

testFlow();
