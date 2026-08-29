import { z } from 'zod';
import { Logger } from '@nestjs/common';
import { RegistroCanonico, SituacaoDivida } from '../../dominio/entidades/registro-canonico';
import { Documento } from '../../dominio/valores/documento';
import { Dinheiro } from '../../dominio/valores/dinheiro';
import { deIso } from '../../dominio/valores/data';
import { paraE164 } from '../../dominio/valores/telefone';
import { CampoObrigatorioAusenteError } from '../../dominio/erros/erro-de-dado';
import { contratoAlfaSchema } from './alfa.dto';

const itemAlfaAchatadoSchema = z.object({
  externalId: z.string(),
  taxId: z.string(),
  customerName: z.string(),
  contract: contratoAlfaSchema.nullable(),
  phones: z.array(z.string()),
  emails: z.array(z.string()),
});

const TRADUCAO_SITUACAO: Record<string, SituacaoDivida> = {
  OVERDUE: 'EM_ATRASO',
  IN_NEGOTIATION: 'EM_NEGOCIACAO',
  SETTLED: 'QUITADA',
  CANCELED: 'CANCELADA',
};

const SITUACAO_PARA_ALFA: Record<SituacaoDivida, string> = {
  EM_ATRASO: 'OVERDUE',
  EM_NEGOCIACAO: 'IN_NEGOTIATION',
  QUITADA: 'SETTLED',
  CANCELADA: 'CANCELED',
};

const logger = new Logger('AlfaMapper');

function traduzirSituacao(bruta: string): SituacaoDivida {
  const traduzida = TRADUCAO_SITUACAO[bruta];
  if (!traduzida) {
    logger.warn(`Situação desconhecida recebida do Parceiro Alfa: "${bruta}", assumindo EM_ATRASO`);
    return 'EM_ATRASO';
  }
  return traduzida;
}

export function traduzirSituacaoParaAlfa(situacao: SituacaoDivida): string {
  return SITUACAO_PARA_ALFA[situacao];
}

export function normalizarAlfa(itemBruto: unknown): RegistroCanonico {
  const item = itemAlfaAchatadoSchema.parse(itemBruto);

  const documento = Documento.criar(item.taxId);
  const nome = item.customerName.trim();
  if (nome === '') {
    throw new CampoObrigatorioAusenteError('customerName');
  }
  if (item.contract === null) {
    throw new CampoObrigatorioAusenteError('contracts');
  }

  return {
    identificadorExterno: item.externalId,
    documento: documento.valor,
    nome,
    telefones: item.phones.map(paraE164).filter((tel): tel is string => tel !== null),
    emails: item.emails.map((email) => email.trim().toLowerCase()),
    numeroContrato: item.contract.contractNumber,
    valorOriginal: Dinheiro.deCentavos(item.contract.originalAmountCents).emCentavos,
    valorAtualizado: Dinheiro.deCentavos(item.contract.currentAmountCents).emCentavos,
    dataVencimento: deIso(item.contract.dueDate),
    situacao: traduzirSituacao(item.contract.status),
  };
}
