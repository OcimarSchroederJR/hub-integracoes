import { DataInvalidaError } from '../erros/erro-de-dado';

function meiaNoiteUtc(ano: number, mes: number, dia: number): Date {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const coerente =
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  if (!coerente) {
    throw new DataInvalidaError(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
  }
  return data;
}

export function deIso(texto: string): Date {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto ?? '');
  if (!casamento) {
    throw new DataInvalidaError(texto);
  }
  const [, anoStr, mesStr, diaStr] = casamento;
  return meiaNoiteUtc(Number(anoStr), Number(mesStr), Number(diaStr));
}

export function deBrasileiro(texto: string): Date {
  const casamento = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((texto ?? '').trim());
  if (!casamento) {
    throw new DataInvalidaError(texto);
  }
  const [, diaStr, mesStr, anoStr] = casamento;
  return meiaNoiteUtc(Number(anoStr), Number(mesStr), Number(diaStr));
}
