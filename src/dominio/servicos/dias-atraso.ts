const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function calcularDiasAtraso(dataVencimento: Date): number {
  const diferencaMs = Date.now() - dataVencimento.getTime();
  return Math.max(0, Math.floor(diferencaMs / UM_DIA_MS));
}
