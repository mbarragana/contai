# CONTAI-016 — Tipo de empreitada na obra (total / parcial / não tenho certeza)

## Tipo e Prioridade

feature (fiscal) — **P0**. Fora da R1; bloco "Depois", antes do CONTAI-017.

Decidido pelo `po` em 2026-08-17. Existe para dar ao app o dado que decide **de
quem é a obrigação do CNO** — hoje o sistema afirma em produção que a obrigação é
do Mateus, sem nunca ter perguntado.

- **Gate 0 (mock)**: **NÃO exige mock novo.** É um campo de rádio de três opções
  no formulário de obra que o CONTAI-003 já entregou e cujo mock foi aprovado.
  **Exige, sim, aprovação do texto das três opções** — texto com consequência
  fiscal, ver critério 3.
- **Gate Fiscal**: **PARCIALMENTE ABERTO, e o ticket é construído em torno disso.**
  - Em arquivo: `docs/pareceres/2026-08-17-terreno-financiado.md` (adendo de
    18/08) — o financiamento é **só do terreno**, sem liberação por medição, o
    que **elimina** a hipótese de dinheiro do banco ir direto ao empreiteiro.
    Simplifica o caso, mas **não responde a Q14**.
  - ⚠️ **DÍVIDA**: o parecer de empreitada total × parcial — incluindo o **texto
    alternativo completo de tela** que o `contador` redigiu no Gate 2 do
    CONTAI-003 — **existe só em transcript**. Registrado no backlog desde
    2026-08-10 e não pago. **Enquanto não estiver em arquivo, o ramo `total` não
    tem texto para exibir** — ver critério 6.

## Dor de Origem

**Q14, a pergunta mais cara em aberto do projeto** (backlog, 2026-08-10):

> "A obra sem CNO é empreitada TOTAL — a construtora fornece o material e assina
> a ART da obra inteira?"

Se for empreitada total, **o CNO é da construtora**, e o texto que o CONTAI-003
já põe em produção *cobra do Mateus uma obrigação de terceiro*: manda a pessoa
errada agir e deixa a certa parada — na **única janela de força que existe**
(antes de liberar a próxima parcela). A Q14 também **troca o dono da ação nº 0
da fila**.

A pergunta está aberta há oito dias, é respondida numa frase, e **o app não tem
onde guardar a resposta**. É esse buraco que este ticket fecha — não a resposta.

## Admissão: por qual porta este ticket entra

**Pela exceção do CONTAI-009/014** — *"dívida de critério de aceite de item da R1
volta como ticket da R1"*. O CONTAI-003 entregou em produção um texto cuja
correção depende de um dado que o app nunca captura.

⚠️ **NÃO entra pela regra de captura irreversível.** Ela segue intacta e não é
invocada: o tipo de empreitada não é fato perecível. Dizer o contrário abriria
porta nova para qualquer campo "importante" entrar na R1.

## User Story

**Como** dono da obra, gerenciando de casa, **quando** cadastro a obra (ou abro
uma já cadastrada), **quero** dizer se a empreitada é total, parcial, ou que
**não tenho certeza**, **para que** o app pare de me cobrar uma obrigação que
pode ser da construtora.

## Critérios de Aceite

1. [ ] **Campo `tipo_empreitada` na tabela `obra`**, com três valores possíveis
   mais a **ausência de valor**. Migration na próxima livre, com **GRANT
   explícito** (`e2e/privilegios.spec.ts` fica vermelho sem ele).
2. [ ] **Três respostas, e a terceira não é placeholder**: **total** ·
   **parcial** · **não tenho certeza**. É resposta legítima, registrada como tal.
3. [ ] ⚠️ **SEM DEFAULT. Nenhuma opção vem pré-selecionada.** Default em campo
   que decide de quem é uma obrigação legal é fabricar uma resposta que ninguém
   deu. Teste afirmando que ao abrir o formulário **as três estão desmarcadas**.
   Cada opção acompanha a frase que a distingue na prática (quem fornece o
   material, quem assina a ART) — **texto copiado do parecer, não reescrito**.
4. [ ] ⚠️ **Obra já cadastrada NÃO recebe backfill.** Nenhuma migração de dado,
   nenhuma inferência a partir de favorecidos ou notas. Nasce **sem valor** e
   **se comporta como "não tenho certeza"**. Teste sobre a obra do seed.
5. [ ] **Comportamento de "não tenho certeza"**: o texto do CNO é o de hoje,
   acrescido da ressalva de que **se a empreitada for total a obrigação pode ser
   da construtora**. Nunca calar o aviso — silêncio na dúvida é pior que aviso
   com ressalva.
6. [ ] ⚠️ **O ramo `total` se comporta como "não tenho certeza" enquanto o texto
   alternativo do `contador` não existir em arquivo — NUNCA como `parcial`.** O
   valor é gravado normalmente; pendente é só o texto. Teste explícito.
   **Cair para `parcial` seria afirmar uma obrigação do Mateus que o parecer pode
   desmentir** — a falha original com sinal trocado.
7. [ ] **Quando o parecer entrar em arquivo**, o ramo `total` passa a exibir o
   texto alternativo completo, **copiado literalmente**. Fica em aberto por
   dependência externa e **não bloqueia o DONE dos demais**.
8. [ ] **`parcial` mantém o comportamento atual** do CONTAI-003, sem ressalva.
9. [ ] **Editável a qualquer momento**, sem SQL (dor D9). Trocar o valor troca o
   texto imediatamente e **não altera nenhum dado fiscal já registrado**.
10. [ ] ⚠️ **Nenhum cálculo fiscal lê `tipo_empreitada` nesta rodada.** Ele decide
    **texto e destinatário de aviso**, nada mais. Grep: nenhuma decisão de custo,
    aferição ou retenção condicionada a este campo.
11. [ ] **E2E contra o Postgres local**: cadastrar obra em cada uma das três
    opções e afirmar o texto exibido, mais o caso da obra sem valor.

## Out of Scope

- **Responder a Q14.** Este ticket dá o lugar da resposta.
- **Recalcular ou reabrir a aferição INSS.** Qualquer efeito sobre aferição
  **exige parecer novo**; não se infere.
- **Campos separados de "quem assina a ART" e "quem fornece o material"** — são a
  explicação das opções, não campos.
- **Cobrança da construtora pelo CNO** — fora de escopo declarado.

## Pre-mortem

1. **O ramo `total` é implementado com o texto de `parcial` "por enquanto"** e o
   app volta a cobrar do Mateus obrigação de terceiro — agora com a autoridade de
   um campo que ele mesmo preencheu, o que é **pior que hoje**. *Mitigação:
   critério 6, com teste.*
2. **Alguém põe default em "parcial"** porque é o caso presumido, e a Q14 morre
   respondida por omissão. *Mitigação: critério 3.*
3. **O campo vira dado morto**: gravado, nunca lido. *Mitigação: critérios 5–8
   amarram cada valor a um texto verificável.*

## Viabilidade (CTO)

- **Migration**: uma coluna em `obra` + constraint dos três valores, permitindo
  nulo. Próxima livre. **GRANT explícito.**
- **Arquivos**: `supabase/migrations/`, formulário e detalhe da obra, e o módulo
  que monta o texto do CNO.
- **Complexidade: S.** O trabalho está em não errar o ramo `total`.

## Dependências

- **Bloqueado por**: nada de código. **Bloqueado no ramo `total`** pela
  materialização do parecer em `docs/pareceres/2026-08-09-obra-sem-cno.md`.
- **Depende de**: `CONTAI-003` — já em produção. ⚠️ Lembrete: ele está **sem
  registro dos Gates 3 e 4**; o schema funciona, o comportamento não foi
  validado.
- **Relacionado**: `CONTAI-007` e `CONTAI-017` — os três vivem na mesma família
  de texto de CNO em tela.

## Perguntas Abertas

1. **Q14, para o Mateus** — a obra sem CNO é empreitada total? Uma frase, e
   continua sendo a mais barata de responder e a mais cara de ignorar.
2. **Se for "total": a ação nº 0 troca de dono** — alguém precisa falar com a
   construtora antes da próxima parcela. Ação fora do software.
3. **A confirmação na IN vigente de quem é o titular do CNO em empreitada
   total** — 2ª condição cumulativa. Trabalho do `contador`, e é o que destrava
   o critério 7.

## Teste do Canteiro (régua de 2026-08-18)

- **Cenário principal — gestão em casa**: é o único. Ninguém responde "qual é o
  regime da minha empreitada" com uma mão no canteiro; se responde, a resposta
  não presta. **375px é piso de leitura**: três opções com uma frase de
  explicação cada é o desenho certo mesmo custando rolagem.
- **Metas atendidas**: 2, indiretamente, e sobretudo **a integridade do que o app
  afirma**. Não serve a meta 1 nem a 3.
- **Filtro de escopo, dito com todas as letras**: um campo que só muda texto é
  candidato natural a corte. **Não é cortado porque o texto que ele corrige já
  está em produção afirmando algo possivelmente falso sobre uma obrigação
  legal** — e porque a janela de força fecha sozinha com o tempo.
- **Veredito: APROVADO como P0 fora da R1**, com o ramo `total` bloqueado por
  parecer.
