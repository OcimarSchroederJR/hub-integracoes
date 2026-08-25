import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { SituacaoRegistro } from '@prisma/client';
import { ExecucaoService } from '../../integracao/execucao.service';

@Controller()
export class ExecucoesController {
  constructor(private readonly execucaoService: ExecucaoService) {}

  @Post('integracoes/:parceiro/execucoes')
  @HttpCode(HttpStatus.ACCEPTED)
  dispararExecucao(@Param('parceiro') parceiro: string) {
    return this.execucaoService.dispararExecucao(parceiro);
  }

  @Get('execucoes/:id')
  consultarExecucao(@Param('id') id: string) {
    return this.execucaoService.consultarExecucao(id);
  }

  @Get('execucoes/:id/registros')
  listarRegistros(@Param('id') id: string, @Query('situacao') situacao?: SituacaoRegistro) {
    return this.execucaoService.listarRegistros(id, situacao);
  }
}
