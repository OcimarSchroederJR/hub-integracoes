import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ZodError } from 'zod';
import { AuthService } from './auth.service';
import { loginSchema } from './auth.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: unknown) {
    const resultado = loginSchema.safeParse(body);
    if (!resultado.success) {
      throw new BadRequestException(formatarErro(resultado.error));
    }
    return this.authService.login(resultado.data.email, resultado.data.senha);
  }
}

function formatarErro(erro: ZodError): string {
  return erro.issues.map((problema) => `${problema.path.join('.')}: ${problema.message}`).join('; ');
}
