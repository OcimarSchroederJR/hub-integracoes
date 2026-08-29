# Uso de IA no desenvolvimento

Registro de como a IA foi usada neste projeto, o que ela resolveu bem e onde precisou ser corrigida. Diferente de uma seção de marketing, o valor deste documento está nos erros: onde a IA errou, por que errou, e como o erro foi pego.

Ferramenta: Claude Code (CLI). Modelo: Claude Sonnet 5.

O projeto inteiro — do esqueleto da Fase 1 aos painéis do Grafana da Fase 3 — foi construído com a IA operando o terminal diretamente: escrevendo código, rodando `docker compose`, subindo o serviço de verdade, disparando importações reais contra o mock, lendo os logs e só então decidindo o próximo passo. Isso muda o que vale a pena registrar aqui: os erros abaixo não foram encontrados relendo código, foram encontrados rodando o sistema e vendo o comportamento errado acontecer.

---

## Onde funcionou bem

**Geração do esqueleto de adaptador a partir do contrato do parceiro.** Colar o JSON de exemplo do Parceiro Alfa e o formato do `RegistroCanonico` e pedir o schema Zod mais o mapeador produziu um esqueleto correto na maior parte das vezes. O ganho real está em não digitar os campos de tradução de situação e os conversores um por um.

**Casos de teste a partir do mapeador pronto.** Pedir os casos-limite de um mapeador já escrito — documento no limite da validade, data 31 de fevereiro, valor não numérico — rende cobertura melhor do que escrever os casos de cabeça, porque a ferramenta enumera combinações que passam despercebidas.

**Redação dos ADRs.** A estrutura (contexto, decisão, alternativas descartadas, consequências) foi gerada; o conteúdo de cada ADR reflete decisões que já tinham sido tomadas durante a implementação, não o contrário. Um ADR escrito antes do código tende a soar plausível e não corresponder ao motivo real da escolha.

---

## Onde a IA errou e foi corrigida

Esta é a seção que importa.

### Registro sem contrato desaparecia em silêncio, em vez de virar REJEITADO

O adaptador do Alfa achata `contracts[]` em itens individuais. Quando esse array vinha vazio — um dos defeitos que o mock injeta de propósito — o laço `for (const contract of item.contracts)` simplesmente não gerava item nenhum. O cliente sumia da carteira sem gerar `REJEITADO` com motivo, o que quebra RF05 (todo registro inválido precisa ser contabilizado) de um jeito que não aparece em teste unitário nenhum, porque o mapeador nunca chega a ser chamado.

Encontrado rodando uma importação Alfa real e reparando que a soma de persistidos e rejeitados não batia com o total recebido. Corrigido representando "sem contrato" como um item com `contract: null`, que o mapeador rejeita explicitamente com `CampoObrigatorioAusenteError`. Commit `21c5c42`.

### A trava de execução concorrente repetiu o exato anti-padrão que a ADR 0002 já tinha descartado

RF01 exige que duas chamadas simultâneas de disparo para o mesmo parceiro não criem execuções concorrentes. A primeira implementação fez `findFirst` para checar se havia execução em andamento e só depois criava uma nova — o mesmíssimo "consultar depois inserir" que a ADR 0002 rejeita explicitamente para a idempotência da dívida, com a mesma falha: não é atômico, então duas requisições genuinamente simultâneas passam pela checagem antes de qualquer uma inserir.

O teste manual com dois `curl` em background não pegava isso, porque o intervalo entre os dois processos do shell raramente é pequeno o suficiente para abrir a janela de corrida. Quem pegou foi o teste de integração rodando de verdade no CI, disparando as duas chamadas com `Promise.all` no mesmo processo Node — aí a janela de corrida abre quase sempre. O CI ficou vermelho, com as duas chamadas voltando 202.

A lição não é só "corrigir o bug". É que a mesma pessoa (ou a mesma IA) que documentou o motivo de evitar um padrão em um lugar do sistema o reintroduziu em outro lugar do mesmo sistema, dias de trabalho depois, porque a ADR não é lida automaticamente antes de escrever cada linha nova. Corrigido com uma tabela `ExecucaoAtiva` com `parceiroId` como chave primária — criar a linha é atômico, a segunda chamada esbarra na restrição única (`P2002`) e vira 409. Commit `70dba5d`.

### Duas regressões de CI custaram um commit extra cada

Depois de adicionar a trilha de eventos em DynamoDB, o CI quebrou porque o LocalStack usado pelos testes de integração só tinha `SERVICES=s3` — o serviço de DynamoDB nunca tinha sido ligado lá, só no `docker-compose.yml` de desenvolvimento. Depois de adicionar as métricas Prometheus, o CI quebrou de novo, agora porque o hook `afterAll` (fechar a aplicação e derrubar os containers) passou do timeout padrão de 5 segundos do Jest — o `beforeAll` já tinha um timeout generoso por precisar subir containers, mas o `afterAll` tinha ficado no padrão.

Os dois casos têm a mesma forma: adicionar uma peça nova (DynamoDB, depois métricas) sem revisar se a infraestrutura de teste já dava conta da peça nova. Nenhum dos dois foi pego antes de chegar no CI, porque o ambiente local do Windows não roda a suíte de integração de verdade (ver limitação abaixo) — o CI real, rodando em Linux, foi a única rede de proteção que realmente pegou os dois. Commits `b257ef6` e `49666d7`.

---

## Uma limitação da própria ferramenta, não do código

A biblioteca `testcontainers` (usada para subir MySQL/Redis/LocalStack nos testes de integração) falha ao criar containers no Docker Desktop deste Windows especificamente, com um erro genérico "(HTTP code 500) server error" vindo do `docker-modem`. Isolado o problema com um script mínimo: `dockerode` puro, chamado diretamente e fora do Jest, funciona; a mesma chamada dentro de um teste Jest falha; `testcontainers` falha nos dois casos, em duas versões majors diferentes (v10 e v12). A causa exata não foi determinada — o sintoma aponta para uma interação entre o transport por named pipe do Windows e alguma característica do ambiente Jest — mas o suficiente foi investigado para confirmar que não era um erro de configuração do projeto, e sim uma incompatibilidade específica desta combinação de sistema operacional, ferramenta e ambiente de teste. A solução foi reescrever o helper de setup usando `dockerode` diretamente. Registrado como limitação conhecida no README em vez de escondido.

---

## Conclusão de uso

Nas partes estruturalmente repetitivas — schema, mapeador campo a campo, caso de teste, esqueleto de ADR — a aceleração foi real e o resultado, quando verificado, estava certo na maioria das vezes.

Os dois erros que valem a pena lembrar têm o mesmo formato: aconteceram exatamente onde o sistema precisa ser confiável sob concorrência ou sob um caminho de dado que não é o feliz, e nenhum dos dois apareceu em um teste unitário. Um foi pego rodando o sistema de verdade e comparando contadores; o outro foi pego porque o teste de integração disparava as duas requisições de propósito no mesmo processo, não em dois processos de shell torcendo para coincidir no tempo. A regra prática que fica: a IA (e quem revisa o trabalho dela) não deveria confiar que um padrão foi seguido só porque está documentado em algum ADR do repositório — vale a pena grep por padrões conhecidos de risco (consulta-depois-insere, sobretudo) toda vez que uma trava de concorrência nova é escrita, não só na primeira vez.
