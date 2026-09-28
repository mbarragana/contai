# Relato + ticket criado, `CONTAI-071` — "Registrar outra compra" não reseta a tela — 2026-09-27

## O relato

O Mateus reportou, com screenshot: "cliquei em registrar outra compra nesta
tela e nada aconteceu". A tela "Agendado" (fase 3 de `/adicionar/compra-cartao`,
depois de salvar uma compra no cartão) continuava na tela, como se o clique
não tivesse feito nada.

## Reprodução e causa raiz

Reproduzido de forma isolada e confirmado ao vivo em produção nesta sessão. O
botão do rodapé é `<BotaoLink href="/adicionar/compra-cartao">Registrar outra
compra</BotaoLink>` — a MESMA URL onde o usuário já está
(`app/(captura)/adicionar/compra-cartao/page.tsx:393-395`). O `cto-obra`
confirmou a causa em código-fonte do Next, não só no comportamento: o
segmento de página usa uma chave de cache de roteador que **ignora a query
string** (`createRouterCacheKey`,
`node_modules/next/dist/client/components/layout-router.js:549`) — então nem
mesmo tirar `?documento=xxx` da URL bastaria sozinho, porque o componente não
remonta de qualquer forma.

**Confirmado isolado, não sistêmico**: `grep` em `/adicionar/documento` e
`/adicionar/pagamento` não achou o mesmo padrão — lá os `BotaoLink` apontam
para `/adicionar`, URL diferente, navegam normalmente. O mesmo rótulo existe
também em `/fatura/[id]` (linha 310), mas é rota diferente e não tem o bug —
fora deste ticket.

## Classificação

Bug de navegação **pura** — sem regra fiscal envolvida, sem obrigação
tributária em risco. Fricção de processo (P1): trava por completo o fluxo de
lançar mais de uma compra na mesma sessão, forçando um contorno manual (F5 ou
redigitar a URL). `/tickets-req` rodou só Passo 1 (`po`) e Passo 3
(`cto-obra`) — sem Passo 2 (Gate Fiscal, dispensado por não tocar regra
fiscal) e sem Passo 4 (sem UI nova).

## Decisão técnica do `cto-obra` — diverge da solução sugerida no relato

O relato original sugeria resetar os 13 `useState` do formulário um a um
(`setFase({ nome: "formulario" })` + limpar cada campo). O `cto-obra`
**discordou** dessa forma e recomendou remount por `key`: `Pagina` passa a
guardar `const [rodada, setRodada] = useState(0)` e renderiza
`<RegistrarCompraCartao key={rodada} herdarDaUrl={rodada === 0}
aoRegistrarOutra={() => setRodada(r => r + 1)} />`. O botão chama
`router.replace("/adicionar/compra-cartao", { scroll: false })` e depois
`aoRegistrarOutra()`. Motivo: reset manual apodrece — o próximo ticket que
adicionar `useState` nesta tela (como o `CONTAI-069`/`070` fizeram em telas
vizinhas) teria que lembrar de somá-lo ao reset, e esquecer é silencioso.
Remount zera **tudo**, inclusive estado que ainda não existe.

**Achado extra do `cto-obra`**: a herança de nota do `CONTAI-064`
(`documentoDeOrigemId`/`documentoDeOrigem`, vinda de `?documento=` na URL)
tem DUAS portas de vazamento, não uma — sessão corrente (coberta pelo prop
`herdarDaUrl`) e F5 depois do clique (coberta pelo `router.replace` limpando a
URL). As duas precisam ser fechadas juntas, ou o vazamento reaparece por F5
mesmo com o reset da sessão corrente funcionando.

## Ticket

`docs/tickets/CONTAI-071.md` — complexidade S, sem migration, sem UI nova,
pronto para `/develop` sem Gate 0. Arquivos: `page.tsx` (produção) +
`e2e/cartao.spec.ts` (teste novo).

## Perguntas Abertas

Nenhuma.
