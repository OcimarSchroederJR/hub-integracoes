import { Logger } from '@nestjs/common';
import { RegistroCanonico, SituacaoDivida } from '../../dominio/entidades/registro-canonico';
import { Documento } from '../../dominio/valores/documento';
import { Dinheiro } from '../../dominio/valores/dinheiro';
import { deBrasileiro } from '../../dominio/valores/data';
import { paraE164 } from '../../dominio/valores/telefone';
import { CampoObrigatorioAusenteError } from '../../dominio/erros/erro-de-dado';
import { linhaBetaSchema } from './beta.dto';

const TRADUCAO_SITUACAO: Record<string, SituacaoDivida> = {
  'EM ATRASO': 'EM_ATRASO',
  'EM NEGOCIACAO': 'EM_NEGOCIACAO',
  QUITADO: 'QUITADA',
  CANCELADO: 'CANCELADA',
};

const SITUACAO_PARA_BETA: Record<SituacaoDivida, string> = {
  EM_ATRASO: 'EM ATRASO',
  EM_NEGOCIACAO: 'EM NEGOCIACAO',
  QUITADA: 'QUITADO',
  CANCELADA: 'CANCELADO',
};

const logger = new Logger('BetaMapper');

function traduzirSituacao(bruta: string): SituacaoDivida {
  const traduzida = TRADUCAO_SITUACAO[bruta.trim().toUpperCase()];
  if (!traduzida) {
    logger.warn(`Situação desconhecida recebida do Parceiro Beta: "${bruta}", assumindo EM_ATRASO`);
    return 'EM_ATRASO';
  }
  return traduzida;
}

export function traduzirSituacaoParaBeta(situacao: SituacaoDivida): string {
  return SITUACAO_PARA_BETA[situacao];
}

export function normalizarBeta(itemBruto: unknown): RegistroCanonico {
  const linha = linhaBetaSchema.parse(itemBruto);

  const documento = Documento.criar(linha.CPF_CNPJ);

  const nome = linha.NOME_CLIENTE.trim();
  if (nome === '') {
    throw new CampoObrigatorioAusenteError('NOME_CLIENTE');
  }

  const numeroContrato = linha.NUM_CONTRATO.trim();
  if (numeroContrato === '') {
    throw new CampoObrigatorioAusenteError('NUM_CONTRATO');
  }

  const telefone = paraE164(linha.TELEFONE);

  return {
    identificadorExterno: `${documento.valor}${numeroContrato}`,
    documento: documento.valor,
    nome,
    telefones: telefone ? [telefone] : [],
    emails: [],
    numeroContrato,
    valorOriginal: Dinheiro.deTextoBrasileiro(linha.VLR_ORIGINAL).emCentavos,
    valorAtualizado: Dinheiro.deTextoBrasileiro(linha.VLR_ATUALIZADO).emCentavos,
    dataVencimento: deBrasileiro(linha.DT_VENCIMENTO),
    situacao: traduzirSituacao(linha.SITUACAO),
  };
}
