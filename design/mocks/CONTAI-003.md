# CONTAI-003 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão (telas 11–16 encostam em captura)   Arquivo: CONTAI-003.html
Telas: 16

## Telas e estados
- **Obra aberta / home** (`#s1`): sucesso apenas — sem loading, sem vazio, sem erro. Mostra afirmação da obra ativa, custo do ano, acumulado, 1 card de quarentena, FAB "+ Adicionar".
- **Lista de obras** (`#s2`): sucesso (2 cards de obra + contagem de pendências) — sem loading, sem vazio (o vazio é a tela `#s3`), sem erro. CTA secundário "+ Nova obra".
- **Nenhuma obra cadastrada** (`#s3`): vazio (CTA "Cadastrar a primeira obra") — sem loading, sem erro, sem sucesso.
- **Cadastro passo 1 — identificação** (`#s4`): formulário; sem loading/vazio/erro. CTAs "Continuar" / "Cancelar".
- **Cadastro passo 2 — bifurcação CNO** (`#s5`): sucesso; duas opções em card tocável ("Já tenho o CNO desta obra" / "Ainda não tenho CNO"). Sem loading/vazio/erro.
- **Cadastro passo 2a — CNO informado** (`#s6`): formulário + banner de janela sem CNO. Sem loading/vazio/erro.
- **Cadastro passo 2b — obra sem CNO** (`#s7`): estado de pendência fiscal (não é erro de sistema). CTAs "Continuar sem CNO", "Já registrei — informar o CNO", "Voltar". Sem loading/vazio/erro.
- **Cadastro passo 3 — custo do terreno** (`#s8`): formulário com total calculado. Sem loading/vazio/erro.
- **Cadastro passo 4 — premissas do imóvel** (`#s9`): formulário; CTA "Criar obra". Sem loading/vazio/erro.
- **Obra criada** (`#s10`): sucesso (resumo + card de pendência CNO). CTAs "Registrar o primeiro documento" / "Ver minhas obras". Sem loading/vazio/erro.
- **Registrar documento — obra afirmada** (`#s11`): formulário com bloco de afirmação da obra + link "Trocar". Sem loading/vazio/erro.
- **Trocar obra (dentro do fluxo)** (`#s12`): lista de 2 obras; CTA "Cancelar". Sem loading/vazio/erro.
- **NF de serviço em obra sem CNO** (`#s13`): alerta fiscal bloqueante-por-texto, não por trava. CTAs "Salvar mesmo assim" / "Voltar" / "Ver as 4 notas desta obra emitidas sem CNO". Sem loading/vazio/erro.
- **Notas sem CNO (lista de cobrança)** (`#s14`): sucesso com 4 linhas. Sem loading, sem vazio, sem erro.
- **Registrado ✓** (`#s15`): sucesso, nomeando a obra; escape "Corrigir a obra deste registro". Sem loading/vazio/erro.
- **Corrigir obra do registro** (`#s16`): formulário de movimentação + consequência. CTAs "Mover documento" / "Cancelar". Sem loading/vazio/erro.

## Campos
- `nome_obra` — texto — obrigatório (*) — — SEM DEFAULT
- `municipio` — texto — obrigatório (*) — — SEM DEFAULT
- `matricula_imovel` — texto/mono — opcional — — SEM DEFAULT
- `cartorio_registro` — texto — opcional — — SEM DEFAULT
- `data_inicio_obra` — data — obrigatório (*) — data **real** de início; alimenta o cálculo do prazo de 30 dias do CNO — SEM DEFAULT — campo fiscal
- `tem_cno` — escolha binária (card) — obrigatório — bifurca `#s6`/`#s7` — SEM DEFAULT — campo fiscal
- `numero_cno` — texto/mono (formato `12.345.67890/26`) — obrigatório se `tem_cno` — SEM DEFAULT — campo fiscal
- `data_registro_cno` — data — obrigatório se `tem_cno` — a diferença para `data_inicio_obra` define a janela de notas sem CNO — SEM DEFAULT — campo fiscal
- `valor_terreno` — moeda — obrigatório (*) — — SEM DEFAULT — campo fiscal
- `itbi` — moeda — opcional (preenchível depois) — integra o custo de aquisição — SEM DEFAULT — campo fiscal
- `escritura_registro` — moeda — opcional (preenchível depois) — integra o custo de aquisição — SEM DEFAULT — campo fiscal
- `custo_terreno` — moeda — derivado (valor + ITBI + escritura), somente leitura — —
- `unidades_autonomas` — número — obrigatório (*) — >1 dispara aviso permanente de incorporação (não bloqueia) — SEM DEFAULT — campo fiscal
- `origem_desmembramento` — sim/não — obrigatório (*) — "sim" dispara o mesmo aviso (não bloqueia) — SEM DEFAULT — campo fiscal
- `registro.obra` — obra afirmada no formulário — obrigatório — vale a obra **na tela**, não a preferência guardada no aparelho — SEM DEFAULT — campo fiscal
- `registro.tipo` — escolha (ex.: "NF de serviço") — obrigatório (*) — — SEM DEFAULT — campo fiscal
- `registro.emitente` — texto — obrigatório (*) — — SEM DEFAULT
- `registro.cnpj` — texto/mono — obrigatório (*) — — SEM DEFAULT
- `registro.valor` — moeda — obrigatório (*) — — SEM DEFAULT
- `mover_para` — seleção de obra — obrigatório em `#s16` — NF de serviço: revalida CNO da nota × CNO da obra destino; divergência barra a correção — SEM DEFAULT — campo fiscal

## Textos com consequência fiscal
- "= situação em 31/12 na ficha Bens e Direitos (terreno + obra)" — `#s1`, sob o acumulado
- "Nada é somado com a outra obra — cada matrícula é um item da declaração." — `#s1`
- "Não entra no custo de aquisição. Peça a nota no seu CPF." — `#s1`, card Quarentena
- "**Escolha a obra.** O app não escolhe por você — um documento na obra errada infla a base de INSS da outra e trava a regularização daquele CNO." — `#s2`, banner âmbar
- "O contai guarda documento e pagamento por obra, porque cada obra é uma matrícula na sua declaração e um CNO na aferição do INSS. Comece cadastrando a primeira." — `#s3`
- "Obrigatória com ou sem CNO. É ela que define o prazo legal do CNO (30 dias) e o período que a aferição do INSS enxerga. Informe a data **real** de início." — `#s4`, sob `data_inicio_obra`
- "O CNO é o cadastro da obra na Receita. É por ele que o INSS da construção é apurado — e ele é **por obra**, nunca compartilhado." — `#s5`
- "O app não bloqueia obra sem CNO: suas notas continuam valendo como custo no IRPF, e travar o cadastro te devolveria para a planilha." — `#s5`
- "O intervalo entre o início da obra (15/03/2026) e esta data é a janela em que as notas saíram sem CNO. É essa lista que você vai cobrar da empreiteira." — `#s6`
- "**18 dias entre o início e o registro.** As notas de serviço emitidas nesse intervalo não abatem a aferição enquanto não forem retificadas — o app vai listá-las para você cobrar." — `#s6`, banner âmbar
- "O CNO é obrigatório e o prazo é de 30 dias contados do início da obra (Lei 8.212/91, art. 49). Esta obra começou em **15/03/2026** — o prazo venceu em **14/04/2026** e o registro está **118 dias** em atraso." — `#s7`
- "Enquanto não houver CNO:<br>• as notas da empreiteira saem sem CNO impresso e **não abatem a aferição do INSS** desta obra — esse INSS vai ser cobrado de novo na regularização;<br>• sem aferição fechada não sai a regularização; sem regularização a construção não é averbada na matrícula; **sem averbação o banco do comprador não financia e o cartório não lavra.**" — `#s7`, consequência vermelha
- "**O que não muda:** as notas no seu CPF continuam valendo como custo de aquisição no IRPF. Continue registrando aqui." — `#s7`, consequência âmbar
- "**Próximo passo:** registre o CNO no e-CAC informando a **data real de início (15/03/2026)**, não a data de hoje. Declarar data posterior joga para fora da aferição tudo que você já pagou." — `#s7`
- "Este valor abre o custo de aquisição do imóvel na ficha Bens e Direitos. Ele não é só o preço pago ao vendedor." — `#s8`
- "ITBI e despesas de escritura/registro integram o custo de aquisição (IN SRF 84/2001, art. 17). Lançar só o preço do terreno subestimaria o custo e aumentaria o ganho de capital na venda." — `#s8`, sob o total
- "Registre o CNO no e-CAC com a data real de início (15/03/2026). Enquanto não houver CNO, as notas de serviço não abatem a aferição desta obra." — `#s10`, card de pendência
- "Esta nota **não vai abater a aferição do INSS** desta obra: sem CNO, a empreiteira não tem como imprimir o CNO na nota nem informá-lo na EFD-Reinf. O valor entra normalmente como **custo de aquisição no IRPF**." — `#s13`
- "**Enquanto ainda houver parcelas a pagar**, exija da empreiteira: (a) CNO impresso nas próximas notas e (b) reemissão ou retificação da EFD-Reinf das notas já emitidas. Depois do último pagamento você perde a força para pedir." — `#s13`, consequência âmbar
- "Notas de serviço desta obra emitidas enquanto ela não tinha CNO. Peça **retificação da EFD-Reinf** de cada uma **antes de liberar a próxima parcela**." — `#s14`, banner âmbar
- "Esta é uma **NF de serviço**: mover para outra obra revalida o CNO da nota contra o CNO da obra de destino. Se a nota referenciar um CNO diferente, a correção é barrada — senão a nota entraria numa obra cujo CNO ela não menciona." — `#s16`
- Rótulo de botão: "Salvar mesmo assim" — `#s13` (é RÓTULO, não checkbox de confirmação — nota do mock, adendo do contador 2026-08-10)
- Rótulo de estado: "sem CNO — obrigação em atraso" — `#s2`, card da obra; "CNO · pendente — 118 dias em atraso" — `#s10`

## Navegação
- `#s1` → `#s2` — link "Trocar obra"
- `#s1` → `#s10` — FAB "+ Adicionar" (no mock leva à confirmação de obra criada; ver Dúvidas)
- `#s2` → `#s1` / `#s9` — toque no card da obra
- `#s2` → `#s4` — "+ Nova obra"
- `#s3` → `#s4` — "Cadastrar a primeira obra"
- `#s4` → `#s5` — "Continuar"; `#s4` → `#s2` — "Cancelar"
- `#s5` → `#s6` — "Já tenho o CNO desta obra"; `#s5` → `#s7` — "Ainda não tenho CNO"; `#s5` → `#s4` — "Voltar"
- `#s6` → `#s8` — "Continuar"; `#s7` → `#s8` — "Continuar sem CNO"; `#s7` → `#s6` — "Já registrei — informar o CNO"
- `#s8` → `#s9` — "Continuar"; `#s9` → `#s10` — "Criar obra"
- `#s10` → `#s11` — "Registrar o primeiro documento"; `#s10` → `#s2` — "Ver minhas obras"
- `#s11` → `#s12` — "Trocar"; `#s12` → `#s11` — escolha de obra ou "Cancelar"
- `#s11` → `#s13` — "Continuar" (é NF de serviço em obra sem CNO)
- `#s13` → `#s14` — "Ver as 4 notas…"; `#s13` → `#s15` — "Salvar mesmo assim"; `#s13` → `#s11` — "Voltar"
- `#s15` → `#s16` — "Corrigir a obra deste registro"; `#s15` → `#s11` — "Registrar outro"; `#s15` → `#s1` — "Ir para a obra"
- `#s16` → `#s15` — "Mover documento" ou "Cancelar"

## Decisões de design visíveis no mock
- Obra é **frase afirmada** com escape ("Trocar"), nunca um `<select>`: seletor convida a trocar sem querer e o erro se descobre tarde. Vale a obra da tela, não a preferência do aparelho.
- Lista de obras **sem valores em dinheiro** de propósito — não existe total das duas obras em declaração nenhuma.
- Obra sem CNO **não bloqueia** cadastro nem registro; a trava seria devolver o Mateus à planilha. A pressão vira texto de consequência + lista de cobrança.
- "Salvar mesmo assim" é rótulo de botão, não caixa a marcar: confirmação a cada nota seria bloqueio disfarçado.
- Correção tardia existe (`#s16`) e revalida CNO no destino — prevenir sem consertar perderia o caso real (a alternativa era SQL na mão).

## Dúvidas
- O FAB "+ Adicionar" de `#s1` navega para `#s10` (Obra criada) no mock — parece atalho do protótipo, não intenção. Destino real provável: fluxo de registro (`#s11`) ou o "Adicionar" do CONTAI-001. Confirmar com o `po`.
- `#s14` (lista de notas sem CNO) depende de `data de emissão` e `CNO da nota`, campos do **CONTAI-007** — o próprio mock declara que está **fora do escopo do CONTAI-003**. Confirmar se entra ou fica stub.
- `#s7` mostra apenas o caso "em atraso"; a nota do mock diz que dentro do prazo a mesma tela diz "faltam N dias". Texto exato do caso "dentro do prazo" não existe no HTML — precisa vir do parecer.
- O aviso permanente de incorporação (`unidades > 1` ou desmembramento) é descrito em `#s9` mas **não tem texto redigido** no mock. Redação tem que vir do `contador`.
