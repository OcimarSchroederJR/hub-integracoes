export class ErroDeDado extends Error {}

export class DocumentoInvalidoError extends ErroDeDado {
  constructor(valorBruto: string) {
    super(`Documento inválido: "${valorBruto}"`);
  }
}

export class DataInvalidaError extends ErroDeDado {
  constructor(valorBruto: string) {
    super(`Data inválida: "${valorBruto}"`);
  }
}

export class ValorMonetarioInvalidoError extends ErroDeDado {
  constructor(valorBruto: string) {
    super(`Valor monetário inválido: "${valorBruto}"`);
  }
}

export class CampoObrigatorioAusenteError extends ErroDeDado {
  constructor(campo: string) {
    super(`Campo obrigatório ausente: "${campo}"`);
  }
}
