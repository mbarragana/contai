# CONTAI-061 — anexar comprovante tardio a pagamento já gravado (D56)

Cenário: **gestão** (em casa, sentado; Teste do Canteiro não se aplica).
Nível 2 (spec + ASCII): espelha `/documento/[id]/corrigir/valor` (mesmo
detector, mesma tabela "antes → depois") e reusa `CampoArquivo`/
`subirParaAcervo` do padrão de `/documento/[id]/anexar`. Não é Nível 1 — não há
decisão de layout em aberto, é recombinação de componentes já testados.

Fonte fiscal: `docs/pareceres/2026-09-26-anexo-tardio-de-comprovante-d56.md`.
Nenhum texto novo: os avisos de "ano já declarado" são as constantes
**já existentes** `AVISO_ANO_ANTERIOR`/`SO_SEI_QUE_E_ANO_ANTERIOR`
(`lib/fiscal/revisao.ts`), copiadas literais; o terceiro parágrafo ("vai virar
pendência...") é o mesmo texto hoje inline em `corrigir/valor/page.tsx:458-463`
— sem constante nova a redigir.

## Campos

### `/pagamento/[id]/comprovante`

- `comprovante` — Arquivo (`CampoArquivo`, `accept="application/pdf,image/*"`)
  — obrigatório para o botão de confirmar habilitar — banco:
  `pagamento.comprovante_path` (grava só quando ainda `null`, nunca
  sobrescreve — RPC nova, ver §3) — **SEM DEFAULT — campo fiscal** (o
  próprio comprovante é o documento hábil; não nasce nem sugerido nem
  pré-marcado). Nenhum outro campo nesta tela — não pergunta "nota no CPF"
  nem nada de retenção, ao contrário de `/documento/[id]/anexar`.

## 1. Entrada em `/pagamento/[id]`

O card dedicado "PAGO SEM COMPROVANTE" (`page.tsx:339-361`, `Chip` +
`Consequencia` + `Dica`, quando `p.comprovantePath === null`) ganha um botão,
no mesmo padrão do "Ligar a uma nota" do card de "sem nota" (linhas 317-323):
`<BotaoLink href={`/pagamento/${p.id}/comprovante`} variante="primary">Anexar
comprovante</BotaoLink>`, logo após a `Dica`. A `Linha rotulo="Comprovante"`
vermelha do card de topo (`~244-248`) fica como está, é status compacto; o
card dedicado logo abaixo é onde a consequência já é explicada e agora também
onde se age — o mesmo papel que o card de "sem nota" cumpre para o botão dele.

## 2. Fluxo de `/pagamento/[id]/comprovante`

1. Carrega `carregarPagamento(id)` e, com o `obraId`, `carregarPainel(obraId)`
   — o mesmo par usado em `corrigir/valor`.
2. **Guarda de reentrada**: se `comprovantePath !== null` (URL direta depois de
   já resolvido), banner âmbar "Este pagamento já tem comprovante.", sem
   controle — mesmo papel do guard de `anexar/page.tsx:148-162`; comprovante
   não é corrigível por aqui.
3. **Vazio**: só `CampoArquivo` ("Comprovante do pagamento", ajuda "PDF, foto
   ou print — é ele que comprova este pagamento.",
   `accept="application/pdf,image/*"`). Sem pergunta fiscal — ao contrário de
   `/documento/[id]/anexar`, não há "nota no CPF" nem gate de retenção aqui.
4. **Ao escolher o arquivo**, antes de subir: calcula o delta simulando
   `painelDepois` = `painel.pagamentos` com este pagamento trocando
   `comprovantePath` de `null` para qualquer string não-nula (o detector só
   olha `=== null`, `lib/fiscal/vinculo.ts:270-272`); `documentos` não muda.
   Roda `anosAfetadosDeUmaObra(pagamento.obraId, painel, painelDepois,
   anoCorrente)` — a mesma chamada de `corrigir/valor/page.tsx:122-139`.
   Mostra Card "O que isso muda no seu custo": `Linha` por ano
   (`antes → depois`, `⚠ ano anterior` se `pendencia`) + "Acumulado até
   {anoCorrente}" via `custoComprovadoAteOAno` — mesma tabela de
   `corrigir/valor/page.tsx:405-441`. Se `conta.anos.length === 0`, Dica: este
   pagamento já não bloqueava custo (caso raro).
5. **Ramo A — sem pendência** (`!abrePendencia(conta.anos)`): confirmação
   simples, botão único "Anexar comprovante — o custo confirmado de {ano}
   passa a {valor}"; um clique sobe e grava.
6. **Ramo B — com pendência** (`abrePendencia(conta.anos)`): antes do botão,
   nesta ordem — `Consequencia(AVISO_ANO_ANTERIOR)`,
   `Dica(SO_SEI_QUE_E_ANO_ANTERIOR)`, e o mesmo terceiro parágrafo de
   `corrigir/valor` ("**Vai virar uma pendência na tela inicial.** ... até você
   marcar que já tratou com o contador."). Botão primário "Anexar mesmo assim —
   o custo de {ano} passa a {valor}" + `BotaoLink` secundário "Cancelar" →
   `/pagamento/${id}` sem gravar. Sem modal novo: aviso e botão na mesma tela,
   como em `corrigir/valor`.
7. **Gravar** (os dois ramos): `subirParaAcervo(arquivo, "comprovante")`,
   depois a gravação (§3). Falha em qualquer etapa não grava nada.

## 3. Escrita — função nova (o gap do D56)

Não existe hoje `.rpc`/`.update()` para preencher `comprovantePath` de um
pagamento já gravado, só no INSERT de criação. Precisa de função nova, formato
análogo a `corrigirValorDoDocumento`/`anexarArquivoDocumento`: recebe
`pagamentoId`, `comprovantePath`, `anos: readonly AnoAfetado[]`; grava o path +
rastro (`null` → path, quando, quem — parecer §2) num ato só; se
`abrePendencia(anos)`, abre a mesma `PendenciaPersistente` que
`corrigirValorDoDocumento` já aciona — nunca um segundo mecanismo. **Nome da
RPC, coluna de data do anexo e forma exata do rastro são decisão do
`cto-obra`** (o parecer deixa isso explícito em "O que isto NÃO decide") —
esta tela só exige essa assinatura funcional.

## 4. Os 4 estados

- **Loading**: `Carregando rotulo="Carregando o pagamento"` no load; botão
  `ocupado` ("Anexando…") durante upload+gravação.
- **Vazio**: campo sem arquivo, sem card de delta, Dica "Escolha o arquivo
  para ver o efeito no custo confirmado do ano." (item 3).
- **Erro**: ao **carregar** → `EstadoErro` + tentar de novo; ao
  **subir/gravar** → `ErroDeGravacao`, "Não deu para anexar." / "Nada foi
  alterado — o pagamento continua sem comprovante, e nenhuma pendência foi
  aberta." (mesma estrutura de `anexar/page.tsx:199-215`).
- **Sucesso**: banner verde "Comprovante anexado ✓"; comprovante como item de
  `ListaDeAnexos`; repete a tabela de anos (fato consumado, como a fase
  `"gravado"` de `corrigir/valor`); se `abrePendencia`, mesma `Card` de
  pendência (`GRAVIDADE_CORRECAO_ANO_ANTERIOR`, `AVISO_ANO_ANTERIOR`,
  `BotaoLink href="/pendencias"`). Sem `router.push` automático quando há
  pendência — o Mateus decide quando sair, como em `corrigir/valor`.

## Perguntas abertas

Nenhuma de fluxo/UI. Para o `cto-obra`: assinatura exata da função de gravação
(§3) e confirmar que `anosAfetadosDeUmaObra` não precisa de adaptação quando
`depois` só muda `comprovantePath` (o detector já é genérico sobre
`EntradaAlocacao`, mas é o Gate 2 que fecha isso).
