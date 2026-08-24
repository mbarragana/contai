# CONTAI-036 — Fatia 2 do CONTAI-025: a linha do §4.5 nas saídas anuais

## Roteamento do `/develop`
- **Tipo**: feature — **P0**. Não nasce de relato: nasce da **fatia** que o `po`
  desenhou no Gate 4 do `CONTAI-025` e do **critério 16**, que trava hoje
  **qualquer** saída anual havendo desembolso pago-sem-comprovante. *"Com a
  fatia 1 em produção, a meta 2 do produto está fechada por uma trava minha.
  Este ticket é o pagamento dela — não uma melhoria."* (`po`)
- **UI**: **SIM** — tela nova, *"Discriminação de {ano} — antes de declarar"`.
  ⛔ **Gate 0 parcialmente satisfeito**: a **tela 4** do mock `CONTAI-025` v2
  (aprovado 23/08) já cobre o essencial atrás de um seletor de fatia
  (`design/mocks/CONTAI-025.md:71-72`). **Falta aprovação de uma frase alterada**
  (o aviso vira incondicional — ver critério 6) antes do `/develop`
- **Gate Fiscal**: **SIM, e FECHADO** — corpo + **ADENDO 2** de
  `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`
- **Migration**: **NENHUMA**
- ⚠️ **Correção de escopo, achada pelo `cto-obra`**: este ticket não é "acrescentar
  uma linha" — **não existe relatório anual em tela nenhuma hoje**. É a
  **primeira saída anual do produto nascendo**

## Tipo e Prioridade
feature — P0 — critério 17 do `CONTAI-025`, mais o pagamento da dívida do
critério 16.

## Dor de Origem

Não nasce de relato do Mateus. Nasce de uma dívida que o próprio pipeline criou
ontem: a fatia 1 do `CONTAI-025` tirou o custo não comprovado da soma e deu
superfície à pendência — criando um número que **nenhuma saída anual menciona**,
porque **nenhuma saída anual existe**. Para o número não sair mudo quando a
saída existir, foi instalada uma guarda real (`podeGerarRelatorioAnual`) que
hoje **veta qualquer saída anual** com desembolso pago-sem-comprovante na base.

O `cto-obra` mediu: `find app -name page.tsx` não tem rota nenhuma de relatório
anual; o critério 20 do `CONTAI-010` está `[ ]`; e a própria blindagem de
`terreno.test.ts` **prova a ausência** — só `compromisso.ts` casa com os
radicais fiscais.

## User Story

> **Como** dono da obra, **em casa e sentado**, revisando antes de preencher a
> declaração, **quando** abro a discriminação do ano, **quero** ver o total
> confirmado e, logo abaixo e **fora do que eu copio**, quanto ficou de fora por
> falta de comprovante, **para** decidir com o contador o que declarar — em vez
> de o app decidir por mim em silêncio, para cima ou para baixo (§2.1, §2.4).

## Critérios de Aceite

1. [ ] Tela nova *"Discriminação de {ano} — antes de declarar"* — **tela 4 do
       mock `CONTAI-025` v2** (Gate 0 parcialmente satisfeito; falta aprovar o
       critério 6). Cenário **gestão**, 375px como piso
2. [ ] **Nasce chamando a porta única `podeGerarRelatorioAnual`**
       (`lib/fiscal/compromisso.ts`) — nunca `bloqueioDaSaidaAnual` direto, nunca
       verificação própria. *"Dois portões que não se conhecem é como a D47
       nasceu."*
3. [ ] Bloco copiável = **Bloco A literal**
       (`docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md` §2 + emenda
       `2026-08-17-terreno-financiado.md` §4). **Bloco B não é gerado**
       (`numero`/`data_emissao` só existem se o `CONTAI-004` estiver entregue) —
       a ausência é **nomeada em tela**, nunca placeholder vazio
4. [ ] **A linha do §4.5, literal, FORA do bloco copiável e imediatamente
       abaixo dele** (decisão de design 5 do mock). Constante em
       `lib/fiscal/terreno.ts`, com teste de string:
       > *"Fora do custo confirmado por falta de comprovante: R$ 0.000,00. Foi
       > pago e está registrado, mas ainda não tem o papel que o demonstra, e
       > por isso não entra na soma acima. Decida com seu contador antes de
       > declarar: deixar de discriminar na declaração um custo real também
       > custa caro — o custo que não é discriminado não existe na venda."*
5. [ ] **A segunda metade do §4.5 vai junto** — `FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO`,
       criada na fatia 1 **com teste de que nenhuma tela da fatia 1 a usa**. É
       aqui, e só aqui, que ela entra. Teste afirma a **string inteira**, as
       três constantes na ordem certa
6. [ ] ⚠️ **Muda o mock aprovado**: o banner *"Revise antes de copiar"* deixa de
       ser condicional (hoje só aparece havendo lançamento fora da soma) e passa
       a ser **incondicional**, sempre **acima** do bloco:
       > *"Revise antes de copiar. Este texto é insumo para a sua conferência
       > com o profissional com CRC — não é a sua declaração pronta."*
       *(havendo lançamento fora: acrescenta `— N lançamentos ficaram de fora
       da soma.`)* — critério 19 do `CONTAI-010` chegando à tela. **Não afirma
       fato sobre matrícula, cônjuge ou quem paga** — não é a linha da
       titularidade voltando por outro nome
7. [ ] **Nunca um número só** (§2.4): total confirmado e, em linha nomeada, o
       pago-sem-comprovante — valor, contagem, link para a lista
8. [ ] **A destravagem não é `delete` — é obrigação tipada, e o veto é POR
       SAÍDA, não único.** `podeGerarRelatorioAnual` continua sendo **porta
       única no mecanismo**, mas devolve um payload com **três blocos
       independentes**, cada um com brand distinto:
       `{ bensEDireitos, pagamentosEfetuados, afericaoInss }`. **Só o bloco
       `bensEDireitos` carrega o termo do terreno** — Pagamentos Efetuados e
       aferição INSS **não são vetados** por pendência de terreno, porque ela
       não tem CPF a listar nem base de retenção a reduzir. *"Vetar as três é o
       defeito que este próprio parecer já nomeou noutra tela: aviso sem
       consequência ensina a ignorar aviso."* (`contador`)
       O gerador de cada saída **exige o brand do seu bloco** — consumir o
       bloco errado não compila. `bloqueioDaSaidaAnual`/
       `motivoDoBloqueioDaSaidaAnual` e o banner vermelho da fatia 1 saem
       juntos, substituídos pelo payload
9. [ ] **O portão do compromisso (crit. 21 do `CONTAI-019`) continua
       transversal aos três blocos** — vencido sem resposta pode virar
       pagamento a PF (Pagamentos Efetuados) ou serviço PJ (aferição), então
       não migra só para `bensEDireitos`. Teste afirmando o veto nos três
       blocos depois da mudança
10. [ ] **Residual 1 — o `[]` fecha por TIPO.** Hoje
       `podeGerarRelatorioAnual(cs, hoje, ano, [])` typecheca e devolve
       `ok:true`. O 4º parâmetro passa a exigir tipo opaco que **só a camada de
       dados produz**. Teste: literal `[]` **não typecheca**
       (`@ts-expect-error`)
11. [ ] **Residual 2 — a blindagem varre por SÍMBOLO, não por arquivo.** Hoje
        um arquivo que mencione a porta passa mesmo ganhando gerador que não a
        chame — *"hoje é teórico, e deixa de ser no dia em que a tela do
        relatório existir: é este ticket."* Cada declaração casada trata o
        retorno da porta; fixture negativa (arquivo com um chamador e um
        não-chamador **reprova**)
12. [ ] **Blindagem intacta como porta única**: um nome só na regex
        `NA_PORTA`, radicais como estão, porta composta em `lib/dados`
        carregando tudo numa passada — **não** três varreduras, três
        carregadores. *"É a extensão natural do item 1a de hoje, não um
        redesenho."* (`cto-obra`)
13. [ ] E2E contra o Postgres local: (a) com pago-sem-comprovante → bloco sai,
        linha §4.5 com o valor certo, valor **não** está no total; (b) sem
        nenhum → linha **não** aparece, total bate com o painel; (c) com
        compromisso vencido → a saída **não** sai (nos três blocos); (d) gerar
        Pagamentos Efetuados **com** terreno pago-sem-comprovante na base →
        **não** veta (prova do critério 8)
14. [ ] **Sem migration, sem `GRANT`** — só leitura. `privilegios.spec.ts`
        intacto

## Out of Scope

- **Bloco B (identificação das notas)** — depende do `CONTAI-004`; a ausência é
  nomeada, não suprida
- **A linha da titularidade / rateio por pagador** — **D53**, ticket próprio.
  **Não volta como condicional.** O valor cheio é número verdadeiro; o app é
  monodeclarante desde a `0001`, e travar por isso trocaria a D49 de lugar
- **Telas de geração de Pagamentos Efetuados e da aferição INSS** — só os
  **portões** delas nascem aqui (critério 8); as telas são tickets próprios
- **Editar o texto da discriminação em tela** — o app gera, o Mateus copia
- **Pacote do `CONTAI-011`** e **ordenação fiscal da lista de pendências**

## Gate Fiscal (Contador)

**Parecer normativo**: `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`
(§2.1, §2.4, §4.5, §4.6; **ADENDO 1 vence o corpo**; **ADENDO 2** de 24/08).

### 1. Titularidade — valor cheio SEM a linha é ACEITÁVEL

O número é **verdadeiro** — o que saiu pelo bem inteiro. Errado seria o
**rótulo** (*"seu custo"*), não a ausência da linha.

1. **A afirmação implícita não nasce aqui**: o app é monodeclarante desde a
   `0001`. Travar por isso travaria toda tela do produto
2. **A linha removida afirmava MAIS, não menos** — *"a matrícula está em dois
   nomes"* é fato que ninguém cadastrou. É a **D46 na forma pura**
3. **A direção do erro é a segura** (§2.2): discriminação que superestima é
   pega pelo CRC no ato de declarar; **não gerar é o erro que não se
   recupera**

**Condição única**: nenhum texto pode acoplar posse ao total — proibidos *"seu
custo"*, *"você pagou"*, *"seu ganho"*. O bloco se rotula pelo **bem e pela
obra**.

### 2. A guarda é POR SAÍDA — correção que muda a arquitetura de ontem

`podeGerarRelatorioAnual` **continua porta única no mecanismo**, mas o veto
deixa de ser um booleano só. Reconciliado entre `contador` e `cto-obra`:

> *"A porta é única; o veto é por saída."*

`terreno.bloqueada` fica **só** no bloco `bensEDireitos` — desembolso de
terreno não é pagamento a PF prestador de serviço nem NF de serviço PJ sujeita
a retenção. Vetar Pagamentos Efetuados ou aferição INSS por causa dele seria o
mesmo defeito da guarda anterior: **aviso sem consequência**.

O portão do **compromisso vencido** (crit. 21) é diferente: **continua
transversal** aos três blocos, porque a incerteza dele pode virar qualquer um
dos três tipos de saída.

### 3. A linha do §4.5 — literal, fora do bloco (ver critério 4)

**Fora do bloco copiável, imediatamente abaixo** — dentro é texto de
declaração; o §4.5 é orientação. *"Logo abaixo do total"* atendido: o total é
a última linha do bloco.

### 4. `FORA_DO_CUSTO_CONFIRMADO_DECIDA_NO_RELATORIO` — é aqui que entra

A linha se compõe de três constantes de `lib/fiscal/terreno.ts`, nesta ordem:
`FORA_DO_CUSTO_CONFIRMADO` + valor · `_PORQUE` · `_DECIDA_NO_RELATORIO`. A
terceira é a **metade não automática do §2.1** — o handoff ao CRC — e colar só
as duas primeiras dropa o handoff em silêncio.

### O que o ticket NÃO pode atribuir ao parecer

- que o app **suprima** um custo pago e real (§2.1 — a escolha é do Mateus com
  o CRC)
- **qualquer percentual de rateio**, ou afirmação sobre matrícula, regime de
  bens ou quem declara (§3.4 ⛔ · §4.6 · D53)
- que a saída anual seja a DAA: é **insumo** (critério 6 obriga a tela a dizer
  isso)

## Pre-mortem

1. **Destravar por `delete`.** Alguém apaga a guarda e escreve a tela; a linha
   do §4.5 vira uma `<div>` que o próximo refactor remove sem nada ficar
   vermelho. Por isso a obrigação mora no **retorno tipado da porta**, não na
   boa vontade de quem escreve JSX
2. **Bloco A sair com cara de completo.** O Bloco B falta por o campo não
   existir no banco — ausência não nomeada entrega texto de declaração
   incompleto parecendo pronto
3. **A guarda por saída vazar de volta para o booleano único** na próxima
   pressa — alguém "simplifica" e volta a vetar as três. O critério 9 (teste
   dos três blocos) é o antídoto

## Viabilidade (CTO)

- **Modelo de dados**: nenhum impacto. Textos do §4.5 já estão em `terreno.ts`;
  total e motivo já saem de `bloqueioDaSaidaAnual`. Zero migration
- **A blindagem por arquivo não basta** quando o arquivo da tela existir —
  substituída por **proteção de tipo**: o payload de `ok:true` carrega dados
  marcados (brand) por bloco; gerador que não passar pela porta **não tem o
  dado para renderizar**. Compilador roda em todo build — verificador que
  sempre roda
- **Porta composta em `lib/dados/saida-anual.ts`** (novo): busca compromissos +
  desembolsos e chama a porta pura; a tela passa `obraId`, nunca monta
  argumentos
- **Arquivos**: `lib/fiscal/compromisso.ts` (a porta: payload por bloco, `[]`
  fecha por tipo), `lib/fiscal/terreno.ts` (helper da linha, constantes
  prontas), `lib/dados/saida-anual.ts` (novo), rota nova da tela do relatório,
  `terreno.test.ts` (edição **consciente** da blindagem — cláusula nova: `app/`
  importa só a porta composta, nunca a pura), `compromisso.test.ts`
- **Complexidade: M**
- **Uma entrega, no mesmo diff**: destravar sem consumidor é remover a guarda
  antes de existir o guardado — a gênese da D47. *"O risco de manter separado é
  entregar constantes e porta destravada com a primeira saída real nascendo
  meses depois, fora da vigilância deste gate."*

## Dependências

- **Bloqueado por**: aprovação da alteração do critério 6 no mock
  (`design/mocks/CONTAI-025.html`, s4) — troca de uma frase, não nova rodada de
  `/design`
- **Bloqueia**: `CONTAI-004` (Bloco B completo) e `CONTAI-011` (pacote do
  dossiê) herdam a porta; nenhum dos dois é bloqueado por este ticket em si

## Perguntas Abertas

- Nenhuma que segure o `/develop`

## Cenário e checagem final

**Gestão** — revisão antes de declarar, em casa, sentado. **Teste do Canteiro
não se aplica.** Serve à **meta 2** de forma direta: é o primeiro relatório
anual do produto, e paga a dívida que a fatia 1 abriu de propósito.

**Veredito: APROVADO, P0.** Condicionado à aprovação da frase alterada no mock.
