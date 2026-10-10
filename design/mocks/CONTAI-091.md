# CONTAI-091 — terceiro estado "Pré-vínculo" visível em Home, `/despesas` e navegação aditiva em `/documento/[id]`
Cenário: **gestão** (em casa, sentado, revisando Home/`/despesas` antes de
decidir o que fazer — doutrina do CLAUDE.md, "Teste do Canteiro" não se aplica)

**Nível 2** — delta em três superfícies já em produção, nenhuma rota nova,
nenhum campo novo, nenhum estado de loading/vazio/erro novo (a condição de
existir é a mesma de hoje: nota em `notasSemPagamento`/`documentosHabeisSemPagamento`
sem agendamento ELEITO). Só muda chip, texto curto e destino de link onde a
nota já tem pré-vínculo aberto. 27 telas HTML para isto não compraria decisão
nenhuma — é exatamente o caso que motivou a mudança de 2026-09-20.

## Fonte dos dados (decidida pelo `cto-obra`, não redecidida aqui)
`preVinculosPorDocumento(compromissos, hojeIso)` → `Map<documentoId, {
compromissoIds, n, href, chip, resumo }>`, chaves disjuntas de
`agendamentosPorDocumento` — "Agendado" sempre precede. `chip` =
`CHIP_PRE_VINCULO` (constante, nunca redigida aqui). `href` = `/compromisso/{id}`
quando N=1, `/documento/{id}` quando N≥2.

## Composição por nota, nas 3 superfícies
`agendado = agendamentosPorDocumento.get(id)`
`preVinculo = agendado ? undefined : preVinculosPorDocumento.get(id)`
Precedência: **Agendado > Pré-vínculo > Sem pagamento ligado** — nunca dois
chips na mesma nota.

## Telas e estados

### Home — `app/(gestao)/page.tsx`, painel "Notas hábeis sem pagamento vinculado" (~207-299)
Dentro do `.map(n => ...)` existente, mesma estrutura de card (chip → título →
Dica → CTA), SEM painel novo:
```
[Chip âmbar VAZADO] Pré-vínculo — ainda não é custo
Título da nota
{favorecido} — previsto R$X para DD/MM/AAAA · R$ <valor da nota>
[BotaoLink ghost]  N=1 → "Revisar vínculo"
                   N≥2 → "Ver vínculos (N)"
```
- Chip: `cor="amb"`, `peso="vazado"` — mesmo peso visual que o detalhe já usa
  para `CHIP_PRE_VINCULO` (comentário em `compromisso.ts:1202-1203`: "o peso
  visual é o do chip 'Agendado' — cor=amb, peso=vazado"). **Nunca**
  `peso="preenchido"` (isso é reservado ao vencido) nem cor diferente de âmbar.
- Linha "Dica": reaproveita o MESMO formato curto que `agendado.resumo` já usa
  (`resumoDoAgendamento`), não a frase longa de `textoPreVinculoDaNota` — essa
  frase longa já mora em `/documento/[id]` e repeti-la aqui duplicaria o que o
  chip + CTA já dizem. Com N≥2: lista curta separada por vírgula, mesmo
  formato, sem a cauda "mas nenhum pagamento aconteceu ainda" (está implícita
  no próprio chip).
- Código: `chip = agendado?.chip ?? preVinculo?.chip ?? "Sem pagamento ligado"`;
  `peso = agendado ? pesoDoChip[agendado.urgencia] : preVinculo ? "vazado" : "preenchido"`;
  Dica = `agendado?.resumo ?? preVinculo?.resumo ?? n.detalhe`.
- CTA: `agendado` → inalterado. Sem `agendado`, com `preVinculo` →
  `<BotaoLink href={preVinculo.href} variante="ghost">` (nunca `primary` —
  não é cobrança, é convite a revisar). Sem os dois → inalterado ("Ligar a um
  pagamento", `primary`).

### `/despesas` — `lib/fiscal/despesas.ts` bloco 6 (~701-741) + `page.tsx` célula Situação (~547-561)
Linha da tabela, célula "Situação" (mesma `<Texto>`/`<Chip>` de hoje, SEM novo
slot):
```
[chip cinza "neutra", como hoje] Pré-vínculo — ainda não é custo
{consequência — EXPLICACAO_NOTAS_SEM_PAGAMENTO, inalterada}
{favorecido} — previsto R$X para DD/MM/AAAA   ← linha "nota", novo conteúdo
```
- **Cor da pílula continua `"neutra"` (cinza, `bg-soft`/`text-mut`)** — não
  muda para âmbar-vazado aqui. Decisão deliberada: nesta tabela "neutra" já É
  o tratamento visual do terceiro estado (comentário em `page.tsx:570-576`,
  "o neutro não é uma cor de gravidade nova"); o que distingue pré-vínculo de
  "Agendado"/órfão dentro desta tabela é o **texto do chip e da linha "nota"**,
  nunca a cor — âmbar nesta tabela já tem significado reservado (vencido sem
  resposta). Só escala para `"amb"` se por algum motivo a nota também estiver
  vencida — mas isso é o ramo `agendado`, que tem precedência e nunca coexiste.
- Código: `chip: agendado?.chip ?? preVinculo?.chip ?? CHIP_SEM_PAGAMENTO`;
  `cor` inalterado (`agendado?.vencidoSemResposta === true ? "amb" : "neutra"`
  — já cai em `"neutra"` sem mudança, porque pré-vínculo nunca é vencido);
  `consequencia` inalterado (cai em `EXPLICACAO_NOTAS_SEM_PAGAMENTO` sem
  mudança, pela mesma razão); `nota: agendado?.resumo ?? preVinculo?.resumo ?? null`.
- Link da linha (`Abrir →`, ~555-561): `linha.href = agendado?.href ?? preVinculo?.href ?? linha.href`
  (mesma regra que já existe para `agendado`, estendida).

### `/documento/[id]` — navegação aditiva no bloco de pré-vínculo (~305-315)
Nenhum estado novo, nenhuma mudança de texto — só cada item da lista já
exibida (`compromissosQuePreLigam`) ganha link. Hoje:
```jsx
<p>{textoPreVinculoDaNota(preLigadoPor)}</p>   // string única, sem link
```
Passa a (texto final idêntico, byte a byte; só os nomes/resumos de cada
compromisso tornam-se `<Link>`):
```jsx
<p className="mt-1.5 text-[13.5px]">
  {preLigadoPor.map((c, i) => (
    <span key={c.id}>
      {i > 0 ? ", " : ""}
      <Link href={`/compromisso/${c.id}`} className="underline">
        {resumoDoAgendamento(c)}
      </Link>
    </span>
  ))}{" "}
  {preLigadoPor.length === 1 ? "está pré-ligado" : "estão pré-ligados"} a esta
  nota, mas nenhum pagamento aconteceu ainda. Esta nota continua sem pagamento
  vinculado até que um pagamento de verdade seja confirmado e ligado a ela —
  ela segue contando em "Notas hábeis sem pagamento vinculado".
</p>
```
`resumoDoAgendamento` já é exportado de `lib/fiscal/compromisso.ts:1163`
(mesma função que gera o texto de cada item hoje, dentro de
`textoPreVinculoDaNota`) — nada novo é redigido, só a composição JSX troca de
string única para spans com `<Link>`. Precisa importar `Link` de
`next/link` (ainda não importado neste arquivo).

## Campos
SEM CAMPO FISCAL NOVO — as três mudanças são de leitura e navegação (chip,
texto curto, `href`). Nenhum input, nenhum formulário, nenhum "Salvar". A
disciplina de campo vazio/preenchido e proibição de default não se aplica
aqui por ausência de campo, não por exceção.

## Textos com consequência fiscal
- `CHIP_PRE_VINCULO` = "Pré-vínculo — ainda não é custo" —
  `lib/fiscal/compromisso.ts:1205`, ADENDO 6 §J.2 de
  `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` — verbatim nas
  3 superfícies, nunca reescrito.
- `textoPreVinculoDaNota(...)` (mesmo parecer, §J.2) — já em produção em
  `/documento/[id]`; este ticket só acrescenta `<Link>` por item, texto final
  inalterado.
- `EXPLICACAO_NOTAS_SEM_PAGAMENTO` — inalterada, continua sendo a consequência
  padrão de toda nota "sem pagamento ligado" em `/despesas`, pré-vínculo
  incluso.
- Nenhum texto novo foi redigido para este ticket.

## Navegação
- Home/`/despesas`, N=1 → `/compromisso/{id}` (bifurcação cartão×PIX/boleto já
  mora lá — decisão do `cto-obra`).
- Home/`/despesas`, N≥2 → `/documento/{id}` (lista os N em texto, sem eleger 1).
- `/documento/{id}`, cada compromisso pré-ligado listado → `/compromisso/{id}`
  (novo, aditivo).

## Decisões de design e perguntas abertas
- Decisão: CTA ghost (nunca primary) em Home para pré-vínculo — é convite a
  revisar algo já resolvido por intenção, não uma cobrança como "Responder
  agendamento" (que é primary só no vencido). Mesma régua de peso que já
  distingue "Agendado dentro do prazo" (ghost) de "vencido" (primary).
- Decisão: rótulo do CTA com contagem só quando N≥2 ("Ver vínculos (N)"); com
  N=1 o rótulo não repete número ("Revisar vínculo"), para não soar burocrático
  no caso mais comum.
- Decisão: a linha "nota"/"Dica" nas listas (Home, `/despesas`) usa o formato
  curto de `resumoDoAgendamento`, não a frase integral de
  `textoPreVinculoDaNota` — evita duplicar, em densidade de lista, o que o
  chip e a consequência genérica já dizem; a frase integral continua exclusiva
  do detalhe. Sinalizo esta escolha porque é leitura minha sobre onde cortar
  texto, não algo que o parecer prescreve literalmente — reversível se o
  Mateus preferir a frase completa também na lista.
- Pergunta aberta (não bloqueia `/develop`): o campo `resumo` do Map que o
  `cto-obra` especificou (`{ ...; resumo: string }`) já nasce no formato curto
  acima, ou nasce como `textoPreVinculoDaNota` completo e cabe ao
  `lead-engineer` decidir o corte na tela? Como designer eu pedi o formato
  curto na lista; se o `cto-obra` já fixou o conteúdo literal de `resumo` como
  a frase integral, o `lead-engineer` deve tratar isso como meu critério de
  UI (o que aparece na tela), não como mudança do dado — e devolver para mim
  se as duas coisas colidirem, em vez de decidir sozinho.
