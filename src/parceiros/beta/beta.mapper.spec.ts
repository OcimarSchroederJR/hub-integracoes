import { normalizarBeta } from './beta.mapper';
import { normalizarAlfa } from '../alfa/alfa.mapper';
import { LinhaBeta } from './beta.dto';
import { ErroDeDado } from '../../dominio/erros/erro-de-dado';

function linhaValida(sobrescritas: Partial<LinhaBeta> = {}): LinhaBeta {
  return {
    CPF_CNPJ: '529.982.247-25',
    NOME_CLIENTE: 'MARIA SOUZA',
    NUM_CONTRATO: 'CT-99182',
    VLR_ORIGINAL: '1.580,00',
    VLR_ATUALIZADO: '2.134,50',
    DT_VENCIMENTO: '15/03/2024',
    TELEFONE: '(81) 99880-5965',
    SITUACAO: 'EM ATRASO',
    ...sobrescritas,
  };
}

describe('normalizarBeta', () => {
  it('mapeia uma linha válida completa para o modelo canônico', () => {
    const canonico = normalizarBeta(linhaValida());

    expect(canonico).toEqual({
      identificadorExterno: '52998224725CT-99182',
      documento: '52998224725',
      nome: 'MARIA SOUZA',
      telefones: ['+5581998805965'],
      emails: [],
      numeroContrato: 'CT-99182',
      valorOriginal: 158000,
      valorAtualizado: 213450,
      dataVencimento: new Date('2024-03-15T00:00:00.000Z'),
      situacao: 'EM_ATRASO',
    });
  });

  it('aceita CPF sem máscara', () => {
    expect(normalizarBeta(linhaValida({ CPF_CNPJ: '52998224725' })).documento).toBe('52998224725');
  });

  it('rejeita linha com campo obrigatório ausente', () => {
    expect(() => normalizarBeta(linhaValida({ NOME_CLIENTE: '' }))).toThrow(ErroDeDado);
    expect(() => normalizarBeta(linhaValida({ NUM_CONTRATO: '' }))).toThrow(ErroDeDado);
  });

  it('rejeita valor não numérico', () => {
    expect(() => normalizarBeta(linhaValida({ VLR_ATUALIZADO: 'N/D' }))).toThrow(ErroDeDado);
  });

  it('rejeita data sintaticamente válida mas inexistente, no limite do formato', () => {
    expect(() => normalizarBeta(linhaValida({ DT_VENCIMENTO: '31/02/2024' }))).toThrow(ErroDeDado);
  });

  it('traduz situação desconhecida para EM_ATRASO', () => {
    expect(normalizarBeta(linhaValida({ SITUACAO: 'ALGO_NOVO' })).situacao).toBe('EM_ATRASO');
  });
});

describe('equivalência entre Alfa e Beta', () => {
  it('o mesmo devedor enviado pelos dois parceiros produz canônicos equivalentes', () => {
    const viaAlfa = normalizarAlfa({
      externalId: 'ALF-0000123',
      taxId: '52998224725',
      customerName: 'Maria Souza',
      contract: {
        contractNumber: 'CT-99182',
        originalAmountCents: 158000,
        currentAmountCents: 213450,
        dueDate: '2024-03-15',
        status: 'OVERDUE',
      },
      phones: ['5581998805965'],
      emails: ['maria@exemplo.com'],
    });

    const viaBeta = normalizarBeta(linhaValida());

    expect(viaBeta.documento).toBe(viaAlfa.documento);
    expect(viaBeta.valorOriginal).toBe(viaAlfa.valorOriginal);
    expect(viaBeta.valorAtualizado).toBe(viaAlfa.valorAtualizado);
    expect(viaBeta.dataVencimento).toEqual(viaAlfa.dataVencimento);
  });
});
