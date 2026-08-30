import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Valores monetários reais (não os nomes/CPFs, que continuam sintéticos),
 * amostrados do dataset público "Default of Credit Card Clients" (UCI
 * Machine Learning Repository, Yeh & Lien, 2009 -- 30000 clientes de
 * cartão de crédito em Taiwan, anonimizado). Usado aqui só pela
 * distribuição de valores de fatura, não por qualquer relação com o
 * domínio de cobrança em si.
 */
export interface RegistroCreditoReal {
  valorFaturaCentavos: number;
  valorPagoCentavos: number;
  inadimplente: boolean;
}

function carregarCsv(): RegistroCreditoReal[] {
  const caminho = join(__dirname, '..', 'data', 'creditos-reais.csv');
  const conteudo = readFileSync(caminho, 'utf-8');
  const linhas = conteudo.trim().split('\n').slice(1);

  return linhas.map((linha) => {
    const [valorFatura, valorPago, inadimplente] = linha.split(',');
    return {
      valorFaturaCentavos: Number(valorFatura),
      valorPagoCentavos: Number(valorPago),
      inadimplente: inadimplente === '1',
    };
  });
}

const registros = carregarCsv();

export function obterCreditoReal(indice: number): RegistroCreditoReal {
  return registros[indice % registros.length];
}
