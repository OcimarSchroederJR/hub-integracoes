import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('expõe o contador de registros processados no formato Prometheus', async () => {
    const metrics = new MetricsService();
    metrics.registrosProcessados.inc({ parceiro: 'alfa', resultado: 'persistido' });
    metrics.registrosProcessados.inc({ parceiro: 'alfa', resultado: 'persistido' });
    metrics.registrosProcessados.inc({ parceiro: 'alfa', resultado: 'rejeitado' });

    const saida = await metrics.registry.metrics();

    expect(saida).toContain('hub_registros_processados_total{parceiro="alfa",resultado="persistido"} 2');
    expect(saida).toContain('hub_registros_processados_total{parceiro="alfa",resultado="rejeitado"} 1');
  });

  it('expõe o histograma de duração de chamada externa com os buckets configurados', async () => {
    const metrics = new MetricsService();
    metrics.duracaoChamadaExterna.observe({ parceiro: 'beta', operacao: 'coletar' }, 120);

    const saida = await metrics.registry.metrics();

    expect(saida).toContain('hub_chamada_externa_duracao_ms_bucket');
    expect(saida).toContain('parceiro="beta"');
    expect(saida).toContain('operacao="coletar"');
  });

  it('cada instância usa seu próprio registro, sem vazar métricas entre testes', async () => {
    const primeira = new MetricsService();
    primeira.registrosProcessados.inc({ parceiro: 'alfa', resultado: 'persistido' });

    const segunda = new MetricsService();
    const saida = await segunda.registry.metrics();

    expect(saida).not.toContain('resultado="persistido"');
  });
});
