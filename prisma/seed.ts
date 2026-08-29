import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.parceiro.upsert({
    where: { codigo: 'alfa' },
    update: {},
    create: { codigo: 'alfa', nome: 'Parceiro Alfa' },
  });
  await prisma.parceiro.upsert({
    where: { codigo: 'beta' },
    update: {},
    create: { codigo: 'beta', nome: 'Parceiro Beta' },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
