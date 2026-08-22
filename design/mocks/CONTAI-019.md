# CONTAI-019 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão (com uma exceção de captura, nomeada abaixo)   Arquivo: CONTAI-019.html
Telas: 21 (s0, s1, s2, s2b, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s17, s18, s19, s15, s16)
Aprovado pelo Mateus em 2026-08-18 (v2). Hoje congelado no mock: 18/08/2026. Larguras: 375px (piso) e 720px (mesa, padrão).

## Telas e estados
- **s0 — Fluxo (ASCII)**: só sucesso; documentação, não tela do app. Sem loading/vazio/erro.
- **s1 — Formulário `/adicionar/pagamento`** (interativo; a mesma tela grava pagamento OU agendamento): sucesso; **erro** só no anexo ("Não consegui anexar" + retry "Tentar de novo" + saída "Salvar sem o comprovante"); sem loading; sem vazio.
- **s2 — Salvo: agendamento, as quatro marcas**: só sucesso. Sem loading/vazio/erro.
- **s2b — Salvo sem comprovante, PJ × PF lado a lado**: sucesso com dois pesos visuais distintos (âmbar PJ, vermelho PF). Sem loading/vazio/erro.
- **s3 — Home da obra**: sucesso, com três blocos (custo confirmado, pendências fiscais, agendados). Sem loading/vazio/erro.
- **s4 — Auditoria dos oito lugares**: só sucesso; não é tela do app, é a prova de que nada foi somado. Sem loading/vazio/erro.
- **s5 — Agendado, ainda não pago**: só sucesso. Sem loading/vazio/erro.
- **s6 — Agendado já pago (1 agendamento, 2 pagamentos)**: só sucesso. Sem loading/vazio/erro.
- **s7 — Agendado vencido, sem resposta**: só sucesso (três respostas disponíveis, nunca zero). Sem loading/vazio/erro.
- **s8 — Não vai ser pago**: sucesso; campo de motivo obrigatório. Sem loading/vazio/erro.
- **s9 — Mudou a data**: sucesso. Sem loading/vazio/erro.
- **s10 — Registrar o pagamento** (interativo, tela densa de mesa): **erro de validação** = data futura (campo em vermelho, CTA desabilitado "Troque a data — ela ainda não aconteceu"); **erro** no anexo ("Não consegui anexar" + retry "Tentar de novo" + "Salvar sem o comprovante"); sem loading; sem vazio.
- **s11 / s12 / s13 / s14 — os quatro resultados de s10** (juros e multa fora do custo | diferença não explicada para conferir | falta pagar o resto | pago sem comprovante): todos só sucesso, mesmo layout, muda o card de efeito. Sem loading/vazio/erro.
- **s17 — Sugestão de quitação, depois de gravado**: sucesso; duas respostas, nenhuma bloqueia. Sem loading/vazio/erro.
- **s18 — Compra no cartão nasce agendamento**: só sucesso. Sem loading/vazio/erro.
- **s19 — Fatura paga: 1 documento, 3 pagamentos**: sucesso. Sem loading/vazio/erro.
- **s15 — Relatório anual bloqueado** (wireframe ASCII da US-004, que ainda não existe): **estado bloqueado** = "⛔ Não dá para gerar ainda." com a lista de vencidos e o botão "Gerar relatório de 2026" desabilitado. Sem loading/vazio/erro convencional.
- **s16 — Exportação do acervo**: só sucesso (três arquivos). Sem loading/vazio/erro.

## Campos
- `meio` (s1) — 3 botões: "PIX" | "Boleto" | "Cartão" — obrigatório — decide o branch junto com a data; em **cartão a data não decide nada** e o registro é sempre agendamento — no mock nasce em PIX (ver Dúvidas 1)
- `fCompra` — "Data da compra *" (s1) — `type=date` — **obrigatória quando meio = cartão** — "Fica registrada e não decide ano nenhum — serve para ligar a nota à fatura" — SEM DEFAULT (mock traz 2026-08-14 de demonstração)
- `fData` — rótulo dinâmico: "Data do pagamento *" (data ≤ hoje) / "Data prevista *" (data > hoje) / "Vencimento da fatura *" (cartão) — `type=date` — obrigatória — é ela que decide qual entidade nasce — **SEM DEFAULT — campo fiscal**
- `fValor` — rótulo dinâmico: "Valor pago *" ou "Valor previsto *" — `number step=0.01` — obrigatório — o campo **se chama valor previsto, nunca "valor"**, quando for agendamento — SEM DEFAULT
- `comprovante` (s1, s10) — anexo real (📷 Tirar foto / 📎 Escolher arquivo; estados vazio/anexado/falha) — **nunca bloqueante**: em pagamento é exigido pelo texto mas o botão grava sempre; em agendamento **não é exigido** (única exceção nomeada do app) — SEM DEFAULT
- `cData` — "Data em que o dinheiro saiu *" (s10) — `type=date` — obrigatória — **recusa data futura** e trava o CTA — vem pré-preenchida com a data prevista e **é editável**; a prevista é descartada na gravação (ver Dúvidas 2)
- `cValor` — "Valor efetivamente pago *" (s10) — `number step=0.01` — obrigatório — compara com o previsto e abre os blocos de maior/menor — SEM DEFAULT
- `cEncargos` — "Juros e multa por atraso *" (s10) — `number step=0.01` — obrigatório **só quando pago > previsto** — o excedente não identificado vira "sem explicação" e é marcado para revisão — mock traz 0.00 (ver Dúvidas 1)
- `escolhaMenor` (s10, quando pago < previsto) — 2 botões de mesmo peso: "Quita o agendamento" | "Falta pagar o resto" — obrigatório (CTA "Diga se quita ou se falta o resto") — **SEM DEFAULT — campo fiscal** ("nenhum dos dois erros é mais barato")
- `cSaldoData` — "Quando você pretende pagar o resto?" (s10, só se "Falta pagar o resto") — `type=date` — obrigatória **ou** o toggle "Ainda não sei — deixar sem data" — SEM DEFAULT
- `fMotivo` — "Por que não vai ser pago? *" (s8) — texto — **obrigatório** ("Daqui a dois anos, um agendamento encerrado sem motivo é a mesma coisa que registro nenhum.") — SEM DEFAULT
- `fNovaData` — "Nova data prevista *" (s9) — `type=date` — obrigatória — SEM DEFAULT
- `fFaturaData` — "Data em que a fatura foi paga *" (s19) — `type=date` — obrigatória — **vira a data de cada um dos N pagamentos** gerados — SEM DEFAULT
- `quitação` (s17) — 2 opções: "Sim, quita este compromisso" | "Não, é outro pagamento" — aparece **depois** do pagamento gravado, nunca bloqueia — SEM DEFAULT

## Textos com consequência fiscal
- "No cartão, a compra ainda não é um pagamento. O dinheiro só sai quando você paga a fatura — então isto vira um agendamento, mesmo que a compra tenha sido ontem." — s1
- "Fica registrada e não decide ano nenhum — serve para ligar a nota à fatura." — s1, campo Data da compra
- "15/09 ainda não aconteceu. Isto vai ser gravado como agendamento: não entra no custo de 2026 e não aparece em nenhum total até o dinheiro sair." — s1
- "O campo se chama valor previsto, nunca "valor"." — s1 (parecer §2, literal)
- "Por que insisto neste aqui: o banco guarda por cerca de 5 anos, e este acervo precisa durar até 31/12/2034, no mínimo. Os dois relógios não coincidem — e o comprovante é o único documento que dá para guardar de graça agora, no instante em que ele existe." — s1 e s10
- "Aqui o anexo não é exigido. Agendamento é a única coisa no app que nasce sem anexo obrigatório — ele não compõe custo nenhum, logo não há o que sustentar. Anexar o boleto é útil e recomendado, jamais bloqueante." — s1 (exceção nomeada, contraria a leitura literal do CLAUDE.md)
- "Vai salvar assim mesmo. Fica como pago sem comprovante — o custo existe, ainda não está demonstrável, e não compõe custo confirmado até você anexar." — s1, s2b, s10, s14 (caminho **PJ com NF**, adendo 2 §5, texto literal)
- "Vai salvar assim mesmo — e este caso é mais grave. Sem o comprovante da transferência, este recibo não sustenta custo nenhum. Fica no mesmo peso de "pago sem nota"." — s1, s2b, s10 (caminho **PF com recibo**, adendo 2 §5, texto literal)
- "Agravante: este mesmo desembolso alimenta a ficha Pagamentos Efetuados, CPF por CPF. Um lançamento lá sem lastro bancário expõe duas frentes, não uma." — s2b (adendo 2 §3, literal)
- "Agendado para 15/09. Nada entrou em custo." — s2
- "O que o app NÃO fez: não somou R$ 10.000,00 a lugar nenhum, não criou pendência fiscal, não mexeu no custo de 2026, não pôs isso na conta do INSS." — s2
- "Sem nota no seu CPF, este pagamento não entra no custo de aquisição." — s3, pendência "Pago sem nota"
- "Composto de documentos, não de previsões — os agendamentos abaixo não estão neste número." — s3, "Notas hábeis sem pagamento vinculado (o terceiro número)"
- "Valores previstos, não executados. Não compõem custo de aquisição." — s3, cabeçalho do bloco de agendados
- "AGENDA DE COMPROMISSOS — VALORES PREVISTOS, NÃO EXECUTADOS. NÃO COMPÕEM CUSTO DE AQUISIÇÃO." — s16, primeira linha literal do arquivo `agenda-de-compromissos-2026.csv` (Gate Fiscal 6.5; critério 23 testa o texto exato)
- "E aí, foi pago? Passaram 8 dias e nada foi registrado. Isto não é pendência fiscal — é agenda. Mas não some sozinho: sem resposta, ele trava a geração de qualquer relatório anual." — s3
- "Isto não é pendência fiscal. Nada saiu da conta, então não há risco fiscal ainda. Mas não some sozinho: enquanto ficar sem resposta, nenhum relatório anual pode ser gerado — nem o de 2026, nem o de outro ano." — s7
- "O boleto não é documento hábil para custo — nem depois de pago. Ele serve para a agenda e para ligar o pagamento à nota sem contar a despesa duas vezes." — s5
- "Só o principal compõe custo. Os R$ 320,00 ficam registrados e fora — se entrassem, o custo iria inflado para a declaração." — s11 (e em s6: "Custo de aquisição gerado: R$ 10.000,00. Juros e multa registrados e fora do custo: R$ 320,00.")
- "⚠️ Não confundir com os juros do financiamento do terreno, que integram o custo (art. 17, I, "g") — fundir os dois casos é erro fiscal." — s6
- "Você pagou a mais que o previsto. Quanto disso foi juros e multa por atraso?" — s10; e "Sobram sem explicação. Isto salva, e a diferença fica marcada para você conferir — o app não vai decidir sozinho o que ela é." — s10
- "Diferença não explicada não se acomoda em campo. Enquanto isso não for resolvido, o app trata os R$ 300,00 como fora do custo e mantém o item marcado." — s12
- "15/09 ainda não aconteceu. Um pagamento só existe com desembolso ocorrido — troque para o dia em que o dinheiro realmente saiu." — s10 (Gate Fiscal 1: "a recusa de data futura FICA, literalmente")
- "Vem preenchida com a data prevista, e é editável. O que for salvo é o que estiver aqui — a data prevista é descartada." — s10
- "O custo do ano é o pago, não o previsto. Os R$ 4.000,00 que faltam não são custo de nada até saírem da conta." — s13
- "Sem isso, o saldo nasceria vencido no mesmo instante e travaria os relatórios para sempre. "Ainda não sei" é resposta válida e não trava nada." — s10
- "Este pagamento ainda precisa de nota no seu CPF para virar custo confirmado. Se o boleto já estiver ligado à NF, o vínculo do CONTAI-018 fecha sozinho." — s11
- "Salvou. Nunca vou recusar o registro de um fato que já aconteceu." — s14 (parecer §4, literal)
- "Este pagamento quita o compromisso de 15/09?" / "Sim, quita este compromisso" / "Não, é outro pagamento" / "Se não quitar, o compromisso continua em aberto e este pagamento fica registrado sozinho." — s17 (bloco inteiro copiado literalmente do adendo 1 §C(b) — "para copiar e não reescrever")
- Condições da sugestão (s17, adendo 1 §C(a)): "Mesmo favorecido, pelo CNPJ/CPF" (nunca por nome) · "|pago − previsto| ≤ 20% do previsto ou ≤ R$ 500,00" (o que for maior) · "Entre 30 dias antes e 60 dias depois da data prevista" (sem recorte de ano) · "Vários agendamentos elegíveis ⇒ o app lista todos. Proibido escolher o mais próximo — escolher é heurística decidindo vínculo."
- "Responder "Não, é outro pagamento" não desbloqueia relatório nenhum, e o app não pergunta de novo daquele par" — s17
- "A data da compra fica registrada e não decide ano nenhum. Quem decide o ano é o dia em que a fatura for paga." — s18
- "O favorecido é a Leroy Merlin, nunca o banco nem a administradora do cartão. Cartão é instrumento de pagamento." — s18
- "⚠️ Ressalva que viaja junto: a tese do ano do pagamento da fatura é defensável, não pacífica. Exige confirmação de contador humano (CRC) antes da primeira declaração que a use, e o relatório anual que contiver custo vindo de cartão exibe essa ressalva." — s18
- "Cada compra daquela fatura é confirmada, uma a uma, gerando um pagamento por compra — nunca um pagamento único pela fatura." — s19 (adendo 1 §B(b), literal)
- "A argamassa vai entrar como pago sem nota — o comprovante da fatura prova que o dinheiro saiu, não prova o que foi comprado." — s19
- "Juros de rotativo, juros de parcelamento, IOF, anuidade e multa ficam fora do custo, na mesma separação principal × encargos." — s19
- "O registro fica, com o motivo — nada é apagado. Este agendamento nunca gerou lançamento nenhum, então não há o que desfazer." — s8
- "A data anterior fica no histórico. Nenhuma das duas datas vira data de pagamento — a que vale é a do dia em que o dinheiro sair." — s9
- s15, texto do bloqueio (wireframe): "⛔ Não dá para gerar ainda." · "2 agendamentos venceram e ninguém respondeu se o dinheiro saiu. Enquanto isso, não dá para saber a que ano o desembolso pertence." · "Os valores acima NÃO entram no relatório em hipótese nenhuma. Responder não os transforma em custo — "Foi pago" abre o registro do pagamento, que é quem cria o custo."
- Regra de bloqueio (s15, adendo 1 §A, corolários 1-4): vencido sem resposta **de qualquer ano** trava tudo · data prevista ≥ hoje não trava · "sem data definida" (saldo parcial) não trava · "Não, é outro pagamento" não destrava.

## Navegação
- s1 → s2 — data > hoje (não cartão), CTA "Agendar — não entra no custo"
- s1 → s18 — meio = cartão, mesmo CTA "Agendar — não entra no custo" (a data não decide)
- s1 → s3 — data ≤ hoje e comprovante anexado, CTA "Salvar pagamento"
- s1 → s2b — data ≤ hoje **sem** comprovante (o botão grava, o estado é que muda)
- s3 → s5 / s7 — "Abrir" no cartão do agendado / do vencido; s3 → s1 — "+ Adicionar"
- s5 → s10 ("Registrar o pagamento") e s5 → s8 ("Marcar que não vai ser pago")
- s7 → s10 ("Foi pago") | s8 ("Não vai ser pago") | s9 ("Mudou a data") — **as três respostas são a única parte do ticket medida pela régua do canteiro** (um toque cada)
- s10 → s11 (encargos identificados) | s12 (diferença sem explicação) | s13 (falta pagar o resto) | s14 (sem comprovante) — o roteamento é do próprio CTA, cujo rótulo muda com o caso
- s18 → s19 — "A fatura foi paga"; s19 → salva os 3 pagamentos
- s15 (relatório bloqueado) → as três respostas por item vencido, ali mesmo

## Decisões de design visíveis no mock
- **Uma tela só grava as duas entidades**, e quem decide é a data (ou o cartão), nunca um botão "já paguei / vou pagar". O compromisso **nunca vira** pagamento: quando o dinheiro sai, nasce um pagamento ligado a ele (1 agendamento ← N pagamentos).
- **O agendado carrega quatro marcas redundantes** (borda tracejada, chip âmbar, `~` e cinza no valor, preposição "para"); **o pago é mudo**. O inverso produz o erro caro — um pagamento que perde a marca parece agendado e ele registra de novo.
- **O botão nunca é bloqueado por falta de anexo** — só data futura o trava, porque aí o fato não existe. O que muda sem comprovante é o **estado que nasce**, e ele é mais grave para PF com recibo (vermelho) do que para PJ com NF (âmbar).
- **Vocabulário de tela ≠ vocabulário de modelo**: "agendado"/"pago" na interface, com a preposição carregando o tempo ("pago em 05/08" × "para 15/09"). Palavra de sistema não vira botão — foi o que reprovou na v1.
- **O bloco de agendados não mostra soma** e fica fora das pendências fiscais, longe do custo: número em dinheiro perto dos outros convida a leitura errada, e "quanto vai sair" é fluxo de caixa, fora de escopo.

## Dúvidas
1. Alguns campos nascem com valor no mock — `meio` inicia em **PIX**, `cEncargos` em **0.00**, e as datas/valores vêm preenchidos. Não dá para distinguir demonstração de default pretendido; dada a proibição de default em campo fiscal, o spec assume SEM DEFAULT, mas `meio` e `cEncargos` precisam de decisão explícita.
2. O próprio mock deixa aberta, sem decidir, a pré-carga de `cData` (s10): "quando o previsto for passado — o boleto vencido em 10/08 registrado hoje, 18/08 — o campo nasce válido e errado, e um toque salva 10/08". Três saídas listadas e nenhuma escolhida: (a) pré-preencher com hoje; (b) deixar vazio; (c) manter o previsto e exigir um toque confirmando a data.
3. s17 usa a palavra **"compromisso"** (única ocorrência na interface), porque o bloco é cópia literal do adendo 1 §C(b); o resto da interface diz "agendamento". O mock pergunta e não decide: manter a palavra do parecer ou uniformizar?
4. s12: onde mora o item marcado "diferença sem explicação" — pendência na home, marca no detalhe do pagamento, ou lista à parte? Nem o ticket nem o parecer dizem; o designer devolveu em vez de preencher.
5. s9: "mudou a data" mantém o mesmo registro (é o que o mock desenha, com histórico) ou fecha um e abre outro? Decisão do `contador`, não do designer.
6. s18: **compra parcelada no cartão** e **fatura paga parcialmente (rotativo)** não foram desenhadas — o adendo dá duas saídas para a primeira (um agendamento por parcela × recusar na entrada com mensagem explícita) e o ticket não escolhe.
7. s7 (aberta pelo próprio mock): o que acontece ao tocar "Foi pago" longe de casa — interrompe ali, ou o app guarda "ele disse que foi pago" como pendência de completar depois? A terceira saída (salvar direto com hoje + valor previsto) foi descartada por violar a proibição de default em campo fiscal.
8. s3, três perguntas de desenho ainda abertas ao Mateus: (a) falta do total previsto no bloco de agendados; (b) os dois tons de âmbar distinguem agendado de vencido no aparelho dele; (c) posição do bloco abaixo das pendências fiscais.
