# CONTAI-018 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão (conciliar é atividade de mesa; 375px é piso, 720px é o alvo)   Arquivo: CONTAI-018.html
Telas: 14   Status no mock: APROVADO pelo Mateus em 2026-08-18 (5 estados ★)
Fora de escopo declarado: agendamento / pagamento futuro → CONTAI-019

## Telas e estados
- **Documento sem pagamento ligado** (`#s1` ★): sucesso. Sem loading, sem vazio, sem erro (é o estado de partida do caminho B)
- **Seletor de candidatos** (`#s2` ★ interativo / `#s3` ★ vazio / `#s3c` quarentena / `#s3d` loading / `#s3e` erro):
  loading `#s3d` (skeletons + "Carregando os candidatos", `role="status"`) | vazio `#s3` (CTA "Registrar o pagamento agora")
  | erro `#s3e` (`role="alert"`, retry "Tentar de novo") | sucesso `#s2`
- **Registrar pagamento já vinculado** (`#s3b`): sucesso; sem loading/vazio/erro (o erro do salvamento é descrito em texto, não desenhado)
- **Depois do vínculo — par exato** (`#s6` ★), **pagou mais** (`#s7`), **nota maior** (`#s8`): só sucesso
- **Desligar pagamento — confirmação** (`#s9`): estado de confirmação com delta antes/depois; sem loading/vazio/erro
- **Home — terceiro estado** (`#s10` ★): sucesso com custo confirmado R$ 0,00 explicado; sem loading/vazio/erro
- **Home — depois do vínculo** (`#s11`): sucesso
- **Fila de conciliação** (`#s12`): wireframe ASCII, não é tela desenhada

## Campos
- `pagamentos candidatos` (`#s2`) — multisseleção (checkbox por candidato) — ao menos 1 obrigatório (botão desabilitado com
  "Marque ao menos um pagamento") — **SEM DEFAULT — campo fiscal**: nada vem marcado, nenhum vínculo nasce sem toque
- `favorecido` (`#s3b`) — READ-ONLY — vem da nota; "Vem da nota. Se estiver errado, corrige-se na nota." (CONTAI-021, critério 14)
- `valor` (`#s3b`) — moeda — OBRIGATÓRIO (*) — SEM DEFAULT — campo fiscal
- `data do pagamento` (`#s3b`) — data — OBRIGATÓRIO (*) — SEM DEFAULT — campo fiscal (regime de caixa)
- `comprovante` (`#s3b`) — anexo — OBRIGATÓRIO (*) — SEM DEFAULT
- Saldo ao vivo (`#s2`, calculado, não campo): restante = valor da nota − marcado; excedente = marcado − valor da nota;
  comprovado = mínimo(marcado, valor da nota)

## Textos com consequência fiscal
- "O custo **existe** — o app é que ainda não consegue demonstrar. Sem um pagamento ligado, estes R$ 3.000,00 não entram no
  **Custo confirmado de 2026**." — `#s1` (Gate Fiscal do CONTAI-018, itens 1 e 2, parecer de 2026-08-16)
- "**Sugestão é ordenação, não vínculo.** Nada vem marcado, e nenhum vínculo nasce sem você tocar. Só aparecem pagamentos da
  obra **Casa Cachoeira**." — `#s2` (Gate Fiscal item 5: "Proibido inferir vínculo por heurística. Sugere, nunca vincula
  sozinho." · item 4: "Nada soma entre obras.")
- "Enquanto não houver pagamento ligado, os R$ 3.000,00 desta nota ficam fora do **Custo confirmado** — é gasto real que o app
  não consegue demonstrar." — `#s3`
- "A data que vale para o custo é a do **pagamento**, não a da nota — regime de caixa." — `#s3b` (IN SRF 84/2001 art. 17)
- "**Esta nota está em quarentena.** Ligar o pagamento é permitido e útil — deixa de contar a mesma despesa duas vezes.
  **Mas não gera custo confirmado.**" + "Não entra no custo de aquisição. Peça a nota no seu CPF." — `#s3c`
  (Gate Fiscal item 6; frase final copiada de `CONSEQUENCIA_QUARENTENA`, `lib/fiscal/documento.ts`)
- "Custo confirmado se ligar agora: R$ 0,00 — a nota não é hábil" — rodapé de `#s3c`
- "entra no custo de aquisição de **2026** — pela data do pagamento (12/08/2026)" — `#s6`
- "= o menor entre o que foi pago (R$ 3.500,00) e o que a nota documenta (R$ 3.000,00)" — `#s7`
  (Gate Fiscal item 4: "Custo comprovado de um par = mínimo entre a soma dos pagamentos vinculados e a soma dos documentos
  hábeis vinculados.")
- "Você pagou R$ 500,00 além do que a nota documenta. Esse valor continua como **pago sem nota** e entra no **Custo em risco no
  IR** até chegar uma nota que o cubra." — `#s7` (Gate Fiscal item 4: "pagou mais do que a nota, o excedente é 'pago sem nota'.")
- "Este pedaço da nota **não vira custo**: regime de caixa — sem desembolso não há dispêndio. Ele passa a contar quando o
  pagamento existir e for ligado aqui." — `#s8` (critério de aceite 5)
- "Vínculo errado **infla o custo de aquisição**, que vai para a declaração — por isso desligar existe aqui, e não em SQL." — `#s9`
- "**Isso não quer dizer que você não gastou.** Há R$ 9.420,00 registrados nesta obra e **nenhum pagamento ligado à sua nota** —
  é custo real que o app ainda não consegue demonstrar." — `#s10` (Gate Fiscal item 2: três estados — custo comprovado, custo
  real que o app não consegue demonstrar, custo inexistente)
- "Gastos desta obra que hoje **não entram no custo de aquisição** — falta documento hábil no seu CPF." — `#s10`, `#s11`
- "Pode custar **até R$ 1.413,00 a mais** de imposto na venda (15% sobre o valor em risco; o fator de redução por tempo de posse
  e as isenções podem diminuir)." — `#s10` (cópia literal do parecer de 2026-08-16, Bloco 1 — headline; 15%: Lei 8.981/1995
  art. 21; reduções: Lei 11.196/2005 arts. 39 e 40). Em `#s11` o mesmo texto com "até R$ 963,00 a mais".
- "A nota está no seu CPF e com retenção — **o custo existe**. Falta ligar o pagamento para ele entrar no custo confirmado de 2026." — `#s10`
- "Sem nota no seu CPF, este pagamento não entra no custo de aquisição." — `#s10`, pendência "Pago sem nota"
- "Não entra no custo de aquisição. Peça a nota no seu CPF." — `#s10`, `#s11`, pendência "Quarentena"
- "= situação em 31/12 na ficha Bens e Direitos (terreno + obra)" — `#s10`, `#s11`, sob "Acumulado desta obra"
- "Se o pagamento salvar e o vínculo falhar, a tela diz que o pagamento ficou **sem vínculo** e mostra como completar — nunca um
  sucesso mentiroso." — `#s3b` (critério de aceite 1)
- "**Não deu para carregar os pagamentos.** Sem conexão com o servidor. **Nada foi ligado** — a nota continua como estava." — `#s3e`

## Navegação
- `#s1` → `#s2` — "Ligar a um pagamento" | `#s1` → `#s3b` — "Registrar o pagamento desta nota" / "+ Adicionar"
- `#s2` → `#s6` (marcado == nota) / `#s7` (marcado > nota) / `#s8` (marcado < nota) — botão "Ligar N pagamentos — R$ X"
- `#s2` → `#s1` — "Cancelar" | `#s2`/`#s3` → `#s3b` — "Registrar o pagamento agora"
- `#s3b` → `#s6` — "Salvar pagamento e ligar à nota" | → `#s1` "Cancelar"
- `#s3e` → `#s2` — "Tentar de novo" | → `#s1` / `#s10`
- `#s6`/`#s7` → `#s9` — "Desligar este pagamento"; `#s9` → `#s1` (desliga) ou `#s6` (cancela)
- `#s8` → `#s2` — "Ligar mais um pagamento"
- `#s10` → `#s2` (pendência "Ligar pagamento" / "Ligar a uma nota") · → `#s3c` ("Resolver" quarentena) · → `#s12` ("Conciliar — 1 par provável")
- `#s6`/`#s7`/`#s8` → `#s11` — "Voltar ao início" (home já com o vínculo)

## Decisões de design visíveis no mock
- **Saldo restante fixo no topo do seletor**, recalculado a cada marcação, com o efeito no custo escrito no rodapé antes de confirmar.
- **Duas larguras no mesmo mock** (375px piso / 720px mesa) — a régua de 2026-08-18 aplicada explicitamente.
- **Critério 13**: depois do vínculo, nota + pagamento viram **um** cartão ("uma despesa, não duas"), não dois lado a lado.
- **Desligar mostra o delta numérico antes** (custo confirmado 3.000→0, risco 6.420→9.420) e nada é apagado, só o vínculo some.
- **/adicionar alcançável do detalhe do documento**, não só da home — e ali NÃO é FAB flutuante, para não cobrir a ação principal.

## Dúvidas
- **Critério 12 — FAB sticky ou barra fixa de rodapé?** O mock mantém as duas (`#s10` FAB, `#s11` barra) porque a causa
  (não renderiza × renderiza onde ele não olha) não está determinada. Decide-se com uma foto da home no aparelho dele.
- O seletor deve mostrar pagamentos **já ligados a outra nota**? Um PIX que cobre duas notas é legítimo; hoje o mock esconde (`#s3`).
- **Nota parcialmente paga vira pendência na home** ("falta ligar R$ 2.500 da NF da WK")? Pendência nova, o CONTAI-005 não a prevê (`#s8`).
- A fila de conciliação (critério 18) entra nesta rodada? Está em ASCII, não desenhada (`#s12`). Regra que ela não pode quebrar:
  "Conferir e ligar" abre o seletor com NADA marcado; não existe "ligar todos".
