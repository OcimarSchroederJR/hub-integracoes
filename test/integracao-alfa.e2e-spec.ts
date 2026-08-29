import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import nock from 'nock';
import request from 'supertest';
import { AmbienteTeste, derrubarAmbiente, subirAmbiente } from './setup/containers';

const ALFA_BASE_URL = 'http://alfa-mock.test';

function clienteAlfa(indice: number, sobrescritas: Record<string, unknown> = {}) {
  return {
    externalId: `ALF-${indice}`,
    taxId: '52998224725',
    customerName: `Cliente ${indice}`,
    contracts: [
      {
        contractNumber: `CT-${indice}`,
        originalAmountCents: 100_00 + indice,
        currentAmountCents: 120_00 + indice,
        dueDate: '2024-03-15',
        status: 'OVERDUE',
      },
    ],
    contacts: { phones: ['5581998805965'], emails: [`cliente${indice}@exemplo.com`] },
    updatedAt: new Date().toISOString(),
    ...sobrescritas,
  };
}

function mockarPaginaUnica(itens: unknown[]): void {
  nock(ALFA_BASE_URL)
    .get('/v1/portfolio')
    .query(true)
    .reply(200, { data: itens, nextCursor: null, hasMore: false });
}

interface ExecucaoDto {
  situacao: string;
  totalRecebidos: number;
  totalPersistidos: number;
  totalRejeitados: number;
  totalFalhas: number;
}

async function aguardarConclusao(
  app: INestApplication,
  execucaoId: string,
  timeoutMs = 30_000,
): Promise<ExecucaoDto> {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const resposta = await request(app.getHttpServer()).get(`/execucoes/${execucaoId}`);
    if (resposta.body.situacao === 'CONCLUIDA') {
      return resposta.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Execução "${execucaoId}" não concluiu em ${timeoutMs}ms`);
}

describe('Importação do Parceiro Alfa (integração com MySQL, Redis e S3/LocalStack reais)', () => {
  let ambiente: AmbienteTeste;
  let app: INestApplication;

  beforeAll(async () => {
    ambiente = await subirAmbiente();

    process.env.DATABASE_URL = ambiente.databaseUrl;
    process.env.REDIS_HOST = ambiente.redisHost;
    process.env.REDIS_PORT = String(ambiente.redisPort);
    process.env.PARCEIRO_ALFA_BASE_URL = ALFA_BASE_URL;
    process.env.PARCEIRO_ALFA_TOKEN = 'token-de-teste';
    process.env.PARCEIRO_BETA_CSV_URL = 'http://beta-mock.test/carteira.csv';
    process.env.PARCEIRO_BETA_WEBHOOK_URL = 'http://beta-mock.test/webhook';
    process.env.AWS_ENDPOINT = ambiente.awsEndpoint;
    process.env.AWS_REGION = 'us-east-1';
    process.env.S3_BUCKET_RAW = 'hub-raw-payloads-teste';
    process.env.DYNAMO_TABLE_EVENTOS = 'hub-eventos-teste';

    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 240_000);

  afterAll(async () => {
    await app.close();
    await derrubarAmbiente(ambiente);
  }, 60_000);

  afterEach(() => {
    nock.cleanAll();
  });

  it('rejeita o registro com documento inválido e persiste o restante do lote', async () => {
    mockarPaginaUnica([clienteAlfa(1), clienteAlfa(2), clienteAlfa(3, { taxId: '00000000000' })]);

    const disparo = await request(app.getHttpServer()).post('/integracoes/alfa/execucoes').expect(202);

    const execucao = await aguardarConclusao(app, disparo.body.id);

    expect(execucao.totalRecebidos).toBe(3);
    expect(execucao.totalPersistidos).toBe(2);
    expect(execucao.totalRejeitados).toBe(1);

    const registrosRejeitados = await request(app.getHttpServer())
      .get(`/execucoes/${disparo.body.id}/registros`)
      .query({ situacao: 'REJEITADO' });

    expect(registrosRejeitados.body).toHaveLength(1);
    expect(registrosRejeitados.body[0].motivoRejeicao).toMatch(/Documento inválido/);
  });

  it('arquiva o payload bruto da página em S3 antes de qualquer transformação (RF02)', async () => {
    const itens = [clienteAlfa(301), clienteAlfa(302)];
    mockarPaginaUnica(itens);

    const disparo = await request(app.getHttpServer()).post('/integracoes/alfa/execucoes').expect(202);
    await aguardarConclusao(app, disparo.body.id);

    const s3 = new S3Client({
      region: 'us-east-1',
      endpoint: ambiente.awsEndpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });
    const objeto = await s3.send(
      new GetObjectCommand({ Bucket: 'hub-raw-payloads-teste', Key: `raw/alfa/${disparo.body.id}/0.json` }),
    );
    const conteudo = JSON.parse(await objeto.Body!.transformToString());

    expect(conteudo.data).toHaveLength(2);
    expect(conteudo.data[0].externalId).toBe('ALF-301');
  });

  it('registra a trilha de eventos do registro persistido e do rejeitado (RF07)', async () => {
    mockarPaginaUnica([clienteAlfa(401), clienteAlfa(402, { taxId: '00000000000' })]);

    const disparo = await request(app.getHttpServer()).post('/integracoes/alfa/execucoes').expect(202);
    await aguardarConclusao(app, disparo.body.id);

    const registros = await request(app.getHttpServer()).get(`/execucoes/${disparo.body.id}/registros`);
    const persistido = registros.body.find((r: { situacao: string }) => r.situacao === 'PERSISTIDO');
    const rejeitado = registros.body.find((r: { situacao: string }) => r.situacao === 'REJEITADO');

    const eventosPersistido = await request(app.getHttpServer()).get(`/registros/${persistido.id}/eventos`);
    expect(eventosPersistido.body).toHaveLength(1);
    expect(eventosPersistido.body[0].tipo).toBe('REGISTRO_PERSISTIDO');
    expect(eventosPersistido.body[0].execucaoId).toBe(disparo.body.id);
    expect(eventosPersistido.body[0].correlationId).toBe(disparo.body.correlationId);

    const eventosRejeitado = await request(app.getHttpServer()).get(`/registros/${rejeitado.id}/eventos`);
    expect(eventosRejeitado.body).toHaveLength(1);
    expect(eventosRejeitado.body[0].tipo).toBe('REGISTRO_REJEITADO');
    expect(eventosRejeitado.body[0].detalhe.motivo).toMatch(/Documento inválido/);

    await request(app.getHttpServer()).get('/registros/id-inexistente/eventos').expect(404);
  });

  it('reprocessar a mesma carteira não duplica dívidas (ADR 0002)', async () => {
    const itens = [clienteAlfa(101), clienteAlfa(102), clienteAlfa(103)];

    mockarPaginaUnica(itens);
    const primeiraExecucao = await request(app.getHttpServer())
      .post('/integracoes/alfa/execucoes')
      .expect(202);
    const primeiroResultado = await aguardarConclusao(app, primeiraExecucao.body.id);
    expect(primeiroResultado.totalPersistidos).toBe(3);

    mockarPaginaUnica(itens);
    const segundaExecucao = await request(app.getHttpServer())
      .post('/integracoes/alfa/execucoes')
      .expect(202);
    const segundoResultado = await aguardarConclusao(app, segundaExecucao.body.id);
    expect(segundoResultado.totalPersistidos).toBe(3);

    mockarPaginaUnica(itens);
    const terceiraExecucao = await request(app.getHttpServer())
      .post('/integracoes/alfa/execucoes')
      .expect(202);
    const terceiroResultado = await aguardarConclusao(app, terceiraExecucao.body.id);
    expect(terceiroResultado.totalPersistidos).toBe(3);

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const totalDividas = await prisma.divida.count({
        where: {
          chaveIdempotencia: {
            in: itens.map((item) => `alfa:${item.externalId}:${item.contracts[0].contractNumber}`),
          },
        },
      });
      expect(totalDividas).toBe(3);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('rejeita a segunda chamada concorrente com 409 e não cria execução duplicada', async () => {
    mockarPaginaUnica([clienteAlfa(201)]);

    const [primeira, segunda] = await Promise.all([
      request(app.getHttpServer()).post('/integracoes/alfa/execucoes'),
      request(app.getHttpServer()).post('/integracoes/alfa/execucoes'),
    ]);

    const situacoes = [primeira.status, segunda.status].sort();
    expect(situacoes).toEqual([202, 409]);

    const idConcluida = primeira.status === 202 ? primeira.body.id : segunda.body.id;
    await aguardarConclusao(app, idConcluida);
  });
});
