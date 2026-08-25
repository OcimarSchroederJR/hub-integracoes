export function calcularChaveIdempotencia(
  parceiroCodigo: string,
  identificadorExterno: string,
  numeroContrato: string,
): string {
  return `${parceiroCodigo}:${identificadorExterno}:${numeroContrato}`;
}
