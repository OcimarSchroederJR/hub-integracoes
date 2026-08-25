# ADR 0004 — MySQL para estado, DynamoDB para trilha de eventos

**Situação:** aceita
**Data:** 2026-08-24

## Contexto

O sistema tem dois tipos de dado com perfis opostos. O estado atual de devedores e dívidas é relacional, consultado por múltiplos critérios, precisa de restrição de unicidade e de transação. A trilha de eventos é apenas escrita, com volume várias vezes maior, esquema variável no campo de detalhe e leitura quase sempre por um único registro em ordem cronológica.

## Decisão

MySQL para parceiros, execuções, registros, devedores e dívidas. DynamoDB para a trilha de eventos, com chave de partição em `registroId` e chave de ordenação em `ocorridoEm`.

## Alternativas consideradas

**Tudo em MySQL, com tabela de eventos.** Tecnicamente viável e mais simples de operar. Descartada porque a tabela de eventos cresce muito mais rápido que as demais e passa a dominar o custo de backup e a manutenção de índices, sem que nenhuma das suas consultas precise de junção ou transação. É o caso de uso para o qual o banco de chave e valor existe.

**Tudo em DynamoDB.** Descartada porque a garantia central do sistema, descrita no ADR 0002, depende de restrição única, que DynamoDB oferece apenas sobre a chave primária. Implementar idempotência por chave composta e ainda assim consultar dívidas por parceiro, situação e faixa de vencimento exigiria índices secundários globais que reintroduzem complexidade sem ganho.

**Trilha de eventos em log estruturado, sem banco.** Descartada porque o requisito é reconstruir a história de um registro específico sob demanda, e busca em arquivo de log não atende com latência aceitável sem uma ferramenta de indexação adicional.

## Consequências

**Positivas.** Cada tipo de dado fica no armazenamento adequado ao seu padrão de acesso. A escrita de eventos não compete com as transações de negócio pelos mesmos recursos.

**Negativas.** Dois bancos significam duas configurações, dois clientes, dois modos de falha e um ambiente de desenvolvimento mais pesado. Não existe transação abrangendo os dois, então uma dívida pode ser persistida sem que o evento correspondente seja gravado. A escolha foi tolerar essa inconsistência, porque a trilha é auxiliar e sua perda não afeta a correção do estado. Se a trilha virasse fonte de verdade, esta decisão precisaria ser revista.

Vale registrar com franqueza: com o volume atual do projeto, MySQL sozinho bastaria. O segundo banco existe também porque o padrão de acesso justifica a escolha de forma didática e porque a stack alvo do projeto inclui DynamoDB. Reconhecer isso é mais honesto do que inventar uma necessidade de escala que este projeto não tem.
