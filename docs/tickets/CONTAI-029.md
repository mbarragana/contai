# CONTAI-029 Teste unitário para os mappers da camada de dados

## Roteamento do `/develop`
- **Tipo**: chore (cobertura de teste)
- **Prioridade**: **P1** — não é P0 porque nenhum bug conhecido está aberto
  aqui, mas é acima de P2 porque estas funções decidem **o que o app acredita
  que está gravado**, e hoje nada as observa
- **UI**: **não há.** Gate 0 não se aplica, sem proposta de design
- **Gate Fiscal**: **SIM** — os casos de teste **são** as condições que o
  `contador` nomeou no `CONTAI-028`. Copiar de lá, não rederivar
- **Bloqueado por**: **`CONTAI-028`**, fatia 1 (a que cria `lib/dados/comum.ts`)

## Tipo e Prioridade
chore — P1 — dívida nomeada como out-of-scope do `CONTAI-028`.

## Dor de Origem

⚠️ **Correção de premissa, registrada porque o erro foi meu**: a leitura inicial
foi *"`lib/data.test.ts` é monolítico, quebrar"*. **É falso.** O arquivo tem
**62 linhas** e dois `describe` — `mensagemDeErro` e `classificarErro`. Não há o
que quebrar. O problema é o oposto do que parecia.

O que a medição de 2026-08-22 mostrou:

| Camada | Código | Teste unitário |
|---|---|---|
| `lib/fiscal/*` (regras) | — | **5.400+ linhas**, bem coberta |
| `lib/money.ts` (conversão `numeric` ↔ centavos) | 30 linhas | 100 linhas — **coberta**, inclusive o caso `number` × `"4850.00"` |
| `lib/data.ts` (acesso a dados) | **2065 linhas** | **62 linhas**, cobrindo 2 funções de erro |

O buraco não é a camada fiscal — é preciso: **14 funções puras de mapeamento
`row` → domínio dentro de `lib/data.ts`, nenhuma exportada, nenhuma testada**:

`paraObra`, `paraDocumento`, `paraDiferenca`, `paraPagamento`, `paraLinhaObra`,
`paraDesembolsoTerreno`, `paraAnexoDeDesembolso`, `paraFinanciamento`,
`paraInforme`, `indexarDiferencas`, `agruparVinculos`, `paraAnosJson`,
`paraAnoAfetado`, `paraCompromisso`.

**Elas são puras** (recebem linha do PostgREST, devolvem objeto de domínio: sem
I/O, sem client) — ou seja, são exatamente o tipo de coisa que Vitest testa bem
e que a regra de E2E do projeto **não** obriga a levar ao Postgres. E é nelas
que moram condições fiscais que hoje ninguém observa:

- **`paraDocumento`** — `documento.valor` `null` → `valorCentavos` fica `null`,
  enquanto pagamento e desembolso caem em `?? 0`. **A assimetria é deliberada**:
  unificar em `?? 0` faz nota sem valor virar **R$ 0,00 declarado**
- **`paraAnosJson`** — o antes→depois do rastro vai como **texto** `.toFixed(2)`.
  Trocar por `String(n)` corrompe a pendência de retificadora
  (`docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §5)
- **`paraAnoAfetado`** — o `?? 0` só é seguro porque o par antes/depois já existe
- **`agruparVinculos`** / **`indexarDiferencas`** — agrupamento que decide qual
  documento aparece ligado a qual pagamento

## Por que este ticket vem DEPOIS do `CONTAI-028`, e não antes

As 14 funções são privadas. Testá-las hoje exige exportá-las de `lib/data.ts`
só para o teste enxergar — e isso:

1. **quebra o critério 3 do `CONTAI-028`** (superfície de export idêntica: 63
   exports antes e depois);
2. é exportar por causa de teste, que é o cheiro que a fatia 1 do `CONTAI-028`
   resolve de graça: os mappers compartilhados vão para `lib/dados/comum.ts`,
   onde ser exportado é **legítimo**, não concessão.

Fazer antes é pagar duas vezes e sujar o diff de movimentação pura — que é a
única coisa que torna o `CONTAI-028` revisável.

⚠️ **A ordem tem um custo, dito por extenso**: o `CONTAI-028` move ~2000 linhas
**sem** esta rede. Quem segura o veredito lá é o golden snapshot (critério 5) e
a auditoria de movimentação (critério 4), não teste unitário. Se o Mateus achar
esse risco alto demais, a inversão é possível — exportar os mappers antes, com o
critério 3 do `028` recalculado — mas aí o diff do `028` deixa de ser
movimentação pura, e o Gate 2 perde a régua que o torna barato de revisar.

## User Story

Como time que mantém o contai, quero que **cada mapper de linha do banco para
objeto de domínio tenha teste unitário**, para que a assimetria deliberada entre
`null` e `0` — e o formato de texto do rastro — falhem em vermelho quando
alguém "simplificar", em vez de virarem R$ 0,00 numa declaração.

## Critérios de Aceite

1. [ ] `lib/dados/comum.ts` (e os módulos que ficarem com mapper próprio) têm
       teste unitário para **cada uma das 14 funções**
2. [ ] Cada condição fiscal listada no Gate Fiscal do `CONTAI-028` tem **um
       caso de teste nomeado**, e o nome do teste diz a consequência, não a
       mecânica — *"nota sem valor não vira R$ 0,00 declarado"*, e não
       *"retorna null"*
3. [ ] A assimetria `documento.valor null → null` × `pagamento → ?? 0` tem teste
       **dos dois lados**, com comentário explicando que é deliberada. É o caso
       que mais convida a "consertar"
4. [ ] `paraAnosJson` tem teste de que o valor sai como **string** `.toFixed(2)`
       — número, `String(n)` ou `toString()` reprovam
5. [ ] Nenhum teste novo faz I/O: sem client Supabase, sem rede, sem Postgres.
       Mapper é puro; teste de mapper é puro
6. [ ] `npm run quality` verde
7. [ ] **Nenhuma alteração em `lib/data.ts` nem em qualquer módulo de
       `lib/dados/`** além do necessário. Este ticket escreve teste; se um teste
       novo revelar bug, ele **é registrado como dor no backlog e não é
       consertado aqui** — bug consertado junto de teste novo nasce sem gate

## Out of Scope

- **Testar as funções de I/O** (`carregar*`, `criar*`, `corrigir*`). Elas falam
  com o PostgREST, e stub de backend é **proibido no projeto**: valida a
  suposição de quem escreveu o teste, não o sistema. Quem cobre isso é o E2E
  contra o Postgres local, e ele já existe
- **Consertar bug encontrado.** Anota, não conserta
- **Mexer em `lib/fiscal/*`** — já tem 5.400+ linhas de teste
- **Refatorar mapper** para "ficar mais testável". Se está difícil de testar,
  o teste registra a dificuldade; o refactor é outro ticket

## Gate Fiscal (Contador)

**Sem regra nova.** Os casos de teste **são** as condições já adjudicadas no
Gate Fiscal do `CONTAI-028` — copiar de lá, com o parecer de origem citado em
comentário no teste. Rederivar regra fiscal de memória para escrever teste é a
mesma falha que o projeto proíbe, com outro nome.

Revisão do `contador` no Gate 2: conferir se cada condição virou caso, e se
nenhum caso **inventou** condição que não está no parecer.

## Pre-mortem

1. **Os testes viram espelho da implementação.** Escritos lendo o código, passam
   a afirmar "faz o que faz" e não "faz o que deve". Aí um bug real é
   congelado como comportamento esperado. *Mitigação: o critério 2 exige que o
   nome do teste diga a consequência fiscal — nome que só descreve mecânica é
   sinal de espelho.*
2. **A assimetria `null`/`0` é "corrigida" durante o próprio ticket**, por
   parecer inconsistência. *Mitigação: critério 3 e comentário obrigatório.*
3. **O ticket nunca roda**, porque depende do `CONTAI-028`, que é P2 e cede a
   qualquer item fiscal. A camada segue sem rede por meses. *Mitigação: nenhuma
   técnica — é decisão de fila do Mateus, e por isso está escrito aqui.*

## Viabilidade (CTO)

- **Modelo de dados**: nenhum impacto. Sem tabela, sem `GRANT`, sem migration
- **Arquivos**: `lib/dados/comum.test.ts` e, se algum mapper ficar em módulo
  próprio, o `.test.ts` ao lado dele. `lib/data.test.ts` continua onde está,
  intocado — ele cobre `mensagemDeErro` e `classificarErro`, que não são mappers
- **Complexidade**: **S** — puro, mecânico, sem ambiguidade de desenho. O custo
  está em montar os `row` de entrada com fidelidade ao que o PostgREST devolve
  (atenção: `numeric(14,2)` volta ora `number`, ora string)

## Dependências

- **Bloqueado por**: `CONTAI-028` (fatia 1, criação de `lib/dados/comum.ts`)
- Bloqueia: nenhum

## Perguntas Abertas

- Nenhuma técnica. A única é de sequência, e é do Mateus: aceitar que o
  `CONTAI-028` mova ~2000 linhas sem esta rede (recomendado), ou inverter a
  ordem pagando o preço descrito acima

## Cenário e checagem final

**Nenhum dos dois** — dívida interna, sem interface. **Teste do Canteiro não se
aplica.** Serve à **meta 1** por tabela: mapper errado é pagamento com valor
errado gravado em silêncio. Veredito: **APROVADO como P1**, atrás do `028`.
