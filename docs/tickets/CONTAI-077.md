# CONTAI-077 Scroll quebrado no rodapé de ação do shell de gestão

## Tipo e Prioridade
Bug — **P1** — fricção real sobre feature recém-entregue (CONTAI-074): sem
correção, a lista de candidatos de vínculo não é usável em listas longas.

## Dor de Origem
Relato: `docs/backlog/94-2026-09-28-scroll-e-busca-nas-telas-de-ligar.md`.

Mateus, tentando ligar uma parcela à nota real da Ilhamix Concreto (NF de
serviço nº 1543, R$16.240,00), relatou: *"o scroll tá quebrado"*. Reproduzido
ao vivo: linhas da lista de candidatos (`/documento/[id]/ligar`, 24
candidatos reais) ficam sobrepostas pelo `RodapeDeAcao` durante boa parte do
scroll, só parando de sobrepor no fim de verdade da lista.

## User Story
Como dono da obra revisando uma lista longa de candidatos numa tela do shell
de gestão, quero ver cada linha por inteiro durante o scroll, sem parte dela
escondida atrás do rodapé de ação fixo.

## Critérios de Aceite
1. [x] Em `/documento/[id]/ligar`, com lista de candidatos longa o bastante
   para exigir scroll (reproduzível com a nota real de 24 candidatos),
   nenhuma linha fica permanentemente sobreposta pelo `RodapeDeAcao` durante
   o scroll intermediário.
2. [x] O mesmo vale, sem exceção, em `/pagamento/[id]/ligar` e em **todas as
   outras 20 telas** que hoje montam `ColunaDeDetalhe` + `RodapeDeAcao`
   juntos: `compromisso/[id]/{cancelar,confirmar,data,valor}`,
   `documento/[id]/{anexar,desligar,ligar,obra}`,
   `documento/[id]/corrigir/{classificacao,emitente,valor}`,
   `fatura/[id]/{alocar,confirmar,parcial}`, `obras/[id]`,
   `obras/[id]/terreno/{desembolsos,financiamento,informe/[anoBase]}`,
   `pagamento/[id]/{comprovante,ligar,obra}`, `pendencias/[id]`.
3. [x] A correção é feita no componente compartilhado
   (`RodapeDeAcao`/`ShellDeGestao`) — nenhuma tela individual muda seu JSX
   para contornar o problema.
4. [x] `RodapeDeAcao` renderiza via portal num slot fora da área rolável
   (`<main>`), como irmão de `<main>` dentro do wrapper
   `flex min-h-0 flex-1 flex-col` do shell — mesmo princípio que a casca de
   430px (`(captura)/layout.tsx`) já usa: quem rola é o corpo, não a página.
5. [x] O slot mantém a mesma largura/alinhamento da coluna (`px-[18px]
   lg:px-9`, `max-w-[640px]`) e o mesmo `data-rodape="acao"`.
6. [x] Fora do shell de gestão (SSR/sem slot no contexto), `RodapeDeAcao`
   continua renderizando inline como hoje (fallback) — nenhuma tela depende
   disso atualmente, mas o componente não pode quebrar se usado assim.
7. [x] Nenhuma das 22 telas listadas no critério 2 regride visualmente: em
   tela com pouco conteúdo, o rodapé fica fixo no pé da viewport com espaço
   vazio acima dele — comportamento já aceito na casca de 430px, não é
   regressão nova.
8. [x] `e2e/shell-desktop.spec.ts:629-643` (largura 640px, alinhamento,
   visibilidade do rodapé) continua passando sem alteração de asserção.
9. [x] Novo teste E2E: com lista longa e `main` scrollado a meio caminho, a
   `boundingBox` do rodapé não intersecta a `boundingBox` de nenhum item
   (`label`) da lista de candidatos.

## Out of Scope
- O card `sticky top-0` ("Falta ligar desta nota") continua sobrepondo
  linhas no TOPO durante o scroll — é cabeçalho de leitura, comportamento
  convencional (sticky header), fora deste relato/ticket.
- Busca na lista de candidatos — vira `CONTAI-078`, ticket separado (zero
  arquivo em comum com este, decisão do `cto-obra`).
- "Vincular a nota antes de pagar" — fora de escopo, já comunicado ao
  Mateus, pode virar relato próprio no futuro.

## Gate Fiscal (Contador)
**Sem impacto fiscal** — correção de mecanismo de layout/scroll, nenhum
campo, texto ou regra fiscal tocado.

## Pre-mortem
1. **Fix pontual numa tela só**: mitigado pelo critério 3 (correção no
   componente compartilhado, não replicada tela a tela).
2. **Regressão silenciosa em outra das 22 telas**: mitigado pelo critério 2
   (lista explícita e completa) e pelo 7 (efeito colateral aceito e
   nomeado, não surpresa).
3. **Rodapé "solto" fora do shell quebra silenciosamente**: mitigado pelo
   critério 6 (fallback inline continua existindo).

## Viabilidade (CTO)
- **Causa raiz**: `RodapeDeAcao` é `sticky bottom-0` DENTRO do
  `<main overflow-y-auto>` do `ShellDeGestao` — sticky em fluxo sobrepõe o
  conteúdo que rola por baixo dele por definição, só "solta" no fim de
  verdade da lista. Não é falta de `padding-bottom` (isso criaria um buraco
  da altura do rodapé no fim de todas as 22 telas, sem resolver o meio do
  scroll).
- **Correção**: `RodapeDeAcao` passa a renderizar via `createPortal` num
  slot que `ShellDeGestao` publica como irmão de `<main>` (mesmo mecanismo
  de contexto que `CabecalhoDaTela` já usa para o topbar). Sem slot no
  contexto (fora do shell) → fallback inline, comportamento de hoje.
- **Modelo de dados**: zero.
- **Arquivos**: `app/_components/detalhe.tsx`, `app/_components/shell.tsx`,
  `e2e/shell-desktop.spec.ts`, `design/mocks/CONTAI-077.md` (já escrito).
- **Complexidade: S**.
- **Dívidas criadas**: nenhuma. Dívida existente registrada, não corrigida
  aqui: o card `sticky top-0` de `ligar` tem a mesma ocultação no topo.

## Dependências
Bloqueado por / Bloqueia: nenhum. Independente do `CONTAI-078` (zero arquivo
em comum, confirmado pelo `cto-obra`).

## Perguntas Abertas
Nenhuma.

## Cenário e checagem final
**Gestão** — as 22 telas afetadas são todas de gestão (formulário/detalhe em
casa, sentado). Sem condição fiscal órfã (Gate Fiscal fechado, sem impacto).
Sem UI que quebre disciplina de campo fiscal (não há campo). **Veredito:
APROVADO.** Pronto para `/develop`.

✅ **Entregue em 2026-09-28.** Gate 4 (`po`) PASS, 9/9 critérios.
`RodapeDeAcao` deixou de ser `sticky bottom-0` dentro do `<main
overflow-y-auto>` (que sobrepõe conteúdo por definição) e passou a
renderizar via `createPortal` num slot que `ShellDeGestao` publica como
irmão de `<main>`, mesmo mecanismo de contexto que `CabecalhoDaTela` já usa
para o topbar. Sem slot (fora do shell), cai no fallback inline de hoje.
Zero das 22 telas tocada — a correção é 100% no componente compartilhado.
Teste novo mede geometria real (recorte por `overflow` não conta como
sobreposição, só o que o `main` de fato mostra) com contraprova: desligar o
slot deixa o teste vermelho, reproduzindo o sintoma original. Gate 2
(`cto-obra`) aprovou sem pendências bloqueantes (2 sugestões de comentário,
não aplicadas). Suíte completa (`npm run quality`, em paralelo com
CONTAI-076/078): 408/409 E2E, única falha é flake confirmado em arquivo não
relacionado. Sem migration. Dívida nomeada, não corrigida: o card `sticky
top-0` ("Falta ligar desta nota") continua sobrepondo linhas no topo
durante o scroll — fora de escopo deste ticket.
