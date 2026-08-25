# Runbook operacional

O que fazer quando algo dá errado em produção. Organizado por sintoma, porque é assim que o problema chega.

**Antes de qualquer coisa**, tenha em mãos o `correlationId` da execução. Ele está no retorno do `POST` de início, na coluna `correlationId` da execução e em todas as linhas de log da importação.

---

## Sintoma: a profundidade da fila de normalização só cresce

Painel `hub_fila_profundidade{fila="normalizacao"}` em subida sustentada.

**Diagnóstico.** Verifique se os trabalhadores estão vivos, com `GET /health` e a métrica de jobs concluídos por minuto. Fila crescendo com trabalhador processando é problema de capacidade; fila crescendo com zero conclusões é trabalhador travado.

**Se for capacidade.** Aumente `FILA_CONCORRENCIA_NORMALIZACAO` e reinicie. Acompanhe a latência do MySQL na mesma janela, porque a concorrência acima do que o banco suporta piora o quadro em vez de melhorar. O ponto de saturação medido está em [BENCHMARK.md](BENCHMARK.md).

**Se for trabalhador travado.** Quase sempre é conexão de banco esgotada ou uma promessa sem tratamento. Reinicie o processo. Os jobs em andamento voltam para a fila após o tempo de bloqueio expirar, e a idempotência do ADR 0002 garante que reprocessá-los é seguro.

**Nunca** limpe a fila para reduzir a profundidade. Isso descarta dado do parceiro que não será reenviado automaticamente.

---

## Sintoma: o parceiro está devolvendo 429

**Diagnóstico.** Confirme na métrica `hub_chamada_externa_duracao_ms` e nos logs do adaptador. Se o limitador está configurado corretamente, isso não deveria acontecer.

**Causas prováveis, em ordem.** Múltiplas instâncias da aplicação sem Redis compartilhado, o que faz cada instância aplicar seu próprio limite. Limite do parceiro reduzido sem aviso. Ou processo manual chamando a API do parceiro em paralelo com o hub.

**Ação.** Reduza `PARCEIRO_{NOME}_RATE_LIMIT_POR_MINUTO` para 70 por cento do valor contratado e reinicie. O 429 é retentado com backoff, então nada é perdido enquanto você investiga. Registre o incidente e abra contato com o parceiro para confirmar o limite atual.

---

## Sintoma: execução parada em PROCESSANDO e não conclui

Este é o modo de falha mais provável do sistema, herdado da decisão do ADR 0003.

**Diagnóstico.**

```sql
SELECT totalRecebidos, totalPersistidos, totalRejeitados, totalFalhas, coletaConcluida
FROM ExecucaoIntegracao WHERE id = '{id}';
```

Se `coletaConcluida` é falso, a coleta parou no meio. Verifique se há job de coleta na fila ou entre os falhos.

Se `coletaConcluida` é verdadeiro e a soma de persistidos, rejeitados e falhas é menor que o total recebido, existem jobs de normalização perdidos. Isso ocorre quando o processo morre entre a conclusão do job e a atualização do contador.

**Ação.** Para coleta interrompida, reenfileire manualmente o job de coleta com o cursor da última página bem-sucedida, disponível no log. Para jobs de normalização perdidos, use `POST /execucoes/{id}/reprocessar` e, se a diferença persistir, force a avaliação de conclusão após confirmar que a fila está vazia.

**Correção permanente pendente.** Trocar o contador do MySQL por contador atômico em Redis, registrado nas limitações conhecidas do README.

---

## Sintoma: suspeita de dívida duplicada

**Diagnóstico.**

```sql
SELECT chaveIdempotencia, COUNT(*) c FROM Divida
GROUP BY chaveIdempotencia HAVING c > 1;
```

Se esta consulta devolver linhas, a restrição única foi removida ou a migration não foi aplicada em produção. Isso é incidente grave, porque significa cobrança duplicada.

Se devolver vazio e ainda assim parecer duplicado, provavelmente são dívidas legítimas do mesmo devedor com contratos diferentes, ou o mesmo contrato reportado por dois parceiros distintos. Confirme comparando `parceiroId` e `numeroContrato`.

**Ação.** Verifique se a migration está aplicada com `npx prisma migrate status`. Nunca resolva duplicidade apagando linha sem antes entender qual das duas o parceiro considera válida.

---

## Sintoma: taxa de rejeição subiu de repente

**Diagnóstico.** `GET /execucoes/{id}/registros?situacao=REJEITADO` e agrupe pelos motivos. Motivo repetido em massa indica mudança de formato do parceiro, não dado ruim.

**Ação.** Se o parceiro mudou o formato, o payload bruto de cada registro rejeitado está preservado. Corrija o mapeador, escreva o teste com o payload novo e reprocesse a execução. Nenhuma chamada ao parceiro é necessária, porque o reprocessamento usa o bruto armazenado.

---

## Sintoma: fila de mortos acumulando

**Diagnóstico.** `hub_dead_letter_total` em crescimento. Liste os registros com situação `FALHA` e agrupe pelo motivo.

**Ação.** Falha de rede resolvida na origem: reprocesse. Falha por erro de código: corrija, implante e reprocesse. Falha por dado que nunca vai funcionar: reclassifique como rejeitado e leve ao parceiro.

Reprocessar execução muito grande enfileira tudo de uma vez, o que pode pressionar o parceiro. Isso está registrado nas limitações do README. Enquanto não houver limite próprio de reprocessamento, faça em lotes usando o endpoint por registro.

---

## Escalonamento

Resolva sozinho: fila crescendo, 429, taxa de rejeição, fila de mortos.

Chame alguém: duplicidade confirmada em `Divida`, perda de dado sem payload bruto preservado, ou qualquer situação em que a ação corretiva envolva apagar linha de dívida.
