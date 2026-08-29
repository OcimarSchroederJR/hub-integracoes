import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from '../../infra/observabilidade/metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async metricas(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metrics.registry.contentType);
    res.send(await this.metrics.registry.metrics());
  }
}
