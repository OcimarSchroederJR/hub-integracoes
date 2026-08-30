import { obterCreditoReal } from './dados-reais';

function calcularDigitosCpf(base9: string): string {
  const calcularD1 = () => {
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(base9[i]) * (10 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calcularD1();
  const dez = base9 + d1;
  const calcularD2 = () => {
    let soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(dez[i]) * (11 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return `${d1}${calcularD2()}`;
}

function gerarCpf(semente: number): string {
  const base9 = String(semente).padStart(9, '0').slice(-9);
  return base9 + calcularDigitosCpf(base9);
}

function formatarCpfComMascara(cpf: string): string {
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
}

export function formatarValorBrasileiro(centavos: number): string {
  const inteiros = Math.floor(centavos / 100);
  const centavosParte = String(centavos % 100).padStart(2, '0');
  const inteirosComPontos = String(inteiros).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteirosComPontos},${centavosParte}`;
}

export function formatarDataBrasileira(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

const NOMES = [
  'MARIA SOUZA',
  'JOÃO LIMA',
  'ANTÔNIO PEREIRA',
  'FRANCISCA COSTA',
  'JOSÉ OLIVEIRA',
  'LUCIANA ROCHA',
  'SEBASTIÃO ALMEIDA',
  'CONCEIÇÃO SANTOS',
];

const SITUACOES = ['EM ATRASO', 'EM NEGOCIACAO', 'QUITADO', 'CANCELADO'];

const CABECALHO =
  'CPF_CNPJ;NOME_CLIENTE;NUM_CONTRATO;VLR_ORIGINAL;VLR_ATUALIZADO;DT_VENCIMENTO;TELEFONE;SITUACAO';

function gerarDataVencimento(indice: number): Date {
  const base = new Date(Date.UTC(2024, 0, 1));
  base.setUTCDate(base.getUTCDate() + (indice % 365));
  return base;
}

export function gerarCarteiraBetaCsv(quantidade: number, comFalhas: boolean): string {
  const linhas: string[] = [CABECALHO];
  let ultimaLinhaValida = '';

  for (let i = 0; i < quantidade; i++) {
    // i === 0 reaproveita de propósito a mesma semente do cliente 0 do Alfa
    // (ver dados.ts) e o mesmo registro do dataset real (índice 0), pra
    // existir uma sobreposição real e detectável entre os dois parceiros
    // nos dados gerados por padrão -- ver SobreposicaoService.
    const cpf = i === 0 ? gerarCpf(100_000_000) : gerarCpf(200_000_000 + i * 11);
    const cpfFormatado = i % 2 === 0 ? formatarCpfComMascara(cpf) : cpf;
    const nome = NOMES[i % NOMES.length];
    // Offset de 1500 pra não sortear exatamente os mesmos registros do
    // dataset que o Alfa usa nos mesmos índices (i === 0 é a exceção
    // proposital, ver acima).
    const original = obterCreditoReal(i === 0 ? 0 : i + 1500).valorFaturaCentavos;
    const atualizado = Math.round(original * 1.13);
    const numeroContrato = `CT-B${String(70_000 + i)}`;
    const telefone = `81${String(988_000_000 + i).slice(0, 9)}`;
    const situacao = SITUACOES[i % SITUACOES.length];

    const campoNomeVazio = comFalhas && i % 25 === 5;
    const dataInvalida = comFalhas && i % 25 === 12;
    const valorNaoNumerico = comFalhas && i % 25 === 19;

    const dataVencimento = dataInvalida ? '31/02/2024' : formatarDataBrasileira(gerarDataVencimento(i));
    const valorAtualizado = valorNaoNumerico ? 'N/D' : formatarValorBrasileiro(atualizado);

    const linha = [
      cpfFormatado,
      campoNomeVazio ? '' : nome,
      numeroContrato,
      formatarValorBrasileiro(original),
      valorAtualizado,
      dataVencimento,
      telefone,
      situacao,
    ].join(';');

    linhas.push(linha);
    if (!campoNomeVazio && !dataInvalida && !valorNaoNumerico) {
      ultimaLinhaValida = linha;
    }
  }

  if (comFalhas && ultimaLinhaValida) {
    linhas.push(ultimaLinhaValida);
  }

  return linhas.join('\r\n') + '\r\n';
}
