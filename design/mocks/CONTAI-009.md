# CONTAI-009 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão   Arquivo: CONTAI-009.html
Telas: 14
Escopo: o detalhe de UM pagamento. Não é inventário (US-009), não abre o comprovante (US-010), e
**só a obra é corrigível** — valor, data e favorecido não se editam aqui.

## Telas e estados
- **Home — a porta que falta** (`#s1`): sucesso. Cards de exposição por favorecido passam de cartaz a porta.
  Sem loading, sem vazio, sem erro nesta tela do mock
- **Lista do grupo (exposição por favorecido)** (`#s2`): sucesso (3 PIX); vazio em `#s13` ("Nenhum pagamento nesta pendência");
  sem loading próprio; erro em `#s8`
- **Detalhe — carregando** (`#s3`): loading (skeleton com a forma da tela cheia: valor no topo, bloco de campos, faixa de
  consequência — para o layout não pular); rótulo "Carregando o pagamento", mesmo componente do detalhe do documento
- **Detalhe — PJ, pago sem nota** (`#s4`, tela principal): sucesso
- **Detalhe — PF, pago sem recibo** (`#s5`): sucesso
- **Detalhe — registro incompleto** (`#s6`): sucesso degradado (favorecido e comprovante ausentes)
- **Detalhe — conciliado** (`#s7`): sucesso
- **Erro + retry** (`#s8`): erro de rede (retry "Tentar de novo") **e** sessão expirada (ação "Entrar") — duas telas distintas
  no app (componente `EstadoErro`), juntas aqui só para comparar
- **Corrigir obra** (`#s9`): tela já aprovada no CONTAI-003 e já implementada em `/pagamento/[id]/obra`; não se redesenha
- **Obra corrigida ✓** (`#s10`) → **Detalhe depois da correção** (`#s11`): sucesso
- **Registrado ✓** (`#s12`): sucesso pós-registro, com o delta "Ver o pagamento"
- **Vazios** (`#s13`): pagamento não encontrado + lista do grupo esvaziada; sem loading/erro
- **Proposta: pagamentos no detalhe do documento** (`#s14`): PROPOSTA, não decisão

## Campos
Nenhum campo editável neste mock — é tela de leitura. Os campos exibidos (read-only):
- `valor` — moeda — exibido — não editável aqui
- `data do pagamento` — data — exibida — não editável aqui
- `favorecido` — nome + CNPJ/CPF — exibido; ausente vira "Favorecido não informado" (`#s6`) — não editável aqui
- `meio` — PIX | Boleto — exibido
- `documento vinculado` — "nenhum ainda" (warn) | "NF de serviço 1042 ✓" (ok)
- `comprovante` — anexo citado como existente, **não servido** (abrir/baixar é US-010); ausente vira
  "Sem comprovante anexado / Registro antigo, de antes de o anexo ser obrigatório." (`#s6`)
- `obra` — exibida em bloco próprio + botão "Corrigir a obra deste registro" — **único campo corrigível**, e por outra tela
- `obra destino` (`#s9`) — seleção — OBRIGATÓRIO — SEM DEFAULT — campo fiscal

## Textos com consequência fiscal
- "Não entra no custo de aquisição. Peça a nota no seu CPF." — `#s1`, chip Quarentena
- "Custo não se sustenta no IR até a NF chegar. Cobre a NF antes da próxima parcela." — `#s1`, `#s2` (banner), `#s4`, `#s11`
  (literal de `lib/fiscal/pagamento.ts`, carimbada em docs/pareceres/2026-08-08-gate2-contai-001.md §8, ressalva R2)
- "Custo não se sustenta no IR até o recibo chegar. Cobre o recibo assinado (nome, CPF e descrição do serviço) antes do
  próximo pagamento." — `#s1`, `#s5` (mesma fonte; PJ cobra NF, PF cobra recibo — R2 do contador)
- "Custo não se sustenta no IR sem documento hábil. Informe o CNPJ/CPF do favorecido para saber se falta NF (PJ) ou recibo
  assinado (PF)." — `#s6`
- "Este pagamento entra no custo de aquisição de **2026** — o ano sai da data do pagamento, não da data da nota." — `#s7`
  ⚠️ o próprio mock marca: **frase ainda sem carimbo**, redação do designer derivada do parecer 2026-08-08 §1 e §7/Q6;
  precisa passar pelo contador antes de virar código
- "Este registro agora está em **Casa do Morro** e sai de todas as saídas da obra anterior." — `#s10`
- "Salvo em **Casa Cachoeira**. Arquivo guardado no acervo — nada se apaga, e o prazo de guarda só começa a correr depois da venda." — `#s12`, banner verde
  ⚠️ ver `## Dúvidas` — texto desatualizado
- "Próximo passo: vincular NF quando chegar (em breve — US-003)" · "Custo 2026: só conta depois de vincular NF" — `#s12`
- "**Valor, data e favorecido não se corrigem aqui.** Nesta tela só a obra é corrigível: mexer em campo fiscal sem regra
  escrita é como se cria erro novo consertando erro velho." — `#s4`
- "Entre de novo para ver a obra. Nada foi perdido: seus documentos e pagamentos continuam guardados." — `#s8`, sessão expirada
- "**Nada foi perdido.** O pagamento continua gravado — o que falhou foi mostrar ele aqui." — `#s8`
- "Não foi possível falar com o servidor. Tente de novo." — `#s8` (literal de `lib/data.ts` / `app/_components/ui.tsx`)
- "Pagamento não encontrado." — `#s13` (mensagem literal que `lib/data.ts` já devolve)
- Rótulo "Corrigir a obra deste registro" — cópia exata de `app/documento/[id]/page.tsx` e `app/_components/registrado.tsx`
  (critério 4 fecha por reuso, não por texto novo); obrigatoriedade do `obra_id` correto: resposta Q9d do contador (2026-08-09)

## Navegação
- `#s1` → `#s2` — card de exposição com N>1 pagamentos ("Ver os pagamentos") | `#s1` → `#s5` — card com 1 pagamento, vai direto ao detalhe
- `#s2` → `#s3` (carregando) → `#s4` — toque num pagamento da lista
- `#s4`/`#s5`/`#s6`/`#s7`/`#s11` → `#s9` — "Corrigir a obra deste registro"
- `#s9` → `#s10` — "Mover para a obra escolhida"; `#s9` → `#s4` — "Cancelar"
- `#s10` → `#s11` — "Voltar ao pagamento" (**primeiro** botão) | → `#s1` "Voltar ao início" (secundário)
- `#s12` → `#s4` — "Ver o pagamento" (delta do ticket) | `#s12` → `#s9` — "Salvou na obra errada?"
- `#s8` → `#s3` — "Tentar de novo" | `#s13` → `#s1` / `#s2`
- `#s7` → `#s14` — apenas na proposta (detalhe do documento listando pagamentos vinculados)
- Voltar do detalhe: `←` no appbar preserva a origem ("← Pago sem nota · AJE" vindo do grupo, "← Casa Cachoeira" vindo da home)

## Decisões de design visíveis no mock
- **A dor é a falta de porta**: o pagamento salvo some depois que "Registrado ✓" é fechado (D20/D21). O mock não cria cards
  novos nem somas novas — transforma cartaz em porta.
- **Vocabulário do chip vem da home** (Pago sem nota / Pago sem recibo / Pago sem documento), não do ticket ("aguardando NF"),
  porque o contador barrou "NF" para favorecido PF.
- **Conciliado não vira tela só de leitura**: erro de obra sobrevive à conciliação e continua indo para a matrícula errada.
- **Buraco visível > botão inventado**: falta de comprovante é apontada sem oferecer botão de anexar, enquanto o PO não responder.
- **Sem aviso de revalidação de CNO** ao mover pagamento de obra — revalidação é regra de NF de serviço; pagamento não referencia CNO.

## Dúvidas
- ⚠️ **`#s12` diz "fica disponível até a venda + 5 anos" — texto DESATUALIZADO.** Copiado literal como manda a regra. O prazo
  correto é o do CTN art. 173, I (5 anos do 1º dia do exercício seguinte à última DAA que declarou parcela do ganho; obra não
  vendida = prazo indefinido; há um segundo relógio previdenciário). Não corrigi por conta própria — **o texto novo é do contador**.
- "O ano sai da data do pagamento, não da data da nota" (`#s7`) é redação do designer, **sem carimbo do contador**.
- **A lista do grupo (`#s2`) é escopo deste ticket ou é US-009?** O card da home agrega N pagamentos e não tem id para linkar.
  Sem a lista, os outros 2 PIX continuam invisíveis e o critério 5 não fecha.
- **Chip de status**: o critério 2 pede "aguardando NF / conciliado"; o mock usa o vocabulário da home. Decisão do PO — mas o
  rótulo do ticket ao pé da letra ressuscita texto já reprovado pelo contador.
- **`#s6`, favorecido ausente**: a consequência manda "informe o CNPJ/CPF do favorecido", ação que a tela não oferece (Out of
  Scope proíbe editar favorecido). Ou o texto ganha caminho, ou o Out of Scope abre exceção para **preencher o que está vazio**
  (que não é o mesmo que trocar o que está preenchido). Texto é carimbado → quem mexe é o contador.
- **Anexar comprovante que faltou** é ação desta tela ou é US-010?
- **Pagamento conciliado não tem porta** (`#s7`): (a) o detalhe do documento passa a listar pagamentos vinculados (`#s14`), ou
  (b) só se alcança pela US-009 — e aí o critério 5 fecha só para pendência.
