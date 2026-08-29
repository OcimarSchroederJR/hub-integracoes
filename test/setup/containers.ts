import { execSync } from 'child_process';
import * as http from 'http';
import * as net from 'net';
import Docker from 'dockerode';

const docker = new Docker();

export interface AmbienteTeste {
  mysqlContainerId: string;
  redisContainerId: string;
  localstackContainerId: string;
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  awsEndpoint: string;
}

function aguardarPortaAberta(host: string, port: number, timeoutMs: number): Promise<void> {
  const inicio = Date.now();
  return new Promise((resolve, reject) => {
    const tentar = () => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.setTimeout(1_000);
      socket.on('error', proximaTentativa);
      socket.on('timeout', () => {
        socket.destroy();
        proximaTentativa();
      });
    };
    const proximaTentativa = () => {
      if (Date.now() - inicio >= timeoutMs) {
        reject(new Error(`Porta ${host}:${port} não abriu em ${timeoutMs}ms`));
        return;
      }
      setTimeout(tentar, 500);
    };
    tentar();
  });
}

function aguardarLocalstackPronto(port: number, timeoutMs: number): Promise<void> {
  const inicio = Date.now();
  return new Promise((resolve, reject) => {
    const tentar = () => {
      const requisicao = http.get(
        { host: '127.0.0.1', port, path: '/_localstack/health', timeout: 1_000 },
        (res) => {
          let corpo = '';
          res.on('data', (pedaco) => (corpo += pedaco));
          res.on('end', () => {
            try {
              const status = JSON.parse(corpo).services?.s3;
              if (status === 'available' || status === 'running') {
                resolve();
                return;
              }
            } catch {
              // resposta ainda não é JSON válido; tenta de novo
            }
            proximaTentativa();
          });
        },
      );
      requisicao.on('error', proximaTentativa);
      requisicao.on('timeout', () => {
        requisicao.destroy();
        proximaTentativa();
      });
    };
    const proximaTentativa = () => {
      if (Date.now() - inicio >= timeoutMs) {
        reject(new Error(`LocalStack não ficou pronto em ${timeoutMs}ms`));
        return;
      }
      setTimeout(tentar, 1_000);
    };
    tentar();
  });
}

async function garantirImagem(imagem: string): Promise<void> {
  const imagens = await docker.listImages({ filters: { reference: [imagem] } });
  if (imagens.length > 0) return;

  await new Promise<void>((resolve, reject) => {
    docker.pull(imagem, (erro: Error | null, stream: NodeJS.ReadableStream) => {
      if (erro) return reject(erro);
      docker.modem.followProgress(stream, (erroFinal: Error | null) =>
        erroFinal ? reject(erroFinal) : resolve(),
      );
    });
  });
}

async function criarESubir(
  imagem: string,
  nome: string,
  opcoes: Docker.ContainerCreateOptions,
): Promise<Docker.Container> {
  await garantirImagem(imagem);
  const container = await docker.createContainer({ Image: imagem, name: nome, ...opcoes });
  await container.start();
  return container;
}

/**
 * Prisma é o sinal de prontidão real do MySQL: a porta abre antes do
 * servidor aceitar autenticação de verdade (fase de setup interno do
 * entrypoint oficial), então tentamos a migration com retry em vez de
 * confiar só na porta TCP.
 */
async function aplicarMigrationsComRetry(databaseUrl: string, tentativas: number): Promise<void> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      });
      return;
    } catch (erro) {
      ultimoErro = erro;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  throw ultimoErro;
}

export async function subirAmbiente(): Promise<AmbienteTeste> {
  const sufixo = Math.random().toString(36).slice(2, 8);

  const [mysql, redis, localstack] = await Promise.all([
    criarESubir('mysql:8.0', `hub-teste-mysql-${sufixo}`, {
      Env: ['MYSQL_ROOT_PASSWORD=root', 'MYSQL_DATABASE=hub_test', 'MYSQL_USER=hub', 'MYSQL_PASSWORD=hub'],
      ExposedPorts: { '3306/tcp': {} },
      HostConfig: { PortBindings: { '3306/tcp': [{ HostPort: '0' }] }, AutoRemove: true },
    }),
    criarESubir('redis:7-alpine', `hub-teste-redis-${sufixo}`, {
      ExposedPorts: { '6379/tcp': {} },
      HostConfig: { PortBindings: { '6379/tcp': [{ HostPort: '0' }] }, AutoRemove: true },
    }),
    criarESubir('localstack/localstack:3', `hub-teste-localstack-${sufixo}`, {
      Env: ['SERVICES=s3', 'DEFAULT_REGION=us-east-1'],
      ExposedPorts: { '4566/tcp': {} },
      HostConfig: { PortBindings: { '4566/tcp': [{ HostPort: '0' }] }, AutoRemove: true },
    }),
  ]);

  const [mysqlInfo, redisInfo, localstackInfo] = await Promise.all([
    mysql.inspect(),
    redis.inspect(),
    localstack.inspect(),
  ]);
  const mysqlPort = Number(mysqlInfo.NetworkSettings.Ports['3306/tcp'][0].HostPort);
  const redisPort = Number(redisInfo.NetworkSettings.Ports['6379/tcp'][0].HostPort);
  const localstackPort = Number(localstackInfo.NetworkSettings.Ports['4566/tcp'][0].HostPort);

  await Promise.all([
    aguardarPortaAberta('127.0.0.1', redisPort, 20_000),
    aguardarLocalstackPronto(localstackPort, 60_000),
  ]);

  const databaseUrl = `mysql://hub:hub@127.0.0.1:${mysqlPort}/hub_test`;
  await aplicarMigrationsComRetry(databaseUrl, 20);

  return {
    mysqlContainerId: mysql.id,
    redisContainerId: redis.id,
    localstackContainerId: localstack.id,
    databaseUrl,
    redisHost: '127.0.0.1',
    redisPort,
    awsEndpoint: `http://127.0.0.1:${localstackPort}`,
  };
}

export async function derrubarAmbiente(ambiente: AmbienteTeste): Promise<void> {
  await Promise.all([
    docker
      .getContainer(ambiente.mysqlContainerId)
      .stop()
      .catch(() => undefined),
    docker
      .getContainer(ambiente.redisContainerId)
      .stop()
      .catch(() => undefined),
    docker
      .getContainer(ambiente.localstackContainerId)
      .stop()
      .catch(() => undefined),
  ]);
}
