import { Documento } from './documento';
import { DocumentoInvalidoError } from '../erros/erro-de-dado';

describe('Documento', () => {
  it('aceita CPF válido, com ou sem máscara', () => {
    expect(Documento.criar('52998224725').valor).toBe('52998224725');
    expect(Documento.criar('529.982.247-25').valor).toBe('52998224725');
  });

  it('aceita CNPJ válido, com ou sem máscara', () => {
    expect(Documento.criar('11222333000181').valor).toBe('11222333000181');
    expect(Documento.criar('11.222.333/0001-81').valor).toBe('11222333000181');
  });

  it('rejeita CPF com dígito verificador incorreto', () => {
    expect(() => Documento.criar('52998224700')).toThrow(DocumentoInvalidoError);
  });

  it('rejeita sequência de dígitos repetidos', () => {
    expect(() => Documento.criar('11111111111')).toThrow(DocumentoInvalidoError);
  });

  it('rejeita string vazia ou tamanho incompatível', () => {
    expect(() => Documento.criar('')).toThrow(DocumentoInvalidoError);
    expect(() => Documento.criar('123')).toThrow(DocumentoInvalidoError);
  });
});
