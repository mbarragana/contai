# CONTAI-094 Colaborador cadastra documento; fila de revisão do dono

## Tipo e Prioridade
feature — P1 — entrega o núcleo da dor original do relato 109 (engenheiro
cadastra a nota direto, sem passar por WhatsApp/e-mail). Depende de
`CONTAI-093`.

## EMENDA pós-Gate-4 (2026-10-14)
O Mateus respondeu, no mesmo dia da criação deste ticket, duas Perguntas
Abertas do `CONTAI-093` que mudam critérios já escritos aqui: (1) "restrita"
= próprios + todos os pendentes de revisão da obra (não só os próprios); (2)
multi-obra desde já. Critérios 2, 4, 8, 9, 10, 13 revisados abaixo; critério
14 é novo. Reavaliação de arquitetura: `cto-obra`; checagem de critérios:
`po`. Complexidade mantém **M/L**.

## Dor de Origem
`docs/backlog/109-2026-10-14-engenheiro-acesso-multiusuario.md`: "seria ainda
mais fácil pra mim se ao invés de ele me mandar a nota fiscal e eu baixar e
subir no sistema, fizéssemos o processo inteiro pelo sistema". Esta fatia é a
captura em si.

## User Story
**Como** o engenheiro da obra, que já está com a nota em mãos, **quero**
cadastrar o `documento` direto no sistema, com o mesmo anexo obrigatório e as
mesmas perguntas fiscais do fluxo do Mateus, **para que** a nota não dependa
de eu mandar por WhatsApp e ele subir depois — e **como** o Mateus, **quero**
ver claramente, numa fila própria, tudo que o colaborador cadastrou e ainda
não revisei, **para que** eu nunca trate algo como resolvido sem ter
confirmado pessoalmente os fatos que ele registrou.

## Critérios de Aceite

1. [ ] Colaborador cadastra `documento` pela mesma rota `/adicionar/documento`
   já existente, adaptada por papel: mesmos campos, mesmas validações de
   documento hábil (anexo obrigatório, nota no CPF do titular?, CNO
   impresso?, há retenção destacada?), mesma quarentena — nenhuma regra de
   documentação hábil muda em função de quem cadastra (confirmado pelo Gate
   Fiscal). A única diferença de fluxo é o texto final de confirmação
   (critério 6).
2. [ ] **Emenda 2026-10-14** — RLS de `documento`: `select` quando `user_id =
   auth.uid()` (dono) **ou** `visibilidade_na_obra(obra_id) = 'total'`
   **ou** (`visibilidade_na_obra(obra_id) = 'restrita' and (criado_por =
   auth.uid() or pendente_revisao)`) — a visibilidade "restrita" deixou de
   ser só "o que eu criei": por resposta do Mateus de 2026-10-14, inclui
   também qualquer documento pendente de revisão da obra, de qualquer
   colaborador (`pendente_revisao`, `CONTAI-093` critério 6). `insert with
   check (criado_por = auth.uid() and (user_id = auth.uid() or
   visibilidade_na_obra(obra_id) is not null))` — o `user_id` chega do
   trigger `user_id_da_obra` (`CONTAI-093`) como o do dono, e `criado_por =
   auth.uid()` impede forjar autoria; `update using/with check (user_id =
   auth.uid())` — **colaborador nunca corrige o que viu**, criado por ele ou
   por outro, correção vira sempre ato do Mateus, com o mesmo rastro de
   revisão já existente (`revisao`). `documento_retencao`: **select** herda
   a mesma partição ampliada do documento-pai (via `exists (select 1 from
   documento d where d.id = documento_id)`, nunca repetindo o predicado —
   doutrina CONTAI-072); **insert/update/delete** continuam restritos a dono
   ou ao autor do documento a que pertence — colaborador não ganha poder de
   edição sobre o que não criou só porque passou a poder ler.
3. [ ] RLS de `favorecido`: `select`/`insert` quando `user_id = auth.uid()`
   **ou** `user_id` é de uma obra em que o usuário é colaborador ativo;
   `update` continua só dono. `garantirFavorecido` passa a receber o
   `user_id` do dono explicitamente (nunca inferido de `getUsuarioId()`) —
   sem isso o colaborador criaria favorecido invisível ao Mateus e a ficha
   Pagamentos Efetuados sairia com `favorecido` nulo.
4. [ ] `storage.objects` (bucket `acervo`): o anexo do colaborador sobe na
   pasta do **dono** (`{dono_uid}/documento/...`), nunca na pasta dele —
   mantém o acervo como uma árvore por dono (meta 3) e deixa `CONTAI-011`
   (export, hoje pausado) retomável sem redesenho para este caso.
   `subirParaAcervo` ganha parâmetro obrigatório `donoDoAcervoId` em vez de
   inferir de `getUsuarioId()` — todo chamador passa a dizer de quem é o
   acervo. Policy de `insert`/`select` em `storage.objects` acompanha a
   mesma regra de visibilidade do critério 2 (via subquery em `documento`).
   **Emenda 2026-10-14**: como a visibilidade "restrita" agora inclui os
   pendentes de revisão de qualquer colaborador (critério 2), a policy de
   `select` do anexo acompanha essa ampliação — um colaborador restrito pode
   abrir o anexo de uma nota pendente cadastrada por **outro** colaborador,
   não só da própria.
5. [ ] Colunas `revisado_em`/`revisado_por` (`CONTAI-093`) são preenchidas só
   pelo Mateus, via ação "Revisado" — trigger `revisado_imutavel` (`before
   update`) impede que `revisado_em` volte de preenchido para `null` ou seja
   regravado por outra autoria depois de definido uma vez.
6. [ ] Tela de confirmação final de `/adicionar/documento`, quando quem salva
   é colaborador: o texto diz explicitamente que o registro entra como
   pendente de revisão do Mateus antes de contar como confirmado — texto
   exato em `design/mocks/CONTAI-094.md` (pergunta aberta, ver abaixo).
7. [ ] Card novo na Home (dono): "N registros do colaborador aguardando
   revisão", visualmente **neutro/informativo**, deliberadamente separado da
   paleta vermelho/âmbar das pendências fiscais (isto é item de fluxo de
   trabalho, não dívida documental — misturar cor arriscaria o Mateus ler
   "aguardando revisão" como "pendência fiscal"); link "Ver fila (N) →" leva
   a `/despesas` já com o filtro de revisão aplicado.
8. [ ] **Emenda 2026-10-14** — `/despesas`: filtro novo "Aguardando revisão"
   (ao lado de Situação/Tipo/Busca) filtra exatamente por
   `documento.pendente_revisao = true` — **nunca** por `revisado_em is null`
   isolado, que incluiria todo documento do próprio Mateus (ele nunca passa
   pela ação "Revisado"). Cada linha com `pendente_revisao = true` ganha uma
   segunda linha de texto secundário "criado por {nome} em dd/MM/aaaa" (o
   dono sempre vê o nome real, isso não muda; mesmo padrão tipográfico já
   usado para a nota de agendamento, `CONTAI-057`/`091`) e uma ação
   "Revisado" na célula de Ação, com peso visual **secundário/ghost** (nunca
   o mesmo peso do botão que confirma pagamento, para não parecer uma
   confirmação de pagamento).
9. [ ] **Emenda 2026-10-14** — Lista de documentos do colaborador (tela (c)
    da `CONTAI-093`, `/colaborador/[obraId]`): para visibilidade
    **restrita**, mostra os documentos que ele próprio criou **mais** todos
    os documentos com `pendente_revisao = true` da mesma obra criados por
    **outros** colaboradores; para visibilidade **total**, mostra o acervo
    inteiro da obra. Cada item ganha chip `CHIP_PENDENTE_REVISAO = "Pendente
    de revisão"` ou `CHIP_REVISADO = "Revisado"` — cor neutra (mesma régua
    do critério 7), nunca as cores de gravidade fiscal (vermelho/âmbar/
    verde), porque isto não é pendência fiscal. Quando o item não foi
    criado pelo próprio colaborador logado, o rótulo de autoria é **"criado
    por você"** (quando foi ele) ou **"criado por outro colaborador"** (sem
    nome, nunca o nome real) — o colaborador não tem, por RLS, como ler o
    nome de outro colaborador na tabela `obra_colaborador`; só o dono vê
    nomes reais, em qualquer tela sua. Nomenclatura dos chips confirmada
    pelo `po`.
10. [ ] **Veto às saídas anuais** (reescrito, Emenda 2026-10-14, mesma regra,
    agora amarrada à coluna única): quando `documento.pendente_revisao =
    true` → a tela que lista o que falta revisar antes de gerar a saída
    anual **avisa** (lista o que falta revisar) e `podeGerarRelatorioAnual`
    **veta** as três saídas (Bens e Direitos, Pagamentos Efetuados, aferição
    INSS) enquanto a pendência existir, pelo parecer transcrito em
    `docs/pareceres/2026-10-14-veto-relatorio-documento-colaborador-nao-revisado.md`.
    (Equivalente à condição anterior "cadastrado por colaborador e
    `revisado_em is null`"; a reescrita só amarra à coluna única em vez de
    repetir a composição em cada lugar — doutrina CONTAI-072.) O documento
    continua gravando no acervo normalmente (nunca recusa fato consumado); o
    único destravamento é a ação "Revisado" do Mateus (critério 8), nunca
    upload de arquivo.
11. [ ] Ficha Pagamentos Efetuados: quando o pagamento listado tem origem em
    documento cadastrado por colaborador, isso é marcado só no registro
    interno (autoria), sem alterar o conteúdo da ficha em si — a ficha
    continua organizada por CPF do prestador, nunca por autor do lançamento.
12. [ ] GRANT: nenhum verbo novo em `documento`/`favorecido`/
    `documento_retencao` (já têm INSERT,SELECT,UPDATE); `e2e/privilegios.spec.ts`
    atualizado mesmo assim pela função de trigger nova (`revisado_imutavel`)
    e pela policy nova em `storage.objects`.
13. [ ] E2E novo (`e2e/colaborador-documento.spec.ts`, Postgres local, client
    autenticado): colaborador cadastra documento e ele aparece na fila do
    dono com autoria correta; colaborador com visibilidade restrita **não**
    vê documento já revisado de outro colaborador nem do dono, **mas vê**
    (Emenda 2026-10-14) documento pendente de revisão cadastrado por outro
    colaborador da mesma obra; colaborador com visibilidade total vê tudo;
    `podeGerarRelatorioAnual` veta quando há documento de colaborador não
    revisado (`pendente_revisao = true`) e destrava depois da ação
    "Revisado"; tentativa de colaborador dar `update` em documento que não
    criou (seu ou de outro colaborador) é recusada pela RLS.
14. [ ] **Critério novo, Emenda 2026-10-14.** `/documento/[id]`: quando quem
    abre é colaborador com visibilidade **restrita** olhando um documento
    que **não** criou (pendente de outro colaborador, agora visível pelo
    critério 2), a tela entra no mesmo "modo leitura" da `CONTAI-096`
    (critério 4/5 ampliado) — nenhum botão de ação aparece, mesmo indicador
    textual discreto. A lista do colaborador (critério 9) passa a linkar
    para `/documento/[id]` nesse caso. Isso não existia antes porque, antes
    da Emenda, "restrita" nunca via documento de outro colaborador — não
    havia o que abrir.

## Out of Scope
- Colaborador criar/editar vínculo `pagamento_documento` ("ligar a um
  pagamento existente") — `criarVinculos` é afirmação de custo, fica
  exclusiva do dono; a RLS de `pagamento_documento` continua dono-only
  (trava real, não é só botão escondido na tela de captura do colaborador).
- Correção de documento já cadastrado pelo colaborador — vira sempre ato do
  Mateus (critério 2), nunca do colaborador que criou.
- Notificar o colaborador quando o Mateus revisa o que ele cadastrou —
  conveniência, não serve a nenhuma das três metas; backlog futuro se pedido.
- Reembolso ao colaborador que eventualmente desembolse com recursos
  próprios — o Gate Fiscal nota que, se isso acontecer na prática
  (hoje fora do escopo fechado: colaborador nunca confirma pagamento), o
  desembolso que conta para a condição 1 do custo de aquisição é o do
  **reembolso** feito pelo Mateus, não o pagamento original do colaborador;
  registrado como nota, não como requisito, porque o relato não descreve
  esse padrão.

## Gate Fiscal (Contador)

**1. Toca regra fiscal?** Sim — documentação hábil, regime de caixa (quem
afirma o quê), e a ficha Pagamentos Efetuados.

**2. Documentação hábil não muda por autoria — confirmado, com uma ressalva
fora do documento.** `[Certain]` As quatro condições de custo de aquisição
(`docs/pareceres/2026-08-17-vinculo-pagamento-documento.md` §1: desembolso do
declarante; bem/serviço incorporado; documentação em nome e CPF dele;
discriminação na DAA) não mencionam quem operou o teclado. O que a condição 3
exige é que a nota esteja no **CPF do Mateus** (destinatário/tomador) —
nunca no CPF do colaborador. **Autoria do lançamento no app e identidade do
declarante/destinatário no documento são coisas diferentes, e só a segunda é
fiscal.**

**3. Regras — "se X e Y → Z":**
- **Se** o documento é cadastrado pelo colaborador **e** o destinatário/
  tomador impresso não é o CPF do Mateus → **recusar** a entrada como custo
  de aquisição (mesma recusa que já vale para o dono,
  `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md` §1, condição 3).
  O documento grava no acervo; **marcar** pendência "nota fora do CPF do
  titular" — igual ao fluxo do dono, sem exceção por autoria.
- **Se** o documento cadastrado pelo colaborador está sem anexo, sem CNO
  impresso, sem CPF/CNPJ do favorecido, ou qualquer campo fiscal vazio →
  **avisar** (pendência), nunca **recusar** o registro em si — mesma
  disciplina de "nunca recusa fato consumado"
  (`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`, ADENDO 2 §5).
- **Se** o documento foi cadastrado por colaborador **e** nenhuma afirmação
  de documentação hábil nele tiver revisão/confirmação do Mateus → **marcar**
  pendência "pendente de revisão do titular" **e** vetar as três saídas
  anuais enquanto a pendência existir — regra completa (automático × humano,
  fundamento, destravamento) no parecer
  `docs/pareceres/2026-10-14-veto-relatorio-documento-colaborador-nao-revisado.md`,
  transcrito a partir do Gate Fiscal deste ticket.
- **Se** a ficha Pagamentos Efetuados listar um pagamento cujo documento de
  origem foi cadastrado por colaborador → **marcar** no registro interno a
  autoria permanente, sem alterar o conteúdo da ficha (critério 11).

**4. Automático × revisão humana.**
- **Automático**: validações de forma do documento (anexo, CNO impresso, CPF
  do destinatário, captura das linhas de retenção do CONTAI-038); marcar
  pendência "pendente de revisão do titular"; vetar as três saídas anuais
  enquanto não revisado.
- **Só o Mateus**: revisar/confirmar (ou corrigir) a afirmação do
  colaborador — esse ato, e só ele, libera o veto (ação "Revisado",
  critério 8).

**5. Parecer novo, transcrito antes deste Gate fechar** —
`docs/pareceres/2026-10-14-veto-relatorio-documento-colaborador-nao-revisado.md`,
combinando (sem reinterpretar) `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`
(ADENDO 2 §A.4) e `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`
(ADENDO §A).

## Pre-mortem
1. **O Mateus revisa em lote, sem olhar o conteúdo de cada item**, treinado
   pelo volume (se o engenheiro cadastrar muitas notas de uma vez, a fila
   cresce e o botão "Revisado" vira reflexo) — a mesma dinâmica que a
   doutrina do campo fiscal tenta evitar no cadastro, mas aqui do lado da
   revisão. Mitigado em parte por manter "criado por {nome} em dd/MM/aaaa"
   visível na própria linha (crit. 8), não por bloqueio mecânico.
2. **Visibilidade "total" expõe CPF/valor de prestadores PF a um terceiro**
   não-declarante — fora da competência fiscal (confirmado no Gate Fiscal do
   `CONTAI-093`), mas é risco de produto real se o Mateus conceder "total" a
   alguém sem pensar na exposição de dado sensível.
3. **Favorecido duplicado** se `garantirFavorecido` não usar o `user_id` do
   dono de forma consistente entre o fluxo do dono e o do colaborador —
   mitigado pelo critério 3, mas é o tipo de regressão silenciosa que só um
   teste com os dois papéis pegaria.

## Viabilidade (CTO)
- **Modelo de dados**: nenhuma tabela nova nesta fatia — usa as colunas de
  `CONTAI-093`. Migration `0031`: split de RLS em `documento`/
  `documento_retencao`/`favorecido`/`storage.objects`; trigger
  `revisado_imutavel`.
- **Arquivos**: `supabase/migrations/0031_documento_colaborador.sql`,
  `lib/data.ts` (`subirParaAcervo` com `donoDoAcervoId`, `garantirFavorecido`
  com `user_id` explícito — ~8 chamadores a revisar), `lib/fiscal/documento.ts`
  (`podeGerarRelatorioAnual`), `app/(captura)/adicionar/documento/page.tsx`,
  `app/(gestao)/page.tsx` (card novo), `app/(gestao)/despesas/page.tsx`
  (filtro + coluna de autoria), área do colaborador (lista de documentos),
  `e2e/colaborador-documento.spec.ts`, `e2e/privilegios.spec.ts`.
- **Complexidade: M/L.** Storage policy com subquery é novidade no repo;
  `subirParaAcervo`/`garantirFavorecido` têm múltiplos chamadores a
  atualizar com o parâmetro explícito.
- **Dívidas**: (D-ix) colaborador com visão restrita nunca vê números
  fiscais — garantido por UI + teste-trava, não por RLS (a RLS devolve
  parcial, não vazio, então o front tem de nunca somar sobre esse recorte
  parcial como se fosse o total da obra).

## Dependências
Bloqueado por `CONTAI-093`. Não bloqueia `CONTAI-095`/`CONTAI-096`
diretamente (as três fatias de escrita/leitura são independentes entre si
depois de `093`). **Emenda 2026-10-14**: o critério 14 (modo leitura em
`/documento/[id]`) depende também do critério 16 da `CONTAI-093`
(`papelDaSessao`, guardas de rota) para a rota ser alcançável pelo
colaborador.

## Perguntas Abertas
1. Texto exato da tela de confirmação quando quem salva é colaborador
   (designer).
2. Card da Home quando N=0: não aparece, ou aparece esmaecido com "Nenhum
   registro aguardando revisão"? (designer).
3. ~~Nomenclatura dos chips~~ — **resolvida pelo `po` na Emenda 2026-10-14**:
   mantém `CHIP_PENDENTE_REVISAO = "Pendente de revisão"` /
   `CHIP_REVISADO = "Revisado"` (critério 9); rótulo de autoria novo "criado
   por você"/"criado por outro colaborador" (sem nome) também fechado no
   critério 9, não é mais pergunta aberta.
4. Botão "Revisado" em `/despesas`: ação de um clique sem confirmação, ou
   exige passo de confirmação, já que é o que libera o veto às saídas
   anuais? (designer).

## Cenário e checagem final
**Dois lados da mesma fatia.** Para o colaborador cadastrando: **captura**
plena — nota em mãos, mesma rota `/adicionar/documento`, mesmo tratamento
desktop já especificado (`captura-no-desktop-v1.md`), ≤3 interações, anexo
obrigatório no ato — nada disso muda; só muda o destino do registro (pendente
de revisão) e o texto final. Para o dono revisando a fila: **gestão** — Home
e `/despesas`, em casa, sentado, revisando antes de decidir. O "Teste do
Canteiro" se aplica só ao primeiro lado (captura do colaborador), nunca à
fila de revisão do dono.

Varredura de condição fiscal órfã: toda condição citada acima amarra a
parecer existente ou ao parecer novo transcrito
(`docs/pareceres/2026-10-14-veto-relatorio-documento-colaborador-nao-revisado.md`)
— nenhuma condição sem parecer.

Veredito: **APROVADO**, condicionado às Perguntas Abertas 1-4 (não bloqueiam
arquitetura, bloqueiam só redação final de tela).

---

## Design (nível 2)
Descrição completa em `design/mocks/CONTAI-094.md`: delta na tela de captura
(texto final adaptado por papel), card novo na Home, filtro+coluna de
autoria em `/despesas`, lista do colaborador com chips de pendente/revisado.
Nenhum campo fiscal novo; textos com consequência fiscal são os mesmos já
existentes, copiados.
