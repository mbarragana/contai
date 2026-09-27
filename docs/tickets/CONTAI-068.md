# CONTAI-068 Sugestão de retenção não colapsa candidata repetida sob dois rótulos com o mesmo valor

## Tipo e Prioridade
bug — P1 — não perde dinheiro nem documento hábil (o Mateus ainda pode digitar a linha à mão), mas anula a automação que o `CONTAI-054`/`062` foram construídos para entregar, exatamente na nota que motivou o `054` originalmente. Fricção de processo, não obrigação fiscal.

## Dor de Origem
Relato direto do Mateus nesta sessão (2026-09-26), com reprodução contra PDF real — ainda sem entrada própria em `docs/backlog/` (registrada junto com este ticket).

`sugerirLinhaRetencao` (`lib/extracao/retencao-texto.ts`, CONTAI-054/062) devolve `null` para uma NFS-e real (padrão do município de Palhoça/SC) mesmo com a aritmética batendo perfeitamente (Total 40.857,14 − Retenção 1.889,48 = Líquido 38.967,66). Essa nota foi o próprio exemplo que o Mateus deu ao especificar o `CONTAI-054` — é regressão de um caso que deveria funcionar desde o início.

**Causa raiz**: a nota imprime o mesmo valor de retenção duas vezes, sob dois rótulos diferentes, em dois blocos do documento — "Valor ISS" (bloco de descrição do item) e "ISSRF" (bloco de resumo financeiro). O `Map<string, SugestaoLinhaRetencao>` de `sugerirLinhaRetencao` é hoje chaveado por `` `${rotulo}|${valorCentavos}` `` (linhas ~275-282): duas candidatas com valor idêntico sob rótulos diferentes geram duas chaves distintas, `sugestoes.size` vira 2, e a função só aceita `size === 1` — devolve `null`, formulário em branco.

## User Story
Como dono da obra, em casa, sentado, conciliando uma nota de serviço PJ contra o pagamento correspondente (cenário de gestão — não captura no canteiro), quando abro o formulário de retenção de uma nota cuja aritmética Total/Retenção/Líquido fecha mas cujo valor de retenção está impresso duas vezes sob rótulos diferentes, quero que o sistema traga a sugestão preenchida, em vez de me devolver um formulário em branco que me obriga a digitar tudo de novo — inclusive no padrão de nota que eu mesmo demonstrei que deveria funcionar.

## Critérios de Aceite

1. [x] **Mesmo valor sob dois rótulos diferentes, aritmética fechando, deixa de ser `null`.** Dado um texto em que o mesmo valor de retenção aparece sob dois rótulos distintos e a aritmética Total − Retenção = Líquido fecha, `sugerirLinhaRetencao` retorna **uma** sugestão não-nula — autorizado por `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO 6), que classifica valor idêntico sob rótulos diferentes como repetição do mesmo fato, não ambiguidade. Caso de teste nomeado, valores **inventados** (nunca os reais 40.857,14/1.889,48/38.967,66, nem os já usados no `CONTAI-054`):
   ```
   Valor Total ............... R$ 15.760,00
   Valor ISS .................. R$ 742,50
   ISSRF ...................... R$ 742,50
   Valor Liquido .............. R$ 15.017,50
   ```
   Nome do teste: `"mesmo valor sob dois rótulos diferentes, aritmética fechando — repetição, não ambiguidade (CONTAI-068)"`. Resultado esperado: `{ rotuloLiteral: "Valor ISS", valorCentavos: 74_250 }` — "Valor ISS" vence por ser o rótulo que aparece primeiro no texto (critério 4 abaixo), nunca por preferência de vocabulário. Este teste ganha uma segunda asserção com a ordem das duas linhas invertida no texto (ISSRF antes de Valor ISS), esperando `{ rotuloLiteral: "ISSRF", valorCentavos: 74_250 }` — prova mecânica de que o desempate segue a ordem de aparição em qualquer direção, não uma preferência por um dos dois rótulos (critério 4). Esta asserção substitui a que uma versão anterior deste ticket havia colocado no teste do critério 5, revertido pelo ADENDO 7 (ver critério 5 abaixo).

2. [x] **Valores diferentes continuam ambiguidade genuína.** Dado um texto em que duas candidatas têm `valorCentavos` **diferentes** entre si, `sugerirLinhaRetencao` continua retornando `null` — por `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO 6, §1 e §5), que restringe o colapso estritamente a valor idêntico. Nenhuma mudança na tolerância aritmética (`TOLERANCIA_CENTAVOS`) nem no filtro de líquido zerado.

3. [x] **Teste de borda da tolerância prova que a chave é por valor exato, não por proximidade.** Duas candidatas com valores próximos mas **não idênticos** (ex.: 500,00 e 500,01) e que separadamente ficariam dentro de `TOLERANCIA_CENTAVOS` da diferença apurada continuam gerando `null` — prova de que o colapso do critério 1 não veio de afrouxar a tolerância aritmética.

4. [x] **Critério de desempate é estrutural (ordem de aparição no texto), nunca por vocabulário de rótulo.** Quando duas ou mais candidatas de valor idêntico colapsam, o rótulo escolhido é o que aparece primeiro no texto de entrada — nenhuma lista, preferência ou reconhecimento de rótulo específico ("ISSRF" > "Valor ISS", ou qualquer outro) pode decidir o desempate. Veto explícito do `contador` em `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO 6, §4).

5. [x] **O teste existente "dois rótulos diferentes com o valor da diferença: ambiguidade genuína" (`lib/extracao/retencao-texto.test.ts`, ~linha 275, par `ISSRF`/`Desconto Condicional`, ambos R$ 500,00) NÃO é alterado — continua esperando `null`, e permanece a proteção do caso de ambiguidade genuína.** Correção de leitura, `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO 7): o ADENDO 6 cobre só a repetição do MESMO fato tributário sob rótulos diferentes (caso real de Palhoça — "Valor ISS"/"ISSRF", ambos, isoladamente, terminologia de retenção). O par `ISSRF`/`Desconto Condicional` é categoricamente diferente: "Desconto Condicional" nunca é terminologia de retenção — é coincidência numérica entre dois conceitos fiscais distintos, exatamente o risco já nomeado nominalmente pelo ADENDO 5 §2 ("frete, desconto, parcela coincidindo em aritmética com total/líquido por acaso"). Inverter esse teste, como uma versão anterior deste ticket propôs, estaria fazendo exatamente o que o ADENDO 6 disse, por escrito, que não fazia — revertido pelo `contador` antes de qualquer código ser escrito.

6. [x] **Novo critério: colapso de candidatas empatadas por valor só se aplica quando NENHUMA das duas contém vocabulário manifestamente não-tributário.** Por `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO 5 §2 e ADENDO 7): o que autoriza o colapso não é "mesmo valor" isoladamente — é "mesmo valor **e** nenhuma das duas candidatas pertence, por rótulo, a uma categoria fiscal manifestamente não-tributária (desconto, abatimento, frete, parcela, acréscimo)". Se qualquer uma das duas candidatas do empate contiver um desses termos, o empate permanece ambiguidade genuína → `null`, doutrina intocada — colapsar é privilégio do caso comprovado (repetição de leiaute), não do caso coincidente. A lista mínima de termos não-tributários é **genérica** (vocabulário universal de contabilidade — "desconto", "frete", "parcela", "acréscimo" — nunca jargão de prefeitura ou emissor específico), mesmo espírito do critério 4 (desempate estrutural, nunca por vocabulário de retenção). Como implementar a triagem (lista fechada de termos que excluem uma candidata do universo de colapso, ou outro mecanismo) é decisão do `cto-obra`/`lead-engineer` — a linha fiscal é só o resultado: candidata com vocabulário não-tributário nunca colapsa.

   Teste novo exigido, cobrindo os três casos lado a lado:
   - duas candidatas retenção-like (ex.: "Valor ISS" e "ISSRF", valores inventados, diferentes dos dois já usados nos critérios 1 e 5) colapsam normalmente;
   - o teste do critério 5 (`ISSRF`/`Desconto Condicional`) continua `null`;
   - um terceiro caso com duas candidatas de valor idêntico onde uma delas contém "desconto" no rótulo (rótulo diferente de "Desconto Condicional", para não duplicar o teste do critério 5) também continua `null`.

7. [x] **Comentário das linhas ~275-281 de `lib/extracao/retencao-texto.ts` corrigido.** O trecho que hoje chama rótulos diferentes com mesmo valor de "ambiguidade genuína" é reescrito para descrever a chave por valor, o desempate por ordem de aparição, e a triagem de vocabulário não-tributário do critério 6 — citando `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (ADENDO 6 para a chave/desempate, ADENDO 7 para a triagem de vocabulário) — mesma dívida documental que o próprio parecer já registra em seu §5, mesmo padrão de correção já aplicado no `CONTAI-062`.

8. [x] **Comentário do cabeçalho do módulo (linhas ~68-69, "Empate real vira `null`") qualificado.** Passa a dizer explicitamente "empate de **valor entre candidatas que já são, isoladamente, terminologia de retenção**" — o próprio ADENDO 6 aponta essas linhas como origem da generalização que causou o bug, e o ADENDO 7 restringe o alcance da generalização.

9. [x] **`SugestaoLinhaRetencao` continua com exatamente dois campos.** Este ticket não adiciona `confianca` nem qualquer outro campo ao tipo — o teste "a sugestão tem exatamente dois campos" (já existente) continua passando sem alteração.

## Out of Scope
- Não altera `composicao`, `tributo`, `eDescontoEfetivo` nem `quemRecolhe` — continuam fora do tipo `SugestaoLinhaRetencao` por construção (ADENDO 5 §4 / Gate Fiscal do CONTAI-038).
- Não altera `notaNoCpf` — admissibilidade do documento inteiro, gravidade estrutural diferente, intocada.
- Não cobre formatos/municípios ainda não observados — o critério vale para o padrão estrutural (rótulo+valor repetido com aritmética fechando), não para uma lista fechada de prefeituras.
- Nenhuma mudança de UI/tela: `lib/extracao/retencao-texto.ts` é módulo puro; `app/api/sugerir-retencao/route.ts` e o formulário de confirmação não mudam de contrato.
- Não toca `extrairLinhasRotuladas`, `TOLERANCIA_CENTAVOS` nem o filtro de líquido zerado — nenhum deles é causa do bug.

## Gate Fiscal (Contador)
**Já fechado** — ADENDO 6 e ADENDO 7, 2026-09-26, em `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`. O ADENDO 7 é uma correção do próprio Gate Fiscal deste ticket: uma versão anterior generalizou o ADENDO 6 além do que ele autoriza (ver critério 5). Resumo aplicável a este ticket, já com a correção incorporada:

- **O sistema pode sozinho**: colapsar candidatas de valor idêntico (`valorCentavos` igual) sob rótulos textuais diferentes em uma única sugestão de linha de retenção **quando nenhuma das duas candidatas contém vocabulário manifestamente não-tributário** (desconto, abatimento, frete, parcela, acréscimo — ADENDO 5 §2 / ADENDO 7), com qualquer critério de desempate **estrutural** (nunca vocabulário) para escolher qual rótulo exibir; continuar exigindo par único (`null`) quando os valores divergem, e continuar recusando colapso (`null`) sempre que uma das candidatas do empate for, por categoria, manifestamente não-tributária.
- **Exige revisão humana (do Mateus, não CRC)**: confirmar a sugestão contra o papel antes de salvar — inalterado, mesmo gesto de sempre.
- **Exige CRC**: nada novo — ajuste de desempate textual num parser de sugestão, não toca classificação de tributo, recolhimento ou equiparação.
- **Vetado explicitamente**: (1) critério de desempate por preferência de vocabulário de emissor/prefeitura (ex. "ISSRF" > "Valor ISS") — reintroduziria o acoplamento que o Critério 4 do módulo evita por desenho; (2) colapsar um par em que qualquer uma das candidatas seja, por rótulo, manifestamente não-tributária (ex. `ISSRF`/`Desconto Condicional`) — na dúvida sobre se as duas candidatas descrevem o mesmo fato tributário, o empate permanece `null` (ADENDO 7).

## Pre-mortem
1. **Desempate acaba resolvido por vocabulário, não por estrutura.** Sob pressão para fechar rápido, é tentável decidir "ISSRF vence por ser mais específico" — exatamente o critério vetado pelo `contador`. Mitigação: critério 1 (teste com ordem invertida) barra isso mecanicamente; o Gate 2 técnico deve recusar qualquer PR cujo desempate dependa do texto do rótulo em si.
2. **Grafias de valor ligeiramente diferentes por arredondamento entre as duas ocorrências.** Conferido no código: a comparação de candidatas e a chave do `Map` operam sobre `valorCentavos` inteiro (produzido por `parseValorInput`), nunca sobre a string impressa. Duas grafias que resultam no mesmo `valorCentavos` colapsam sem problema (critério 1); duas que resultam em `valorCentavos` diferente (mesmo por 1 centavo de exibição) caem em "valores diferentes" (critério 2) e permanecem `null` — não é um problema novo introduzido por este ticket.
3. **A triagem de vocabulário não-tributário (critério 6) vira, na prática, uma lista de rótulos específicos de emissor/prefeitura em vez de termos genéricos de contabilidade.** Isso repetiria, por outra porta, o mesmo erro que o Critério 4 do módulo evita por desenho (acoplamento a jargão municipal). Mitigação: a lista mínima do critério 6 ("desconto", "frete", "parcela", "acréscimo") é fechada e citada no ticket; o Gate 2 (`cto-obra`) recusa qualquer PR que acrescente termo específico de prefeitura/emissor a essa lista sem passar de novo pelo `contador`.
4. **Uma futura leitura apressada do ADENDO 6 repete o erro que gerou o ADENDO 7** — generalizar "valor idêntico colapsa" sem checar se as duas candidatas já são, isoladamente, terminologia de retenção. Mitigação: os critérios 5 e 6 e o Gate Fiscal deste ticket citam o ADENDO 7 nominalmente, não só o ADENDO 6 — quem ler só o ADENDO 6 sem o 7 repete o erro.

## Viabilidade (CTO)
- **Modelo de dados**: nenhum impacto. Módulo puro; `SugestaoLinhaRetencao` mantém dois campos; `app/api/sugerir-retencao/route.ts` consome o mesmo tipo sem mudança de contrato. Sem migration, sem `database.types.ts`, sem E2E novo.
- **Critério de desempate escolhido**: ordem de aparição no texto — não "proximidade ao par total/líquido que fechou a conta" (a alternativa que o parecer também autorizava). Motivo: o total aparece mais de uma vez em notas reais (mesmo módulo já trata isso), então "proximidade ao par" exigiria antes decidir *qual* par é o de referência — reabrindo a mesma ambiguidade que o ticket fecha. Ordem de aparição é uma ordem total que já existe de graça (`extrairLinhasRotuladas` preserva ordem do texto).
- **Mudança exata em `sugerirLinhaRetencao`**: trocar a chave do `Map` de `` `${rotulo}|${valorCentavos}` `` para `candidata.valorCentavos` (número), e adicionar um guard de "primeiro vence" antes do `set` (`if (sugestoes.has(candidata.valorCentavos)) continue;`). Como `candidatas` está em ordem de texto, a primeira inserção para um dado valor é sempre a candidata mais cedo no documento. `if (sugestoes.size !== 1) return null;` e o `return` finais ficam inalterados. Valores diferentes continuam gerando chaves diferentes → `size > 1` → `null`, comportamento idêntico ao atual. Antes desse agrupamento por valor, entra a triagem do critério 6: qualquer candidata cujo rótulo contenha um termo da lista fechada não-tributária é excluída do universo de colapso (ex.: filtrar `candidatas` removendo as que casam a lista antes de montar o `Map`, ou marcar essas candidatas para nunca colapsarem mesmo com valor batendo) — mecanismo exato é decisão de implementação, a exigência fiscal é só o resultado.
- **Teste da linha ~275 do arquivo de teste (`ISSRF`/`Desconto Condicional`)**: NÃO muda — o ADENDO 7 corrigiu a leitura literal do ADENDO 6 que motivara o flip numa versão anterior deste ticket. "Desconto Condicional" cai na lista não-tributária do critério 6, então esse par continua `null` por duas vias que convergem: nunca houve distinção técnica possível só pelo valor (constatação que segue verdadeira), mas agora há uma triagem de vocabulário anterior ao agrupamento por valor que resolve exatamente esse caso sem precisar de "proximidade ao par" nem de heurística especial — é a mesma lista do critério 6, aplicada de forma genérica.
- **Arquivos**:
  - `lib/extracao/retencao-texto.ts` — chave do `Map`, guard de desempate, triagem de vocabulário não-tributário (critério 6), comentários das linhas ~68-69 e ~275-281.
  - `lib/extracao/retencao-texto.test.ts` — teste novo do critério 1 (com a asserção de ordem invertida), teste de borda do critério 3, teste novo do critério 6 (três casos); o teste existente do critério 5 (`ISSRF`/`Desconto Condicional`) permanece sem alteração.
  - Opcional, não bloqueante: `lib/extracao/retencao-texto-real.test.ts` com fixture anonimizada no padrão Palhoça (célula-por-linha, como o `unpdf` real devolve) — prova o caminho ponta a ponta, já que o bug foi descoberto em PDF real, não em texto sintético. Fica a critério do `lead-engineer` incluir nesta rodada.
- **Complexidade**: **S**. Diff de produção com menos de 15 linhas (chave do `Map` + guard de desempate + triagem de vocabulário); o peso está em teste e comentário.
- **Dívidas**: nenhuma criada. Fecha a dívida documental que o próprio ADENDO 6 §5 já registrava (comentário das linhas 275-281). Não abre porta para vocabulário hardcoded de retenção (Critério 4 do módulo preservado) — a lista do critério 6 é de exclusão por categoria manifestamente não-tributária, operação diferente da vetada.

## Dependências
- Bloqueado por / Bloqueia: nenhum. Mesmo módulo do `CONTAI-054`/`CONTAI-062`, sem relação de bloqueio.

## Perguntas Abertas
Nenhuma. A pergunta registrada nesta seção numa versão anterior deste ticket ("o ADENDO 6 pretendia cobrir também o caso `ISSRF`/`Desconto Condicional`?") foi respondida pelo `contador` em ADENDO 7, 2026-09-26: não — ver critérios 5 e 6 acima.

## Cenário e checagem final
**Gestão** (em casa, sentado, conciliando nota × pagamento) — não é fluxo de captura, então o Teste do Canteiro não se aplica. Sem UI nova ou alterada: Gate 0 (`/design`) não é necessário.

Serve à meta 2 do produto (relatórios anuais prontos): a sugestão correta reduz erro de digitação manual na linha de retenção que alimenta a pendência de "quem recolhe" e, por consequência, o custo de aquisição comprovado.

**Veredito: APROVADO.** Gate Fiscal fechado (ADENDO 6 + ADENDO 7), viabilidade técnica de baixa complexidade e sem discordância entre `po` e `cto-obra` quanto à direção da correção. Pronto para `/develop` sem Gate 0.

## ✅ Entregue em 2026-09-26

Gate 4 (`po`) — **PASS, 9/9 critérios.** Arquivos: `lib/extracao/retencao-texto.ts`
(chave do `Map` por `valorCentavos`, guard de desempate por ordem de aparição,
triagem `RE_NAO_TRIBUTARIO` do ADENDO 7, comentários das linhas ~68-69 e
~275-333 corrigidos), `lib/extracao/retencao-texto.test.ts` (4 testes novos do
critério 1/2/3/6, teste do critério 5 byte a byte intocado) e
`lib/extracao/retencao-texto-real.test.ts` (Nota 3, padrão Palhoça, PDF
sintético via `unpdf` real). Nenhum arquivo mudou depois do APPROVE do
`cto-obra` no Gate 2. Sem migration, sem UI. `npm run quality` completo verde:
**1144 Vitest / 362 Playwright.** Nenhum valor real da nota de Palhoça
(40.857,14/1.889,48/38.967,66) entrou em código ou teste — só valores
inventados. Detalhe do Gate 4 na entrega, `docs/tickets/README.md` (resumo do
topo e seção longa atualizados).
