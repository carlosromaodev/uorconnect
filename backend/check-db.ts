import { prisma } from "./src/shared/prisma";

async function check() {
  try {
    const count = await prisma.homeSocialConfig.count();
    console.log(`Total records in HomeSocialConfig: ${count}`);
    
    const config = await prisma.homeSocialConfig.findFirst();
    console.log("First config:", JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
