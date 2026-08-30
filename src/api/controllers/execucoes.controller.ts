import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SituacaoRegistro } from '@prisma/client';
import { ExecucaoService } from '../../integracao/execucao.service';
import { ReprocessamentoService } from '../../integracao/reprocessamento.service';

@ApiTags('execucoes')
@ApiBearerAuth()
@Controller()
export class ExecucoesController {
  constructor(
    private readonly execucaoService: ExecucaoService,
    private readonly reprocessamentoService: ReprocessamentoService,
  ) {}

  @Post('integracoes/:parceiro/execucoes')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Dispara uma nova execução de coleta para um parceiro' })
  @ApiParam({ name: 'parceiro', example: 'alfa', description: '"alfa" ou "beta"' })
  dispararExecucao(@Param('parceiro') parceiro: string) {
    return this.execucaoService.dispararExecucao(parceiro);
  }

  @Get('execucoes')
  @ApiOperation({ summary: 'Lista as execuções mais recentes, opcionalmente filtrando por parceiro' })
  @ApiQuery({ name: 'parceiro', required: false, example: 'alfa' })
  @ApiQuery({ name: 'limite', required: false, example: 50 })
  listarExecucoes(@Query('parceiro') parceiro?: string, @Query('limite') limite?: string) {
    return this.execucaoService.listarExecucoes(parceiro, limite ? Number(limite) : undefined);
  }

  @Get('execucoes/:id')
  @ApiOperation({ summary: 'Consulta o status de uma execução' })
  consultarExecucao(@Param('id') id: string) {
    return this.execucaoService.consultarExecucao(id);
  }

  @Get('execucoes/:id/registros')
  @ApiOperation({ summary: 'Lista os registros de uma execução, opcionalmente filtrando por situação' })
  @ApiQuery({ name: 'situacao', required: false, enum: ['PENDENTE', 'PERSISTIDO', 'REJEITADO', 'FALHA'] })
  listarRegistros(@Param('id') id: string, @Query('situacao') situacao?: SituacaoRegistro) {
    return this.execucaoService.listarRegistros(id, situacao);
  }

  @Post('execucoes/:id/reprocessar')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reprocessa todos os registros em falha de uma execução' })
  reprocessarExecucao(@Param('id') id: string) {
    return this.reprocessamentoService.reprocessarExecucao(id);
  }

  @Post('registros/:id/reprocessar')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reprocessa um registro específico' })
  reprocessarRegistro(@Param('id') id: string) {
    return this.reprocessamentoService.reprocessarRegistro(id);
  }

  @Get('registros/:id/eventos')
  @ApiOperation({ summary: 'Lista a trilha de eventos de um registro, em ordem cronológica' })
  listarEventosDoRegistro(@Param('id') id: string) {
    return this.execucaoService.listarEventosDoRegistro(id);
  }
}
