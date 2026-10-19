# CONTAI-099 CTA "Registrar pagamento" na confirmação do documento

## Tipo e Prioridade
feature — P1 — fricção de processo real e recorrente, citada ao vivo pelo
Mateus. Não é P0: nenhuma regra de documentação hábil muda, é só atalho de
navegação para um mecanismo que já existe e já funciona. Não é P2: não é
capricho, é o caso comum de obra (nota chega e já foi paga) ficando sem
caminho direto.

## Dor de Origem
`docs/backlog/112-2026-10-19-cta-registrar-pagamento-apos-salvar-documento.md`.
Citação literal do Mateus: *"quando eu adiciono um registro, deveriamos
adicionar um novo passo que é registrar pagamento, já na sequencia da nota
fiscal, porque agora por exemplo eu recebi a nota e já paguei e já cadastrei
tudo ao mesmo tempo, daí eu tive que cadastrar a nota, voltar ao inicio e
cadastrar o pagamento."*

Hoje, depois de salvar um documento em `/adicionar/documento`, a tela de
confirmação (`Registrado`, `app/_components/registrado.tsx`) só mostra TEXTO
estático "registrar o pagamento quando ele acontecer" quando `fase.ligados
=== 0` — sem botão (`documento/page.tsx:1235-1244`). O mecanismo para fazer
exatamente isso já existe e já funciona:
`/adicionar/pagamento?documento=<id>` (`pagamento/page.tsx:147-233`) herda
favorecido/CNPJ, sugere o valor pelo saldo (`sugerirValorDaNota`) e já cria o
vínculo pagamento↔documento no salvar — hoje só acionado a partir de
`/documento/[id]` (`documento/[id]/page.tsx:357-365`, `ligar/page.tsx:585`),
nunca a partir da própria tela de confirmação do fluxo de captura.

## User Story
Como Mateus, depois de cadastrar uma nota que ele já pagou, quero um botão
real na própria tela de confirmação (`Registrado`) para ir direto registrar
esse pagamento — com favorecido, CNPJ e valor sugerido já herdados da nota, e
o vínculo criado só quando eu confirmar no formulário seguinte — para não
precisar voltar à Home e navegar de novo até o detalhe do documento só para
achar o mesmo link que eu já sei que existe lá.

## Critérios de Aceite
1. [x] Proposta de design nível 2 em `design/mocks/CONTAI-099.md` (rótulo,
   ASCII antes/depois, decisões de onde o botão entra no `Card`).
2. [x] Na tela de confirmação (`Registrado`, chamada a partir de
   `/adicionar/documento` em fase "salvo"), quando `fase.ligados === 0 &&
   !fase.vinculoFalhou`, o campo "Próximo passo" ganha, no mesmo `Card`
   (abaixo da `Linha` existente, sem alterar o texto dela), um **botão
   único** com o rótulo **"Registrar o pagamento desta nota"**, levando para
   `/adicionar/pagamento?documento=<id>`, mais a dica de apoio "Favorecido,
   CNPJ e valor sugerido já vêm desta nota." Não há segundo botão "paguei no
   cartão" nessa tela — `/adicionar/pagamento` já bifurca para
   `/adicionar/compra-cartao?documento=<id>` pelo seletor "Como foi pago"
   (mecanismo existente desde o CONTAI-064). O clique só navega: não cria
   pagamento nem vínculo por si só — a criação continua acontecendo no
   "Salvar" do formulário seguinte.
3. [x] Quando `fase.ligados > 0` (já tem pagamento vinculado nesse ato), o
   comportamento atual (texto "nada pendente — N pagamento(s) ligado(s)")
   permanece byte a byte inalterado — sem regressão do caso já coberto.
4. [x] Quando `fase.vinculoFalhou === true` (tentativa automática de vínculo
   que não deu certo — estado real, hoje força `ligados` a 0 no mesmo
   código), a CTA de "registrar pagamento NOVO" **não aparece**: esse ramo
   já tem um pagamento existente, só não ligado, e oferecer "Registrar
   pagamento" ali induziria a criação de um pagamento duplicado. O
   comportamento atual desse ramo (banner vermelho + texto orientando abrir
   o documento e usar "Ligar a um pagamento") permanece inalterado.
5. [x] O botão reaproveita 100% o mecanismo já existente de
   `/adicionar/pagamento?documento=<id>` (herança de favorecido/CNPJ,
   sugestão de valor pelo saldo, criação do vínculo no salvar) — zero lógica
   nova de herança, zero mudança de schema.
6. [x] As duas ações hoje existentes na tela de confirmação ("Corrigir a obra
   deste registro", "Voltar ao início") continuam presentes e funcionando —
   o botão novo se soma, não substitui nenhuma delas.
7. [x] `Registrado` ganha um prop novo opcional `acaoProximoPasso?:
   ReactNode`, renderizado dentro do mesmo `Card` que já tem
   Obra/Próximo passo/Custo, imediatamente depois da última `Linha` e antes
   de `{extra}` — não reaproveita `extra` (já ocupado, no mesmo call site,
   pelos avisos ortogonais de CNO ausente e retenção parcial, que podem
   coexistir com o caso novo). O outro consumidor de `Registrado`
   (`pagamento/page.tsx`) não é afetado — o prop é opcional.
8. [x] O botão usa `variante="primary"` (mesmo peso visual de "Voltar ao
   início"; "Corrigir a obra deste registro" continua `ghost`).
9. [x] Rótulo do botão nunca afirma fato consumado (ex.: nunca "Pagamento
   registrado" ou "Nota paga") — é convite à ação. O rótulo
   "Registrar o pagamento desta nota" é fixo (reaproveita byte a byte o já
   usado em `documento/[id]/page.tsx:363-365`), não é escolha livre de quem
   implementa.
10. [x] E2E novo cobrindo: salvar documento sem vínculo → botão "Registrar o
    pagamento desta nota" aparece → clicar → cai em
    `/adicionar/pagamento?documento=<id>` com favorecido/CNPJ herdados e
    valor sugerido corretos; mais asserções confirmando que o caso
    `ligados > 0` (critério 3) e o caso `vinculoFalhou === true` (critério 4)
    não mostram essa CTA.

## Out of Scope
- Reformular o Caminho A (CONTAI-018) para criar pagamento inline dentro do
  próprio formulário do documento — alternativa mais cara, registrada mas
  não escolhida; o caminho via `?documento=` já existe e é mais barato.
- Reabrir a separação deliberada de portas no hub `/adicionar` (decisão
  fechada do CONTAI-018) — este ticket não promete vínculo automático, só
  oferece um atalho ativo para um fluxo que já existe.
- Segundo botão "Comprei no cartão" (herança por texto, CONTAI-089) na tela
  de confirmação — decisão do `cto-obra`: a tela seguinte
  (`/adicionar/pagamento`) já bifurca para cartão pelo seletor "Como foi
  pago"; duplicar essa pergunta na confirmação abriria uma segunda rota de
  herança a manter sem necessidade.
- Trocar o texto do ramo `fase.vinculoFalhou` por um link real para
  `/documento/<id>/ligar` — melhoria opcional registrada em
  `design/mocks/CONTAI-099.md` ("Nota lateral"), não exigida por este
  ticket. O obrigatório nesse ramo é só a ausência da CTA de "registrar
  pagamento novo" (critério 4).

## Gate Fiscal (Contador)
**Sem impacto fiscal direto.** Não muda regime de caixa (a data que conta
para o custo de aquisição continua sendo a da execução do pagamento,
inalterada por este ticket), não muda documentação hábil, não muda cálculo
de aferição INSS, não toca `sustentaCusto`/`pagamento_documento`. É
navegação pura para um mecanismo de herança (`sugerirValorDaNota`) já
aprovado e em produção.

**Precedente `CONTAI-018` (critério 19, não as linhas 116-117 do Caminho A —
citação corrigida pelo `cto-obra`) NÃO se aplica aqui**, e por um motivo mais
específico que "é botão, não texto": o que o CONTAI-018 proibiu foi uma frase
que descrevia comportamento automático inexistente ("a NF vincula depois",
sem ação nem mecanismo por trás). O botão proposto aqui faz o oposto — ao ser
clicado, navega para um formulário real onde o próprio Mateus preenche e
confirma o "Salvar"; nada é vinculado, criado ou afirmado pelo clique em si.
A "separação deliberada de portas" do CONTAI-018 é sobre o **hub**
`/adicionar` (Documento e Pagamento como duas entradas independentes) — não
sobre um link de continuação dentro do mesmo ato de captura, depois que o
documento já foi salvo. Nenhum gate deve citar o CONTAI-018 como veto a este
ticket.

Cuidado de produto (não é regra tributária nova, é consistência de texto já
refletida nos critérios 2 e 9):
- O rótulo/texto do botão usa verbo de ação, nunca afirma fato consumado —
  qualquer formulação que sugira que o pagamento já está registrado,
  vinculado ou pago antes do "Salvar" em `/adicionar/pagamento` reproduziria
  o defeito que o critério 19 do CONTAI-018 corrigiu, com outra tela.
- O clique no botão só navega; a gravação do pagamento/vínculo continua
  condicionada exclusivamente ao "Salvar" do formulário de destino — nenhuma
  lógica de criação implícita nasce nesta tela.
- Caso o `lead-engineer`, no Gate 1, decida também linkar o ramo
  `vinculoFalhou` (nota lateral, fora de escopo): se o fizer, o destino tem
  que ser `/documento/<id>/ligar` (liga pagamento **existente**), nunca
  `/adicionar/pagamento?documento=<id>` (cria pagamento **novo**) — misturar
  os dois nesse ramo específico duplicaria o pagamento.

## Pre-mortem
1. **Condição implementada errada cria pagamento duplicado.** Se o código
   checar só `fase.ligados === 0` (sem `&& !fase.vinculoFalhou`), a CTA
   aparece também no ramo de falha de vínculo — onde já existe um pagamento,
   só não ligado. O Mateus, vendo "Registrar pagamento", cria um novo em vez
   de ligar o existente, e a obra passa a ter um pagamento duplicado que só
   aparece reconciliando o ano inteiro depois.
2. **Texto do botão afirma fato consumado.** Se o rótulo ou texto de apoio
   disser algo como "Pagamento registrado" em vez de convidar à ação, o
   Mateus lê, acha que já está resolvido e não completa o formulário
   seguinte. Mitigado pelo rótulo fixo (critério 9), reaproveitado de uma
   tela que já está em produção.
3. **Rótulo ambíguo mata a adoção mesmo com o mecanismo certo.** Se o botão
   saísse com texto genérico de navegação em vez de nomear a ação, o Mateus
   não reconheceria o atalho que ele mesmo pediu e voltaria a navegar
   manualmente — mitigado por reaproveitar, byte a byte, o rótulo já usado em
   `/documento/[id]`.

## Viabilidade (CTO)
- **Modelo de dados**: zero. Sem migration, sem RPC, sem coluna nova. O
  vínculo nasce no `criarVinculos` já existente de `pagamento/page.tsx:362`.
- **Cartão (pergunta 1 do relato) — resolvido: um botão só.** A tela de
  confirmação não tem como saber, neste ponto, se a nota foi paga no cartão
  (`Fase.salvo` não carrega meio de pagamento). Mas isso é irrelevante: quem
  já faz essa bifurcação é a própria `/adicionar/pagamento`, cujo seletor
  "Como foi pago" leva para `/adicionar/compra-cartao?documento=<id>` quando
  o Mateus escolhe Cartão (`pagamento/page.tsx:755-772`), mecanismo em
  produção desde o CONTAI-064. **Correção à investigação do relato**: o item
  5 do relato ("compra no cartão nunca pode herdar `documento_origem_id`,
  ADENDO 9") está errado para compra **avulsa** no cartão — ela herda por
  `?documento=` desde o CONTAI-064 (`compra-cartao/page.tsx:141`,
  confirmado em `:424-442`). ADENDO 9/`texto-herdado.ts` restringe só o
  **lote de parcelas** (`/adicionar/compra-cartao/parcelas`,
  CONTAI-084/089), que não é o caminho deste ticket.
- **`vinculoFalhou` (pergunta 3 do relato) — resolvido: existe, e exclui a
  CTA.** `fase.vinculoFalhou` é real (`documento/page.tsx:194`, setado em
  `:1075-1096`/`:1127`). Quando é `true`, `ligados` já é forçado a 0 na
  mesma função (`:1126`) — por isso a condição não pode ser só
  `ligados === 0`; tem que ser `ligados === 0 && !vinculoFalhou`, senão a CTA
  apareceria no ramo errado (pagamento já existe, só não ligado — mostrar
  "Registrar pagamento" ali induz a criar um segundo pagamento para a mesma
  despesa, a única direção de erro com passivo real).
- **Arquivos prováveis**: `app/_components/registrado.tsx` (prop novo
  `acaoProximoPasso`); `app/(captura)/adicionar/documento/page.tsx`
  (`:1148-1250`, decide o valor do prop pelas 3 condições); `e2e/vinculo.spec.ts`
  (já exercita `/adicionar/pagamento?documento=` em `:574`/`:630` — o caso
  novo e o caso negativo de `vinculoFalhou` entram nessa suíte ou numa nova).
- **Complexidade: S.** Fiação de um `BotaoLink` já testado para dentro de uma
  tela existente, sobre um mecanismo de destino já em produção. Sem
  migration, sem componente novo, sem campo novo.
- **Dívida nova**: nenhuma. Não toca D57, ADENDO 9, nem `texto-herdado.ts`.
- **Correções de arquivo:linha à investigação do relato**: itens 1, 2, 3, 6
  conferem como citados. Item 4 cita as linhas 116-117 (critério 1 do
  Caminho A) — a citação correta para o precedente é o critério 19
  (linha ~192). A frase "dá para registrar depois de salvar a nota" está em
  `:2141-2146`, não em `:896-949`. Item 5 está incorreto (ver acima).

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: nenhum.

## Perguntas Abertas
Nenhuma. As 3 perguntas do relato foram decididas pelo pipeline: (1) cartão —
um botão só, sem segunda opção na confirmação; (2) rótulo — "Registrar o
pagamento desta nota"; (3) `vinculoFalhou` — exclui a CTA, não a inclui.

## Cenário e checagem final
**Captura** (`/adicionar/documento`, fase "salvo") — mas esta tela não é o
instante sagrado da captura (fotografar a nota, digitar o PIX), é o passo
imediatamente seguinte, depois que o documento já está gravado. O Teste do
Canteiro ainda se aplica como régua de usabilidade (botão de alvo de toque
adequado, uma mão, sem bloquear a saída — "Voltar ao início" continua ali),
mas este ticket não exercita a permissão de 2026-09-22 (tratamento desktop
para `/adicionar/*`): é delta de um botão dentro do shell `COLUNA_DO_FORMULARIO`
(430px, CONTAI-047) já existente, não redesenho de layout — ficaria para um
ticket de design à parte.

Serve a meta 1 do produto ("nenhum pagamento sem documento hábil"): reduz o
risco de uma nota já paga ficar sem o pagamento correspondente registrado
porque o caminho até o mecanismo existente era indireto demais para o
momento em que o Mateus está com os dois fatos na cabeça ao mesmo tempo
(acabou de salvar a nota e já sabe que pagou).

Varredura de condição fiscal órfã (`grep -rniE` do `/tickets-req`): o Gate
Fiscal deste ticket declara "sem impacto fiscal direto" e as únicas condições
de texto citadas (nunca afirmar fato consumado) são consistência de produto
herdada do precedente CONTAI-018 (um ticket, não uma regra tributária), não
uma restrição fiscal que precise de parecer — nenhum achado órfão.

Veredito: **APROVADO**.

---

## Design (nível 2)
Spec completo em `design/mocks/CONTAI-099.md`. Botão único "Registrar o
pagamento desta nota" (rótulo reaproveitado byte a byte de
`documento/[id]/page.tsx:363-365`) dentro do mesmo `Card` de
Obra/Próximo passo/Custo, condicionado a `fase.ligados === 0 &&
!fase.vinculoFalhou`, com dica de apoio e `variante="primary"`. ASCII
antes/depois dos 3 ramos (`ligados > 0`, `vinculoFalhou`, caso novo). Cenário
captura (ver "Cenário e checagem final"). Sem campo fiscal novo.
