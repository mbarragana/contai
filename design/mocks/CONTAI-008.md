# CONTAI-008 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão   Arquivo: CONTAI-008.html

**Por que nível 1, não 2**: é tela existente (`/pagamento/[id]/obra`, hoje um
`UPDATE` seco) ganhando fluxo interativo com dois estados que nenhum mock
anterior mostrou — escolha por documento e, dentro dela, uma linha **bloqueada
condicionalmente** (crit. 16, CNO incompatível) com opção (i) indisponível e
texto de consequência fixo ao lado da opção (ii), única e ainda assim exigindo
clique. É densidade/hierarquia nova (como fica um `.opt` bloqueado ao lado de
um livre, onde o texto de consequência entra, quanto isso cresce a tela com 2
notas) — "precisa ver", não só ler. O espelho (CONTAI-021 s8/s8b) cobre a
mecânica de "N vínculos, escolha um a um", mas não tem CNO nenhum. Na dúvida,
subi de nível.

Telas: 8 (p0 ASCII, p1/p1b cenário a, p2/p2b cenário b, p3/p3b cenário c, pG).
Larguras: 375px (piso) e 720px (mesa, ligada por padrão).

## Telas e estados
- **p0 — Fluxo (ASCII)**: só sucesso; documentação do fluxo, não tela do app.
- **p1 — Corrigir a obra, sem vínculo** (cenário a, 99% dos casos): **vazio**
  inicial (obra não escolhida, CTA "Escolha a obra de destino"); sem
  loading/erro (mesmo tratamento do s8b do 021 — loading/erro é demonstrado
  uma vez, em pG).
- **p1b — Gravado, sem pendência**: só sucesso.
- **p2 — Corrigir a obra, vínculo simples** (cenário b, 2 notas livres):
  **vazio** inicial (obra + 2 escolhas em branco, CTA "Faltam 3 respostas
  para ver a conta" → "Falta 1 resposta..." → "Gravar — e abrir a pendência
  de 2025"); bloco de delta oculto até as 3 respostas. Sem loading/erro.
- **p2b — Gravado, pendência de 2025 aberta**: só sucesso (desfecho misto:
  1 nota junto, 1 fica — mostra a variante mais rica do resumo).
- **p3 — Corrigir a obra, vínculo com CNO bloqueado** (cenário c, NOVO):
  **vazio** inicial igual a p2; a Nota B nasce com a opção (i) **desabilitada**
  (`<button disabled>`) e texto de consequência fixo — não é um 3º estado de
  escolha, é (i) indisponível com (ii) como único caminho clicável. Nota A
  seque livre. Sem loading/erro.
- **p3b — Gravado, nota ficou pelo CNO**: só sucesso.
- **pG — Gravando / falha**: **loading** ("Gravando…", botão desabilitado) +
  **erro** com retry ("Tentar de novo") + saída ("Voltar ao fluxo") — mesma
  técnica do s3e do 021 (duas sub-seções "a)"/"b)" na mesma tela,
  demonstração isolada, não amarrada ao clique real de Gravar de p2/p3).

## Campos
**Nenhum campo de texto/número/data novo.** A interação inteira é escolha por
clique — confirmado lendo o critério 2 (não critério de UI, mas a forma do
ato: "para CADA documento, um a um, em ato explícito... escolhe um (i)...(ii)")
e o critério 5 (não há pergunta de motivo nesta tela). Os dois "campos" no
sentido do CONTAI-021 (i.e. escolha obrigatória, sem default) são:
- `obraDestino` (p1/p2/p3) — 1 opção entre as obras cadastradas — obrigatório
  — **SEM DEFAULT** ("Nada nasce marcado") — já existia no 021, reusado aqui
- `escolhaDoc[d]` (p2/p3), por documento vinculado — 2 opções: "esta nota
  também é da obra de destino" | "esta nota é mesmo da obra de origem" —
  obrigatório, um a um, nunca em cascata — **SEM DEFAULT — campo fiscal**.
  Em p3, a Nota B tem só a 2ª opção **habilitada**; a indisponibilidade da 1ª
  não é um default (nada se marca sozinho), é a opção sumindo do conjunto de
  escolhas possíveis — a discriminação normal de "campo vazio pergunta,
  campo preenchido afirma" ainda vale: enquanto não clicado, o Gravar
  continua bloqueado para aquele documento.

## Textos com consequência fiscal (todos com origem citada na própria tela)
- "Vai junto com o pagamento. O par continua inteiro, só muda de imóvel..." —
  p2/p3, opção (i) — adendo 2026-08-19 §5.2, mesma norma do 021 s8, direção
  espelhada (Gate Fiscal pergunta 1, 24/08: "a simetria foi ratificada, não
  reinventada")
- "O vínculo se desfaz, com registro. O pagamento volta a 'pago sem nota' na
  [destino]..." — p2/p3, opção (ii) — mesma origem + critério 2 do CONTAI-008
- "Nada muda, e por isso NÃO abre pendência... pagamento sozinho não comprova
  custo" — p1 — critério 7 do CONTAI-008 / Gate Fiscal pergunta 4 (24/08)
- **"Esta nota não abate a aferição desta obra. Sem a aferição fechada não há
  regularização, e sem regularização a construção não é averbada na
  matrícula."** — p3, Nota B — **cópia literal do critério 2 do CONTAI-007**
- "O CNO desta NF de serviço é diferente do CNO da obra de destino — mover
  inflaria a base de aferição do CNO errado." — p3, Nota B — cópia literal do
  `motivo` retornado por `podeCorrigirObra` (`lib/fiscal/obra.ts:296-303`)
- "Não existe uma terceira saída... vínculo cruzando duas obras é o estado
  que o critério 11 do CONTAI-018 proíbe" — p2 — crit. 2 do CONTAI-008
- "Esta tela não pergunta o motivo... o papel não tem obra" — p2/p3 —
  crit. 5 do CONTAI-008, mesma redação do adendo §5 (021 s8)
- "Não deu para gravar. A conexão caiu no meio..." — pG — mesmo texto/padrão
  do s3e do 021, adaptado ao pagamento

## Navegação
p0 → p1/p2/p3 (botões de cenário) · p1 → p1b (Gravar) · p2 → p2b (Gravar,
quando as 3 respostas estão dadas) · p3 → p3b (idem) · p1b/p2b/p3b → p0 ·
pG é aba isolada, não amarrada ao clique de Gravar de p2/p3 (mesmo tratamento
do s3e no 021).

## Decisões de design
- **A recusa é por linha, nunca pelo card inteiro** — Nota B bloqueada não
  desabilita a Nota A nem o resto da tela (crit. 16: "a recusa é por
  documento, nunca pelo ato inteiro").
- **Opção indisponível usa vermelho, não âmbar** — bloqueio fiscal duro
  (mesma gravidade do crit. 2 do CONTAI-007), não um aviso.
- **loading/erro não duplicado por cenário** — precedente do s3e/021, que já
  concentra os dois estados numa aba isolada em vez de repetir por fluxo.
- **Delta oculto até a última resposta**, botão desabilitado diz o que falta
  — mesmo padrão do 021.

## Perguntas em aberto
Nenhuma. As 16 critérios do ticket estão fechados; o Gate Fiscal (pergunta 1
e pergunta 4) foi respondido em 24/08. Este mock não abre requisito novo.
