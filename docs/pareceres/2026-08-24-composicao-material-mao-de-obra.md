# Parecer fiscal — repartição do custo do ano entre material e mão de obra

- **Data**: 2026-08-24
- **Autor**: agente `contador` (autoridade fiscal do projeto), execução read-only
  sobre `lib/fiscal/vinculo.ts` e `lib/fiscal/revisao.ts`
- **Origem**: Gate 1 do `/develop` do `CONTAI-036` — o `lead-engineer` derivou
  todas as lacunas do **Bloco A** de
  `2026-08-16-gate-fiscal-contai-004-005.md` §2 **menos uma**: a cláusula
  *"sendo R$ [materiais] em materiais e R$ [mão de obra] em mão de obra e
  serviços"*. Não havia regra ratificada para ela.
- **Status**: **regra fiscal do projeto**. Deixa de ser decisão de implementação.
- **Normativo para**: `lib/fiscal/vinculo.ts`, `lib/fiscal/revisao.ts`
  (`composicaoDaDiscriminacao`) e o `CONTAI-036`.
- **Veredicto**: regra ratificada (§1); cláusula supressível isoladamente (§3);
  documento hábil sem classificação **suspende** a cláusula (§4).

> Transcrição do parecer do agente `contador`. As marcações `[Certain]` /
> `[Likely]` / `[Guessing]` são dele. Nada aqui substitui contador humano (CRC)
> na assinatura da declaração.

---

## 0. Achado que vem antes da regra — defeito vivo, não hipótese

`composicaoDaDiscriminacao` (`lib/fiscal/revisao.ts`) pondera material × mão de
obra por **`cobertoCentavos`**. E `cobertoCentavos` é distribuído, em
`alocarCusto`, por **ordem de `id`** — que o próprio código declara, em
comentário, *"sem efeito fiscal nenhum — ordem estável por id só para a tela não
dançar"*.

Num componente conexo **subcoberto** (Σ pagamentos elegíveis < Σ documentos
hábeis) essa ordem **decide, por id, se o que está coberto é a nota de material
ou a de serviço**. `[Certain]` Ou seja: um número fiscal está hoje apoiado numa
ordenação que o código afirma ser fiscalmente irrelevante — e a contradição já
está **em tela**, na correção do `CONTAI-021`, sem recorte de ano.

Não é generalização inofensiva esperando o relatório anual existir. É defeito
vivo, e a regra do §1 o corrige na raiz: **o peso nunca é o coberto; é o valor
integral do documento hábil.**

---

## 1. A regra

> O custo comprovado de cada pagamento (`comprovadoCentavos`) é repartido entre
> **material** e **mão de obra e serviços** **pro rata pelo valor dos documentos
> HÁBEIS do componente conexo a que o pagamento pertence** — pelos **valores
> integrais** desses documentos, **nunca** por `cobertoCentavos`.
>
> A composição do ano-calendário é a soma dessas parcelas sobre os pagamentos
> cuja `data_pagamento` cai no ano (regime de caixa, art. 17 da IN SRF
> 84/2001).

**Aplicação em componente subcoberto** (a dúvida que o `lead-engineer` levantou,
e a resposta é sim): o **denominador** é a soma dos valores integrais de **todos**
os documentos hábeis do componente; o **numerador** de cada balde é a soma dos
integrais dos hábeis **daquela classificação**. A proporção é a do **conjunto de
notas**, e o `comprovadoCentavos` de cada pagamento se reparte nessa proporção.
**Não** existe repartição limitada ao que cada nota tem de coberto — isso seria
`cobertoCentavos` de volta, que é exatamente o que o §0 proíbe. `[Certain]`

**Consequência aritmética**: dentro de um componente, a proporção é **uniforme
entre todos os pagamentos**. Dois pagamentos do mesmo conjunto conexo têm a
mesma composição percentual, ainda que caiam em anos diferentes.

## 2. Fundamento

1. **Os dois eixos são distintos.** `[Certain]` O regime de caixa fixa **o ano**
   pela data do pagamento — e só isso. Material × mão de obra é atributo do
   **documento**, não do pagamento. A cláusula pede o cruzamento dos dois, e
   nenhuma regra anterior o havia definido.
2. **No caso normal a regra é exata, não convencional.** `[Certain]` Componente
   **homogêneo** (fornecedor de material de um lado, empreiteiro do outro) ou
   componente **totalmente coberto** → o resultado é o número verdadeiro. A
   convenção só age no cruzamento genuinamente emaranhado: componente que junta
   nota de material e nota de serviço **e** está subcoberto ou cruza anos.
3. **Não é o pro-rata recusado no ADENDO de 18/08** de
   `2026-08-17-vinculo-pagamento-documento.md`. `[Certain]` Aquele movia custo
   **entre anos**, e foi recusado por contradizer DAA já entregue. Este **nunca
   toca o total do ano**: `custoComprovadoDoAno` permanece intocado, e a
   repartição entre pagamentos permanece **cronológica**. Eixos diferentes,
   objeções diferentes.
4. **A objeção da imutabilidade não se sustenta neste eixo.** `[Likely,
   confiança alta]` Registrar a nota que chega meses depois do PIX — o caso mais
   frequente do projeto (Relato 002, D6) — **já move o total** de um ano
   anterior, pela própria regra cronológica. A composição não pode ser exigida
   mais imutável que o total que ela reparte.

### 2.1. A alternativa recusada, e o porquê

**Recusada**: *"repartir pela classificação dos documentos ligados a cada
pagamento"* (`pagamento.documentoIds`).

Motivo: **não é função total.** `[Certain]` Num componente N:M, a repartição
cronológica do custo comprovado pode atribuir `comprovadoCentavos > 0` a um
pagamento ligado **somente a documento não hábil** (boleto, nota em quarentena)
— e aí a alternativa não tem resposta nenhuma a dar. Regra fiscal com buraco é
pior que convenção neutra: o buraco reaparece como default silencioso no dia em
que o caso acontecer.

## 3. `X + Y ≡ total do ano` — exigência não negociável

A palavra **"sendo"**, no Bloco A, **afirma uma partição**. Se os dois
sub-valores não somam exatamente o total declarado na mesma frase, o texto se
contradiz no corpo da DAA, à vista de quem o ler. `[Certain]`

- Arredondamento por **maior resto**.
- Resíduo fixo em **"mão de obra e serviços"**. `[Certain]` que a regra precisa
  ser fixa e determinística; `[Certain]` que o centavo em si é fiscalmente
  irrelevante. Regra fixa existe para o número não dançar entre dois
  carregamentos, não porque um balde mereça o centavo.
- O arredondamento só é exercido no caso de **dois baldes**: havendo parcela sem
  classificação, a cláusula inteira é suprimida (§4).

## 4. Documento hábil sem classificação — suspende a cláusula

Havendo, no recorte do ano, **qualquer parcela** de custo comprovado vinda de
documento hábil com `classificacao === null`, a cláusula *"sendo R$ X em
materiais e R$ Y em mão de obra e serviços"* **não é gerada**. `[Certain]`

As duas alternativas são piores:
- **`X + Y ≠ total`** publica uma partição falsa num campo da declaração;
- **jogar o não classificado num dos baldes** é **default em campo fiscal**,
  proibido pela disciplina do projeto — *campo vazio pergunta, campo preenchido
  afirma*. O app não sabe se aquela nota é material ou serviço, e fingir que
  sabe é a D46 com outro nome.

E aqui o conserto é barato e está no produto: a tela de correção do
`CONTAI-021` classifica.

### 4.1. O gatilho, no recorte do ano

O gatilho é a **parcela sem classificação computada no recorte do ano** — isto
é, o balde `semClassificacaoCentavos` calculado **sobre a composição do ano**,
maior que zero.

Sob a regra do §1 as duas formulações que o `lead-engineer` distinguiu
**coincidem por construção** `[Certain]`, e é por isso que a distinção some: a
proporção do componente é **uniforme entre seus pagamentos**, então basta que um
componente **contribua com custo comprovado no ano** e tenha documento hábil sem
classificação para que a parcela não classificada apareça naquele ano. Não há
como a massa não classificada "ficar em outro ano" dentro do mesmo componente.

O que **não** suspende: componente cuja contribuição de custo comprovado ao ano
em tela é **zero** (todos os seus pagamentos caem em outros anos), ainda que
tenha documento hábil sem classificação. `[Certain]` Ele não toca o número deste
ano; suspender por causa dele seria alarme sem consequência.

**O teste correto afirma sobre a parcela computada do ano**, não sobre a
existência do documento — as duas coincidem hoje, e a parcela é a que continua
correta se a regra do §1 for um dia emendada.

## 5. A supressão é isolada — o Bloco A sai

A ausência da cláusula **não contamina o Bloco A**. `[Certain]` A frase
remanescente — *"Dispêndios pagos no ano-calendário de [ano]: R$ [total]."* — é
verdadeira e completa sozinha.

Dois esclarecimentos sobre pareceres anteriores, porque os dois seriam mal
aplicados aqui:

- A **prioridade do §5** de `2026-08-16-gate-fiscal-contai-004-005.md`
  (*composição do ano e material/mão de obra > CNO > matrícula > enumeração de
  notas*) governa **corte por limite de caracteres**, e pressupõe a composição
  **conhecida**. Ela ordena o que sacrificar, não autoriza **fabricar** o que
  falta.
- A lógica da **direção do erro** (§2.2 de
  `2026-08-23-anexo-no-desembolso-do-terreno.md`: *"não gerar é o erro que não
  se recupera"*) vale para o **total** — custo não discriminado não existe na
  venda. Não vale para uma repartição **descritiva** que se completa em minutos,
  enquanto a declaração ainda está sendo preenchida.

## 6. Texto de tela — literal, FORA do bloco copiável

Quando a cláusula for suprimida (§4), a ausência é **nomeada**, nunca omitida em
silêncio nem preenchida com placeholder. O texto vai **fora do bloco copiável**,
junto da linha do §4.5:

```
A composição entre materiais e mão de obra não foi gerada: {N} nota(s) que
compõem o total de {ano} ainda não estão classificadas. O total acima está
completo — falta só a repartição dele. Classifique essas notas e a frase entra
no texto. O app não escolhe essa classificação no seu lugar.
```

Sem *"seu custo"*, *"você pagou"*, *"seu ganho"* — a condição única do Gate
Fiscal do `CONTAI-036` (§1) é respeitada: o bloco se rotula pelo bem e pela
obra, e este texto não afirma posse.

## 7. Automático × humano

- **Sistema sozinho**: a repartição do §1; a exigência `X + Y ≡ total` do §3; a
  suspensão e o texto do §4/§6; a correção do defeito do §0.
- **Exige CRC**: o texto da discriminação que vai assinado à declaração
  (permanece insumo, nunca declaração pronta); e o efeito de **classificar uma
  nota depois** de o ano já ter sido declarado — pode virar **retificadora**, e
  isso é do contador humano, não do app.
