import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.robot.upsert({
    where: { externalId: 'CR-001' },
    update: { name: 'Cleaning Robot CR-001' },
    create: { name: 'Cleaning Robot CR-001', externalId: 'CR-001' },
  });
  await prisma.robot.upsert({
    where: { externalId: 'CR-002' },
    update: { name: 'Cleaning Robot CR-002' },
    create: { name: 'Cleaning Robot CR-002', externalId: 'CR-002' },
  });
  await prisma.robot.upsert({
    where: { externalId: 'CR-003' },
    update: { name: 'Cleaning Robot CR-003' },
    create: { name: 'Cleaning Robot CR-003', externalId: 'CR-003' },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
