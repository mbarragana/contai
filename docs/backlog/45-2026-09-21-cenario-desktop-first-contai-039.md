# Cenário desktop-first — 2026-09-21 — "o uso atualmente é 100% desktop"

## Contexto

Reação do Mateus ao `CONTAI-039` (layout desktop da home, entregue no mesmo
dia — `44-2026-09-21-contai-039-entregue.md`): o resultado ficou ruim porque
reaproveitou os cards de mobile numa grade, em vez de ser uma experiência de
desktop de verdade (dashboard, sidebar, tabelas). Palavras literais dele:

> "o uso atualmente é 100% desktop"

> "se tiver que quebrar a compatibilidade com o mobile pode quebrar"

## A dor

Não é dor de execução do `CONTAI-039` — o ticket entregou o que foi pedido
(Gate 4 do `po`, 12/12 critérios PASS). É dor de **doutrina**. A correção de
cenários de 2026-08-18 (`CLAUDE.md`, seção "Cenários de uso") tirou o celular
de filtro único para tudo, mas manteve uma invariante que continuou travando
decisão de desktop: **"375px continua sendo o piso, não o alvo"**. Essa
invariante foi o motivo declarado no Gate 1 do `CONTAI-039`
(`43-2026-09-21-convergencia-home-desktop.md`) para escolher o Conceito 2
(régua fixa + fila em grid, reaproveitando os cards existentes) em vez do
Conceito 1 (tabela) — que teria sido mais "desktop de verdade", mas quebraria
em 375px. O resultado visível dessa escolha é o que o Mateus está reagindo
agora: um desktop que "parece mobile esticado".

## Classificação

Fricção de processo / doutrina de produto — não é obrigação fiscal nem
conveniência. É uma decisão de **escopo de compatibilidade** que muda o
filtro sob o qual toda decisão futura de UI de gestão é avaliada. Registrada
no `CLAUDE.md` (não só aqui) porque tem o mesmo peso estrutural da correção de
cenários de 2026-08-18 — é o mesmo tipo de correção, na direção oposta.

## Decisão registrada

Ver `CLAUDE.md`, seção "Premissas de processo" → "Cenários de uso — 2ª
correção, 2026-09-21":

- **375px deixa de ser piso obrigatório.** Uma melhoria de desktop não precisa
  mais caber, sem quebrar, no layout mobile.
- O cenário de **captura no canteiro** deixa de ser a régua que trava ou
  limita decisão de desktop — mas continua existindo como cenário do produto.
- O que **não** muda sem decisão futura explícita: o app não fica inacessível
  no celular amanhã, o fluxo de captura não deixa de existir, e a disciplina
  fiscal (campo vazio pergunta, sem default em campo fiscal, anexo obrigatório
  no ato do registro) vale em qualquer tela e qualquer dispositivo — a
  correção é sobre restrição de **layout**, não sobre regra fiscal.

## O que isto destrava / obsoleta

- **Obsoleta a doutrina "375px é o piso, não o alvo"** que orientou a
  rejeição do Conceito 1 (tabela) no Gate 1 do `CONTAI-039`. Essa rejeição
  precisa ser **revisitada** agora que a restrição caiu. Não é decidida
  aqui — é trabalho paralelo do `designer` nesta mesma rodada — mas fica
  registrado que o Conceito 1, e qualquer desenho que a régua antiga teria
  vetado por não caber em 375px, volta a ser opção legítima.
- **Não retroage sozinho ao `CONTAI-039` já entregue**: a home fica como está
  até haver uma decisão nova de desenho que a substitua. Não é regressão
  identificada, é ordem de fila — cabe ao Mateus decidir se abre ticket de
  redesenho agora ou deixa para quando o `designer` tiver o novo conceito.
- **Não muda** o cenário "captura no canteiro" como cenário do produto — o
  `CLAUDE.md` continua listando os dois cenários (gestão em casa / captura no
  canteiro). Muda o **peso** do cenário de captura como restrição de layout
  das telas de gestão.

## Perguntas abertas (ao Mateus, não decididas aqui)

1. **Até onde vai "pode quebrar"?** — (a) o celular continua funcional, mas
   deixa de ser prioridade de teste/QA quando conflitar com uma decisão de
   desktop; ou (b) telas de gestão podem parar de funcionar no celular sem
   isso contar como regressão. Tratado como (a) até resposta explícita.
2. **A permissão de quebra vale só para telas de GESTÃO ou também para a tela
   de CAPTURA** (registrar nota/pagamento no canteiro, celular, uma mão)? O
   relato comenta sobre a home, que é tela de gestão; não há sinal sobre
   captura. Tratado como "só gestão" até resposta explícita.
3. Isto é uma constatação do uso atual — o Mateus é hoje o único usuário e
   está gerenciando do computador durante a fase de build — ou é uma decisão
   permanente de produto? Importa porque, se for uma leitura do momento, o
   piso de 375px pode voltar a valer quando o padrão de uso mudar (ex.: uso
   móvel aumentar depois que a obra avançar). Sem essa resposta, tratar a
   decisão como valendo até segunda ordem, não como reversível por padrão.

## Fora de escopo desta entrada

Esta entrada **não decide** o novo desenho de desktop (dashboard, sidebar,
tabela etc.) — isso é trabalho do `designer`, em paralelo, nesta mesma
rodada. Aqui fica registrada só a mudança de doutrina e suas implicações de
escopo, para o `designer` trabalhar sem a amarra do piso de 375px e para o
histórico não perder por que o `CONTAI-039` foi desenhado do jeito que foi.
