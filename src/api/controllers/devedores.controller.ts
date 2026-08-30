import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SobreposicaoService } from '../../integracao/sobreposicao.service';

@ApiTags('devedores')
@ApiBearerAuth()
@Controller()
export class DevedoresController {
  constructor(private readonly sobreposicaoService: SobreposicaoService) {}

  @Get('devedores/sobreposicoes')
  @ApiOperation({ summary: 'Lista sobreposições de dívidas detectadas entre parceiros diferentes' })
  listarSobreposicoes() {
    return this.sobreposicaoService.listar();
  }
}
