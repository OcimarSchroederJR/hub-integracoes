import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../infra/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, senha: string): Promise<{ accessToken: string }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    const senhaValida = usuario ? await bcrypt.compare(senha, usuario.senhaHash) : false;

    if (!usuario || !senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const accessToken = await this.jwt.signAsync({ sub: usuario.id, email: usuario.email });
    return { accessToken };
  }
}
