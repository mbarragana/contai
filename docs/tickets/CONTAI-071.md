# CONTAI-071 "Registrar outra compra" não reseta a tela — URL idêntica não navega

## Tipo e Prioridade
bug — **P1**. Bug de navegação pura (não fiscal — nenhum documento nem pagamento em risco), mas trava por completo o fluxo de lançar mais de uma compra de cartão na mesma sessão: depois de "Agendado", o clique não faz nada e o único jeito de continuar é recarregar a página à força ou digitar a URL de novo. É fricção de processo que atinge o caminho de captura repetida (várias compras da mesma ida ao lojista, ou revisão em lote em casa).

## Dor de Origem
Relato direto do Mateus, com screenshot mostrando a tela "Agendado" persistindo depois do clique em "Registrar outra compra" — reproduzido de forma isolada e confirmado ao vivo em produção nesta sessão (2026-09-27). Ainda sem entrada própria em `docs/backlog/` (registrada junto com este ticket).

**Causa raiz** (`app/(captura)/adicionar/compra-cartao/page.tsx:393-395`): o rodapé da fase `"agendado"` tem `<BotaoLink href="/adicionar/compra-cartao">Registrar outra compra</BotaoLink>` — a MESMA URL onde o usuário já está. Confirmado em código pelo `cto-obra`: o Next 16 dá ao segmento de página uma chave de cache de roteador que **ignora a query string** (`createRouterCacheKey`, `layout-router.js:549`). Duas consequências:
- `/adicionar/compra-cartao` → `/adicionar/compra-cartao`: nenhuma navegação, nenhum remount.
- `/adicionar/compra-cartao?documento=xxx` → `/adicionar/compra-cartao`: a URL muda na barra, **mas o componente não remonta** (mesma chave) — então mesmo tirar a query da URL não bastaria sozinho.

**Confirmado que é isolado, não sistêmico**: `grep` em `/adicionar/documento` e `/adicionar/pagamento` não encontrou o mesmo padrão — os `BotaoLink` de lá apontam para `/adicionar`, URL diferente da atual, navegam normalmente. O mesmo rótulo "Registrar outra compra" existe também em `app/(gestao)/fatura/[id]/page.tsx:310`, mas é rota diferente (não é a mesma URL) e não tem o bug — **não é tocado por este ticket**.

## User Story
Como dono da obra — tanto no canteiro (lançando várias compras da mesma ida ao lojista) quanto em casa, sentado, revisando uma leva de notas de cartão — depois de agendar uma compra e ver a tela "Agendado", quando clico em "Registrar outra compra" quero que a tela volte ao formulário vazio imediatamente, pronta para a próxima compra, sem precisar recarregar a página manualmente. Hoje o clique não faz nada e a confirmação da compra anterior fica presa na tela, me obrigando a um contorno manual (F5 ou redigitar a URL) para continuar.

## Critérios de Aceite

1. [x] **O clique navega de fato, sem reload de página.** Clicar em "Registrar outra compra" volta a tela para "Nova compra no cartão" (Passo 2 de 2), sem depender de `window.location` nem de recarregar a página.
2. [x] **O formulário volta ao estado inicial, sem resíduo.** Nenhum campo (favorecido, documento, valor, data da compra, vencimento da fatura) herda o valor da compra anterior; "Parcelado?" volta a nenhuma opção selecionada (campo fiscal nunca nasce com default — disciplina intocada); nenhum erro de validação da tentativa anterior aparece.
3. [x] **Herança de nota (CONTAI-064) não vaza para a próxima compra, mesmo sem F5.** Se a compra registrada tinha chegado via `?documento=` (nascida ligada a uma nota), a próxima compra depois do clique NÃO nasce ligada a essa nota: o bloco "Ligado à nota" não aparece, e a próxima gravação não envia o `documentoOrigemId` da compra anterior.
4. [x] **A URL some da barra de endereço, para o F5 também não ressuscitar a herança.** Depois do clique, a URL deixa de conter `?documento=...`. Um `page.reload()` logo em seguida continua sem qualquer vínculo de nota.
5. [x] **Sem dois botões primários no rodapé.** O novo botão declara `variante="ghost"` explicitamente (hoje o `BotaoLink` trocado herdava esse visual "de graça").
6. [x] **Teste E2E novo em `e2e/cartao.spec.ts`.** Cenário: salvar uma compra chegando via `?documento=`, clicar em "Registrar outra compra" (via `getByRole("button", …)` — o elemento deixa de ser um link), e verificar: heading "Nova compra no cartão" visível, ausência do bloco de nota herdada, URL sem `?documento`, e que um `page.reload()` subsequente continua limpo.
7. [x] **`/fatura/[id]` continua intocado.** O botão de mesmo rótulo nessa rota (linha 310) não muda de comportamento nem de marcação — é uma navegação real, para uma URL diferente, e já funciona.

## ✅ Entregue em 2026-09-27

Gate 4 (`po`) — 7/7 critérios PASS. `Pagina` guarda `const [rodada, setRodada]
= useState(0)` e renderiza `<RegistrarCompraCartao key={rodada} herdarDaUrl={rodada
=== 0} aoRegistrarOutra={() => setRodada(r => r + 1)} />`, exatamente a
decisão de arquitetura do `cto-obra` na Viabilidade acima — nenhum desvio. O
rodapé troca `BotaoLink` por `<Botao variante="ghost" onClick={...}>`, que
executa `router.replace("/adicionar/compra-cartao", { scroll: false })` e só
então `aoRegistrarOutra()`. Remount zera os 14 `useState` de uma vez, sem
reset campo a campo. As duas portas da herança de nota (CONTAI-064) fecham
juntas: `herdarDaUrl={rodada === 0}` cobre a sessão corrente de forma
determinística (não depende de o `router.replace` já ter propagado para
`useSearchParams`), e o próprio `router.replace` cobre o F5 subsequente.
`/fatura/[id]:310` confirmado intocado (`git diff` vazio no arquivo — mesmo
rótulo, rota e navegação diferentes, já funcionava). 2 E2E novos em
`e2e/cartao.spec.ts`, arquivo inteiro 26/26 verde. Nenhum arquivo mudou depois
do APPROVE do `cto-obra` no Gate 2. `npm run quality` completo: **1202 Vitest
/ 375 Playwright** — as 7 falhas de Playwright são todas do `CONTAI-072`, em
desenvolvimento paralelo na mesma árvore (`despesas.spec.ts`,
`vinculo.spec.ts`), fora do escopo deste ticket. Sem migration. Detalhe:
`docs/tickets/README.md`.

## Out of Scope
- Qualquer mudança em `/adicionar/pagamento` ou `/adicionar/documento` — o padrão de lá (`BotaoLink` para uma URL diferente da atual) já está correto e não é tocado.
- Qualquer mudança na regra fiscal do agendamento da fatura ou do gate do parcelamento (`lib/fiscal/fatura.ts`) — bug é só de navegação/estado local.
- `cacheComponents`/bfcache do Next (achado técnico da Viabilidade abaixo) — vira nota registrada, não trabalho deste ticket.

## Gate Fiscal (Contador)
**Não aplicável.** Bug de navegação pura — nenhum campo fiscal, regra de tributo, retenção ou documentação hábil é tocado. Passo 2 do `/tickets-req` dispensado por definição do relato de origem.

## Pre-mortem
1. **Reset manual campo a campo apodrece com o tempo.** Se a correção fosse resetar cada `useState` um a um, o próximo ticket que adicionar estado nesta tela (como o CONTAI-069/070 fizeram em telas vizinhas) tem que lembrar de somá-lo ao reset — esquecer é silencioso: a segunda compra nasce com resíduo da primeira sem erro nenhum. Mitigado pela decisão de arquitetura do `cto-obra` abaixo (remount por `key`, que zera tudo, inclusive estado que ainda não existe).
2. **Herança de nota vazando via F5, não só no clique.** A URL continuar com `?documento=xxx` depois do reset local reabriria o vazamento no primeiro F5. Coberto pelo critério 4 (`router.replace` limpa a URL) e pelo critério 6 (teste cobre o F5 explicitamente).
3. **Favorecido herdado (nome/CNPJ) sobrevivendo à troca por engano.** Coberto pelo remount total do critério 2 — não há caminho parcial de reset que deixe um campo intocado.
4. **Dois botões `primary` no rodapé.** `Botao` tem `"primary"` como variante padrão (diferente do `BotaoLink` trocado, cujo padrão era `"ghost"`) — sem declarar a variante explicitamente, o rodapé ganharia dois botões de destaque. Coberto pelo critério 5.

## Viabilidade (CTO)
Confirmado pelo `cto-obra`, com a causa-raiz de roteamento verificada em código-fonte do Next (`node_modules/next/dist/client/components/layout-router.js:549`), não só inferida do comportamento.

**Decisão de arquitetura: remount por `key`, não reset manual dos 13 `useState`.** O `cto-obra` discordou explicitamente da forma sugerida no relato de origem (trocar `setFase`/limpar campos um a um) e recomendou: `Pagina` passa a guardar `const [rodada, setRodada] = useState(0)` e renderiza `<RegistrarCompraCartao key={rodada} herdarDaUrl={rodada === 0} aoRegistrarOutra={() => setRodada(r => r + 1)} />`. O botão do rodapé vira `<Botao variante="ghost" onClick={...}>` que chama `router.replace("/adicionar/compra-cartao", { scroll: false })` e depois `aoRegistrarOutra()`. Remount zera **todo** o estado do componente, inclusive estado que um ticket futuro venha a adicionar — reset manual exigiria que cada novo `useState` fosse lembrado nesse ponto, e esquecer é silencioso.

**Lista de estado (14 `useState`, linhas 103-134 — não há `useRef`)**, valendo como especificação do que o remount tem de produzir:

| Estado | Valor inicial pós-remount | Nota |
|---|---|---|
| `fase` | `{ nome: "formulario" }` | |
| `erroSalvar` | `null` | |
| `documentoDeOrigemId` | `null` quando `herdarDaUrl` é `false`; senão `documentoNaUrl` | ver herança abaixo |
| `documentoDeOrigem` | `null` | |
| `tentativaDaNota` | `0` | |
| `nome`, `documento`, `valor`, `dataCompra`, `dataVencimento` | `""` | |
| `parcelado` | `null` | campo fiscal — nunca nasce com default |
| `erros` | `[]` | |
| `sugestaoValor` | `null` | |
| `trocando` | `false` | independente do formulário; já é `false` na fase "agendado", então remontar não muda nada aqui |

**Herança de nota (CONTAI-064) — duas portas, cobertas juntas:**
- **Sessão corrente**: `herdarDaUrl={rodada === 0}` controla o `useState(herdarDaUrl ? documentoNaUrl : null)` — garante `null` de forma determinística no remount, sem depender de o `router.replace` já ter atualizado `useSearchParams` no primeiro render (a navegação é assíncrona).
- **F5 depois do clique**: `router.replace` limpa a URL, então um reload não re-semeia o id.
- Não sincronizar `documentoDeOrigemId` de forma reativa com a URL — brigaria com o fluxo de "Desfazer" já existente (linhas 486-491), que zera o id por ato do usuário.

**Arquivos tocados:**
- `app/(captura)/adicionar/compra-cartao/page.tsx` — troca `BotaoLink` → `Botao` (linha 393), import de `useRouter` de `next/navigation`, `key`/props novas em `Pagina` (linha 649). `Botao` já existe em `app/_components/ui.tsx:272`.
- `e2e/cartao.spec.ts` — teste novo (critério 6).
- **Não tocar** `app/(gestao)/fatura/[id]/page.tsx:310` — mesmo rótulo, rota e navegação diferentes, já funciona.

**Complexidade: S.** ~15 linhas de diff em produção + ~25 no E2E. Sem migration, sem UI nova, sem texto fiscal.

**Dependências/dívidas: nenhuma nova.** Observação registrada, não dívida: hoje `MAX_BF_CACHE_ENTRIES = 1` sem `cacheComponents` ligado, então o Next não preserva estado entre rotas irmãs. Se `cacheComponents` for ligado no futuro (o valor sobe para 3), `/adicionar/pagamento` ↔ `/adicionar/compra-cartao` passam a poder reaparecer com estado antigo pela mesma mecânica de bfcache — vale revisitar quando esse flag entrar; fora de escopo aqui.

**Pre-mortem técnico complementar:**
- Remontar re-executa `useObraDoRegistro`, produzindo um flash breve de "Carregando a obra" — mesmo efeito que uma navegação real teria; aceitável para complexidade S.
- `Botao` precisa de `variante="ghost"` explícita (default dele é `"primary"`; o `BotaoLink` trocado tinha `"ghost"` como default) — sem isso, dois botões primários no rodapé.

## Dependências
Bloqueado por / Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
Vale para os dois cenários: **captura** (canteiro, lançando várias compras da mesma ida ao lojista) e **gestão** (em casa, revisão em lote de uma leva de notas). É bug de estado, não de layout — não há tela nova, então o Gate 0 (`/design`) não é necessário.

Serve indiretamente às metas do produto: destrava o fluxo de captura repetida sem forçar um contorno manual (F5/redigitar URL) que poderia levar o Mateus a pular o anexo obrigatório de uma próxima compra por frustração com a tela travada — meta 1 (nenhum pagamento sem documento hábil). A correção da herança de nota (critérios 3-4) evita um vínculo fiscal errado (uma compra nascendo ligada à nota de outra) que contaminaria a discriminação anual — meta 2.

**Veredito: APROVADO.** Sem Gate Fiscal necessário (bug de navegação pura). Viabilidade técnica de complexidade S confirmada pelo `cto-obra`, com decisão de arquitetura explícita (remount por `key` em vez do reset manual sugerido no relato original) e sem discordância entre `po` e `cto-obra` quanto à direção da correção. Pronto para `/develop` sem Gate 0.
