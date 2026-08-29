import { normalizarAlfa } from './alfa.mapper';
import { ItemAlfaAchatado } from './alfa.dto';
import { ErroDeDado } from '../../dominio/erros/erro-de-dado';

function itemValido(sobrescritas: Partial<ItemAlfaAchatado> = {}): ItemAlfaAchatado {
  return {
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
    ...sobrescritas,
  };
}

describe('normalizarAlfa', () => {
  it('mapeia um item válido completo para o modelo canônico', () => {
    const canonico = normalizarAlfa(itemValido());

    expect(canonico).toEqual({
      identificadorExterno: 'ALF-0000123',
      documento: '52998224725',
      nome: 'Maria Souza',
      telefones: ['+5581998805965'],
      emails: ['maria@exemplo.com'],
      numeroContrato: 'CT-99182',
      valorOriginal: 158000,
      valorAtualizado: 213450,
      dataVencimento: new Date('2024-03-15T00:00:00.000Z'),
      situacao: 'EM_ATRASO',
    });
  });

  it('rejeita item com taxId inválido', () => {
    expect(() => normalizarAlfa(itemValido({ taxId: '00000000000' }))).toThrow(ErroDeDado);
  });

  it('rejeita item com nome vazio', () => {
    expect(() => normalizarAlfa(itemValido({ customerName: '   ' }))).toThrow(ErroDeDado);
  });

  it('rejeita item com data de vencimento no limite do formato, inexistente no calendário', () => {
    const item = itemValido();
    item.contract!.dueDate = '2024-02-31';
    expect(() => normalizarAlfa(item)).toThrow(ErroDeDado);
  });

  it('descarta telefone inválido sem rejeitar o registro', () => {
    const canonico = normalizarAlfa(itemValido({ phones: ['123'] }));
    expect(canonico.telefones).toEqual([]);
  });

  it('traduz situação desconhecida para EM_ATRASO', () => {
    const item = itemValido();
    item.contract!.status = 'ALGO_NOVO';
    expect(normalizarAlfa(item).situacao).toBe('EM_ATRASO');
  });

  it('rejeita cliente sem nenhum contrato', () => {
    expect(() => normalizarAlfa(itemValido({ contract: null }))).toThrow(ErroDeDado);
  });
});
