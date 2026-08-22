# CONTAI-001 — spec do mock
Nível: 1 (HTML navegável)   Cenário: captura (telas 2,9,10) + gestão (telas 1,5,6,7)   Arquivo: CONTAI-001.html
Telas: 10

## Telas e estados
- **Início / quarentena** (`#s1`): sucesso apenas — cabeçalho de custo + 4 cards de pendência + FAB "+ Documento". Sem loading, sem vazio, sem erro.
- **Adicionar (interação 1 de 3)** (`#s2`): escolha entre "📄 Documento — PDF, XML ou foto" e "💸 Pagamento — PIX sem nota"; CTA "Cancelar". Sem loading/vazio/erro.
- **Lendo documento…** (`#s3`): **loading** (4 skeletons pulsantes; respeita `prefers-reduced-motion`). Fase 2 (extração automática). Sem vazio, sem erro, sem sucesso.
- **Confira o registro — NF material extraída** (`#s4`): sucesso da extração, com campos marcados "revisar". Fase 2. CTAs "Confirmar registro" / "Corrigir campos". Sem loading/vazio/erro.
- **Confira o registro — boleto** (`#s5`): sucesso. CTAs "Confirmar — lembrar do vencimento" / "Cancelar". Sem loading/vazio/erro.
- **Quarentena — NF fora do CPF** (`#s6`): estado de pendência fiscal. CTAs "Pedir nota corrigida ao fornecedor" / "Registrar mesmo assim — fora do IR". Sem loading/vazio/erro.
- **NF de serviço sem retenção** (`#s7`): aviso fiscal. CTAs "Entendi — manter registro" / "Anotar: falar com o empreiteiro". Sem loading/vazio/erro.
- **Registrado ✓ (interação 3 de 3)** (`#s8`): sucesso. CTA "Voltar ao início". Sem loading/vazio/erro.
- **Registrar documento (manual, interação 2 de 3)** (`#s9`): formulário com **arquivo já anexado** + 2 checks fiscais. CTAs "Salvar registro" / "Voltar". Sem loading/vazio/erro.
- **Registrar pagamento — PIX sem documento** (`#s10`): formulário. CTA "Salvar — aguardando NF" / "Voltar". Sem loading/vazio/erro.

## Campos
### `#s9` — registrar documento (manual-first)
- `arquivo` — anexo (PDF/XML/foto) — **obrigatório no ato do registro** — mostrado como "NF-AJE-0091.pdf ✓ no acervo" antes dos demais campos — SEM DEFAULT
- `tipo` — escolha: NF material · NF serviço · boleto — obrigatório — SEM DEFAULT — campo fiscal
- `emitente` / `cnpj` — texto — obrigatório — "— toque para preencher —" (placeholder, não valor) — SEM DEFAULT
- `valor` — moeda — obrigatório — "— toque para preencher —" — SEM DEFAULT
- `classificacao` — escolha: material · mão de obra — obrigatório — SEM DEFAULT — campo fiscal
- `nota_no_seu_cpf` — sim · não — **obrigatório, sem salvar sem resposta** — "não" → quarentena (`#s6`) — SEM DEFAULT — campo fiscal
- `retencao_11_inss` — sim · não · não sei — **obrigatório** para NF de serviço — "não"/"não sei" → aviso INSS (`#s7`) — SEM DEFAULT — campo fiscal

### `#s10` — registrar pagamento
- `favorecido` — texto com sugestão de recentes ("AJE Construções (recente)") — obrigatório — sugestão não é default preenchido — SEM DEFAULT
- `valor` — moeda — obrigatório — SEM DEFAULT
- `data_do_pagamento` — data — obrigatório — é a chave do regime de caixa (custo de aquisição) — SEM DEFAULT — campo fiscal
- `comprovante` — anexo do PIX — **obrigatório** ("anexar PIX — obrigatório") — SEM DEFAULT

### `#s4`/`#s5` — proposta da extração (fase 2), campos somente-conferência
- `emitente`+CNPJ, `destinatario` ("Seu CPF ✓"), `valor`, `emissao`, `classificacao` (estado "revisar") / boleto: `beneficiario`+CNPJ, `valor`, `vencimento`

## Textos com consequência fiscal
- "= situação em 31/12 na ficha Bens e Direitos (terreno + obra)" — `#s1`, sob o acumulado
- "Em pendência: R$ 47.850 — resolver abaixo" — `#s1`, cabeçalho
- "Não entra no custo de aquisição. Peça a nota no seu CPF." — `#s1`, card "NF fora do seu CPF"
- "Boleto não é documento hábil. O custo só se sustenta com a NF." — `#s1`, card "Boleto sem nota vinculada"
- "Custo não se sustenta no IR até a NF chegar. Cobre a nota antes da próxima parcela." — `#s1`, card "3 PIX sem NF vinculada"
- "Não abate na aferição do INSS da obra (SERO)." — `#s1`, card "Sem retenção 11%"
- "Nota ou boleto que chegou no WhatsApp/e-mail. O arquivo fica no acervo; você preenche os campos (extração automática: fase 2)." — `#s2`
- "Pagou e o documento ainda não existe? Registra agora; a NF vincula depois." — `#s2`
- "Vai nascer como **aguardando NF**. Quando a nota chegar (mensal ou consolidada), você vincula este e outros pagamentos a ela — o custo só conta no IR com a nota junto." — `#s10`, banner âmbar
- "Campos com ✓ foram lidos com certeza. “Revisar” = a leitura ficou em dúvida — confirme ou corrija antes de salvar." — `#s4`
- "Boleto não é documento hábil sozinho. Ao confirmar: entra na fila **a pagar**, com **lembrete antes do vencimento**, e fica **aguardando NF + comprovante** — o custo só conta no IR com os três juntos." — `#s5`, banner âmbar
- "**Destinatário: AJE Construções Ltda** — esta nota não está no seu CPF." — `#s6`, banner vermelho
- "Se não corrigir → fora do custo de aquisição" / "Custo na venda → ~R$ 728 de imposto a mais" — `#s6`, linhas do card
- "Ganho de capital: cada real não documentado no seu CPF vira ~15% de imposto na venda. Peça ao fornecedor a nota corrigida — é a única saída que preserva o custo." — `#s6`
- Rótulo de botão: "Registrar mesmo assim — fora do IR" — `#s6`
- "Retenção 11% INSS → não identificada" / "Vale para o IR → sim ✓" / "Abate no INSS (SERO) → não" — `#s7`, linhas do card
- "Sem retenção, esse INSS fica para **você** pagar na regularização da obra. Confira com o empreiteiro se a retenção sairá nas próximas notas." — `#s7`, banner âmbar
- "**Salvo.** Arquivo guardado no acervo — nada se apaga, e o prazo de guarda só começa a correr depois da venda." — `#s8`, banner verde ⚠️ ver Dúvidas
- "Custo 2026 → soma quando o pagamento for registrado" — `#s8`
- "Olhe na nota antes de responder — "não" no CPF leva à quarentena; "não/não sei" na retenção gera o aviso do INSS. Sem responder, não salva." — `#s9`

## Navegação
- `#s1` → `#s2` — FAB "+ Documento"
- `#s1` → `#s6` — botão "Resolver" no card de quarentena; `#s1` → `#s7` — "Ver detalhes" no card de retenção
- `#s2` → `#s9` — "📄 Documento — PDF, XML ou foto"; `#s2` → `#s10` — "💸 Pagamento — PIX sem nota"; `#s2` → `#s1` — "Cancelar"
- `#s3` → `#s4` — fim da leitura (no mock: toque em qualquer lugar) — fase 2
- `#s4` → `#s8` — "Confirmar registro"; `#s4` → `#s9` — "Corrigir campos"
- `#s5` → `#s8` — "Confirmar — lembrar do vencimento"; `#s5` → `#s1` — "Cancelar"
- `#s6` → `#s1` — "Registrar mesmo assim — fora do IR"; "Pedir nota corrigida ao fornecedor" **não navega** no mock
- `#s7` → `#s1` — "Entendi — manter registro"; "Anotar: falar com o empreiteiro" **não navega**
- `#s9` → `#s8` — "Salvar registro"; `#s9` → `#s2` — "Voltar"
- `#s10` → `#s8` — "Salvar — aguardando NF"; `#s10` → `#s2` — "Voltar"
- `#s8` → `#s1` — "Voltar ao início"

## Decisões de design visíveis no mock
- **Orçamento de 3 interações** é rótulo na própria appbar ("Interação 1/2/3 de 3") — o caminho de captura é contado, não estimado.
- A home **não é dashboard**: é lista de dívidas documentais, cada card com chip de estado (Quarentena / Aguardando NF / Pago sem nota / Sem retenção 11%) e uma linha de consequência colorida.
- **Pagamento sem documento é caminho de primeira classe** (`#s10`) — nasce "aguardando NF" em vez de não ser registrado.
- Os dois checks fiscais de `#s9` são **perguntas, não caixas pré-marcadas**, e travam o salvar: "Sem responder, não salva."
- Quarentena quantifica o prejuízo em reais (~R$ 728) em vez de asterisco vermelho; o atalho continua disponível, mas rotulado "fora do IR".

## Dúvidas
- ⚠️ `#s8` diz "fica disponível até a **venda + 5 anos**". O CLAUDE.md registra que "venda + 5 anos" foi **corrigido como atalho errado em 2026-08-16** (CTN art. 173, I: venda em 2028 → 31/12/2034; obra não vendida → prazo indefinido). **Não implementar esta frase**: o texto tem que ser reescrito pelo `contador` a partir de `docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`.
- `#s3` e `#s4` são explicitamente **fase 2** (extração automática). Confirmar com o `po` se entram no escopo do ticket ou ficam fora.
- "Pedir nota corrigida ao fornecedor" (`#s6`) e "Anotar: falar com o empreiteiro" (`#s7`) não têm destino no mock — comportamento real indefinido (abre WhatsApp? cria pendência? no-op?).
- O mock do CONTAI-001 assume **uma obra única** (appbar "Obra · CNO …"); o CONTAI-003 introduz N obras e a obra afirmada no formulário. A conciliação entre os dois mocks não está no HTML.
- `#s1` não tem estado vazio ("nenhuma pendência") nem estado de erro de carregamento — ambos precisam de texto.
