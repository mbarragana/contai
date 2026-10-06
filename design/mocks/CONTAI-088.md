# CONTAI-088 — ponto de entrada único para correção de documento, com anexo reaproveitado
Cenário: **gestão** (correção documental, em casa, sentado — nenhum passo daqui precisa caber
numa mão nem em ≤3 interações; é o mesmo cenário dos 3 tickets de origem 085/086/087).

## Nível por fatia

- **Fatia A — nível 2** (delta em tela existente). `corrigir/numero` e `corrigir/valor` ganham
  exatamente o bloco de chips que `corrigir/retencao` já tem em produção (critérios 9/10 do
  CONTAI-086, código em
  `app/(gestao)/documento/[id]/corrigir/retencao/page.tsx:736-771`). Não é fluxo novo — é portar
  um padrão já aprovado e já no ar para as duas telas-irmãs que ficaram de fora.
- **Fatia B — nível 1** no ponto de entrada (rota nova, componente novo), **+ nível 2** em três
  lugares que já têm spec: as 3 telas de correção (modo pacote) e `documento/[id]/page.tsx`
  (agrupamento de `ListaDeAnexos`). O nível 1 é só a casca nova; o resto é delta sobre spec
  existente (`design/mocks/CONTAI-085.md`, `CONTAI-086.md`).

---

## Fatia A — chip de reaproveitar anexo em `corrigir/numero` e `corrigir/valor`

### Telas e estados
Delta único, no passo do campo (onde já existe `CampoArquivo` — `numero/page.tsx:420-427`,
`valor/page.tsx:351`), **só quando `motivo === "emitente_corrigiu_a_nota"`**: imediatamente
depois do `CampoArquivo` e antes do `Consequencia cor="amb"`, entra o mesmo bloco de
`retencao/page.tsx:736-771` — `Card` "Ou use um papel que já está neste documento" com um botão
por anexo ADICIONAL do documento (nunca o original — `papelOriginal` não entra aqui), rótulo
"Usar a nota anexada em {dd/mm/aaaa hh:mm} ({origem})", `aria-pressed` quando selecionado, e a
`Dica` "O mesmo arquivo pode provar duas correções...". Escolher o chip zera `anexo` (File);
escolher/trocar o `CampoArquivo` zera o chip — upload e chip são a mesma pergunta.
- **Carregando**: as duas telas passam a chamar `carregarAnexosDoDocumento(d.id)` dentro do
  `Carregando` que já existe (mesma chamada de rede extra que `corrigir/retencao` já faz hoje) —
  nenhum estado novo, só mais um `await` no mesmo carregamento.
- **Vazio** (documento sem anexo adicional): `Card` dos chips não renderiza (mesma guarda
  `anexos.length > 0 ? ... : null` de `retencao`) — só o `CampoArquivo` aparece, como hoje.
- **Erro**: nenhum novo — falha em `carregarAnexosDoDocumento` cai no mesmo `EstadoErro` que já
  cobre falha de carregar o documento (mesmo `Promise.all`/try-catch da tela irmã).
- **Sucesso**: inalterado — o que grava é `anexoPath` (chip) ou upload novo, exatamente como
  `retencao` já decide hoje (ver `retencao/page.tsx:463`, `anexoEscolhido`).

### Campos
- `chip` — path de anexo existente — opcional, mutuamente exclusivo com `anexo` — SEM DEFAULT

### Navegação
Nenhuma nova — é delta de conteúdo dentro das duas rotas já existentes.

---

## Fatia B — ponto de entrada `/documento/[id]/documento-novo`

### Fluxo
```
/documento/[id]  →  [link "Recebi um documento novo para esta nota →"]
                          │
                          ▼
            documento-novo  (2 passos, mesma rota, sem rede no passo 2)
     Passo 1: qual anexo?  →  Passo 2: o que ele corrige?  → Continuar
                          │
                          ▼  router.push, SEM gravar nada aqui
        /documento/[id]/corrigir/{primeira marcada}?pacote=<restantes>&anexo=<path|"">
                          │
             PassoMotivo (respondido aqui, de novo) → campo → (preview) → Gravar
                          │
                          ▼  sucesso
          pacote vazio → "Ver o documento" (como hoje)
          pacote não-vazio → "Continuar: corrigir {próximo} →" (primário),
                              botão de hoje vira secundário
                          │
                          ▼  próxima rota da mesma forma, até pacote esvaziar
```
Ordem fixa: **número → valor → retenção**, independente da ordem de marcação no passo 2.

### Passo 1 — qual anexo
- **Carregando**: `Carregando rotulo="Carregando os anexos deste documento"` (busca documento +
  `carregarAnexosDoDocumento`).
- **Erro**: `EstadoErro` com retry — igual ao padrão das 3 telas-irmãs.
- **Vazio** (documento sem NENHUM anexo adicional, só o original): sem chips. `Card`: "Este
  documento ainda não tem nenhum anexo adicional, além do original." + uma única opção, já
  destacada visualmente como chip: "Vou anexar um arquivo novo." Nasce **não selecionada** (sem
  default) — precisa do clique para habilitar "Avançar".
- **Sucesso** (há ≥1 anexo adicional): lista de chips, mesmo componente/rótulo da Fatia A
  ("Usar a nota anexada em dd/mm/aaaa hh:mm ({origem})"), **mais um chip final sempre presente**:
  "Vou anexar um arquivo novo." Nada marcado por padrão. CTA "Avançar" desabilitado até escolher
  um dos dois tipos de opção.
- Escolher um chip → leva o `path`. Escolher "arquivo novo" → não há upload aqui (nenhum
  `<input type=file>` neste passo) — o upload só acontece dentro da PRIMEIRA correção do pacote.

### Passo 2 — o que corrigir (sem rede — dados já em memória do passo 1)
- Três checkboxes, nenhuma marcada por padrão:
  - "Número da nota — hoje: Nº {numero}{ · série {serie}}"
  - "Valor — hoje: {R$ formatado}"
  - "Retenção — hoje: {Nenhuma|Destacada}" (rótulo de `OPCOES_GATE`)
- **Vazio**: zero marcadas → CTA "Continuar" desabilitado.
- **Sucesso**: ≥1 marcada → "Continuar" habilitado. Ao clicar, monta a ordem fixa das marcadas,
  navega (client-side, sem POST) para a primeira com `?pacote=<resto, separado por vírgula>
  &anexo=<path escolhido no passo 1, ou "" se "arquivo novo">`.
- Sem estado de carregando/erro próprio — este passo não faz chamada de rede; reusa o que o
  passo 1 já carregou (valores atuais do documento).
- Botão "Voltar" (passo 2 → passo 1) preserva a escolha do passo 1.

### Delta nas 3 telas de correção, em modo pacote (`pacote` presente na URL, mesmo vazio)
Aplica-se às três rotas já especificadas (`CONTAI-085.md`, `CONTAI-086.md`) e à Fatia A acima.
1. **PassoMotivo sempre perguntado** — nenhuma herança entre correções do mesmo pacote (intocado).
2. **`?anexo=` pré-seleciona o chip**: se o path bate com algum item de
   `carregarAnexosDoDocumento` daquele documento, o chip nasce `aria-pressed` + `Dica` "Este
   anexo veio da entrada do pacote — pode trocar se não for o papel certo." Se o path **não**
   bate com nenhum anexo do documento (nenhum chip pré-selecionado), `Dica` cor avisa: "O papel
   indicado não está neste documento." — e o campo segue exigindo escolha manual (upload ou
   outro chip), igual ao passo sem pacote. `anexo=""` (caso "arquivo novo") não dispara aviso —
   é o caminho normal da primeira correção do pacote; `CampoArquivo` ganha ajuda extra: "Esse
   arquivo vai ser reaproveitado nas próximas correções deste pacote."
3. **Preview antes de "Gravar"** (só em modo pacote — fora dele, nenhuma das 3 telas muda).
   Redação final do critério C (ratificada pelo `cto-obra`): "Antes de 'Gravar', a rota mostra o
   papel escolhido: upload novo → preview inline (`ControleVerDocumento`/`LightboxDoAnexo`);
   anexo via chip → o anexo selecionado como `ItemDeAnexo` com 'Abrir' (mesmo mecanismo do
   detalhe)."
   - Upload novo (`File` em memória): `ControleVerDocumento` + `LightboxDoAnexo`
     (`app/_components/anexo-preview.tsx`), via `useUrlDoAnexo(anexo)` — rótulo "Ver o arquivo
     antes de gravar".
   - Chip (path já no acervo, sem `File` local): renderiza o próprio chip escolhido como um
     `ItemDeAnexo` (`app/_components/anexo.tsx`) — o mesmo "Abrir" que já aparece no detalhe do
     documento e em toda `ListaDeAnexos`, um visualizador por path já coberto por E2E, em vez de
     um segundo mecanismo novo (link avulso descartado nesta rodada).
4. **Rodapé de sucesso**: se `pacote` tem item(ns) restante(s), o botão que hoje é primário
   ("Ver o documento"/"Voltar ao documento" — `numero`/`retencao` já têm; `valor` hoje **não
   tem nenhum botão de volta na tela de sucesso**, gap pré-existente que este ticket não assume
   corrigir fora do pacote) vira **secundário**, mesmo texto, e um botão **primário** novo
   aparece: "Continuar: corrigir {o valor|a retenção|o número} →", `href` para a próxima rota do
   pacote com `?pacote=<resto-sem-esta>&anexo=<path usado nesta correção>` — path = o `chip`
   escolhido, OU o `arquivo_path` que a própria tela acabou de subir (ela já sabe esse valor,
   sem round-trip). Se `pacote` vazio, nada muda: comportamento de hoje.
5. **No passo do campo, antes de gravar**: se há próxima no pacote, "Cancelar" vira "Pular esta
   e continuar: corrigir {o próximo} →" — navega direto para a próxima rota, **sem gravar nada**,
   propagando o MESMO `anexo` recebido (se nada foi escolhido/upado aqui, o próximo passo recebe
   o mesmo path ou `""` que chegou). Se não há próxima (última do pacote, ou fora de pacote),
   "Cancelar" continua indo para `/documento/[id]` como hoje.

### Delta no detalhe do documento — agrupamento de anexos
`app/(gestao)/documento/[id]/page.tsx`, bloco `blocoAnexos` (linha ~468): hoje
`estado.anexos.map((a) => ({ path: a.arquivoPath }))` lista uma entrada por correção, mesmo
quando duas correções do mesmo pacote reusam o mesmo `arquivo_path`. Novo helper (ex.:
`agruparAnexosPorArquivo` em `app/_components/anexo.tsx`) agrupa por `arquivoPath` ANTES de
montar `ItemDeAcervo[]`: grupos com 1 entrada seguem sem `papel` (como hoje); grupos com N>1
ganham `papel = "usado em N correções"` (renderiza como o chip cinza que `ItemDeAnexo` já sabe
desenhar — nenhum componente novo). O original (`papelOriginal`) nunca entra nesse agrupamento —
ele é sempre uma linha própria, fora da lista de adicionais.
- **4 estados**: nenhum novo — `blocoAnexos` já tem vazio (`SEM_PAPEL_NO_ACERVO`) e não depende
  de rede própria (vem do mesmo `estado` que a tela já carrega).

## Campos (fatia B)
- `anexoEscolhido` (passo 1) — chip-path ou `"novo"` — obrigatório para avançar — SEM DEFAULT
- `correcoesMarcadas` (passo 2) — subset de `{numero, valor, retencao}` — ≥1 obrigatório — SEM
  DEFAULT
- `pacote` (query, nas 3 rotas de correção) — lista de tokens restantes, nunca persistido fora
  da URL — SOMENTE LEITURA
- `anexo` (query, idem) — path ou `""` — nunca grava nada por si: cada correção decide gravar
  (ou não) seu próprio `documento_anexo`, igual hoje — SOMENTE LEITURA

## Textos de produto (não fiscais — fiscal é 100% reuso dos pareceres já citados em 085/086/087)
- Link de entrada: **"Recebi um documento novo para esta nota →"**
- Passo 1 vazio: **"Este documento ainda não tem nenhum anexo adicional, além do original."**
- Chip extra do passo 1: **"Vou anexar um arquivo novo."**
- Ajuda no upload da 1ª correção do pacote: **"Esse arquivo vai ser reaproveitado nas próximas
  correções deste pacote."**
- Aviso de path não encontrado: **"O papel indicado não está neste documento."**
- Confirmação de pré-seleção: **"Este anexo veio da entrada do pacote — pode trocar se não for
  o papel certo."**
- Botão de avanço: **"Continuar: corrigir o número/o valor/a retenção →"**
- Botão de pulo: **"Pular esta e continuar: corrigir o número/o valor/a retenção →"**
- Agrupamento no detalhe: **"usado em N correções"**

## Navegação
- `/documento/[id]` → `/documento/[id]/documento-novo` — novo link, **acima** da lista de
  "Corrigir X" individuais (ele é o caminho rápido quando ≥2 correções se aplicam; os links
  individuais continuam existindo para correção isolada, agora também com chip — Fatia A).
- `documento-novo` passo 2 → `corrigir/{numero|valor|retencao}?pacote=…&anexo=…` — client-side,
  sem gravação.
- Sucesso de uma correção em pacote → próxima rota do pacote, mesmo padrão de query.
- Sucesso da última correção do pacote (ou fora de pacote) → `/documento/[id]`, como hoje.

## Decisões de design e perguntas abertas
- Decisão: passo 1 e passo 2 do ponto de entrada vivem na MESMA rota/componente (estado React
  local, sem URL por passo) — é o mesmo padrão que `PassoMotivo` já usa dentro de cada correção;
  criar duas rotas para dois passos sem rede entre eles seria navegação sem motivo.
- Decisão (ratificada pelo `cto-obra`): preview de chip renderiza o próprio `ItemDeAnexo`
  (mesmo "Abrir" do detalhe do documento e de toda `ListaDeAnexos`), não `LightboxDoAnexo` — o
  tipo do componente exige `File` em memória, que um chip (path já no acervo) não tem. Reusar
  `ItemDeAnexo` em vez de um link avulso novo mantém um único mecanismo de visualizar-por-path,
  já coberto por E2E, em vez de abrir um segundo caminho só para este fluxo.
- Decisão: "Pular esta e continuar" nunca pede confirmação — pular não descarta nada (nada foi
  gravado ainda nesse passo), diferente de abandonar um formulário com dado digitado.
- Pergunta ao `cto-obra`: confirmar que propagar `anexo=<arquivo_path recém-upado>` direto da
  tela de sucesso (sem reconsultar `carregarAnexosDoDocumento`) é seguro — a RPC de cada correção
  já insere a linha em `documento_anexo` no mesmo ato (critério já ratificado no 086), então o
  path existe no banco no momento em que a próxima tela carrega e tenta casar o chip.
- Fora de escopo, com porquê: estender o preview pré-gravação às 3 telas FORA de modo pacote —
  não pedido pelo ticket; produto já aceitou viver sem preview nessas telas até hoje.
