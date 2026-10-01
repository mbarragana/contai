# CONTAI-084 Criador em lote de parcelas (compra no cartão)

## Tipo e Prioridade
Feature — **P1** — fricção real e recorrente, não obrigação fiscal em si,
mas com histórico de ter causado o incidente P0 do `CONTAI-083` (criação
manual repetida herdando origem por acidente).

## Dor de Origem
Relato: `docs/backlog/100-2026-09-30-criador-em-lote-de-parcelas.md`.

> "agora temos que fazer o parcelado verdadeiro. Porque hoje não é possível
> inserir pagamentos parcelados, eu tenho que adicionar cada parcela. isso é
> inviável."

Não é "o sistema recusa parcelado" — `RECUSA_PARCELADO` (`lib/fiscal/fatura.ts:20-33`,
ADENDO 5 do parecer `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
§I.1-I.3) está correta e **não muda**: cada parcela continua sendo um
`Compromisso` fiscalmente independente, com ano de custo decidido pela
fatura em que é paga, nunca pelo total da compra. A dor é o custo de
digitação de criar N desses registros um a um, repetindo favorecido/CPF-CNPJ
a cada parcela. Caso real: Ilhamix Concreto, 3 parcelas de R$15.000 no
cartão, criadas uma a uma — mesmo padrão que abriu a janela para o bug do
`CONTAI-083`.

## User Story
Como dono da obra, sentado em casa, quando eu souber de antemão que uma
compra no cartão será paga em N parcelas mensais, quero preencher
favorecido, CNPJ/CPF, data da compra, vencimento da 1ª fatura, valor total
e número de parcelas uma única vez, revisar e ajustar o valor e a data de
cada parcela sugeridas, e confirmar numa única ação, para que o sistema
gere as N compras de cartão separadas — cada uma continuando a ser um
`Compromisso` independente, do jeito que já nasce hoje — em vez de repetir
manualmente o mesmo cadastro N vezes.

## Critérios de Aceite
1. [ ] Proposta nível 1 em `design/mocks/CONTAI-084.md`.
2. [ ] Rota nova `/adicionar/compra-cartao/parcelas`, irmã de
   `/adicionar/compra-cartao` — não um "modo" na mesma tela. Esta rota
   NUNCA lê `?documento=` (isola a herança de nota do `CONTAI-064`/`071`).
3. [ ] Link de entrada "Lançar as parcelas em lote →" sob o banner
   `RECUSA_PARCELADO` já existente em `compra-cartao/page.tsx` (~linha
   556-560), sem herdar nenhum parâmetro da URL.
4. [ ] Campos comuns da Tela 1 (preenchidos uma vez): Favorecido (nome),
   CNPJ/CPF, Data da compra, Vencimento da 1ª fatura (campo separado da
   data da compra — é a semente do gerador de datas), Valor total, Número
   de parcelas (N) — stepper inteiro, mínimo 2, máximo 24, com mensagem de
   erro nomeada nos dois extremos ("Abaixo de 2 não é lote — lance em
   `/adicionar/compra-cartao`." / "Máximo 24 parcelas por lote.").
5. [ ] A Tela 1 NÃO tem campo "Parcelado?". Dica fixa, texto verbatim
   (ratificado pelo `contador`): *"Nenhuma parcela aqui pergunta se é
   parcelada — cada uma já nasce um evento à vista, sozinha. Vínculo com
   nota não é feito aqui: depois de criadas, ligue cada parcela em
   pré-vínculo."*
6. [ ] Banner da Tela 1, texto verbatim (pluralização ratificada pelo
   `contador`): *"Estas compras nascem sempre agendamento — o dinheiro só
   sai quando cada fatura for paga. O favorecido é o lojista, nunca o
   banco nem a administradora."*
7. [ ] Geração de valores: `dividirCentavos(total, N)` — `total ÷ N`
   truncado em centavos nas N-1 primeiras parcelas, resíduo inteiro de
   centavos somado só à ÚLTIMA parcela.
8. [ ] Geração de datas: `vencimentosSugeridos(semente, N)` — cada parcela
   `i` (i=2..N) vence no mesmo dia do mês da semente, `(i-1)` meses depois
   (cálculo direto `semente + i meses`, nunca iterativo mês a mês); quando
   o mês de destino não tiver esse dia (ex. dia 31 em abril), a data cai no
   último dia daquele mês e a tela nomeia visivelmente qual parcela foi
   ajustada (ex. etiqueta "ajustada — abril não tem dia 31").
9. [ ] Tela 2 (revisão): valor e vencimento de cada parcela editáveis
   individualmente; cabeçalho e linha de totais `sticky`; botão "Confirmar
   as N parcelas" desabilitado enquanto a soma das N parcelas ≠ valor
   total, nomeando a diferença ("Falta R$X,XX para a soma bater com o
   valor total." / "Sobra R$X,XX — a soma passou do valor total.").
10. [ ] Nenhuma parcela recebe `documento_origem_id` na criação — nasce
    sempre `null`, mesmo quando existe uma nota única cobrindo o valor
    total da compra (ADENDO 9 do parecer `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
    confirmado nesta rodada de Gate Fiscal). Vínculo com nota é feito
    depois, pela tela de pré-vínculo (`CONTAI-080`/`081`), uma parcela de
    cada vez.
11. [ ] Cada parcela é validada como evento "à vista" por construção
    (`validarCompraCartao({..., parcelado: "vista"})`) — a tela do lote
    não tem campo editável de parcelamento, porque cada linha gerada já é
    o estado-alvo prescrito pelo ADENDO 5 §I.1 (uma compra separada por
    fatura, à vista por definição daquela linha).
12. [ ] Confirmação tudo-ou-nada via RPC nova `compra_cartao_gravar_lote`,
    numa única transação do banco: ou existem as N linhas de `compromisso`
    com seus vínculos de fatura, ou nenhuma. Guardas no servidor: menos de
    2 parcelas recusa; soma das parcelas ≠ valor total recusa — ambas com
    mensagem nomeada. Verificável por E2E: um lote com uma parcela
    inválida forçada (ex. valor ≤ 0) é recusado e `compromisso` não ganha
    linha nenhuma. Sair do formulário antes de confirmar não grava nada.
13. [ ] Proteção contra reenvio/duplo clique — botão "ocupado" durante o
    envio, mesmo padrão de `compra-cartao/page.tsx`.
14. [ ] Migration `0026_compra_cartao_lote.sql`: função
    `compra_cartao_gravar_lote(p_obra_id uuid, p_favorecido_id uuid,
    p_data_compra date, p_valor_total numeric, p_parcelas jsonb) returns
    jsonb`, `language plpgsql`, `security invoker`, `set search_path =
    public, pg_temp` — família de `0009`/`0010`/`0013`. `revoke execute ...
    from public, anon; grant execute ... to authenticated;` na mesma
    migration. `documento_origem_id` NÃO é parâmetro da função (cumpre o
    critério 10 por assinatura, não por disciplina de chamador).
15. [ ] `e2e/privilegios.spec.ts` — `FUNCOES_ESPERADAS` ganha
    `compra_cartao_gravar_lote`; suíte continua verde.
16. [ ] `lib/database.types.ts` atualizado à mão com a função nova (não há
    script `gen types` no projeto — padrão já existente).
17. [ ] `lib/fiscal/parcelamento.ts` novo (+ `.test.ts`): `dividirCentavos`,
    `vencimentosSugeridos`, `validarLoteCompraCartao` — funções puras,
    testadas isoladamente (sem depender de banco).
18. [ ] Tela 3 (sucesso): lista das N parcelas confirmadas, com link "Ver a
    fatura" (ou "Confirmar o pagamento" se já vencida, regra
    `faturaVencida` já existente); banner único (não repetido por linha)
    com a ressalva do ano de pagamento, texto verbatim de
    `compra-cartao/page.tsx`; nenhuma parcela entra em custo ainda.
19. [ ] `/adicionar/compra-cartao` (tela individual, captura de uma compra
    só) permanece intocada em comportamento — a única mudança ali é o link
    novo de entrada do critério 3.

## Out of Scope
- **Fusão das N parcelas num evento fiscal único** — `RECUSA_PARCELADO`/
  ADENDO 5 não é revisitada. Mudaria o ano de custo de parcelas futuras.
- **PIX/boleto parcelado** — fora deste ticket (decisão do Mateus); dor
  equivalente para outro meio é relato novo, mesma regra de origem
  (critério 10) se estenderia sem exceção.
- **Cadência não mensal** (quinzenal, datas digitadas uma a uma) — decisão
  do Mateus de reduzir escopo agora; baixo custo de extensão futura
  (função pura de datas, sem tabela de "plano"/cadência persistida).
- **Desvio de valor por parcela além do resíduo de centavos** (juros,
  parcela "balão", valores crescentes/decrescentes) — coberto pela edição
  manual linha a linha (critério 9), não precisa de modo novo.
- **Sinalização visual "parcela X de N" na Agenda** (US2 do relato 100) —
  ticket futuro, não bloqueante; este ticket não cria conceito de
  "lote"/"série" persistido no schema.
- **Gestão de cronograma de obra / orçamento** — fora do produto
  (`CLAUDE.md`).
- **Confirmação textual extra tipo "confirmo que são parcelas desta mesma
  compra"** — avaliada e recusada pelo `contador`: regime de caixa não
  vincula custo entre linhas, e o rótulo de lote é cosmético (US2), não
  fiscal.

## Gate Fiscal (Contador)
Pareceres de origem: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
(ADENDO 5 §I.1-I.3, ADENDO 9 §M.0/M.2/M.8).

- **Se o criador em lote gerar N `Compromisso` → nenhuma das N linhas
  recebe `documento_origem_id` preenchido no ato da criação**, mesmo
  quando existe uma nota que cobriria o valor total — nasce sempre `null`,
  idêntico a uma criação manual sem contexto de nota. Vínculo é ato
  deliberado posterior, via pré-vínculo, parcela por parcela. Motivo: o
  caso real que originou este ticket (Ilhamix, CONTAI-083) é a prova de
  que herança em massa — de propósito, numa única ação — escalaria o
  mesmo erro para N parcelas de uma vez, em vez de ser acidente isolado.
- **Cada parcela gerada é validada como "à vista"**, sem campo editável de
  parcelamento na tela do lote — correção de linguagem ratificada: não é
  "a rota declara por inferência" (isso violaria a proibição de heurística
  do ADENDO 5 §I.2), é que "o campo não se aplica a uma linha que já nasce
  à vista por construção" — cada linha isolada já é o estado-alvo que o
  próprio ADENDO 5 prescreve como saída da recusa de parcelado.
- **Regime de caixa preservado**: cada parcela paga entra na
  discriminação/custo do ano em que ELA for efetivamente paga — nunca o
  ano da compra, nunca o ano de criação do lote (ADENDO 5 §I.1: "o ano do
  custo é o da fatura em que ela é paga — não o da compra", estendido ao
  terceiro candidato de data que esta feature introduz).
- **Equivalência fiscal confirmada**: o criador em lote não introduz regra
  fiscal nova — é a automação exata da instrução que o próprio ADENDO 5
  §I.1 já dá por escrito ("lance cada parcela como uma compra separada").
- Sem impacto em aferição INSS (compra de material não abate em nenhuma
  hipótese; a forma de criação do compromisso — lote ou manual — não toca
  a apuração, que depende só da declaração eSocial/EFD-Reinf da
  prestadora).
- Documentação hábil por parcela: parcela paga sem pré-vínculo segue a
  disciplina já existente ("notas hábeis sem pagamento vinculado",
  ADENDO 9 §M.6) sem exceção por ter nascido em lote.
- **Nenhum ponto exige CRC** — extensão de doutrina já fixada, nenhuma
  tese ou número de legislação nova.

## Pre-mortem
1. **Resíduo de centavos passa despercebido**: se a tela permitisse
   confirmar com soma divergente do total, o custo do ano sairia errado
   por um valor pequeno demais para notar. Mitigado pelo critério 9
   (validação em tempo real bloqueando confirmação).
2. **Ajuste de data em mês curto (fev/abr/jun/set/nov) silencioso**: só
   apareceria quando o Mateus conferisse a fatura física semanas depois.
   Mitigado pelo critério 8 (ajuste visível e nomeado por parcela).
3. **Duplo clique/F5 duplica o lote inteiro** (N compromissos vira 2N) —
   mesmo padrão de criação repetida do `CONTAI-083`, multiplicado numa
   única ação. Mitigado pelos critérios 12 (tudo-ou-nada transacional) e
   13 (proteção contra reenvio).

## Viabilidade (CTO)
- **Modelo de dados**: nenhuma tabela/coluna/enum nova. Função SQL nova
  (`compra_cartao_gravar_lote`) exige `revoke`+`grant` de função (não de
  tabela) e entrada em `FUNCOES_ESPERADAS` de `e2e/privilegios.spec.ts`
  (critérios 14-15). Sem conceito de "lote"/"série" persistido.
- **Tudo-ou-nada real**: N chamadas HTTP sequenciais client-side NÃO são
  atômicas entre si (falha na 3ª de 5 deixaria 2 gravadas, sem DELETE
  disponível — acervo append-only). Por isso a decisão é uma função
  `plpgsql` nova que itera as N parcelas numa única transação de banco,
  não N chamadas separadas de `compra_cartao_gravar`.
- **Gerador de datas/valores**: função pura nova em `lib/fiscal/parcelamento.ts`
  (não em `compromisso.ts`, 1803 linhas, nem em `fatura.ts`) — soma de
  centavos com resíduo e soma de meses por cálculo direto (não iterativo,
  para não "escorregar" o dia em meses curtos).
- **Limite de N: 2 a 24**, só validado no formulário (não no SQL) — cobre
  até 24x (teto comum de parcelamento de material), UX de lista editável;
  mínimo e soma==total são regra e ficam nos dois lados.
- **Arquivos**: `supabase/migrations/0026_compra_cartao_lote.sql` (novo),
  `e2e/privilegios.spec.ts`, `lib/database.types.ts`,
  `lib/fiscal/parcelamento.ts` + `.test.ts` (novos), `lib/data.ts`
  (`criarCompraCartaoEmLote`), `app/(captura)/adicionar/compra-cartao/parcelas/page.tsx`
  (novo), `app/(captura)/adicionar/compra-cartao/page.tsx` (link, ~5
  linhas), `e2e/cartao-lote.spec.ts` (novo, inclui cenário de falha
  forçada provando zero linhas gravadas), `design/mocks/CONTAI-084.md`.
- **Complexidade: M**.
- **Dívidas**: idempotência do lote hoje só por `fase === "salvando"`
  (mesmo padrão da tela atual) — chave de idempotência no servidor fica
  para território da US2 (sinalização de lote), não bloqueia. Lote
  PIX/boleto é ticket próprio — `decidirRegistro` entraria em jogo lá
  (parcela com data passada viraria pagamento), gate diferente deste.
  `lib/database.types.ts` mantido à mão, dívida preexistente ao projeto.

## Dependências
Bloqueado por / Bloqueia: nenhum. Reaproveita sem modificar:
`compra_cartao_gravar` (CONTAI-022), pré-vínculo (CONTAI-080/081),
desfazer origem (CONTAI-083) — nenhum desses é tocado por este ticket.

## Perguntas Abertas
Nenhuma — as 3 perguntas do relato (meio, resíduo, cadência) já foram
respondidas pelo Mateus antes deste ticket ser escrito; as 2 checagens de
texto fiscal do `designer` já foram ratificadas pelo `contador`.

## Cenário e checagem final
**Gestão** (em casa, sentado — é onde compras parceladas grandes, como a
do concreto, são lançadas). "Teste do Canteiro" não se aplica — densidade
de até 24 linhas editáveis é aceitável, contanto que
`/adicionar/compra-cartao` (captura individual) continue intocada
(critério 19). Serve à meta 1 (nenhum pagamento sem documento hábil,
reduzindo a fricção que abriu a janela para o `CONTAI-083`). Varredura de
condição fiscal órfã: todas as condições fiscais deste ticket citam o
parecer de origem no mesmo trecho (ADENDO 5 ou ADENDO 9). Sem UI que
quebre disciplina de campo fiscal — nenhum campo fiscal nasce preenchido,
e a ausência do campo "Parcelado?" foi justificada, não ignorada.
**Veredito: APROVADO.** Pronto para `/develop`.
