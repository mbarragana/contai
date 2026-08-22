## Dívidas nomeadas no Gate 2 do CONTAI-019 — 2026-08-18

*Três, todas levantadas pelo `cto-obra` e pelo `contador` e conscientemente
NÃO implementadas na rodada. A D28 é a única que promete alguma coisa ao
Mateus na tela — as outras duas são defesa de suíte e de acervo.*

### D28 — a tela promete que o relatório trava, e hoje nada trava

⚠️ **É a que não pode se perder, e a frase é literal:**

> o texto em tela **promete que o relatório trava**, e hoje **nada trava** — o
> ticket da **US-004** tem de chamar `podeGerarRelatorioAnual`, senão aquele
> texto vira mentira.

**Onde a promessa está escrita**, em três lugares que o CONTAI-019 acabou de
publicar:

- `app/compromisso/[id]/page.tsx` — o cartão do vencido diz que, sem resposta,
  **nenhum relatório anual pode ser gerado**;
- `app/_components/agendado.tsx` — a mesma consequência no cartão da home;
- `app/page.tsx` — o bloco de agendados.

**O mecanismo existe e está testado**: `podeGerarRelatorioAnual`
(`lib/fiscal/compromisso.ts`), com o `ano` recebido e provadamente ignorado
(§A do adendo 1), e unitários cobrindo 28/12/2025 bloqueando 2026, "sem data
prevista não bloqueia" e "o *não, é outro pagamento* não desbloqueia".
**O que não existe é o CHAMADOR** — a tela de relatório anual é da US-004.

**Por que isso é pior que uma funcionalidade faltando**: o critério 21 do
CONTAI-019 diz, com todas as letras, que *"este critério não pode ser adiado
com a US-004 — é o único dente do mecanismo"*. A função entregue satisfaz o
critério; a **promessa em tela**, não. O Mateus vai ler que o app trava o
relatório e confiar nisso. Se a US-004 nascer sem chamar a função, ele gera um
relatório anual com buraco conhecido **acreditando que o app o teria impedido**
— e é exatamente na virada do ano que a omissão custa.

**Amarração explícita**: quem pegar a **US-004** topa com esta exigência antes
de começar. Não é sugestão de implementação; é pré-condição de o texto já
publicado continuar verdadeiro. Alternativa aceitável, se a US-004 demorar:
tirar a promessa das três telas — mas aí o dente do critério 21 fica sem
nenhuma expressão para o usuário, e o `contador` precisa ser consultado.

### D29 — `getByRole(..., { name })` sem `exact` erra na direção de APROVAR

O Gate 1b achou **quatro** testes que passavam na página de ORIGEM: `"Pagamento"`
casa por SUBSTRING com `"Registrar o pagamento"`, e as asserções nunca chegavam
na tela que diziam testar. Foram consertados com `waitForURL`, que é o conserto
certo — **ajustar o locator ao que a tela mostra é como se apaga um requisito**.

O que ficou por fazer é a **defesa estrutural**: o `cto-obra` levantou ~31
`getByRole(..., { name })` sem `exact: true` na suíte. Nenhum deles é
falso-positivo hoje; o problema é que **nada impede o próximo**. Teste verde
pelo motivo errado não aparece em relatório nenhum, e a suíte é a única defesa
do projeto contra "passa local, quebra remoto".

Entra no mesmo pacote o `getByRole("alert")` × route-announcer do Next
(escopado em `main` no Gate 2) — mesma família: locator que casa com mais coisa
do que quem escreveu imaginou.

### D30 — `pagamento_diferenca` aceita UPDATE no valor, e não deveria

O critério 32 do CONTAI-019 é explícito: **resolver não apaga o registro da
diferença** (acervo append-only, CONTAI-009). O código só escreve `resolucao` e
`resolvido_em`, e o comentário da migration diz isso — mas o `grant update` é
de **tabela**, não de coluna, porque `information_schema.role_table_grants` só
enxerga privilégio de tabela e um `grant update (col)` viraria falso negativo
em `e2e/privilegios.spec.ts`.

Resultado: **nada no banco impede** um caminho futuro de sobrescrever
`encargos` ou `nao_explicado`. A defesa correta é um **trigger de
imutabilidade** nessas duas colunas, que não interfere no mapa de privilégios.
Não entrou na rodada por ser risco de código futuro, não de código presente.

### D32 — enum fiscal sem contrapartida no parecer é classe, não incidente

*Levantada pelo `contador` no ADENDO 4 (`d69a3cf`) e **decidida pelo `po` no
Gate 4**: **entra como dívida P1, não entra agora.** Vai junto com a D29, no
mesmo passe de defesa estrutural da suíte.*

**O achado, na frase dele:** o `grep` que pegou a divergência entre o enum
`resolucao_diferenca` (cinco valores) e o §F.2 (quatro resoluções) **só existiu
porque o `po` foi olhar**. Vigilância humana não é defesa — é a mesma coisa que
o `status` do CONTAI-018 e o `alter default privileges` do incidente de 17/08:
**proteção de atenção, não de tipo.** Valor de enum fiscal que só existe em
comentário de código é regra fiscal fora do arquivo, que é exatamente o que o
`CLAUDE.md` proíbe.

**A defesa proposta**: um teste que quebre quando um valor de enum com efeito
fiscal não aparecer em `docs/pareceres/`.

⚠️ **Ela não funciona como está, e a correção é pré-requisito, não detalhe.**
O teste compara um identificador `snake_case` com prosa em português. Hoje ele
passaria por sorte de redação — o ADENDO 4 escreve `previsao_errada` entre
crases porque o `contador` quis, não porque alguma regra o obrigue. Sem essa
obrigação, o próximo parecer descreve a resolução pelo **rótulo de tela** e o
teste fica vermelho sem que nada esteja errado. **Teste que fica vermelho sem
motivo é pior que teste nenhum**: ele treina o time a afrouxar a asserção, que é
a D29 pelo outro lado.

**Ordem certa, então:**

1. **Regra primeiro** (`po` + `contador`): parecer que crie ou altere valor de
   enum fiscal **cita o identificador entre crases**. É barato e é o que dá ao
   teste algo estável para procurar.
2. **Teste depois**, junto com a D29.

**Escopo, e é deliberadamente estreito**: só enums cujo valor **muda se o
dinheiro entra ou não no custo** — hoje, `resolucao_diferenca`. `situacao_compromisso`
e `origem_compromisso` não decidem custo (o parecer é explícito em que boleto e
PIX previsto são fiscalmente idênticos: zero) e não entram. Alargar isto para
"todo enum" transformaria uma defesa em cerimônia.

**Por que não agora** `[Certain]`: o Gate 4 é o gate de **fechamento**, e o
FAIL que eu dei foi explícito em **não reabrir código** — os quatro arquivos a
mexer eram todos de `docs/`. Abrir `lib/` agora para acrescentar um teste torna
meu próprio veredito incoerente e reabre o `quality` que já fechou com 295
unitários e 63 E2E verdes. **A dívida está registrada com dono, ordem e
escopo**, que é o que impede ela de virar folclore.

---
