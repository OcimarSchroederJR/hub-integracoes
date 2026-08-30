import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminSenha = process.env.ADMIN_SENHA;
  if (adminEmail && adminSenha) {
    const senhaHash = await bcrypt.hash(adminSenha, 10);
    await prisma.usuario.upsert({
      where: { email: adminEmail },
      update: { senhaHash },
      create: { email: adminEmail, senhaHash },
    });
  } else {
    console.warn('ADMIN_EMAIL/ADMIN_SENHA não definidos — usuário admin não foi criado.');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
