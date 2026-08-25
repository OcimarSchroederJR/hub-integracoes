import { DocumentoInvalidoError } from '../erros/erro-de-dado';

function calcularDigitosCpf(digitos: string): string {
  const calcular = (tamanho: number): number => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(digitos[i]) * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calcular(9);
  const d2 = calcular(10);
  return `${d1}${d2}`;
}

function calcularDigitosCnpj(digitos: string): string {
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calcular = (base: string, pesos: number[]): number => {
    const soma = pesos.reduce((acc, peso, i) => acc + peso * Number(base[i]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calcular(digitos.slice(0, 12), pesos1);
  const d2 = calcular(digitos.slice(0, 12) + d1, pesos2);
  return `${d1}${d2}`;
}

function todosDigitosIguais(digitos: string): boolean {
  return digitos.split('').every((d) => d === digitos[0]);
}

function cpfValido(digitos: string): boolean {
  if (digitos.length !== 11 || todosDigitosIguais(digitos)) return false;
  return digitos.slice(9) === calcularDigitosCpf(digitos);
}

function cnpjValido(digitos: string): boolean {
  if (digitos.length !== 14 || todosDigitosIguais(digitos)) return false;
  return digitos.slice(12) === calcularDigitosCnpj(digitos);
}

export class Documento {
  private constructor(private readonly digitos: string) {}

  static criar(bruto: string): Documento {
    const digitos = (bruto ?? '').replace(/\D/g, '');
    if (!cpfValido(digitos) && !cnpjValido(digitos)) {
      throw new DocumentoInvalidoError(bruto);
    }
    return new Documento(digitos);
  }

  get valor(): string {
    return this.digitos;
  }
}
