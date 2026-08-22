# CONTAI-010 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão (casa, sentado; 375px = piso, 760px = régua da tela)   Arquivo: CONTAI-010.html
Telas: 17   Aprovado pelo Mateus em 2026-08-19 (v2)   ⚠️ topo do arquivo marca parte como DESATUALIZADA (ver Decisões)

## Telas e estados
- **Fluxo — os 4 passos** (`#s0`): só sucesso (estático) — sem loading, sem vazio, sem erro
- **Painel — custo do terreno por ano** (`#s1`): sucesso com 3 cards de ano (2024 ✓ completo / 2025 ⚠ falta lançar / 2026 ⏳ aguardando) + bloco "saiu do bolso" com 3 linhas sem data — sem loading, sem vazio, sem erro
- **Passo 1 · a compra e o TIPO DE COMPRA** (`#s2`): vazio (data em branco, nenhum tipo pré-marcado) → sucesso — sem loading, sem erro
- **Ramo à vista** (`#s15`): só sucesso (estático) — sem loading, sem vazio, sem erro
- **Passo 2 · entrada, ITBI, escritura** (`#s16`): só sucesso (estático, valores "—") — sem loading, sem erro
- **Passo 3 · a escolha informe OU parcelas** (`#s17`): só sucesso (2 cards de escolha) — sem loading, sem vazio, sem erro
- **Passo 4a · anexar o extrato** (`#s3`): vazio (CTA "📄 Escolher arquivo" / "📷 Usar a câmera") | anexado (nome+tamanho reais, links "trocar"/"remover") | falha de envio (retry "Tentar enviar de novo" + "Escolher outro") — sem loading
- **Passo 4b · rubricas** (`#s4`): vazio ("Preencha as linhas do extrato.") | não-fecha (bloqueio do botão) | fecha (verde) — sem loading, sem erro de rede
- **Passo 4c · conferência** (`#s6`): só sucesso — sem loading, sem vazio, sem erro
- **Gravado** (`#s7`): só sucesso — sem loading, sem vazio, sem erro
- **⚠️ Por que juros entram e seguro não** (`#s8`): só sucesso — **TELA REMOVIDA em 2026-08-19**, não implementar
- **Diferença Teórico / Pago** (`#s9`): só sucesso (explicativa) — sem loading, sem vazio, sem erro
- **Taxas e FCVS** (`#s10`): só sucesso (explicativa; bloco "taxa de administração" com rótulo REMOVIDO em 19/08)
- **Trocar de ramo (parcelas ↔ informe)** (`#s11`): só sucesso, 2 CTAs "Manter as 4 parcelas" / "Trocar pelo informe de 2024"
- **Aguardando informe (ano corrente)** (`#s12`): só sucesso — sem loading, sem vazio, sem erro
- **Ano da venda — a exceção** (`#s13`): só sucesso (wireframe, depende da US-004)
- **Perguntas e decisões** (`#s14`): meta-tela de mock, não é tela de produto

## Campos
- `cData` "Quando você comprou" — date — sublabel "a data do contrato ou da escritura — é o marco da aquisição" — obrigatoriedade não declarada no mock — SEM DEFAULT — campo fiscal
- Tipo de compra — escolha 1-de-4 (À vista / Financiado com um banco / Parcelado direto com o vendedor / Recebido — herança, doação ou permuta) — obrigatório (é a bifurcação) — SEM DEFAULT — campo fiscal
- Entrada: `valor` — nº — ; `data em que foi paga` — date — **obrigatória** ; `de onde saiu o dinheiro` — recurso próprio / FGTS ; `comprovante` — arquivo — **obrigatório** — todos SEM DEFAULT — campos fiscais
- ITBI: `valor recolhido` — nº ; `data do recolhimento` — date — **obrigatória** — SEM DEFAULT — campo fiscal
- Escritura e registro: `valor pago` — nº ; `data do pagamento` — date — **obrigatória** — SEM DEFAULT — campo fiscal
- Ramo à vista: `valor pago` — nº ; `data em que saiu da conta` — date — **obrigatória** ; `comprovante` — **obrigatório** — SEM DEFAULT
- Anexo do extrato (`#fArq`/`#fCam`) — file, `accept="application/pdf,image/*"`, câmera com `capture="environment"` — **obrigatório: sem ele não grava** — SEM DEFAULT
- `iAmort` Amortização — nº step .01 — placeholder "0,00" — entra na soma da trava E no custo — SEM DEFAULT — campo fiscal
- `iJuros` Juros / Correção Monetária — nº step .01 — entra na trava E no custo — SEM DEFAULT — campo fiscal
- `iSeg` Seguros (MIP e DFI) — nº step .01 — entra na trava, fora do custo — SEM DEFAULT — campo fiscal
- `iTaxas` Taxas + FCVS — nº step .01 — entra na trava, fora do custo; valor > 0 abre aviso de revisão humana — SEM DEFAULT — campo fiscal
- `iMora` Mora — nº step .01 — entra na trava, fora do custo — SEM DEFAULT — campo fiscal
- `iMulta` Multa — nº step .01 — entra na trava, fora do custo — SEM DEFAULT — campo fiscal
- `iDif` Diferença Teórico / Pago — nº step .01 — entra na trava, fora do custo — SEM DEFAULT — campo fiscal
- `iTotal` Total Pago no Exercício — nº step .01 — **obrigatório**; validação: soma das 7 rubricas == total, tolerância `< 0,005` (zero centavo) — SEM DEFAULT — campo fiscal
- `iSaldo` Saldo Devedor em 31/12/AAAA — nº step .01 — informativo, fora de toda soma — SEM DEFAULT — campo fiscal
- Derivado (não editável): custo = `iAmort + iJuros`

## Textos com consequência fiscal
- "O preço contratado nunca vai para o custo." / "Declarar o imóvel pelo preço cheio sem declarar a dívida produz evolução de patrimônio sem renda que a explique." — s2
- "O saldo devedor não é custo de nada e não entra na declaração do bem. Está aqui só para você conferir a conta: pago + saldo = preço contratado." — s1
- "Sem este lançamento, o custo de aquisição de 2025 não existe no sistema. Custo pago e não discriminado na declaração não existe na hora da venda." — s1, card do ano pendente
- "Sem a data, este valor não tem ano-calendário e a discriminação não pode ser gerada. Não bloqueia o app — fica como pendência até você preencher." — s1
- "é a data de cada um que decide o ano dele" / "ITBI recolhido em fevereiro do ano seguinte é custo do ano seguinte, não do ano da escritura." — s1 e s16
- "É a data de cada um que decide em que ano ele entra — não a data da compra." — s16
- "A data que vale é a do débito no extrato — não a do contrato, não a da escritura, não a do vencimento." — s15
- "FGTS usado na entrada entra no custo — é dinheiro seu, não do banco." — s16
- "ITBI a recolher ou escritura a lavrar podem ser registrados com valor previsto e sem data. Nesse caso eles não entram em ano nenhum — nem no corrente. Previsto não é pago." — s16
- "O app nunca inventa a data: nem a de hoje, nem a do cadastro. Data ausente continua ausente e visível — campo vazio pergunta, data de memória afirma." — s16
- "Escolher um fecha o outro para 2025. Registrar os dois contaria os mesmos pagamentos duas vezes, e custo inflado em Bens e Direitos é redução indevida de ganho de capital — cobrada com multa na venda. Dá para trocar de ideia depois, mas nunca somar os dois." — s17
- "Sem o extrato anexado, este lançamento não grava. São dezenas de milhares de reais de custo de aquisição: o número sem o documento que o sustenta não serve para nada no dia da venda." — s3
- "Anexe o extrato para continuar. Sem ele, este lançamento não grava." — s3, hint do botão (estado não anexado)
- "✓ Fecha. As sete linhas somam exatamente o total pago no exercício. Nenhuma rubrica do seu extrato ficou de fora." — s4, trava fechada
- "Não fecha — e por isso este lançamento não grava." + "Faltam R$ X" / "Sobram R$ X" + "Ou uma linha ficou em branco, ou o seu extrato tem uma rubrica que este app ainda não conhece. Nos dois casos, somar o que está aqui e seguir produziria um custo de aquisição errado, com aparência de certo." / "Alguma linha foi digitada a mais, ou o total pago está menor do que deveria. Confira o documento." — s4
- Parecer, adendo 2 §4 (exibido em tela): "Se não fechar, é rubrica que o app não conhece — recusar e pedir revisão humana, nunca somar o resto e seguir."
- "✕ penalidade nunca é custo" — s4, rubricas Mora e Multa
- "◆ não soma hoje — o FCVS ainda pode vir a entrar" — s4, rubrica Taxas + FCVS
- "Esta linha veio com valor, e ela junta duas coisas que têm destinos diferentes. Taxa de administração não entra no custo; o FCVS ainda pode vir a entrar. Como o extrato não separa, o app não adivinha a divisão: guarda o valor cheio fora da soma e marca o ano como pendente de revisão humana, até você confirmar a divisão com a instituição." + "Nada trava por causa disto — o lançamento grava normalmente. O que fica marcado é que uma parte pode estar sendo deixada de fora do custo indevidamente." — s4 (só com `iTaxas` > 0)
- "◆ fica guardada, fora da soma, até a instituição explicar" e "Não sabemos o que esta linha é. Ela aparece no seu extrato, está dentro do total pago, e nenhum parecer deste projeto a previu. Enquanto ninguém confirmar a natureza dela, ela não soma no custo." — s4 / s9
- "o que ainda falta pagar ao banco. Fica fora de tudo: não soma, não subtrai, não vira dívida na declaração" — s4, `iSaldo`
- "R$ 43.051,23 — 72% deste desembolso — são juros, e a inclusão deles apoia-se na leitura de um dispositivo que ainda não foi confirmado por contador com registro. O app soma e nomeia em linha própria na declaração; quem assume a posição é humano." — s6
- "Guardado não é descartado. […] o erro irreversível seria não ter capturado." — s6
- "Os juros vão nomeados, sempre. Nunca diluídos dentro de um total. Um item que pode ser questionado, incluído em silêncio, é o pior dos mundos; incluído com nome, é posição declarada." — s7
- Texto gerado da discriminação (s7): "...declarado pelo valor efetivamente pago, conforme regime de caixa: [...] e R$ 59.934,75 pagos no financiamento em 2025, dos quais R$ 16.883,52 de amortização e R$ 43.051,23 a título de juros e correção monetária, conforme extrato anual da instituição credora. Saldo devedor do financiamento em 31/12/2025: R$ 585.815,19, não incluído por não ter sido pago."
- s7 — onde o lançamento NÃO aparece: Pagamentos Efetuados (CPF por CPF) = não; Base de aferição do INSS (CNO/SERO) = não; "Custo em risco" da home = não
- "Trocar não apaga nada. As 4 parcelas continuam no acervo, com os comprovantes, marcadas como \"substituídas pelo informe anual de 2024\". O que muda é só de onde o custo do ano é calculado. O acervo deste app não apaga registro." — s11
- "O custo de 2026 que o app mostra está menor do que a realidade — e vai ficar assim o ano todo." + "Isto não é um defeito, é o calendário do banco." — s12
- "Quitar o saldo devedor com o dinheiro da venda é dispêndio pago, e integra o custo no ano da venda." / "Multa ou tarifa de quitação antecipada fica fora do custo." / "O preço de venda é o bruto da escritura — nunca o líquido depois de descontado o saldo devedor." — s13
- Recebido (herança/doação/permuta): "há data de aquisição sem desembolso; o custo é o valor que constava na declaração de quem doou ou faleceu" — s2

## Navegação
- s0 → s2 — "Começar pelo passo 1 →" | s0 → s1 — "Ver o painel"
- s2 → s15 — escolher "À vista" | s2 → s16 — escolher "Financiado com um banco" | (Parcelado com o vendedor e Recebido **não navegam** no mock)
- s15 → s16 — "Ir para o passo 2 →" | s16 → s17 — "Ir para o passo 3 →"
- s17 → s3 — "Registrar pelo informe anual" | s17 → s11 — "Registrar parcela a parcela"
- s3 → s4 — "Continuar para os números →" (**desabilitado até haver anexo**)
- s4 → s6 — "Conferir e gravar →" (**desabilitado até a soma fechar**) | s4 → s8 / s9 / s10 — links das rubricas
- s6 → s7 — "Gravar informe de 2025" | s7 → s1 — "Voltar ao painel"
- s1 → s3 — "Registrar informe de 2025" | s1 → s12 — "O que isso significa →" | s1 → s16 — "Completar as três datas →"
- Voltas: s4→s3, s6→s4, s8/s9/s10→s4, s11→s17, s12/s13→s1, s14→s0

## Decisões de design visíveis no mock
- **O tipo de compra é a bifurcação, no passo 1** — muda campos, documentos e o ciclo anual; "à vista" é o caso degenerado do mesmo modelo (um desembolso), não uma tela paralela.
- **A trava da dupla contagem é uma escolha no ato** (informe **ou** parcelas, por ano+contrato), não uma recusa tardia; trocar de ramo desvincula sem apagar (acervo append-only).
- **Recusar aqui é correto e recusar no CONTAI-019 não era**: a régua é "não bloqueie quando o fato do mundo já aconteceu" — soma que não fecha é dado errado, não fato novo. Tolerância zero centavo, assumida com o risco de arredondamento de banco.
- **Três marcas distintas para rubrica fora do custo**: "não entra" (firme), "ainda não entra / candidato" (FCVS) e "natureza desconhecida" (Diferença Teórico/Pago) — colapsá-las em "excluído" perderia a revisão futura.
- **⚠️ Parte do mock está morta por decisão de 19/08 (ADENDO 4 do parecer)**: nenhuma tela afirma o tratamento dos seguros. O rótulo "✕ não entra no custo — decisão firme" (seguros e taxa de administração) e a tela `s8` inteira **não devem ser implementados**; o texto implementado é "Guardado separado — a classificação desta rubrica é decisão do seu contador."

## Dúvidas
- Passo 1 mora dentro do cadastro de obra do CONTAI-003 (em produção) ou em tela própria de "terreno"? (pergunta 1, ao `po`)
- Quais anos aparecem na lista do painel — todos entre a compra e hoje? Contrato antigo abre a tela com N pendências de uma vez (pergunta 2, ao `po`)
- "Taxas + FCVS" vem em linha única: guardar tudo fora da soma é o conservador certo ao longo de 20 anos? (pergunta 3, ao `contador`)
- Gravar ano já declarado (2025) — a tela avisa, e com base em quê, se o app não sabe qual ano foi declarado (dor D24)? (pergunta 4, ao `po`)
- Pagamento que sai do custo por ser absorvido pelo informe continua discriminável numa intimação? (pergunta 5, ao `contador`)
- O custo do financiamento entra no total de custo da obra na home? (pergunta 6, ao `po`)
- O app lembra de perguntar à instituição a natureza da "Diferença Teórico / Pago"? (pergunta 7, ao `po`)
- Mostrar a estimativa "≈ R$ 60 mil" do ano corrente, numa tela cuja disciplina é não afirmar o que não sabe? (pergunta 8, ao `po`)
- Obrigatoriedade de `cData` e do "Preço contratado" não é declarada em tela — o mock só os exibe.
