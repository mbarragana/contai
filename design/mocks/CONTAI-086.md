# CONTAI-086 — reabrir o gate de retenção já respondido
Nível: 1 (rota nova, 4 passos)   Cenário: gestão   Rota: `/documento/[id]/corrigir/retencao`

**Cobre também o CONTAI-087** (anexo em linha adicionada depois) — `cto-obra` decidiu: mesmo fluxo/tela (passos 3-4 servem às duas US; backlog continua separado). Sem spec próprio para 087 — é este arquivo. Delta fora da rota nova: `BlocoRetencao` (`app/_components/retencao.tsx`) ganha estado novo — **nível 2**.

## Fluxo — 4 passos

1. **Motivo** — `PassoMotivo` (reuso integral de `app/_components/corrigir.tsx`, mesmo texto/4ª saída `ErroEstaNaNota` das 3 telas-irmãs).
2. **Gate** — mostra a resposta ATUAL, pede a NOVA (`OPCOES_GATE`/`PERGUNTA_GATE`).
3. **Ramo**: "Destacada" → formulário de linhas NOVAS; "Nenhuma" com linhas gravadas → aviso de remoção + confirmação; "Nenhuma" sem linha → nada a corrigir, sem passo 4.
4. **Anexo + Salvar** — condicional pelo motivo do passo 1.

⚠️ Diferença das telas-irmãs: lá, resposta igual à gravada desabilita o botão; aqui reafirmar "Destacada" quando já era "Destacada" é o caminho normal do 087 (linha descoberta depois, com prova) — gate não muda, correção é real. Só "Nenhuma→Nenhuma sem linha" é nada a corrigir de fato.

## Telas e estados

- **Passo 1**: igual à spec CONTAI-085 (carregando/erro com retry/vazio).
- **Passo 2**: `Linha` "Esta nota destaca alguma retenção? Hoje: {Nenhuma|Destacada}" + `Escolha` da resposta nova. Vazio = nada marcado, CTA "Escolha a resposta nova para continuar". Sem rede.
- **3a "Destacada"**: `FormularioDeLinha` nasce ABERTO (padrão do estado vazio de `BlocoRetencaoDaCaptura`). Linha confirmada vira recap `LinhaPendente`-style com "Remover" local; "+ Adicionar outra linha" reabre em BRANCO (regra CONTAI-053/070 — nada herdado). Vazio = 0 linhas, CTA "Adicione ao menos uma linha de retenção para continuar". Linhas gravadas ANTES desta correção **não aparecem aqui**, ficam no `Repeater` da tela do documento — este passo só coleta linhas NOVAS.
- **3b "Nenhuma" com linhas existentes**: `Card border-red` + texto fiscal (abaixo) + checkbox "Confirmo a remoção das N linhas" (nasce desmarcada, SEM DEFAULT). Vazio = desmarcada, CTA desabilitado.
- **3c "Nenhuma" sem linhas**: `Dica` "Nada a corrigir: esta nota já não tinha nenhuma linha de retenção." + link "Voltar ao documento". Não chega ao passo 4, não grava rastro.
- **4** (só se 3a/3b produziram algo a gravar):
  - `emitente_corrigiu_a_nota`: `CampoArquivo` (upload novo) **+** chips clicáveis por anexo já existente no documento, rótulo "Usar a nota anexada em {dd/mm} ({motivo que a anexou})" — cobre o caso real (261→263: o 085 pode ter anexado a 263 segundos antes). Clicar preenche com aquele `arquivo_path`. Vazio = nenhum escolhido, CTA "Anexe ou escolha um documento já anexado para gravar". Erro de upload igual a `corrigir/valor`.
  - `erro_de_digitacao_minha`/`outro`: sem upload; checkbox "Confirmo que reconferi o papel já anexado" (nasce desmarcada). Vazio = CTA desabilitado.
  - **Gravando**: "Gravando…" — upload (se houver) → RPC/inserts num ATO só (gate + linhas novas OU remoção + anexo), mesma atomicidade de `corrigir/valor`.
  - **Erro**: `ErroDeGravacao` — "Nada foi alterado", formulário preservado, retry sem redigitar.
  - **Sucesso**: `Banner cor="grn"` "Retenção corrigida ✓" + "Gate: {antes}→{depois}" + (3a) linhas criadas ou (3b) "N linhas removidas — snapshot no histórico". Nunca "anos afetados". `HistoricoDeCorrecoes` embaixo.

## Densidade do formulário (pergunta 4)

**Lista editável acumulando em memória** (não accordion, não inline no card do gate) — mesmo padrão de `BlocoRetencaoDaCaptura` quando o documento ainda não existe. Aqui ele existe, mas a escolha é igual: nada grava linha por linha no passo 3 — a correção inteira (gate+linhas+anexo) é um ato só no passo 4. Gravar antes do gate confirmado deixaria o documento num estado intermediário visível em outra tela antes da correção estar completa.

## Campos

- `gateNovo` — "destacada"\|"nenhuma" — obrigatório — SEM DEFAULT
- linhas 3a — campos do `FormularioDeLinha` (`rotuloLiteral`, `valorCentavos`, `composicao`, `tributo`, `eDescontoEfetivo`, `quemRecolhe`) — reuso `validarLinhaRetencao`, sem sugestão de extração (nunca há PDF novo aqui) — SEM DEFAULT
- `confirmaRemocao` (3b) — boolean — obrigatório com linha a remover — nasce falso — SEM DEFAULT
- `anexo`/`chipEscolhido` (4) — um dos dois, obrigatório se `emitente_corrigiu_a_nota` — SEM DEFAULT
- `reconferiAfirmacao` (4) — boolean — obrigatório nos outros motivos — nasce falso — SEM DEFAULT

## Textos com consequência fiscal (verbatim — Gate Fiscal já fechado deste ticket)

- 3b: "As N linhas de retenção desta nota serão removidas. O fato fica registrado no histórico da correção — mas elas deixam de contar como pendência."
- Nenhuma menção a "anos afetados" em tela nenhuma deste fluxo.
- Pendência pós-correção (3a): textos/cores já em produção (`TEXTO_DA_RETENCAO_ABERTA`, `lib/fiscal/retencao.ts`) via `Repeater` — mesmo texto, mesma cor, mesmo lugar (CONTAI-059); nada redigido aqui.

## Navegação

- `BlocoRetencao`, gate `"nenhuma"`: hoje `null`; passa a mostrar `Card` "Esta nota: sem retenção destacada — Corrigir" → `/documento/[id]/corrigir/retencao`.
- `BlocoRetencao`→`Repeater`, gate `"destacada"`: link extra "Corrigir a resposta sobre retenção" ao lado de "+ Adicionar outra linha", mesmo destino.
- Sucesso/cancelar → `/documento/[id]`.

## Decisões e perguntas abertas

- Linhas já gravadas nunca aparecem no wizard — evita 2º lugar para editar/remover (o `Repeater` já é esse lugar).
- Pergunta ao `cto-obra`: chips do passo 4 precisam data+motivo por anexo, mas `carregarAnexosDoDocumento` (`lib/data.ts:1098`) hoje só devolve `arquivo_path` — dívida de dado (join com `revisao`, ou coluna nova).
- Pergunta ao `contador`: 3c não grava e não deixa rastro, mesma régua do `ErroEstaNaNota` — confirmar que o motivo do passo 1 também não deixa rastro nesse caso (presumido aqui).
