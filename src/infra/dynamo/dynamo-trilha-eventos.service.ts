import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { EnvConfig } from '../../config/env.schema';
import { EventoTrilha, TrilhaEventos } from '../../dominio/portas/trilha-eventos.port';

@Injectable()
export class DynamoTrilhaEventosService implements TrilhaEventos, OnModuleInit {
  private readonly logger = new Logger(DynamoTrilhaEventosService.name);
  private readonly cliente: DynamoDBDocumentClient;
  private readonly tabela: string;

  constructor(config: ConfigService<EnvConfig, true>) {
    this.tabela = config.get('DYNAMO_TABLE_EVENTOS', { infer: true });
    const endpoint = config.get('AWS_ENDPOINT', { infer: true });

    const base = new DynamoDBClient({
      region: config.get('AWS_REGION', { infer: true }),
      endpoint,
      ...(endpoint ? { credentials: { accessKeyId: 'local', secretAccessKey: 'local' } } : {}),
    });
    this.cliente = DynamoDBDocumentClient.from(base);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.cliente.send(
        new CreateTableCommand({
          TableName: this.tabela,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'registroId', AttributeType: 'S' },
            { AttributeName: 'ocorridoEm', AttributeType: 'S' },
          ],
          KeySchema: [
            { AttributeName: 'registroId', KeyType: 'HASH' },
            { AttributeName: 'ocorridoEm', KeyType: 'RANGE' },
          ],
        }),
      );
      this.logger.log(`Tabela "${this.tabela}" criada`);
    } catch (erro) {
      if (!(erro instanceof ResourceInUseException)) {
        this.logger.error(`Falha ao garantir a tabela "${this.tabela}": ${(erro as Error).message}`);
      }
    }
  }

  async registrar(evento: EventoTrilha): Promise<void> {
    await this.cliente.send(new PutCommand({ TableName: this.tabela, Item: evento }));
  }

  async listarPorRegistro(registroId: string): Promise<EventoTrilha[]> {
    const resultado = await this.cliente.send(
      new QueryCommand({
        TableName: this.tabela,
        KeyConditionExpression: 'registroId = :registroId',
        ExpressionAttributeValues: { ':registroId': registroId },
        ScanIndexForward: true,
      }),
    );
    return (resultado.Items ?? []) as EventoTrilha[];
  }
}
