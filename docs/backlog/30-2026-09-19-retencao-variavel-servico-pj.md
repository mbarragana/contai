# Retenção variável em NF de serviço PJ — 2026-09-19 — *"cada um tem a sua, portanto eu acho que tem que ser um input"*

Relato colhido em sessão de trabalho (não em `/relato` isolado — registrado
aqui depois do fato para não deixar a dor presa só no transcript). Palavras
do Mateus:

> *"A NF tem retenção aparente de 3%, não 11% tem que validar isso, as notas
> do francisco vem com 3% a do Alex vem com 4,8%, ou seja cada um tem a sua,
> portanto eu acho que tem ser um input"*

Pedido original era "trocar o booleano por um input de percentual". O
`contador` (parecer `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`)
recusou a solução literal — motivo no §0 do parecer: para tomador **pessoa
física**, a retenção do art. 31 da Lei 8.212/91 **não existe em nenhum
percentual**, então "input de %" resolveria o sintoma sem entender o dado.

**Rodada 2** — respostas do Mateus às perguntas do parecer (§5), que geraram o
ADENDO de 2026-09-19:

- Francisco e Alex são PJ, mas **isso tem que ser independente**: *"foi só um
  exemplo, podemos ter N outras empresas envolvidas"* — a solução não pode
  depender de conhecer o regime de um prestador específico
- O campo real na nota do Francisco é **"Total das Retenções (ISSQN /
  Federais)"** — uma linha ÚNICA que já mistura ISS com os federais, sem abrir
  por tributo. Quebra a premissa de que dava para desenhar um campo por
  tributo (INSS/ISS/IRRF/PIS/COFINS/CSLL)
- O valor **é abatido de fato** do que ele transfere ao prestador —
  `e_desconto_efetivo = true`, confirmado
- Ele **não recolhe guia nenhuma**; acredita que a contabilidade do prestador
  recolhe por conta própria, mas não tem certeza

Achado do parecer (ADENDO): estrutura vira **lista de 1..N linhas de retenção
por documento**, cada uma com rótulo literal copiado da nota (nunca
normalizado), valor, `composicao` (`tributo identificado` /
`combinado, não aberto pela nota` / `não sei`, sem default) e
`e_desconto_efetivo`. Quando `composicao = combinado`, o app **nunca**
decompõe o valor entre tributos — mesmo princípio que já proíbe ratear
material×mão-de-obra por estimativa. `documento.retencao11: boolean` sai do
schema, não só da UI — ele responde uma pergunta ("é 11%?") que nunca é a
pergunta certa para tomador PF.

Parecer completo, com o corpo original (§§0–7) e o ADENDO — que vence onde
divergir —: `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`.

→ Ticket: `docs/tickets/CONTAI-XXX.md` (gerado via `/tickets-req` na mesma
sessão — ver o próprio ticket para o número final).
