import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extrairToken(request);
    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    try {
      request.usuario = await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
    return true;
  }

  private extrairToken(request: Request): string | undefined {
    const [tipo, token] = request.header('authorization')?.split(' ') ?? [];
    return tipo === 'Bearer' ? token : undefined;
  }
}
