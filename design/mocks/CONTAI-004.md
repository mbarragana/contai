# CONTAI-004 — spec do mock
Nível: **1** (HTML navegável) — campo novo bloqueante + escolha tocável nova no formulário de captura;
densidade e ordem de leitura precisam ser vistas, não só lidas. Cenário: captura (canteiro), fricção
controlada. **Cobre CONTAI-004 + CONTAI-007** — mesmo formulário `/adicionar/documento` (tela `#s9` do
CONTAI-001), mesmo passe, por exigência do critério 1 do CONTAI-004. Arquivo: `CONTAI-004.html`.
Telas: 8.

## Telas e estados
- **Formulário — NF de serviço, caminho feliz** (`#s1`): sucesso, todos os campos preenchidos, CNO
  respondido "desta obra". CTAs "Salvar registro" / "Voltar" (não navega).
- **Data de emissão no futuro** (`#s2`): **erro** — campo em vermelho, mensagem própria, Save desabilitado.
  Campos não-relevantes omitidos de propósito (foco na validação nova).
- **NF de material, com aviso de duplicidade** (`#s3`): sucesso com banner âmbar não-bloqueante.
- **Formulário — boleto** (`#s4`): sucesso; número/data de emissão **não aparecem** (não perguntados).
- **CNO de outra obra — bloqueio** (`#s5`): estado de bloqueio fiscal (não é erro de sistema). CTAs
  "Registrar na outra obra" / "Voltar e corrigir a resposta".
- **Trocar obra** (`#s6`): mesmo padrão do `#s12` do CONTAI-003, reaproveitado — saída real do bloqueio.
- **Salvo com pendência — nota sem CNO** (`#s7`): sucesso com pendência aberta, não bloqueio.
- **Registrado ✓** (`#s8`): sucesso, Passo 3 de 3.
- Não desenhadas: vazio (não se aplica) e loading (extração é fase 2, fora do escopo manual do 004/007).

## Campos (novos, acrescentados ao `#s9` do CONTAI-001)
- `numero` — texto livre, teclado alfanumérico — **obrigatório e bloqueante** em `nf_material`/`nf_servico`,
  **ausente em boleto** — preservado literalmente (zeros à esquerda, letras, barras) — SEM DEFAULT — campo
  fiscal — obrigatório **também em quarentena** (não modelado como tela própria; validação roda antes da
  bifurcação de CPF, ver Decisões)
- `serie` — texto opcional, não-bloqueante — "campo próprio, nunca concatenado no número" (R6)
- `data_emissao` — data — **obrigatório e bloqueante** nos mesmos dois tipos, ausente em boleto — SEM
  DEFAULT — campo fiscal — futuro **recusado com mensagem própria** — anterior ao início da obra é legítimo
  (sem UI dedicada: ausência de aviso é o comportamento, não há o que desenhar)
- `cno_referenciado` — escolha tocável entre 3 opções, **zero digitação** — só aparece em `nf_servico` —
  campo fiscal — "desta obra" segue; "outra obra" bloqueia (`#s5`); "não traz CNO" salva com pendência (`#s7`)

## Textos com consequência fiscal (origem)
- "Copie como está impresso — zeros à esquerda e letras contam. Nunca é normalizado." — `#s1`/`#s3`, sob
  `numero` — texto operacional (não fiscal), meu, grounded no R2/critério 7
- "Identifica a nota e a janela do CNO. Não decide o ano do custo — quem decide é a data do pagamento." —
  `#s1`/`#s3`, sob `data_emissao` — paraphrase da tabela do parecer 2026-08-16 Parte 1, item 3 (critério 8)
- "Data de emissão não pode ser depois de hoje — documento não existe antes de ser emitido." — `#s2` —
  cópia quase literal de "Documento não existe antes de ser emitido", parecer 2026-08-16, item 1
  (Bloqueantes), mensagem própria (R4) — **não** reaproveita a de data de pagamento futura
- "Essa nota já foi registrada em 15/03." — `#s3` — cópia literal do critério 11 / R7 do parecer
- "Esta nota não abate a aferição desta obra. Sem a aferição fechada não há regularização, e sem
  regularização a construção não é averbada na matrícula." — `#s5` e `#s7` (mesmo texto, critério 3) — cópia
  literal do critério 2 do CONTAI-007
- "Número e data de emissão não são pedidos para boleto — ele não é documentação hábil e não compõe a
  discriminação anual." — `#s4` — grounded no R5/critério 2 do CONTAI-004 e na "Correção de premissa" do
  parecer 2026-08-16

## Navegação
- `#s1` → `#s5` — "É o CNO de outra obra"; `#s1` → `#s7` — "A nota não traz CNO"; `#s1` → `#s8` — "Salvar
  registro" (caminho "desta obra")
- `#s3`/`#s4` → `#s8` — CTA de salvar
- `#s5` → `#s6` — "Registrar na outra obra"; `#s5` → `#s1` — "Voltar e corrigir a resposta"
- `#s6` → `#s8` — obra correta; `#s6` → `#s5` — obra atual/"Cancelar"
- `#s7` → `#s1` — "Entendi — manter registro"
- `#s8` → `#s1` — "Voltar ao início"
- "Ver registro existente" (`#s3`) **não navega** no mock — mesmo padrão de link secundário do CONTAI-001

## Decisões de design
- Campos novos entram **no mesmo passo** do valor/emitente — nenhum passo a mais (pre-mortem 1 do 004 e
  Teste do Canteiro do 007). Ordem: número → série → data de emissão → emitente/CNPJ → (duplicidade, se
  houver) → valor → classificação → CPF → retenção → CNO.
- `cno_referenciado` é card tocável (`.card.tap`), igual ao padrão já usado em `#s5` do CONTAI-003 para
  `tem_cno` — reaproveita componente existente em vez de inventar um novo.
- Obrigatoriedade em quarentena (critério 3) **não ganhou tela própria**: nada muda visualmente na
  bifurcação de CPF (`#s6` do CONTAI-001) — a validação de `numero`/`data_emissao` roda antes, invisível.
- `#s6` (Trocar obra) inventa uma segunda obra com CNO ("Terreno Vista Mar") só para este mock — não é fato
  real da obra do Mateus; existe só para demonstrar a "saída real" do pre-mortem 2 do CONTAI-007.
- Chave de acesso NF-e (44 dígitos) **não entra neste mock** — Out of Scope do CONTAI-004: digitar 44
  dígitos no canteiro é o oposto da meta, e o CTO não lista essa coluna. Ver pergunta aberta 1.
- Pendência de campo faltante (critério 13, número/data ausentes) **não ganhou tela própria** — só existe
  para documentos que não passam pela validação bloqueante nova (dado legado/migração), nunca pelo caminho
  deste formulário. Texto (registro, não render): **"Falta o número ou a data da nota" — [fornecedor] ·
  R$ [valor] — O custo não está em risco: o documento está no acervo e continua valendo. Sem o número e a
  data, a discriminação do ano sai sem identificar esta nota, e ela fica de fora da lista de cobrança do
  CNO. — [Abrir o anexo e completar]** (parecer 2026-08-16 seção 4 / critério 13 do CONTAI-004)
- Rótulo "Interação X de 3" → "Passo X de 3" em todas as telas de formulário (`#s1`,`#s2`,`#s3`,`#s4`,`#s8`) — critério 14.

### `/documento/[id]` — bloco ASCII (critério 9, não é tela nova)
```
┌ Documento ─────────────────────┐
│ Emitente    AJE Construções    │
│ Nº / série  1042 / —           │
│ Emissão     20/03/2026         │
│ CNO         Desta obra ✓       │
│ Valor       R$ 18.000,00       │
└─────────────────────────────────┘
```
Sem mock aprovado de `/documento/[id]` em nenhum ticket lido — fora do escopo (o pedido foi o formulário).
Nível 2 quando essa tela for desenhada.

## Perguntas abertas
1. Chave de acesso NF-e / código de verificação NFS-e (R6, não-bloqueante): confirmar com `po`/`cto-obra`
   se entra como coluna neste ticket (opcional, sem UI) ou fica para um ticket futuro — o CTO não lista
   essa coluna nos "arquivos prováveis" do CONTAI-004, só o parecer a menciona.
2. `serie` é sempre opcional, mesmo com série impressa na nota? Assumido que sim (nem toda NFS-e tem
   série) — não bloqueia o mock, mas vale confirmação fiscal.
3. Texto de "salvo com pendência" (`#s7`) reusa a frase do critério 2/3 do CONTAI-007 — confirmar com o
   `contador` se cabe antes do `/develop`.
