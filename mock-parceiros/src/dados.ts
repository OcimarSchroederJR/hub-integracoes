import { obterCreditoReal } from './dados-reais';

function calcularDigitosCpf(base9: string): string {
  const calcular = (tamanho: number): number => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(base9[i]) * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const nove = base9;
  const d1 = calcular(9);
  const dez = nove + d1;
  const calcularD2 = () => {
    let soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += Number(dez[i]) * (11 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d2 = calcularD2();
  return `${d1}${d2}`;
}

function gerarCpfValido(semente: number): string {
  const base9 = String(semente).padStart(9, '0').slice(-9);
  return base9 + calcularDigitosCpf(base9);
}

function gerarCpfComDigitoInvalido(semente: number): string {
  const cpf = gerarCpfValido(semente);
  const ultimoDigito = Number(cpf[cpf.length - 1]);
  return cpf.slice(0, -1) + ((ultimoDigito + 1) % 10);
}

const NOMES = [
  'Maria Souza',
  'Joao Lima',
  'Ana Pereira',
  'Carlos Santos',
  'Fernanda Costa',
  'Paulo Oliveira',
  'Juliana Rocha',
  'Marcos Almeida',
];

const STATUS = ['OVERDUE', 'IN_NEGOTIATION', 'SETTLED', 'CANCELED'];

export interface ContratoAlfa {
  contractNumber: string;
  originalAmountCents: number;
  currentAmountCents: number;
  dueDate: string;
  status: string;
}

export interface ClienteAlfa {
  externalId: string;
  taxId: string;
  customerName: string;
  contracts: ContratoAlfa[];
  contacts: { phones: string[]; emails: string[] };
  updatedAt: string;
}

function gerarDataVencimento(indice: number): string {
  const base = new Date(Date.UTC(2024, 0, 1));
  base.setUTCDate(base.getUTCDate() + (indice % 365));
  return base.toISOString().slice(0, 10);
}

export function gerarCarteira(quantidade: number, comFalhas: boolean): ClienteAlfa[] {
  const clientes: ClienteAlfa[] = [];
  for (let i = 0; i < quantidade; i++) {
    const nome = NOMES[i % NOMES.length];
    const original = obterCreditoReal(i).valorFaturaCentavos;

    const documentoInvalido = comFalhas && i % 20 === 3;
    const contratosVazios = comFalhas && i % 20 === 11;

    clientes.push({
      externalId: `ALF-${String(1_000_000 + i)}`,
      taxId: documentoInvalido
        ? gerarCpfComDigitoInvalido(100_000_000 + i * 7)
        : gerarCpfValido(100_000_000 + i * 7),
      customerName: `${nome} ${i}`,
      contracts: contratosVazios
        ? []
        : [
            {
              contractNumber: `CT-${String(90_000 + i)}`,
              originalAmountCents: original,
              currentAmountCents: Math.round(original * 1.15),
              dueDate: gerarDataVencimento(i),
              status: STATUS[i % STATUS.length],
            },
          ],
      contacts: {
        phones: [`5581${String(900_000_000 + i).slice(0, 9)}`],
        emails: [`cliente${i}@exemplo.com`],
      },
      updatedAt: new Date().toISOString(),
    });
  }
  return clientes;
}
