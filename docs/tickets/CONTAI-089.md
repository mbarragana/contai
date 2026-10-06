# CONTAI-089 Herdar texto (não vínculo) no criador em lote de parcelas

## Tipo e Prioridade
feature — **P2 (conveniência)** — não bloqueia: o fluxo funciona hoje com
preenchimento manual; vira story por fricção repetida de digitação.

## Dor de Origem
Relato: `docs/backlog/104-2026-10-05-herdar-texto-nao-vinculo-lote-parcelas.md`.

> "eu fui na nota e cliquei em adicionar pagamento e depois cartao e depois
> definir parcelas" — esperando chegar com favorecido, CNPJ/CPF e valor
> total já preenchidos, e não chegou.

Caminho real: documento → "Adicionar pagamento" → "Cartão" → "Definir
parcelas". O link "Lançar as parcelas em lote →" (sob o banner
`RECUSA_PARCELADO`, critério 3 do CONTAI-084) larga o contexto da nota no
caminho por desenho, e o Mateus redigitou o que já tinha informado na tela
anterior.

## User Story
Como dono da obra, sentado em casa, quando eu chegar na Tela 1 de
`/adicionar/compra-cartao/parcelas` a partir de uma nota já identificada,
quero que Favorecido (nome), CNPJ/CPF e Valor total venham pré-preenchidos
a partir dessa nota — continuando livre para editar qualquer um dos três
—, para não redigitar o que já informei na tela anterior, sem que isso
signifique vincular nenhuma das parcelas geradas a essa nota.

## Critérios de Aceite
1. [ ] Favorecido (nome), CNPJ/CPF e Valor total aparecem preenchidos na
   Tela 1 quando a navegação vem de uma nota (documento → "Adicionar
   pagamento" → "Cartão" → "Definir parcelas") — mesmos três campos que
   `/adicionar/compra-cartao?documento=<id>` já pré-preenche hoje
   (CONTAI-064/071).
2. [ ] Os três campos herdados continuam editáveis livremente — nenhum
   fica travado/read-only por ter vindo de uma nota; é o valor editado
   (se houver) que segue para a geração das parcelas.
3. [ ] "Data da compra" e "Vencimento da 1ª fatura" permanecem vazios,
   sem herdar nenhum valor da nota — decisão do Mateus, 2026-10-06.
4. [ ] Sem contexto de documento (fluxo atual, direto do banner
   `RECUSA_PARCELADO`), a Tela 1 se comporta exatamente como hoje — três
   campos vazios, nada herdado.
5. [ ] Verificável no banco: um lote gerado a partir de uma Tela 1 com
   contexto herdado grava as N linhas de `compromisso` com
   `documento_origem_id = null` em todas, sem exceção — reforça, não
   reabre, o critério 2/10 do CONTAI-084 (ADENDO 9 do parecer
   `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`).
6. [ ] O mecanismo que carrega o contexto na Tela 1 é tecnicamente
   distinto de qualquer leitura usada para gravar vínculo — carregar
   texto para pré-preenchimento e ler para vincular não podem ser a
   mesma função nem o mesmo parâmetro repassado adiante sem filtro.
7. [ ] A rota `/adicionar/compra-cartao/parcelas` **não recebe nem lê
   nenhum id de documento**: o link de entrada carrega só texto
   (`favorecidoNome`, `favorecidoDocumento`, `valorTotal`), e
   `parcelas/page.tsx` não importa `carregarDocumento`, não chama
   `sugerirValorDaNota` nem referencia `documentoOrigemId`/
   `documento_origem_id` fora de comentário — verificável por `grep`.
8. [ ] A única leitura de query string em `/parcelas` é `lerTextoHerdado`
   (`texto-herdado.ts`), cujo retorno é `{nome, documento, valor}: string`,
   consumido exclusivamente como valor inicial de `useState`;
   `montarQueryTextoHerdado` é chamada só em `compra-cartao/page.tsx`.
   Nenhuma das duas funções é importada por `lib/`.
9. [ ] O link "Lançar as parcelas em lote →" só é oferecido depois que
   nome, CNPJ/CPF e a sugestão de valor da nota terminaram de carregar
   (`sugerirValorDaNota` resolvida, com valor ou `null`) — até então
   mostra "Carregando a nota…". **O valor herdado é o saldo descoberto
   da nota (o estado `valor`, já calculado por `sugerirValorDaNota`),
   nunca `valorCentavos` de face** — repetir o valor cheio de uma nota
   com pagamento parcial dobraria o custo, a única direção de erro com
   passivo tributário. Nota sem saldo sugerível (`sugerirValorDaNota`
   devolve `null`) chega com "Valor total" vazio, perguntando — não
   trava o link nem o fluxo.
10. [ ] Só o primeiro lote da rodada herda o texto (`herdarDaUrl`);
    "Lançar outro lote" e a fase de sucesso (`router.replace` limpando a
    query) não reaproveitam a herança de uma rodada anterior.
11. [ ] O teste E2E "o link ... NÃO carrega a nota da URL" é reescrito
    para afirmar que a URL de destino não contém o **id** do documento e
    contém os três textos; novo teste grava um lote herdado por texto e
    confere `documento_origem_id = null` nas N linhas.

## Out of Scope
- **Qualquer forma de vínculo/origem automático nas N parcelas** — a
  recusa do CONTAI-084/ADENDO 9 está intocada.
- **Mudar o comportamento de `/adicionar/compra-cartao`** (tela
  individual) — já funciona (CONTAI-064/071).
- **Fundir as N parcelas num evento fiscal único** — fora de escopo
  desde o CONTAI-084 (`RECUSA_PARCELADO`).
- **Herdar "Data da compra" ou "Vencimento da 1ª fatura"** — decisão do
  Mateus (critério 3): ficam manuais.

## Gate Fiscal (Contador)
Ratificado nesta rodada — **NÃO reabre** o ADENDO 9, e é **NEUTRO** quanto
a regime de caixa.

- Herdar TEXTO (favorecido/CNPJ/valor) não lê, não grava e não referencia
  `documento_origem_id` nem `compromisso_documento_previsto` — por
  definição dos critérios 2/10 do CONTAI-084, que este ticket reforça,
  nunca toca. A proveniência do dado (teclado vs. herança) não é fato
  que o sistema tribute: é o mesmo dado que o Mateus digitaria olhando a
  mesma nota. A doutrina de "campo preenchido afirma" (ADENDO 7 §K.3) é
  sobre *vínculo*, não sobre *dígitos repetidos*.
- Valor total herdado: neutro. Compromisso é custo zero até virar
  pagamento executado (§1 do parecer `2026-08-18-compromisso-versus-pagamento.md`)
  — a fonte do número (digitado ou herdado) não altera quando cada uma
  das N parcelas se torna custo, decidido parcela a parcela pela data em
  que ela for efetivamente paga.
- **Ponto de atenção não-bloqueante**: se a tela de confirmação de
  pagamento usa correspondência textual de favorecido/CNPJ pra sugerir
  notas candidatas, herdar o texto pode aumentar a chance dessa sugestão
  "achar" uma nota — não é risco novo (o Mateus digitando manualmente
  teria o mesmo efeito).
- Nada aqui exige CRC — extensão de conveniência de digitação sobre texto,
  dentro do arcabouço já fixado.

## Pre-mortem
1. **Vazamento de vínculo**: o mecanismo que carrega favorecido/CNPJ/valor
   reaproveita, por economia de código, a mesma leitura que alimentaria
   vínculo, ou repassa o id do documento sem filtro até
   `compra_cartao_gravar_lote` — reabrindo o padrão do CONTAI-083
   (Ilhamix), agora para N parcelas herdadas de uma vez. Mitigado pelo
   critério 5 (verificação direta no banco) e pelo desenho da Viabilidade
   (a rota nunca recebe id de documento — a garantia vira estrutural, não
   só disciplina de código).
2. **Regressão do caminho sem nota de origem**: a lógica condicional de
   herança passa a exigir contexto, quebrando quando ausente. Mitigado
   pelo critério 4.
3. **Campo travado por excesso de cautela**: pra "blindar" contra vínculo
   acidental, a implementação trava os três campos herdados como
   read-only, confundindo herança de texto com vínculo fiscal. Mitigado
   pelo critério 2.

## Viabilidade (CTO)
- **Mecanismo**: a URL carrega o **TEXTO**, não o id do documento. O link
  sob `RECUSA_PARCELADO` monta
  `/adicionar/compra-cartao/parcelas?favorecidoNome=…&favorecidoDocumento=…&valorTotal=…`
  a partir do **estado atual** do formulário de `compra-cartao` (`nome`,
  `documento`, `valor`). A rota `/parcelas` nunca recebe um id de
  documento — não há id para vazar; "herdar texto, não vínculo" vira fato
  do transporte, não só disciplina do chamador. Rejeitado:
  `sessionStorage`/contexto React (estado invisível, F5 muda
  comportamento sem a URL dizer por quê).
- **Módulo puro novo** `app/(captura)/adicionar/compra-cartao/texto-herdado.ts`:
  `montarQueryTextoHerdado({nome, documento, valor})` (usado só em
  `compra-cartao/page.tsx`) e `lerTextoHerdado(params)` (usado só nos
  `useState` iniciais de `LancarParcelasEmLote`). Vitest de ida-e-volta.
- `parcelas/page.tsx` ganha `Suspense` (exigência do `useSearchParams` no
  Next 16) e `herdarDaUrl={rodada === 0}` — mesmo padrão do CONTAI-071.
  `router.replace` ao entrar em "sucesso", pra F5 não ressuscitar o texto.
- `compra-cartao/page.tsx`: enquanto a nota ainda carrega
  (`!notaPronta`), o link não aparece — mostra "Carregando a nota…".
- Campos lidos: `Documento.favorecidoNome`, `Documento.favorecidoDocumento`
  (`lib/types.ts`), e o estado `valor` (saldo de `sugerirValorDaNota`,
  `app/_components/nota-de-origem.tsx`) — não `Documento.valorCentavos`
  (ver critério 9).
- **Garantia estrutural (critério 5)**: `NovoLoteCompraCartao`
  (`lib/data.ts`) e a RPC `compra_cartao_gravar_lote` (migration `0026`)
  **não têm `documentoOrigemId`/`p_documento_origem_id` na assinatura**
  desde o CONTAI-084 — o cliente não tem como passar um id ainda que o
  tivesse, e com a abordagem de texto, nem o tem.
- **Modelo de dados**: nenhuma migration, nenhuma alteração em
  `lib/data.ts`/`lib/fiscal/*`/`database.types.ts`.
- **Arquivos**: `app/(captura)/adicionar/compra-cartao/page.tsx` (href
  com query + gate `notaPronta`), `.../parcelas/page.tsx` (Suspense,
  `herdarDaUrl`, `useState` iniciais, `router.replace`),
  `.../texto-herdado.ts` + `.test.ts` (novo), `e2e/cartao-lote.spec.ts`
  (teste reescrito + novo), `design/mocks/CONTAI-089.md`.
- **Complexidade: S**. Dívida nova: nenhuma.

## Dependências
Bloqueado por / Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
**Gestão** — lançamento de compra parcelada grande, feito sentado. Serve
à meta 1 indiretamente (menos fricção na captura reduz erro de
digitação). Sem condição fiscal órfã — toda condição cita o ADENDO 9 ou
a ratificação desta rodada. Sem UI que quebre disciplina de campo fiscal.
**Veredito: APROVADO.** Pronto para `/develop`.
