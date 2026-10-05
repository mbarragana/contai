# 101 — Correção de documento quando a nota substitutiva só muda a retenção (e o número)

**2026-10-05.** Relato do Mateus: *"temos que implementar essa
funcionalidade"* — confirmação de que a lacuna encontrada nesta sessão (não
um desabafo novo) vira trabalho real.

## O caso real

NFS-e PerfuraTec Fundações Ltda nº **261** (já registrada no app, com arquivo
anexado, R$59.901,00, "Situação Tributária: Normal") foi **cancelada** pela
própria prestadora e substituída pela nº **263** (mesmo valor bruto
R$59.901,00, agora "Situação Tributária do ISSQN: **Retenção**", valor
líquido R$58.103,97 — R$1.797,03 de ISS retido na fonte). Mateus já pagou os
R$59.901,00 cheios via PIX, com base na 261. Parecer fiscal completo:
`docs/pareceres/2026-10-02-iss-retido-floripa-perfuratec-nfse263.md` (há ação
urgente **fora do software** — confirmar retenção de ISS com a Prefeitura de
Florianópolis e cobrar o excedente da PerfuraTec — já registrada na memória
do projeto, não é objeto deste backlog).

Ele precisa registrar, **dentro do app**, a correção: anexar a 263 como
prova e deixar rastreável que agora há retenção de ISS pendente de
recolhimento.

## Dores extraídas (investigação desta sessão, não repetir)

**Dor 1 — não há onde anexar a nota substitutiva.** As três telas de
correção existentes (`corrigir/valor`, `corrigir/classificacao`,
`corrigir/emitente`) são o único lugar que aceita anexo adicional — mas
**as três recusam gravar quando o valor novo é igual ao já gravado**
(`corrigir/valor/page.tsx:284-300`, mesmo padrão em `classificacao`). No caso
real, nem valor bruto, nem classificação, nem CNPJ do emitente mudaram entre
261 e 263 — só a composição de retenção. Resultado: as três recusam, e
`/documento/[id]/anexar` só aceita quando o documento **não tem nenhum**
arquivo ainda (`arquivo_path is null`), que não é o caso de 261. **Não existe
hoje nenhum caminho, dentro da disciplina do app (anexo visível + afirmação,
nunca dado sem prova), para anexar um documento novo a um já registrado
quando a correção é só de composição de retenção.**

**Dor 2 — o próprio número da nota (261→263) também não é corrigível, e essa
é a causa-raiz mais funda.** Achado desta sessão, não estava no relato
original: o parecer `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`
§1 já classificou `numero`/`serie` como **"CORRIGÍVEL COM CONDIÇÃO"**
(reroda a checagem de duplicidade ao gravar). O `CONTAI-021` **cortou**
`numero`/`serie` da rodada 1 só porque a coluna "não existe no schema"
(`docs/tickets/CONTAI-021.md:358-361`) — nota explícita: *"Quando o 004
entrar, a lista corrigível cresce pelo §1 do parecer, sem reabrir gate."* O
`CONTAI-004` **já entregou** a coluna `numero` (`lib/types.ts:131`,
migration `0012_documento_numero_emissao.sql`) há semanas. **A tela
`corrigir/numero` nunca foi construída** — é dívida pré-aprovada pelo
contador, sem gate fiscal pendente, só nunca priorizada porque não havia
caso real. Agora há.

**Dor 3 — mesmo com anexo resolvido, o gate de retenção do documento 261 não
tem como ser corrigido.** `BlocoRetencao` (`app/_components/retencao.tsx:122-132`)
só oferece `ConfirmarGateLegado` quando `documento.retencaoNaNota === null`
(estado legado, pré-migration). O documento 261 já tem gate respondido —
**"nenhuma"** (confirmado em `docs/backlog/97-2026-09-29-parser-retencao-nao-reconhece-valor-bruto.md`:
a nota não tinha retenção na época). Com gate = "nenhuma", o bloco inteiro
retorna `null` (linha 132) e o repeater de linhas de retenção do CONTAI-038
nunca aparece — não existe caminho para flipar um gate **já respondido** de
"nenhuma" para "destacada".

## Classificação

**P0 fiscal**, com ressalva de que a urgência é sobre **correção do rastro**,
não sobre documentação faltante: o pagamento em si já tem documento hábil
(261, com arquivo); o que está errado é que o documento hábil autoritativo no
acervo é uma nota **cancelada**, e a pendência real de retenção (ISS a
recolher) não aparece em nenhum lugar do sistema. Toca a meta 1 (nenhum
pagamento sem documento hábil **correto**) e a meta 3 (acervo que sobrevive à
decadência — o acervo hoje aponta para o papel errado). Mesmo raciocínio que
o `CONTAI-021` usou para definir seu próprio gatilho de P0: *"a partir do
instante em que uma nota for registrada errada, isto é P0, porque hoje não
existe desfazer"* — aqui não é typo, é substituição pela prestadora, mesma
classe de dano.

## User stories

**US1 (P0) — Corrigir o número/série de um documento já registrado.**
Como dono da obra, em casa e sentado, quando a prestadora cancela e reemite
uma nota com número novo, quero corrigir o número/série do documento já
registrado, anexando a nota nova como prova, para que o acervo pare de
apontar para um papel cancelado.
- Critério de aceite: `/documento/[id]/corrigir/numero` segue o padrão das
  três telas existentes (anexo adicional obrigatório, trava "nada a
  corrigir" se o número digitado for igual ao gravado, rastro
  campo/antes/depois/motivo/quando). Ao gravar, a checagem de duplicidade
  roda contra outro documento do mesmo emitente/série na mesma obra (parecer
  §1). O dossiê do acervo e o detalhe do documento passam a exibir o número
  novo e a nota cancelada como anexo histórico, não como arquivo vigente.

**US2 (P0) — Corrigir o gate de retenção de um documento já registrado.**
Como dono da obra, quando a nota substitutiva muda a situação tributária
("Normal"→"Retenção" ou o inverso), quero reabrir a resposta já dada sobre
"esta nota destaca alguma retenção?", para que o repeater de linhas de
retenção (CONTAI-038) fique disponível e a pendência real de "quem recolhe"
apareça.
- Critério de aceite: existe um caminho para corrigir `retencaoNaNota` de um
  documento com gate já respondido (não só do estado legado `null`), com
  rastro da mudança e exigência da mesma prova (anexo) que motivou a
  correção. Depois da correção, o documento exibe a pendência de retenção
  igual a qualquer nota registrada direto como "destacada" — mesmo texto,
  mesma cor, mesmo lugar (CONTAI-059).

**US3 (P1/P0 a decidir pelo contador) — Anexo de prova em linha de retenção
adicionada depois do registro original.** Como dono da obra, quando descubro
depois do registro que uma nota tem retenção que a versão original não
tinha, quero poder provar essa linha com o documento que a revelou, para que
a pendência de "quem recolhe" não fique sem lastro documental.
- Critério de aceite: a decidir no `/tickets-req` — ver Gate Fiscal abaixo.

## Filtro de escopo — o que fica de fora, e por quê

- **Mudar a doutrina de `valorCentavos` = sempre o bruto.** Não é tocado; o
  caso real não muda valor bruto entre 261 e 263.
- **Um 4º tipo de correção "genérica" sem anexo-chave.** `corrigir/numero`
  (US1) é uma **ação nomeada**, no mesmo padrão das três existentes — não é
  o formulário genérico que o `cto-obra` já rejeitou no `CONTAI-021`.
- **A ação de confirmar a obrigação de reter ISS com a Prefeitura de
  Florianópolis, cobrar o excedente da PerfuraTec, pagar a guia.** Fora do
  software por definição (parecer 2026-10-02, §4) — já é ação urgente
  registrada na memória do projeto, fora deste backlog.
- **Fluxo de CNPJ errado / `favorecido_id`.** Não é o caso aqui (emitente não
  mudou); CONTAI-021 já cortou isso para a "rodada 2" por razão própria.
- **Criar um tipo de documento novo para "comprovante de recolhimento de
  guia de ISS pelo próprio Mateus".** O parecer de 2026-10-02 §5 já levanta
  essa lacuna como possível; fica **fora desta rodada** — este backlog é só
  sobre a correção de 261→263, não sobre o ciclo de vida da guia futura.

## Dívidas nomeadas

- **D89** — `corrigir/numero`/`serie` pré-aprovado pelo contador desde
  2026-08-18 (§1 do parecer), destravado pelo schema do `CONTAI-004`, nunca
  implementado por falta de caso real. Agora há caso real (este relato).
- **D90** — gate de retenção (`retencaoNaNota`) não tem caminho de correção
  depois de respondido; só o estado legado (`null`, pré-migration) é
  reaberto por `ConfirmarGateLegado`.

## Gate Fiscal — para o `contador` decidir no `/tickets-req`

1. Adicionar/corrigir linha de retenção de um documento já registrado deveria
   exigir anexo de prova **sempre**, **nunca**, ou **só quando o dado não é
   visível no anexo original já existente**? (Determina se US3 é obrigatória
   ou opcional, e se US2 precisa de anexo próprio ou pode reaproveitar o
   anexo gravado pela correção de número da US1 quando as duas acontecem
   juntas, como no caso real.)
2. A correção do gate de retenção (US2) merece o mesmo rastro auditável
   (campo/antes/depois/motivo/quando/quem/anos afetados) que as outras três
   correções do CONTAI-021 têm, já que muda a pendência de "quem recolhe"
   mesmo sem mudar valor?
3. Para `cto-obra`: no caso real, a mesma nota 263 serve de prova para DUAS
   correções (número e gate de retenção) no mesmo documento. US1 e US2
   deveriam compartilhar um único anexo quando resolvidas na mesma sessão,
   ou cada correção exige o seu próprio upload (duplicando o arquivo no
   acervo)? Doutrina relevante: `documento_anexo` (migration citada no
   fatiamento do CONTAI-011, `docs/backlog/62-2026-09-23-fatiamento-contai-011.md`)
   foi desenhado para "anexo adicional do mesmo desembolso" num contexto
   diferente (vincular objeto órfão) — mas é a mesma peça de schema que
   serviria aqui; avaliar se vale reusar em vez de criar mecanismo paralelo.
   **Nota**: `CONTAI-049`/`050` (onde `documento_anexo` nasceria) estão **em
   espera** no fluxo ativo — não é razão para bloquear US1/US2, que não
   dependem deles; é só contexto de que a peça de schema mais próxima ainda
   não foi construída em lugar nenhum.

## Perguntas ao Mateus

1. Esse padrão (nota cancelada e reemitida com situação tributária
   diferente) já aconteceu com outro prestador na obra, ou é a primeira vez?
   (Importa para dimensionar: se for recorrente, `corrigir/numero` sai do
   "nunca priorizado por falta de caso real" para ferramenta de uso regular,
   não exceção pontual.)
2. Enquanto o ticket não sai do pipeline (`/tickets-req` → `/design` →
   `/develop`), a nota 263 já está guardada em algum lugar seguro fora do
   app (e-mail, pasta local), ou isso também precisa de ação imediata
   separada deste backlog?

Sem resposta ainda a nenhuma das duas — não bloqueiam o avanço para
`/tickets-req` (US1 e US2 têm Gate Fiscal próprio listado acima, que é o que
efetivamente bloqueia).
