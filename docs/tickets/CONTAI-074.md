# CONTAI-074 Ligar o mesmo pagamento (ou a mesma nota) a mais de um documento

## Tipo e Prioridade
feature — P1 — fricção de processo real, sem workaround limpo hoje (o único
jeito de contornar seria desligar o vínculo existente, perdendo a prova da
primeira nota, para ligar a segunda). Sem impacto fiscal que eleve a
prioridade a P0 (Gate Fiscal do `contador` fechado sem restrição de valor).

## Dor de Origem
Mateus, registrando um fornecedor de concreto usinado que emitiu 3 notas
fiscais pagas com uma mistura de PIX + cartão dele parcelado em 3x + cartão
da esposa parcelado em 3x (7 pagamentos ao todo, porque "compra no cartão" só
aceita à vista e cada parcela vira um lançamento próprio): tentou ligar uma
parcela já ligada à Nota A também à Nota B, e a tela `/documento/[id]/ligar`
não mostrou essa parcela como candidata — porque a correspondência real entre
parcela e nota, do jeito que o fornecedor faturou, não é 1-para-1 limpa.
Confirmado com o Mateus: ele precisa mesmo do mesmo pagamento contando para
mais de uma nota, não de um jeito de redistribuir sem repetir.

## User Story
Como dono da obra, no cenário de gestão (em casa, sentado, conciliando
pagamento↔nota), quando um fornecedor fatura de um jeito que não corresponde
1-para-1 com os pagamentos que fiz, quero poder ligar um pagamento que já
está 100% absorvido por outra nota a uma nota adicional — vendo antes, de
forma explícita, a quais outras notas ele já está ligado — para que a
conciliação reflita a correspondência real, sem precisar desligar o vínculo
anterior.

## Critérios de Aceite
1. [ ] Spec em `design/mocks/CONTAI-074.md` (nível 2) é a referência de
   implementação — fluxo, os 4 estados e os textos exatos já decididos, para
   as duas telas (`/documento/[id]/ligar` e `/pagamento/[id]/ligar`); sem
   gate de aprovação nem HTML (regra vigente desde 2026-09-20).
2. [ ] `Candidato<T, Outro>` (`lib/fiscal/vinculo.ts`) ganha dois campos:
   `jaLigadoA: Outro[]` (os registros a que o item já está ligado hoje) e
   `cobertoPorInteiro: boolean`. `pagamentosCandidatos`/`documentosCandidatos`
   deixam de FILTRAR por `temSaldoSemNota`/`temSaldoDescoberto` — essas
   funções viram a fonte da flag `cobertoPorInteiro`, não um filtro de
   exclusão da lista.
3. [ ] Em `/documento/[id]/ligar`, um pagamento já 100% absorvido por outra
   nota (`cobertoPorInteiro === true`) não aparece na lista de checkboxes por
   padrão — fica dentro de um bloco colapsado, no fim da lista, com o texto
   novo de `CANDIDATO_OCULTO_PAGAMENTO` (critério 10) e um botão
   `` `Mostrar N pagamentos já cobertos` ``.
4. [ ] Clicar no botão do critério 3 revela esses pagamentos DENTRO da mesma
   lista de checkboxes dos demais candidatos (mesmo estado `marcados`, mesma
   ordenação: favorecido igual → valor igual → menor diferença → data),
   anexados ao fim da lista visível. Não existe botão para escondê-los de
   novo depois de revelados.
5. [ ] Todo candidato com `jaLigadoA.length > 0` — coberto por inteiro ou só
   parcialmente absorvido por outro documento (ex.: pagamento de R$ 3.000 já
   parcialmente ligado a uma NF de R$ 1.000, que já é candidato visível
   hoje) — mostra uma marca informativa: um `Chip` âmbar ("Coberto por
   inteiro" ou "Vínculo parcial") mais a lista do que já está ligado
   (identificador + valor), sempre visível, revelado ou não.
6. [ ] Ao marcar (checkbox) um candidato com `jaLigadoA.length > 0`, aparece
   imediatamente abaixo do item um aviso `Consequencia` cor âmbar com o texto
   exato do Gate Fiscal (ver seção abaixo), citando nominalmente cada
   nota/pagamento a que o item já está ligado. O aviso some se o item for
   desmarcado. Se mais de um candidato marcado tiver vínculo prévio, aparece
   um aviso por item, cada um sob o seu próprio candidato — nunca agregado
   num bloco único no rodapé.
7. [ ] Marcar e salvar (clicar "Ligar"/"Confirmar ligação também...") um
   candidato com vínculo prévio cria um vínculo NOVO em `pagamento_documento`
   sem remover o(s) vínculo(s) anterior(es) — verificável abrindo o registro
   de origem (a outra nota, ou o outro pagamento) e confirmando que o vínculo
   antigo continua intacto.
8. [ ] Quando o acréscimo de "Custo confirmado se ligar agora" no rodapé é
   R$ 0,00 por causa de um candidato de cobertura total (`cobertoPorInteiro`)
   marcado, aparece a frase adicional "Não muda o custo confirmado — muda a
   prova documental: o pagamento passa a comprovar também esta nota." — texto
   distinto do R$ 0,00 por documento não hábil, que mantém a frase já
   existente hoje (" — a nota não é hábil").
9. [ ] O rótulo do `BotaoSalvar` muda para `` `Confirmar ligação também a
   esta nota — R$X` `` (ou "a este pagamento" na tela espelhada) quando ao
   menos um candidato marcado tem `jaLigadoA.length > 0`; mantém o rótulo
   atual (`` `Ligar N pagamentos/documentos — R$X` ``) quando nenhum tem.
10. [ ] `CANDIDATO_OCULTO_PAGAMENTO` e `CANDIDATO_OCULTO_DOCUMENTO`
    (`lib/fiscal/vinculo.ts`) trocam de texto para a versão do Gate Fiscal —
    a versão atual, que presume que cobertura prévia é sempre engano a
    desfazer, deixa de ser verdade e some do código.
11. [ ] Mesma capacidade, mesmo mecanismo (bloco colapsado, marca, aviso,
    rótulo do botão) espelhados em `/pagamento/[id]/ligar`
    (`documentosCandidatos`/`temSaldoDescoberto`), com o texto do aviso na
    versão corrigida pelo `contador` (não é espelho mecânico puro — ver Gate
    Fiscal): a garantia citada é "nunca conta a mesma nota duas vezes na
    soma do custo", não "o mesmo pagamento".
12. [ ] `app/(captura)/adicionar/documento/page.tsx` (terceiro consumidor de
    `pagamentosCandidatos`, fluxo de captura com documento provisório)
    continua filtrando `cobertoPorInteiro` sem oferecer "revelar" — o
    comportamento atual desse fluxo (≤3 interações) é preservado sem
    mudança, e a ativação do "revelar" nele fica fora de escopo deste
    ticket.
13. [ ] Teste unitário novo em `lib/fiscal/vinculo.test.ts`: um pagamento P
    ligado a NF1 (100% absorvido, `cobertoPorInteiro`) e, no mesmo teste,
    também ligado a NF2 do mesmo componente conexo — `custoComprovado` do
    componente resultante = `min(Σ pagamentos elegíveis, Σ documentos
    hábeis)`, e P entra uma única vez em `Σ pagamentos elegíveis` (nunca a
    soma ingênua dos dois vínculos, nunca dobra).
14. [ ] Os testes existentes que cobrem a doutrina anterior de
    `pagamentosOcultosPorCobertura`/`documentosOcultosPorCobertura`
    (`vinculo.test.ts`, em torno das linhas 780-820) são reescritos para a
    nova forma (flag `cobertoPorInteiro` dentro da lista única), não apenas
    apagados — o critério "nunca sumiço mudo" continua valendo, só muda a
    saída que o prova.
15. [ ] E2E novo em `e2e/vinculo.spec.ts`: pagamento ligado a NF1, revelar o
    bloco colapsado em NF2, marcar, confirmar o aviso, ligar, e verificar que
    o custo confirmado da obra não conta o pagamento duas vezes.
16. [ ] Nada aparece marcado por padrão em nenhum dos dois estados (visível
    ou revelado); nenhum vínculo nasce sem toque explícito no checkbox
    seguido do clique em salvar — doutrina já vigente do seletor, reafirmada
    para o item revelado.

## Out of Scope
- Redistribuir ou "dividir" o valor de um pagamento entre notas — o
  pagamento inteiro continua entrando na alocação por componente conexo; não
  há conceito de "fatia" deste ticket.
- Desfazer um vínculo (exclusão de `pagamento_documento`) — fora de escopo do
  produto (CONTAI-009, acervo append-only). Quem quiser corrigir um vínculo
  errado continua sem esse caminho, doutrina inalterada.
- Mudar `alocarCusto`/`alocarSimulando` — já corretos por construção
  (union-find + teto do mínimo); este ticket é só o filtro de apresentação
  que escondia um candidato legítimo.
- Ativar "revelar candidato já coberto" no fluxo de captura
  (`adicionar/documento`) — fica preservado como está (critério 12); virar
  ticket à parte se o Mateus quiser essa capacidade também na captura.
- Construir a ficha "Pagamentos Efetuados" (CPF-por-CPF) — não existe gerador
  dedicado hoje. Este ticket não cria regressão nela, mas registra a
  invariante que o gerador futuro tem que respeitar (ver Gate Fiscal e
  backlog).
- Gestão de cronograma de obra, orçamento vs. realizado de engenharia,
  comunicação com empreiteiro — fora de escopo do produto.

## Gate Fiscal (Contador)
**Sem impacto fiscal substantivo** — corrige um filtro de UX que contrariava
a arquitetura de alocação já ratificada; nenhuma regra de custo de aquisição,
aferição INSS ou documentação hábil muda.

**Regra exata:**
- **(a)** SE pagamento e documento são da mesma obra E o pagamento ainda não
  está ligado A ESTE documento → PERMITIR a ligação, mesmo que o pagamento já
  esteja 100% absorvido por OUTRO documento. Cobertura prévia deixa de
  excluir da lista de candidatos ou motivar recusa. SE a nova ligação une
  dois componentes conexos → REVALIDAR (recalcular) `custoComprovado` do
  componente resultante pela fórmula já existente (`min(Σ pagamentos
  elegíveis, Σ documentos hábeis)`) — nenhuma trava nova é necessária.
  Continua RECUSANDO (inalterado): obras diferentes; vínculo idêntico
  repetido ao mesmo documento.
- **(b)** SE o pagamento (ou a nota, na direção espelhada) já possui vínculo
  com outro(s) registro(s) → AVISAR, antes de gravar, citando nominalmente
  cada nota/pagamento já vinculado (identificador e valor). MARCAR (sempre,
  não só no aviso): na lista de candidatos, todo item com vínculo prévio
  aparece identificado com o que já está ligado — nunca sumiço mudo.

**Texto do aviso, `/documento/[id]/ligar` (candidato = pagamento):**
> "Este pagamento já está ligado a [Nota nº X — R$ valor][, Nota nº Y — R$
> valor]. Ligá-lo também a esta nota é permitido: o mesmo pagamento pode
> servir de prova para mais de um documento, sem duplicar valor — o sistema
> nunca conta o mesmo pagamento duas vezes na soma. Confirme que este
> pagamento realmente corresponde também a esta nota, e não é engano."

**Texto do aviso, `/pagamento/[id]/ligar` (candidato = documento) —
⚠️ garantia final DIFERENTE, não é espelho mecânico:** as duas direções não
protegem contra a mesma duplicação. Nesta direção são dois pagamentos
distintos e reais provando a mesma nota — o que não pode duplicar é a NOTA no
custo, não "o pagamento":
> "Esta nota já está ligada a [Pagamento — data/favorecido — R$ valor][,
> Pagamento — data/favorecido — R$ valor]. Ligá-la também a este pagamento é
> permitido: a mesma nota pode ser comprovada por mais de um pagamento, sem
> duplicar valor — o sistema nunca conta a mesma nota duas vezes na soma do
> custo. Confirme que esta nota realmente corresponde também a este
> pagamento, e não é engano."

**Texto novo de `CANDIDATO_OCULTO_PAGAMENTO`** (substitui o atual, que
presumia que cobertura prévia é sempre engano a desfazer):
> "Pagamento já ligado a outra nota, com valor totalmente absorvido, não
> aparece aqui por padrão. Se este pagamento também é desta nota — é
> permitido: o mesmo pagamento pode servir de prova para mais de uma nota,
> desde que a soma não ultrapasse o que foi realmente pago —, revele-o para
> escolher. Se ele foi ligado à nota errada por engano, abra a nota errada e
> desligue-o antes de ligar aqui."
(`CANDIDATO_OCULTO_DOCUMENTO` espelha trocando nota↔pagamento.)

**Automático × exige revisão humana:** automático — permitir a segunda
ligação nas condições de (a); recalcular o teto do componente; avisar citando
os registros já vinculados; marcar cobertura prévia na lista de candidatos.
Exige CRC: nenhuma exigência nova além das já registradas nos pareceres de
origem.

**Pagamentos Efetuados / discriminação anual:** sem risco de duplicar valor,
desde que todo relatório continue agregando por `pagamento.id` distinto (um
pagamento = um valor = uma linha), nunca por linha de `pagamento_documento` —
`alocacao.porPagamento` e `carregarSaidaAnual` já seguem essa disciplina hoje.
Não há gerador dedicado da ficha "Pagamentos Efetuados" no código ainda, logo
não há regressão AGORA; é invariante a não violar quando esse gerador nascer
(dívida registrada no backlog, não critério deste ticket).

**Pareceres de origem:** `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`
(§1 condição 3, §2, §3 teto do mínimo, ADENDO 18/08 repartição cronológica, e
ADENDO 2026-09-28 "cobertura prévia não é motivo de exclusão da lista de
candidatos" — normativo direto para este ticket, com a correção da cláusula
final do aviso espelhado registrada na mesma sessão); e
`docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` §5.1 (defesa
estrutural do teto do mínimo contra dupla contagem).

## Pre-mortem
1. Confusão do usuário vendo o mesmo pagamento em duas notas sem lembrar por
   que ligou — mitigado por sempre mostrar, na lista (marca) e no aviso, a
   quais outras notas o pagamento já está ligado, antes e depois de
   confirmar.
2. Usuário liga por engano o pagamento errado a uma segunda nota (fat-finger
   num seletor que agora aceita mais candidatos do que antes) — mitigado por
   nada vir marcado por padrão, pelo aviso explícito exigir leitura antes de
   confirmar, e pelo rótulo do botão mudar de "Ligar" para "Confirmar ligação
   também..." (fricção deliberada, não automatismo).
3. Ligar o mesmo pagamento a notas de fornecedores diferentes (não só do
   mesmo fornecedor, como no caso de origem) funde componentes conexos que
   antes eram independentes — o teto do mínimo continua matematicamente
   correto (confirmado no Gate Fiscal e no critério 13), mas a leitura humana
   de "quanto cada nota individualmente já tem coberto" fica mais indireta
   quando muitas notas compartilham pagamentos. Aceito como risco: a marca do
   critério 5 e o aviso do critério 6 são a mitigação disponível hoje; virar
   uma visão de "componente inteiro" é melhoria futura, não deste ticket.

## Viabilidade (CTO)
- **Modelo de dados**: nenhum impacto. `pagamento_documento` já é N:M desde a
  `0001_init.sql` (PK composta `(pagamento_id, documento_id)`, sem `unique`
  em `pagamento_id`); `insert`/`delete` para `authenticated` já concedidos na
  `0006_vinculo_grants.sql`; `criarVinculos` (`lib/data.ts:1583`) já faz
  `upsert` com `ignoreDuplicates`, então "vínculo idêntico repetido" já é
  no-op idempotente. Sem migration, sem GRANT novo, sem mudança em
  `e2e/privilegios.spec.ts`. Não colide com o `CONTAI-073` em desenvolvimento
  paralelo (`lib/data.ts` não precisa ser tocado por este ticket).
- **Arquivos**: `lib/fiscal/vinculo.ts` (tipo `Candidato`,
  `pagamentosCandidatos`, `documentosCandidatos`, as duas constantes
  `CANDIDATO_OCULTO_*`, constante nova para o aviso (b));
  `lib/fiscal/vinculo.test.ts` (chamadas existentes mudam de assinatura +
  casos novos, incluindo o critério 13); `app/(gestao)/documento/[id]/ligar/page.tsx`;
  `app/(gestao)/pagamento/[id]/ligar/page.tsx`; `app/(captura)/adicionar/documento/page.tsx`
  (só ajuste de chamada, preservando o filtro atual — critério 12);
  `e2e/vinculo.spec.ts` (cenário novo do critério 15); `design/mocks/CONTAI-074.md`.
- **Complexidade: M** — a função pura é S; o M vem das duas telas de gestão +
  o ajuste na captura + os testes novos (unitário + E2E). Nada de infra.

## Dependências
Bloqueado por / Bloqueia: nenhum. Não colide com o `CONTAI-073` em
desenvolvimento paralelo (arquivos diferentes: `lib/fiscal/vinculo.ts` e as
telas `ligar` vs. `lib/data.ts`, migration e `/compromisso/[id]/valor`).

## Perguntas Abertas
Nenhuma bloqueante — os 4 gates fecharam sem pendência. Dívida a registrar no
backlog (não bloqueia este ticket): quando a ficha "Pagamentos Efetuados"
ganhar gerador dedicado, ela precisa somar por `pagamento.id` distinto, nunca
por linha de `pagamento_documento` (Gate Fiscal, acima).

## Cenário e checagem final
**Gestão** (em casa, sentado). As duas telas afetadas já são de gestão hoje
(conciliação pagamento↔nota, fora do momento de captura) — o "Teste do
Canteiro" não se aplica: a tarefa "este pagamento também prova esta outra
nota" acontece depois, olhando extrato e notas lado a lado, nunca no instante
do pagamento no canteiro. A terceira tela consumidora
(`adicionar/documento`, captura de verdade) fica fora de escopo (critério
12).

**Veredito: APROVADO.** Serve à meta 1 (nenhum pagamento sem documento
hábil): hoje um pagamento real que prova uma segunda nota fica invisível para
ela, e a nota sem pagamento ligado aparece incorretamente como "sem
cobertura" quando na verdade já tem prova, só que o app escondia o candidato.
Sem condição fiscal órfã (Gate Fiscal fechado e citado por parecer, inclusive
a correção da cláusula final do aviso espelhado). Sem UI que quebre a
disciplina de não-default em campo — nada nasce marcado.

✅ **Entregue em 2026-09-28.** Gate 4 (`po`) PASS. `Candidato<T, Outro>`
unificado com `jaLigadoA`/`cobertoPorInteiro`; `pagamentosCandidatos`/
`documentosCandidatos` pararam de filtrar por `temSaldoSemNota`/
`temSaldoDescoberto` — essas viraram fonte da flag, não motivo de exclusão.
Lista única nas duas telas (`documento/[id]/ligar`, `pagamento/[id]/ligar`),
bloco colapsado "Mostrar N…", chip "já ligado a:", texto de consequência
espelhado por direção (documento→pagamento: "mesmo pagamento não conta duas
vezes"; pagamento→documento: "mesma nota não duplica no custo"). Critério 13
(o mesmo pagamento ligado a duas notas não dobra o custo) provado
diretamente em `alocarCusto`. `/adicionar/documento` manteve o filtro
(critério 12, fora de escopo). Gate 2 (`cto-obra`+`contador`) APPROVE
condicionado a 1 pendência documental: os textos literais das duas telas
precisavam estar copiados no parecer antes do commit — fechado com um
ADENDO datado de 2026-09-28 em
`docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`, conferido byte a
byte contra o código pelo Gate 4. Nenhuma mudança de código depois do
APPROVE. 1214/1214 Vitest, `e2e/vinculo.spec.ts` verde (25 testes, 2 novos).
Sem migration. Dívida registrada no backlog: gerador futuro da ficha
Pagamentos Efetuados precisa somar por `pagamento.id`, nunca por linha de
`pagamento_documento`.
