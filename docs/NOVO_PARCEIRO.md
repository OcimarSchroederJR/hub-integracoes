# Como incluir um parceiro novo

Este documento é o teste da arquitetura. Se em algum momento for necessário editar arquivo fora de `src/parceiros`, a separação descrita no ADR 0001 falhou e o problema está no código, não neste guia.

**Tempo estimado:** 3 a 5 horas para um parceiro com formato já documentado.

---

## Antes de escrever código

Preencha a tabela de contrato do parceiro. Sem ela, o mapeamento vira tentativa e erro.

| Pergunta | Onde encontrar |
|---|---|
| Transporte é API, arquivo ou fila? | documentação do parceiro |
| Como autentica e o token expira? | documentação do parceiro |
| Existe limite de requisições? Qual? | documentação ou contrato comercial |
| Como pagina? Cursor, deslocamento ou sem paginação? | documentação |
| Qual a codificação e o separador, se for arquivo? | amostra real, nunca a documentação |
| Valor vem em centavos ou em decimal? Qual separador? | amostra real |
| Formato de data e fuso horário | amostra real |
| Vocabulário de situação e tradução para o enum interno | documentação mais amostra |
| O que identifica unicamente um registro? | decisão conjunta com o parceiro |
| Como devolver atualização de situação? | documentação |

A coluna da direita repete "amostra real" de propósito. Documentação de parceiro descreve o formato pretendido; o arquivo entregue mostra o formato existente. Quando divergem, o arquivo vence.

---

## Passo a passo

### 1. Crie o diretório

```
src/parceiros/{nome}/
  {nome}.adapter.ts
  {nome}.dto.ts
  {nome}.mapper.ts
  {nome}.mapper.spec.ts
```

### 2. Descreva o formato de entrada em `dto.ts`

Um schema Zod por item e um por página. O schema de página valida `data` como `unknown[]`, nunca como array tipado. Um item defeituoso não pode invalidar a página inteira.

### 3. Escreva o mapeador

Ele recebe o item bruto e devolve `RegistroCanonico`. Use os conversores existentes em `src/dominio/valores` em vez de escrever novos. Se o formato do parceiro não for coberto por nenhum conversor, adicione um conversor novo ali, com teste, e não um tratamento improvisado dentro do mapeador.

A tabela de tradução de situação fica como constante no topo do mapeador, nunca espalhada em condicionais.

### 4. Escreva o teste do mapeador antes do adaptador

Três casos no mínimo: item válido completo, item com campo obrigatório ausente, e item com valor ou data no limite do formato. Depois adicione o caso de equivalência, verificando que o mesmo devedor vindo deste parceiro e do Alfa produz canônicos idênticos nos campos `documento`, `valorAtualizado` e `dataVencimento`.

### 5. Implemente o adaptador

Implemente `ParceiroAdapter`. Em `coletarPagina`, arquive sempre o conteúdo bruto no `Buffer` de retorno antes de qualquer parse. Se o parceiro não pagina, devolva `proximoCursor: null` na primeira chamada.

### 6. Registre

```ts
// src/parceiros/registro-adaptadores.ts
constructor(alfa: AlfaAdapter, beta: BetaAdapter, novo: NovoAdapter) {
  this.registrar(alfa);
  this.registrar(beta);
  this.registrar(novo);
}
```

Adicione o provider em `parceiros.module.ts` e a linha do parceiro no seed.

### 7. Adicione as variáveis de ambiente

Em `env.schema.ts`, com prefixo `PARCEIRO_{NOME}_`. A aplicação deve recusar subir sem elas.

### 8. Simule antes de rodar a carteira real

```bash
curl -X POST http://localhost:3000/integracoes/{nome}/execucoes
curl "http://localhost:3000/execucoes/{id}/registros?situacao=REJEITADO"
```

Taxa de rejeição acima de 10 por cento quase sempre indica erro de mapeamento, não dado ruim do parceiro. Leia os motivos antes de culpar a origem.

---

## Checklist de conclusão

- [ ] Tabela de contrato preenchida a partir de amostra real
- [ ] Schema Zod valida item, não a página inteira
- [ ] Mapeador usa apenas conversores de `src/dominio/valores`
- [ ] Teste de mapeamento com caso válido, caso inválido e caso limite
- [ ] Teste de equivalência com outro parceiro passando
- [ ] Payload bruto arquivado antes do parse
- [ ] Adaptador registrado e variáveis de ambiente validadas
- [ ] Importação completa com taxa de rejeição explicada
- [ ] Fluxo de saída testado com uma mudança de situação
- [ ] **Nenhum arquivo fora de `src/parceiros` foi alterado**

O último item é o que importa. Se ele falhou, abra um ADR explicando por quê antes de seguir.
