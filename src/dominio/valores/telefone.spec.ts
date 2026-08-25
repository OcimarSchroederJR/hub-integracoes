import { paraE164 } from './telefone';

describe('paraE164', () => {
  it('assume Brasil quando não há código de país', () => {
    expect(paraE164('81998805965')).toBe('+5581998805965');
    expect(paraE164('(81) 99880-5965')).toBe('+5581998805965');
  });

  it('mantém quando o código do país já está presente', () => {
    expect(paraE164('5581998805965')).toBe('+5581998805965');
  });

  it('aceita telefone fixo, sem o nono dígito', () => {
    expect(paraE164('81 3222-1010')).toBe('+558132221010');
  });

  it('descarta em silêncio um telefone com tamanho incompatível', () => {
    expect(paraE164('123')).toBeNull();
    expect(paraE164('')).toBeNull();
  });
});
