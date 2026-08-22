# CONTAI-021 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão   Arquivo: CONTAI-021.html
Telas: 27 (s0, s0b, s1, s1b, s1c, s2, s2b, s3, s3b, s3c, s3d, s3e, s4, s5, s5b, s6, s6c, s6b, s7, s7b, s7c, s7d, s7e, s7f, s8, s8b, s8c)
Aprovado pelo Mateus em 2026-08-19 (v2). Larguras do mock: 375px (piso) e 720px (mesa, ligada por padrão).

## Telas e estados
- **s0 / s0b — Fluxo (ASCII, dois diagramas)**: só sucesso; sem loading, sem vazio, sem erro. Documentação de fluxo, não tela do app.
- **s1 — Detalhe do documento** (`/documento/[id]`): sucesso; **vazio** = card "Histórico de correções" com "Nenhuma correção neste registro."; sem loading; sem erro.
- **s1b — Registrar pagamento (origem do link "Corrigir na nota")**: só sucesso (formulário parcialmente preenchido). Sem loading/vazio/erro.
- **s1c — Diálogo "Sair para corrigir a nota?"**: só sucesso (confirmação). Sem loading/vazio/erro.
- **s2 — Passo 1: "Esse dado está errado na nota, ou só aqui no app?"** (interativo): vazio inicial (nada escolhido, CTA desabilitado "Escolha o motivo para continuar" → "Escreva o motivo para continuar" → "Continuar — ver o valor"); sem loading; sem erro.
- **s2b — "O erro está na nota"** (beco sem saída deliberado): só sucesso; não grava nada. Sem loading/vazio/erro.
- **s3 — Corrigir o valor, ano corrente** (passos 2 e 3): sucesso; sem loading/vazio/erro nesta tela (estão em s3d/s3e).
- **s3b — Corrigir o valor, mexe em ano anterior**: igual a s3 + aviso de retificadora + pendência. Sem loading/vazio/erro.
- **s3c — Valor em branco (`null → valor`)**: **vazio** = campo com placeholder `0,00` e "Valor gravado hoje —". Sem loading/erro.
- **s3d — Dois estados que travam a gravação**: **erro (a)** valor igual ao gravado, botão desabilitado "Nada a corrigir"; **erro (b)** valor não numérico, botão "Gravar" desabilitado. Sem retry (é validação de campo). Sem loading.
- **s3e — Gravando e falha**: **loading** = "Gravando…"; **erro** com retry "Tentar de novo" (+ saída "Voltar ao documento"). Sem vazio.
- **s4 — Corrigir a classificação** (interativo): vazio inicial (nada marcado, nem a classificação atual; CTA "Escolha a classificação para continuar"). Sem loading/erro.
- **s5 — Corrigir o nome do emitente** (interativo): vazio inicial (afirmação não marcada; CTA "Confirme a afirmação para gravar" → "Gravar o nome novo — vale para os 7 registros"). Sem loading/erro.
- **s5b — Anexo do documento novo** (`<input type="file">` real): **vazio** (CTA "Anexe o documento para gravar"), **erro** "Não consegui anexar" com retry "Tentar de novo" (CTA vira "Não dá para gravar sem o documento"), **sucesso** (CTA "Gravar — com o documento novo anexado"). Sem loading.
- **s6 — "O CNPJ/CPF do emitente está errado"**: só sucesso; sem campo editável; ação única "Marcar: o CNPJ deste registro está errado — tratar". Sem loading/vazio/erro.
- **s6c — Documento marcado (CNPJ errado)**: sucesso; botão idempotente "Já marcado — CNPJ errado, a tratar"; **vazio** = histórico "Nenhuma correção neste registro." Sem loading/erro.
- **s6b — "Está errado outro dado"**: só sucesso (texto explicativo do que não tem campo). Sem loading/vazio/erro.
- **s7 — Documento corrigido, com histórico** (`data-corr` = valor | classificacao | emitente — mesma tela, três banners e três cards de efeito): só sucesso. Sem loading/vazio/erro.
- **s7b — Home da obra "o que está faltando"**: sucesso com 3 pendências (retificadora do ano, CNPJ errado, pago sem nota). Sem loading/vazio/erro.
- **s7c — Pendência do ano (2025), acumulada**: só sucesso. Sem loading/vazio/erro.
- **s7d — Marcar como tratada** (interativo): vazio inicial (nenhum desfecho marcado; CTA "Escolha o desfecho para continuar" → "Informe a data para continuar" → "Marcar a pendência de 2025 como tratada"). Sem loading/erro.
- **s7e — Home depois da baixa**: sucesso; a linha de 2025 sai da lista e aparece em "Histórico do ano · 2025". Sem loading/vazio/erro.
- **s7f — Home 02/09, pendência NOVA de 2025**: sucesso; a baixada permanece no histórico. Sem loading/vazio/erro.
- **s8 — Corrigir a obra, com 2 pagamentos ligados** (interativo): vazio inicial (obra e as 2 respostas em branco; CTA "Faltam 3 respostas para ver a conta" → "Falta 1 resposta para ver a conta" → "Gravar — e abrir a pendência de 2025"); o bloco "O que isso muda no seu custo" fica oculto até as 3 respostas. Sem loading/erro.
- **s8b — Corrigir a obra, sem pagamento ligado**: vazio inicial (CTA "Escolha a obra de destino"); nenhum número muda; não abre pendência. Sem loading/erro.
- **s8c — A mesma pendência de 2025 vista das duas obras**: só sucesso. Sem loading/vazio/erro.

## Campos
- `motivo` (s2) — 3 opções exclusivas: "Só aqui no app — eu digitei errado" | "A nota estava errada e o emitente já corrigiu" | "Outro motivo — vou escrever" — obrigatório — escolher habilita o CTA; `emitente` roteia para s5b (anexo obrigatório) — **SEM DEFAULT — campo fiscal** ("Nada aqui nasce escolhido. Campo que decide consequência fiscal não tem resposta padrão.")
- `txtOutro` (s2) — textarea, placeholder "O que aconteceu, em uma ou duas linhas." — obrigatório quando motivo = outro — não pode ser só espaço — SEM DEFAULT
- `inpValor` / `inpValor2` / `inpValor3` / `inpValor4` — "Valor que está no papel" (s5b: "Valor que está no documento novo") — texto `inputmode="decimal"` — obrigatório — recusa: igual ao gravado ("Igual ao que já está gravado — não há o que corrigir.") e não numérico ("Não consigo ler isto como um valor em reais. Digite só números, com vírgula nos centavos.") — SEM DEFAULT — campo fiscal (ver Dúvidas 1)
- `classificacao` (s4) — 2 opções: "Material" | "Mão de obra" — obrigatório — **SEM DEFAULT — campo fiscal** ("Nada nasce marcado, nem a classificação atual.")
- `inpNome` (s5) — "Nome como está impresso na nota" — texto — obrigatório — SEM DEFAULT (ver Dúvidas 1)
- `afirmCnpj` (s5) — afirmação (toggle) "O CNPJ impresso na nota é 12.345.678/0001-99 — só o nome está diferente." — obrigatória para gravar — **SEM DEFAULT — campo fiscal** (nunca pré-marcada)
- `anexoNovo` (s5b) — `<input type="file">` real (câmera "📷 Tirar foto" + "📎 Escolher arquivo") — **obrigatório no mesmo ato** quando motivo = emitente — estados vazio/anexado/falha — SEM DEFAULT
- `desfecho` (s7d) — 3 opções: "Retifiquei a DAA de 2025" | "Meu contador avaliou e não é preciso retificar" | "A DAA de 2025 ainda não foi entregue" — obrigatório — **SEM DEFAULT — campo fiscal** (não há campo de texto livre)
- `inpDataDesf` (s7d) — data `dd/mm/aaaa`, rótulo dinâmico "Data da retificadora — obrigatória" / "Data em que seu contador respondeu — obrigatória" — obrigatória nos desfechos a e b; **o desfecho c não pede data** — SEM DEFAULT
- `obraDestino` (s8/s8b) — 1 opção por obra ("Reforma do apartamento · CNO próprio · iniciada em 03/2025") — obrigatório — **SEM DEFAULT** ("Nada nasce marcado.")
- `escolhaPag[p1]`, `escolhaPag[p2]` (s8) — por pagamento, 2 opções: "Este pagamento também é da Reforma do apartamento" | "Este pagamento é mesmo da Casa Tanheiros" — obrigatórios, um a um, nunca em cascata — **SEM DEFAULT — campo fiscal**
- Campos exibidos e **não editáveis**: CNPJ/CPF do favorecido, situação do documento, arquivo anexado (só se acrescenta), tipo, vencimento, "a nota está no meu CPF", número/série/data de emissão (não existem no app).

## Textos com consequência fiscal
- "entra no custo de aquisição pela data do pagamento — regime de caixa" — s1, sob "Custo comprovado"
- "Você pagou além do que esta nota documenta. Esse valor continua como pago sem nota até chegar uma nota que o cubra." — s1, "Excedente do pagamento"
- "Quem recebe o dinheiro é atributo da nota, não do pagamento. CNPJ/CPF errado não se edita: é outro favorecido — corrige-se o documento e refaz-se o vínculo." — s1b
- "Se está errado na nota, não dá para consertar aqui. O que vale na fiscalização é o papel: se o app disser uma coisa e o arquivo anexado disser outra, a divergência derruba a prova — e quem explica isso numa intimação é você." — s2b (cópia literal do §3 do parecer de 2026-08-18)
- "Peça ao emitente: Valor, CNPJ/CPF do destinatário ou data de emissão errados → nota substitutiva (cancelamento e reemissão). Carta de correção não conserta nenhum desses." — s2b
- "Descrição do serviço ou dado sem efeito no valor → carta de correção, que ele te manda em arquivo." — s2b
- "Quando o documento novo chegar, registre e anexe. Esta nota continua no acervo — nada aqui se apaga." — s2b
- "Nada. Não grava, não marca quarentena, não muda status. O documento fica exatamente como está, e você volta aqui quando o arquivo novo chegar." — s2b
- "Quarentena tem um significado só no contai — destinatário diferente do seu CPF. Usá-la para "nota errada do emitente" destruiria o único sinal fiscal daquela coluna." — s2b (e, com a mesma substância, em s6 e s6c)
- "Custo comprovado do par = mínimo entre a soma dos pagamentos e a soma dos documentos hábeis (parecer de 2026-08-17, §3). O ano é o da data do pagamento — regime de caixa." — s3
- "Esta correção mudou o custo de um ano anterior; se a DAA daquele ano já foi entregue, avalie retificadora com seu contador." — s3b, s7b, s7c, s7f, s8 (crit. 4 / parecer §6 — texto único, mesmo detector)
- "O app não sabe se você já entregou a declaração de 2025. Ele sabe que 2025 é um ano anterior a 2026, e é só isso que ele afirma. Quem sabe a data da entrega é você." — s3b, s8
- "Este aviso não some quando você fechar a tela. Ele fica na lista de pendências até você marcar que já tratou com o contador." — s3b
- "Enquanto o valor estiver em branco, este documento não cobre pagamento nenhum — o que foi pago contra ele continua como "pago sem nota"." — s3c
- "Não deu para gravar. A conexão caiu no meio. Nada foi alterado — o valor continua R$ 4.085,71 e nenhum registro de correção foi criado." — s3e
- "Esta escolha muda só a composição do que você declara (material × mão de obra). Não muda o total e não tira nada do custo. Se a sua dúvida é se o gasto entra no custo do imóvel — é o caso de marcenaria fixa e planejados —, isso não se decide aqui: leve ao seu contador." — s4 (adendo de 2026-08-19 §2, cópia literal)
- "O CNPJ é a identidade do favorecido. É por ele que a Receita cruza tudo — o nome só acompanha." — s5
- "O CNPJ impresso na nota é 12.345.678/0001-99 — só o nome está diferente." / "Não é esse o CNPJ do papel? Então não é o nome que está errado. → O CNPJ/CPF do emitente está errado" — s5 (adendo §3, as duas linhas são obrigatórias)
- "Um dos pagamentos deste favorecido é de 2025. Se você já entregou a declaração daquele ano, o nome que saiu nela continua diferente do que o app mostra a partir de agora. O CPF/CNPJ, que é o que identifica o favorecido na declaração, não mudou." — s5 (adendo §4, cópia literal)
- "Esta correção fica registrada no histórico, com a data. Se o seu contador precisar dela, está lá — o app não decide se isso pede retificadora." — s5 (adendo §4)
- "Isto NÃO abre pendência na sua lista. O custo não muda um centavo, e pendência persistente só nasce quando a correção muda um número declarado. Aqui muda identificação: rastro e aviso, e acabou." — s5
- "CNPJ errado não é typo, é outro favorecido." — s6 (adendo de 2026-08-18 §2, citação literal)
- "Marcar não muda nada no documento: não abre campo, não mexe na situação, não manda para quarentena, não altera valor nem desfaz vínculo. É anotação com consequência visível — e marcar duas vezes continua sendo uma pendência." — s6
- "Enquanto não for tratado, esse documento continua apontando para um favorecido que não é o que emitiu a nota — e é esse favorecido que sairia na ficha Pagamentos Efetuados. A correção do apontamento ainda não existe no app." — s7b, pendência "CNPJ errado — tratar"
- "Conferi o papel: o CNPJ gravado está certo — o erro foi meu ao marcar" — s6c, único desfecho manual da pendência de CNPJ (pede a data)
- "A situação (em ordem, em quarentena) sai do que você respondeu sobre a nota. Ela muda quando você corrige o fato — nunca escolhendo a situação numa lista." — s6b
- "O anexo é a prova. Se a foto ficou ilegível ou chegou uma 2ª via, anexe o arquivo novo: os dois ficam. Nada sai do acervo." — s6b (e s5b: "Este anexo não substitui a nota antiga. Ele se soma a ela.")
- "Correção registrada não se apaga e não se edita — nem por você." / "Esta lista só cresce. Nenhuma linha pode ser editada ou apagada — nem por você." — s3, s7
- "Nome não é dinheiro: custo, anos e vínculos ficaram exatamente como estavam. O que muda é o que sai escrito na ficha Pagamentos Efetuados." — s7 (variante emitente)
- "Um pagamento e o documento dele não podem ficar em obras diferentes. Então um dos dois está errado, e só você sabe qual — a resposta é por pagamento, um a um." — s8
- "Vai junto com a nota. O par pagamento↔nota continua inteiro, só muda de imóvel: sai do custo de aquisição de um bem e entra no do outro, sem que o seu gasto mude um centavo." — s8, resposta "também é da Reforma"
- "Então foi ligado ao papel errado. O vínculo se desfaz, com registro, e ele volta a "pago sem nota" na Casa Tanheiros. O pagamento continua sendo dispêndio dela — o que falta é o documento hábil que o comprove." — s8, resposta "é mesmo da Casa Tanheiros"
- Resumo dinâmico de s8, três variantes literais: (a) "O custo total não muda. Os R$ X saem de uma obra e entram na outra — a nota e os pagamentos dela viajam juntos."; (b) "O custo confirmado total cai R$ X. A nota vai sozinha para a Reforma, onde não cobre pagamento nenhum, e os pagamentos voltam a pago sem nota na Casa Tanheiros. Isso agora é a verdade — antes o vínculo estava errado."; (c) "Dos R$ V, R$ J acompanham a nota e R$ D voltam a pago sem nota na Casa Tanheiros. O custo confirmado somado das duas obras cai R$ D. Isso não é perda: esses R$ D continuam sendo dispêndio da Casa Tanheiros — o que falta é o documento hábil que os comprove."
- "Nada muda, e por isso NÃO abre pendência. Fica o rastro e o aviso, e acabou. Pendência persistente só nasce quando a correção muda um número declarado." — s8b
- "O rastro é sempre, com ou sem pagamento ligado." — s8b (parecer §5)
- "Sem pagamento ligado, mover de obra não muda número nenhum — nem na origem nem no destino. Documento sozinho não comprova custo: o que comprova é o par." — s8b
- "É UMA pendência, não duas. A chave é o ano, porque a DAA é do contribuinte e não da obra" — s8c; e "Esta correção também mudou o custo de 2025 na Reforma do apartamento." (a outra obra é nomeada **sem valor**)
- "O app não diz se você precisa retificar. Ele não sabe se a declaração de 2025 foi entregue, nem se essa diferença é material. Quem decide isso é o contador." — s7c
- "Baixar não apaga. A pendência sai da lista e fica no histórico de 2025" / "Baixar não silencia o futuro. Se você corrigir outra coisa que mexa em 2025 depois de hoje, abre uma pendência nova — esta não reabre." — s7d
- "O que você digitou não vai ser guardado. Valor, data e meio voltam em branco. E o arquivo que você já escolheu não sobrevive a esta navegação — vai precisar anexar de novo, mesmo que a tela pareça lembrar dele." — s1c
- "O pagamento aponta para o favorecido, não para o texto do nome dele. Termine este pagamento e corrija o nome depois, pelo documento: o dado gravado é exatamente o mesmo." — s1c

## Navegação
- s1 (detalhe) → s2 — card "Corrigir este registro", ação "Corrigir o valor" / "Corrigir a classificação" (→ s4) / "Corrigir o nome do emitente" (→ s5)
- s1 → s6 — "O CNPJ/CPF do emitente está errado — e agora?"; s1 → s6b — "Está errado outro dado, que não está nesta lista"; s1 → s8 — "Corrigir a obra deste registro"
- s1b (registrar pagamento) → s1c — link "Corrigir na nota" com formulário pela metade; s1c → s1b ("Continuar o pagamento") ou → s5 via `/documento/ID/corrigir/emitente?voltar=pagamento` ("Sair e corrigir a nota — perco o que digitei")
- s2 → s3 — motivo = digitação ou outro, CTA "Continuar — ver o valor"
- s2 → s5b — motivo = "o emitente corrigiu a nota" (desvio obrigatório pelo anexo)
- s2 → s2b — opção "A nota está errada e eu ainda não pedi nada ao emitente"; s2b → s1 ("Voltar ao documento — deixar como está"), sem gravar nada
- s3 / s3b / s4 / s5 / s5b / s8 / s8b → s7 — botão Gravar (`data-corr` diz qual das três variantes o s7 exibe)
- s3b, s8 → também abrem a pendência do ano na home (s7b)
- s3e (falha) → retry na mesma tela ou → s1
- s6 → s6c — "Marcar: o CNPJ deste registro está errado — tratar"; s6c → s7b — "Ver na lista de pendências"
- s7b → s7c — "Abrir a pendência de 2025"; s7c → s7d — "Marcar como tratada"; s7d → s7e — CTA do desfecho; s7e → s7f — "E se eu corrigir outra coisa de 2025 depois disso?"
- s8 → s8c — depois de mover com pagamentos, a pendência aparece nas duas homes

## Decisões de design visíveis no mock
- **Três ações nomeadas, não um formulário** — `/documento/[id]/corrigir/{valor|classificacao|emitente}`. Campo proibido sentado ao lado de campo editável é convite a inventar dado; por isso CNPJ, situação e anexo só têm texto, nunca campo.
- **A pergunta do motivo vem antes do campo.** Se o erro é da nota, não existe campo a mostrar (s2b), e sair de lá **não deixa rastro** — de propósito: não houve antes nem depois de um fato do acervo.
- **Fronteira única que decide pendência**: pendência persistente só nasce quando a correção muda um **número declarado**. Nome, classificação e obra-sem-pagamento geram rastro + aviso e nada mais.
- **A pendência de retificadora é por ANO, não por correção**, acumula o delta do primeiro "antes" ao último "depois", carrega o conjunto de obras afetadas (antes ∪ depois do campo obra no rastro, nunca `documento.obra_id`) e só o Mateus a baixa, com desfecho escolhido, por INSERT.
- **Botão desabilitado sempre diz no rótulo o que falta** ("Faltam 3 respostas para ver a conta", "Escolha o desfecho para continuar"): botão cinza mudo faz o usuário achar que o app quebrou.

## Dúvidas
1. Vários campos aparecem **pré-preenchidos** no mock (`inpValor` = 40.857,14; `inpNome` = "WK Construções LTDA"; `inpValor2`; `inpValor4`) enquanto `inpValor3` nasce vazio com placeholder `0,00`. Não dá para distinguir no HTML se isso é conteúdo de demonstração ou default pretendido. Dado que default em campo fiscal é proibido, o spec assume **SEM DEFAULT** — mas isso precisa de confirmação antes do Gate 1.
- Nota do próprio mock, não resolvida no HTML: o texto de s2b marca **[Likely]** o prazo do emitente para cancelar/substituir a nota — "confirmar na legislação municipal".
