# `CONTAI-074` criado — 2026-09-28 — mesmo pagamento contando para mais de uma nota

## Origem

Mateus, registrando um fornecedor de concreto usinado que emitiu 3 notas
fiscais pagas com uma mistura de PIX + cartão dele parcelado em 3x + cartão
da esposa parcelado em 3x (7 pagamentos ao todo, porque "compra no cartão" só
aceita à vista e cada parcela vira um lançamento próprio): tentou ligar uma
parcela já ligada à Nota A também à Nota B, e `/documento/[id]/ligar` não
mostrou essa parcela como candidata — a correspondência real entre parcela e
nota, do jeito que o fornecedor faturou, não é 1-para-1 limpa. Confirmado com
o Mateus: ele precisa mesmo do mesmo pagamento contando para mais de uma
nota.

## Causa técnica

`pagamentosCandidatos`/`documentosCandidatos` (`lib/fiscal/vinculo.ts`)
filtravam por `temSaldoSemNota`/`temSaldoDescoberto`, escondendo qualquer
candidato já 100% absorvido por outro registro — mesmo sendo matematicamente
seguro ligá-lo a um segundo, porque `alocarCusto` já apura por componente
conexo (union-find) com teto `min(Σ pagamentos elegíveis, Σ documentos
hábeis)`: cada pagamento entra uma vez na soma, não uma vez por vínculo.

## `/tickets-req` completo, 4 gates

- **`po`**: user story + 16 critérios de aceite, pre-mortem de 3 riscos
  (confusão do usuário, fat-finger num seletor mais permissivo, leitura mais
  indireta quando muitos vínculos fundem componentes).
- **`contador`**: aprovado sem restrição de valor — ADENDO novo em
  `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md` ("cobertura
  prévia não é motivo de exclusão da lista de candidatos"). Regra: permitir a
  segunda ligação sempre que mesma obra + ainda não ligado a ESTE documento;
  avisar antes de gravar citando os vínculos já existentes. Achado fino do
  `contador` no fechamento: o texto do aviso espelhado para
  `/pagamento/[id]/ligar` que o `designer` propôs por substituição mecânica
  nota↔pagamento errava a garantia final — nessa direção o que não pode
  duplicar no custo é a NOTA (dois pagamentos reais e distintos provando a
  mesma nota), não "o pagamento" como na direção original. Corrigido antes de
  fechar.
- **`cto-obra`**: sem migration (`pagamento_documento` já é N:M desde a
  `0001_init.sql`). Discordou do enquadramento inicial do `po`/`contador`: o
  aviso não é propriedade só dos "candidatos ocultos" — vale para QUALQUER
  candidato com vínculo prévio, mesmo os já visíveis hoje (ex.: pagamento
  parcialmente absorvido). Redesenhou `Candidato<T, Outro>` com dois campos
  novos (`jaLigadoA: Outro[]`, `cobertoPorInteiro: boolean`) em vez de duas
  listas paralelas. Achou um terceiro consumidor não citado no relato
  (`adicionar/documento`, fluxo de captura) — fica fora de escopo, preserva o
  filtro atual. Complexidade M.
- **`designer`**: nível 2 (spec + ASCII) em `design/mocks/CONTAI-074.md` —
  bloco colapsado revelável, marca `Chip` âmbar sempre visível em candidato
  com vínculo prévio, aviso `Consequencia` inline por item marcado, frase
  extra no rodapé quando o acréscimo é R$ 0,00 por cobertura total. Cenário
  gestão, Teste do Canteiro não se aplica.

## Dívida nomeada

Quando a ficha "Pagamentos Efetuados" (CPF-por-CPF) ganhar gerador dedicado
(não existe hoje), ela precisa somar por `pagamento.id` distinto, nunca por
linha de `pagamento_documento` — senão um pagamento ligado a duas notas do
mesmo favorecido dobraria na soma por CPF. Sem regressão agora
(`lib/dados/saida-anual.ts` não lê `pagamento_documento` diretamente).

**Pronto para `/develop`.** Detalhe: `docs/tickets/CONTAI-074.md`.
