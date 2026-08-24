# CONTAI-027 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão (casa, sentado; 375px = piso, 720px = mesa) — com caminho de captura preservado   Arquivo: CONTAI-027.html
Telas: 13   Aprovado pelo Mateus em 2026-08-21 (v1)

## Telas e estados
- **Fluxo 1 — abrir o papel** (`#s0`) e **Fluxo 2 — N papéis** (`#s0b`): ASCII, só sucesso — sem loading, sem vazio, sem erro (telas de acordo de fluxo, não de produto)
- **Terreno — card do desembolso com a lista** (`#s1`): sucesso (2 papéis) | por item: pronto ("Abrir") · abrindo ("abrindo…") · falha (retry "Tentar de novo") · negado (sem ação, "—") — sem vazio nesta tela
- **Corrigir o valor — "confira antes de digitar"** (`#s1b`): mesmos 4 estados do item; sucesso com 1 papel — sem vazio
- **Pago, e sem papel nenhum** (`#s1c`): **é o estado vazio** (CTA "📎 Anexar agora") — sem loading, sem erro
- **As outras superfícies** (`#s1d`): lista das 7 telas que recebem o componente — meta-tela, sem estados
- **Registrar um desembolso** (`#s2`): vazio ("Nenhum papel escolhido ainda." + botão "Escolha ao menos um papel para gravar") | preenchendo | bloqueado por papel sem classificação | bloqueado pela pergunta do 2º comprovante | pronto para gravar — sem loading, sem erro
- **Gravou — tudo no mesmo dia** (`#s2b`): sucesso, sem pendência — sem loading, sem vazio, sem erro
- **Gravou — em mais de um dia** (`#s2c`): sucesso **com** pendência vermelha aberta — sem loading, sem vazio, sem erro
- **O papel que chega depois** (`#s2d`): vazio (hint explicando) | com papel novo | pergunta disparada — sem loading, sem erro
- **A pendência na home** (`#s3`): sucesso — 2 dívidas (vermelha "Um lançamento, mais de uma data"; cinza "Falta a data") — sem loading, sem vazio, sem erro
- **Discriminação de 2026 — antes de declarar** (`#s3b`): sucesso com aviso âmbar **acima** da área copiável — sem loading, sem vazio, sem erro
- **O critério 13 — o bloqueio que saiu** (`#s3c`): tela de comparação, **não implementar** — mostra o botão desabilitado "Resolva a pendência para gerar"

## Campos
- Tipo do desembolso (`data-radio="tipo"`) — escolha 1-de-3 (Entrada / ITBI / Escritura e registro) — obrigatório — SEM DEFAULT — campo fiscal
- `inpValorS2` "Valor" — texto `inputmode="decimal"`, placeholder "0,00" — obrigatório — SEM DEFAULT — campo fiscal
- "Este valor já foi pago?" (`data-radio="estado"`) — 1-de-2 (Já saiu da conta / Ainda vou pagar) — obrigatório — SEM DEFAULT — campo fiscal
- `inpDataS2` "Data em que saiu da conta" — date — obrigatória para o desembolso pago; sem ela a pergunta do 2º comprovante fica **represada** — **no mock vem com `value="2026-08-21"` (ver Dúvidas)** — deve ser SEM DEFAULT — campo fiscal
- Papéis do desembolso — `<input type="file" multiple>`, e câmera com `accept="image/*" capture="environment"` — **obrigatório: ao menos um** — SEM DEFAULT
- "O que é este papel?" (por arquivo) — 1-de-3 (Comprovante do pagamento / Nota ou recibo / Contrato ou escritura) — **obrigatório por papel** — validação "Escolha um — sem isso este papel não grava." — **nasce VAZIO: campo com consequência fiscal não tem default** — campo fiscal
- "Quando esse dinheiro saiu da sua conta?" (`data-radio="quando"`) — 1-de-2 ("Tudo em `<data do desembolso>`" / "Em mais de um dia") — obrigatório **quando** houver ≥2 papéis marcados "Comprovante do pagamento" — SEM DEFAULT — campo fiscal
- `inpValorS1b` "Valor que está no papel" — texto `inputmode="decimal"`, placeholder "0,00" — SEM DEFAULT — campo fiscal
- Não existem, de propósito: **valor por papel**, **data por papel**, **trava de soma dos comprovantes**

## Textos com consequência fiscal
- "Obrigatório: é o que sustenta este custo no dia da venda. **Pode ser mais de um.**" — s2, cabeçalho dos papéis
- "Na ordem: o dinheiro saiu · o que eu comprei · o que eu combinei." — hint das 3 opções de papel
- "Escolha um — sem isso este papel não grava." — validação do papel
- "Nada sobe para o acervo enquanto você não gravar — por isso "tirar da lista" só existe aqui, antes do Gravar. Depois de gravado, o acervo só cresce." — s2
- "O app nunca inventa a data: nem a de hoje, nem a do cadastro. Data ausente continua ausente e visível." — s2
- "A data que vale é a do débito no extrato — não a do contrato, não a da escritura, não a do vencimento." — s2, hint da data
- "Cada dia em que o dinheiro saiu é um pagamento com a sua própria data — e é a data que decide em que ano o custo entra. Se foi em mais de um dia, o registro é gravado do mesmo jeito e fica uma pendência." — s2 e s2d, caixa da pergunta
- "Não é retrabalho: dois débitos em dias diferentes são dois fatos, e o app não tem como saber quanto foi em cada dia — nem deve fingir que tem." — s2
- Rótulos do botão Gravar (estados): "Escolha ao menos um papel para gravar" · "Diga o que é cada papel para gravar (N sem resposta)" · "Responda quando o dinheiro saiu para gravar" · "Gravar o desembolso" · "Gravar — e abrir a pendência de datas"
- "**Gravado.** O registro entrou do mesmo jeito — o app nunca recusa um fato que já aconteceu." — s2c
- Pendência (chip) "Um lançamento, mais de uma data" + "Este lançamento tem **R$ 60.000,00 numa data só**, e você respondeu que o dinheiro saiu em mais de um dia. Cada data é um lançamento — é a data do pagamento que decide o ano do custo." — s2c
- "**Ainda não dá para arrumar aqui:** o app não corrige o valor de um desembolso do terreno já gravado. **Não registre os lançamentos separados antes disso** — enquanto este continuar com os R$ 60.000,00, os novos somam por cima e o custo do terreno fica maior do que foi." — s2c (na home, s3, a última oração é "os novos somam por cima.")
- "Quando a correção de valor existir: corrija este para o que saiu na primeira data e registre um lançamento para cada uma das outras." — s2c
- "Não desdobra o lançamento em três. Mexer em valor e data já gravados é outro assunto e, num ano já declarado, exige retificadora. A pendência **nomeia** a ação e diz quando ela fica possível; quem executa é você." — s2c
- "Pago, e sem papel nenhum" (chip) + "Este valor está gravado como pago e não tem nenhum papel no acervo. O custo é real, mas não é comprovável — e é você quem prova, não a memória." — s1c
- "Falta a data" (chip) + "Sem a data, este valor não tem ano-calendário e a discriminação não pode ser gerada." — s3
- "Não dá para dispensar, adiar ou esconder. Ela fecha quando o fato mudar — e hoje, honestamente, não fecha. Pendência fiscal baixada por declaração de intenção é o mesmo defeito do campo preenchido que afirma o que ninguém conferiu, com um botão na frente." — s3
- Regra de cor (nova, do `po` em 21/08): "**vermelho = fato consumado com consequência fiscal aberta; âmbar = nada saiu ainda**" — s3
- ⚠️ **NOTA DE 2026-08-23 — o HTML deste mock NÃO foi reescrito, e a cor de "Falta a data" nele está
  SUPERADA.** O `po` fechou a régua por extenso: *saiu? → tem apoio hábil no ano certo? → não = vermelho*,
  binária, **sem terceiro nível**. Por ela, o chip **"Falta a data" é VERMELHO**, não cinza — o desembolso
  está pago e o valor não cai em ano nenhum. O `s3` deste arquivo (aprovado pelo Mateus em 21/08) segue
  mostrando cinza; **o carimbo válido é o mock do CONTAI-025 v2**, e é ele que o `/develop` obedece neste
  ponto. Quem implementar: não copie a cor daqui. As outras cinco divergências de cor do inventário
  (inclusive "Pago sem comprovante" em âmbar no PJ do CONTAI-019) são o **CONTAI-035**.
- "**O link de leitura é temporário e só seu.** O acervo é privado: nada aqui vira endereço público, e o link expira sozinho." — s1
- "**O valor aparece uma vez só, no desembolso — nunca por papel.** Dois papéis não são dois custos." — s1
- "**Dois comprovantes, um custo.** O limite do PIX quebrou a transferência; não quebrou o desembolso." — s2b
- Erro ao abrir: "Não consegui abrir agora. O papel continua no acervo — o que falhou foi o link de leitura. Nada foi perdido." — todos os itens de lista
- Negado (RLS): "Este arquivo não é seu. O acervo só abre para o dono." — todos os itens de lista
- "Cada papel novo é **acréscimo** — nunca substituição, nunca remoção." / "O papel **não se substitui**; se precisar, anexa-se um adicional." — s2d / s1b
- "**Revise antes de copiar — 1 lançamento pede atenção.** A discriminação sai; o que a linha abaixo diz é onde o número pode estar no ano errado." — s3b
- "Este valor inteiro está caindo em **2026** pela data do lançamento. Se parte dele saiu em outro dia — e principalmente em outro ano — o ano está errado para essa parte." — s3b
- "O aviso fica **acima** deste bloco, nunca dentro dele: o que está dentro é o que você cola na declaração." — s3b

## Navegação
- s2 → s2b — "Gravar o desembolso" (nenhum 2º comprovante, ou resposta "Tudo em <data>")
- s2 → s2c — "Gravar — e abrir a pendência de datas" (resposta "Em mais de um dia")
- s2c → s3 — "Ver a pendência na lista" | s3 → s2c — "Abrir o desembolso"
- s3b → s3c — "Por que isto não trava (tela 3c)" | s3c → s3b — "Voltar para a tela que vai ao ar (3b)"
- Dentro do item de lista: "Abrir" → abrindo → papel em aba nova | falha → "Tentar de novo" | negado → sem ação
- "📎 Anexar mais um papel" (s1) / "📎 Anexar agora" (s1c) / "📎 Anexar papel" (s2d) — mesma ação, **sem tela nova**
- s3b → "Copiar o texto de 2026" — a discriminação **sai** mesmo com pendência aberta

## Decisões de design visíveis no mock
- **Um componente único de item de anexo, já em lista**, reusado nas 7 superfícies (corrigir valor / classificação / emitente, detalhe do documento, detalhe do pagamento, painel do terreno, informe anual). A 8ª (confirmar compromisso) fica de fora: ali o papel está sendo escolhido, não lido. Critério: nenhuma tela mostra nome de arquivo sem poder abrir.
- **A pergunta dispara pelo PAPEL, não pela contagem de arquivos** — ≥2 marcados "Comprovante do pagamento"; uma pergunta por **ato** (3 comprovantes de uma vez = 1 pergunta); **de novo** se a resposta vigente era "tudo no dia X" e chega comprovante novo; **nunca** para "Nota ou recibo"/"Contrato ou escritura"; **não** se a pendência já está aberta; **represada** enquanto o desembolso não tiver data (a pergunta cita a data no botão).
- **O caminho de captura fica intacto**: com um papel só, nenhuma tela nova, nenhuma confirmação, nenhuma navegação — uma tela e um Gravar.
- **A pendência "pago e sem papel nenhum" muda de fonte, não de cara**: passa de "a coluna do arquivo está vazia" para "este desembolso não tem nenhuma linha de anexo" — a migration não pode apagar a dívida junto com a coluna.
- **O bloqueio do critério 13 foi retirado desta rodada**: bloqueio sem caminho de baixa produz a resposta mentirosa; a pendência fica indispensável (sem "ok, entendi") e o bloqueio volta com a correção de valor, em ticket novo.

## ⚠️ Argumento rejeitado, presente no HTML

O bloco que justifica o corte do critério 13 no `CONTAI-027.html` contém
*"a discriminação não é transmitida pelo app"*. Esse argumento está **REJEITADO
pelo §2** de `docs/pareceres/2026-08-21-gate-fiscal-contai-027-criterio-13.md` —
ele derrubaria junto o **bloqueio do compromisso vencido**, que está de pé.
**Não reusar em ticket, mock ou tela.** O corte se sustenta pelo **§3.1/§3.2**.
O HTML foi marcado com tachado e nota de recusa em 2026-08-23; o parágrafo não
foi apagado porque o mock é registro do que o Mateus aprovou.

## Dúvidas
- `inpDataS2` tem `value="2026-08-21"` no HTML, o que contraria o texto da própria tela ("O app nunca inventa a data"). Interpreto como artefato do mock (serve ao eco da data no botão da pergunta) — confirmar que na implementação o campo nasce **vazio**.
- O mock não define o **texto do papel de exemplo** nem a duração do link assinado (só "temporário"); o TTL do `createSignedUrl` não aparece em tela.
- O estado "abrindo…" tem 420 ms fixos no mock — não há decisão sobre o comportamento real (spinner, timeout, retry automático).
- s3b mostra "Lançamentos 7" e "Em revisão 1"; o mock não diz se "Em revisão" conta só esta pendência ou toda pendência do ano.
