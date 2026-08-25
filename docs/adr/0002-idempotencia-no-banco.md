# ADR 0002 — Idempotência garantida por restrição única no banco

**Situação:** aceita
**Data:** 2026-08-24

## Contexto

Carteiras são reenviadas pelos parceiros com frequência, seja por reenvio programado, por reprocessamento manual após falha, ou porque a fila entregou o mesmo job duas vezes. BullMQ, como qualquer fila, garante entrega ao menos uma vez, e não exatamente uma vez. Processar o mesmo registro duas vezes não pode gerar dívida duplicada, porque duplicidade em carteira de cobrança significa cobrar a mesma pessoa duas vezes pela mesma dívida.

## Decisão

Cada dívida recebe uma chave determinística no formato `{parceiroId}:{identificadorExterno}:{numeroContrato}`, gravada em coluna com restrição `UNIQUE` no MySQL. A persistência usa `upsert` sobre essa chave.

A garantia vive no banco. O código não consulta antes de inserir.

## Alternativas consideradas

**Consultar antes de inserir.** Descartada porque não é atômica. Com concorrência de dez trabalhadores, dois jobs do mesmo registro consultam ao mesmo tempo, ambos não encontram nada e ambos inserem. O defeito só aparece sob carga, que é exatamente quando é mais caro descobrir.

**Chave baseada no documento do devedor.** Descartada porque o mesmo devedor pode ter contratos distintos, inclusive com parceiros distintos. A chave precisa identificar a dívida, não a pessoa.

**Bloqueio distribuído em Redis por registro.** Descartada por adicionar um ponto de falha e um custo de latência para resolver algo que a restrição do banco resolve de graça e com garantia mais forte.

**Deduplicação por identificador de job na fila.** Descartada porque protege contra entrega repetida do mesmo job, mas não contra o reenvio legítimo da carteira pelo parceiro no dia seguinte, que é o caso mais comum.

## Consequências

**Positivas.** A garantia é estrutural e independe de disciplina de quem escreve o código. Qualquer caminho novo de escrita herda a proteção. O reprocessamento manual passa a ser seguro por construção, o que é pré-requisito do runbook.

**Negativas.** A coluna é limitada a 191 caracteres por causa do tamanho máximo de índice com utf8mb4 no MySQL. Identificador externo muito longo de algum parceiro futuro exigiria trocar a chave por um hash, o que dificulta a inspeção manual. Além disso, o `upsert` sobrescreve o registro existente; se um parceiro reenviar dado pior do que o já armazenado, ele vence. Conciliação por data de atualização resolveria e não foi implementada.

## Verificação

O teste `reprocessar a mesma carteira não duplica dívidas` executa a importação completa duas vezes e afirma que a contagem não muda. Ele roda contra MySQL real via Testcontainers, porque contra banco em memória a restrição não seria exercitada.
