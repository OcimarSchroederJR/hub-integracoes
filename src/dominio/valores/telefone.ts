export function paraE164(bruto: string): string | null {
  const digitos = (bruto ?? '').replace(/\D/g, '');

  const comDdiJaPresente = digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13);
  const semDdi = digitos.length === 10 || digitos.length === 11;

  if (comDdiJaPresente) {
    return `+${digitos}`;
  }
  if (semDdi) {
    return `+55${digitos}`;
  }
  return null;
}
