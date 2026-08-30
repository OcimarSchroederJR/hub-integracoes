import { Controller, Get } from '@nestjs/common';
import { SobreposicaoService } from '../../integracao/sobreposicao.service';

@Controller()
export class DevedoresController {
  constructor(private readonly sobreposicaoService: SobreposicaoService) {}

  @Get('devedores/sobreposicoes')
  listarSobreposicoes() {
    return this.sobreposicaoService.listar();
  }
}
