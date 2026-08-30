#!/usr/bin/env node
import { Command } from 'commander';
import axios, { AxiosError } from 'axios';

const baseURL = process.env.HUB_API_URL ?? 'http://localhost:3000';
const http = axios.create({ baseURL });

function imprimir(dado: unknown): void {
  console.log(JSON.stringify(dado, null, 2));
}

async function executar(chamada: () => Promise<{ data: unknown }>): Promise<void> {
  try {
    const resposta = await chamada();
    imprimir(resposta.data);
  } catch (erro) {
    if (erro instanceof AxiosError && erro.response) {
      console.error(`Erro HTTP ${erro.response.status}:`);
      imprimir(erro.response.data);
    } else {
      console.error(`Falha ao chamar ${baseURL}: ${(erro as Error).message}`);
    }
    process.exitCode = 1;
  }
}

const programa = new Command();

programa
  .name('hub')
  .description(`CLI administrativo do Hub de Integrações (API em ${baseURL}, mude com HUB_API_URL)`)
  .version('0.1.0');

programa
  .command('execucoes:disparar <parceiro>')
  .description('dispara uma nova execução de coleta para um parceiro (ex.: alfa, beta)')
  .action((parceiro: string) => executar(() => http.post(`/integracoes/${parceiro}/execucoes`)));

programa
  .command('execucoes:status <id>')
  .description('consulta o status de uma execução')
  .action((id: string) => executar(() => http.get(`/execucoes/${id}`)));

programa
  .command('execucoes:registros <id>')
  .description('lista os registros de uma execução, opcionalmente filtrando por situação')
  .option('-s, --situacao <situacao>', 'PENDENTE | PERSISTIDO | REJEITADO | FALHA')
  .action((id: string, opcoes: { situacao?: string }) =>
    executar(() => http.get(`/execucoes/${id}/registros`, { params: { situacao: opcoes.situacao } })),
  );

programa
  .command('execucoes:reprocessar <id>')
  .description('reprocessa todos os registros em falha de uma execução')
  .action((id: string) => executar(() => http.post(`/execucoes/${id}/reprocessar`)));

programa
  .command('registros:reprocessar <id>')
  .description('reprocessa um registro específico')
  .action((id: string) => executar(() => http.post(`/registros/${id}/reprocessar`)));

programa
  .command('registros:eventos <id>')
  .description('lista a trilha de eventos de um registro')
  .action((id: string) => executar(() => http.get(`/registros/${id}/eventos`)));

programa
  .command('sobreposicoes:listar')
  .description('lista sobreposições de dívidas detectadas entre parceiros diferentes')
  .action(() => executar(() => http.get('/devedores/sobreposicoes')));

programa
  .command('health')
  .description('consulta o health check do hub')
  .action(() => executar(() => http.get('/health')));

programa.parseAsync(process.argv);
