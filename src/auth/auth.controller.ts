import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodError } from 'zod';
import { AuthService } from './auth.service';
import { loginSchema } from './auth.dto';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autentica e devolve um token JWT (Bearer) para as demais rotas' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'senha'],
      properties: { email: { type: 'string', example: 'admin@hub.local' }, senha: { type: 'string' } },
    },
  })
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
