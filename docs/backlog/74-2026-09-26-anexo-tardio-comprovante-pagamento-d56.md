# D56 materializada em produção: não dá para anexar comprovante depois — 2026-09-26

## Contexto do relato

O Mateus foi resolver, de verdade, a pendência "Custo em risco no IR:
R$ 7.449,76" que a Home mostra (ver correção de diagnóstico ao fim de
`73-2026-09-26-texto-pendencia-retencao-e-escopo-ano-despesas.md`: o valor é
exatamente o pagamento a FRANCISCO ALMEIDA, registrado sem comprovante). Foi
até `/pagamento/[id]` para anexar o comprovante que tem em mãos.

## Dor extraída

*"não consigo anexar o comprovante de pagamento nesta tela"* — reação à tela
`/pagamento/[id]` (R$ 7.449,76, "Comprovante: sem comprovante" em vermelho,
"pago sem comprovante — o custo existe, ainda não está demonstrável"). Ele não
estava explorando a tela por curiosidade: estava tentando fechar a pendência
real que a própria Home apontou, e não teve como.

## Investigação técnica (dada, não repetida em detalhe)

- `app/(gestao)/pagamento/[id]/page.tsx:244-246` — quando `comprovantePath` é
  `null`, a tela só EXIBE o aviso vermelho. Não existe controle de upload em
  lugar nenhum do arquivo.
- As únicas subrotas de `/pagamento/[id]/*` são `obra` e `ligar` — nenhuma
  para corrigir/anexar o comprovante do próprio pagamento.
- `lib/data.ts` — `comprovantePath`/`p_comprovante_path` só existe no fluxo de
  CRIAÇÃO (`criarPagamento`). Não existe `anexarComprovanteAoPagamento(...)`.
  A lacuna é de **backend**, não só de UI.
- **Precedente direto já existe no código**, achado nesta investigação:
  `anexar_arquivo_documento` (migrations `0014`/`0017`, exposta por
  `lib/data.ts:1119`) resolve exatamente este padrão para `documento`: RPC que
  só aceita gravar quando o campo está `null` (`arquivo_path is null`), com
  trigger `documento_arquivo_path_imutavel` fechando a escrita direta pela
  tabela. Anexar comprovante tardiamente a um `pagamento` é o mesmo problema
  com outra tabela — não é conceito novo para o `cto-obra` desenhar do zero.
- Doutrina do produto já cobre o caso: acervo append-only não proíbe isto —
  "vincular documento órfão depois" (`CONTAI-011`/`049`) já é operação
  legítima. Isto é "campo vazio pergunta, campo preenchido afirma", não
  reescrita de história.

## Consulta ao `contador`

Parecer completo em
`docs/pareceres/2026-09-26-anexo-tardio-de-comprovante-d56.md` (consome o
parecer de 2026-08-18 sobre correção de documento registrado, §5 e §6, e o de
2026-08-16 sobre o prazo de decadência). Veredito:

1. **Anexo tardio não muda validade documental (IN 84/2001 art. 17) nem o
   prazo de decadência (CTN art. 173, I).** O documento vale desde quando o
   pagamento foi feito, não a partir de quando foi anexado ao app. Única
   ressalva: quanto mais tarde o anexo, maior o peso probatório que recai
   sobre a consistência interna do documento — não vira critério de aceite,
   é só o motivo pelo qual a pergunta 2 importa.
2. **Sim, precisa capturar a DATA DO ANEXO como metadado próprio**, separada
   da data do pagamento — não basta `comprovantePath` deixar de ser `null`.
   Dois motivos: (a) é o mesmo rastro obrigatório de toda correção de campo
   gravado (parecer 2026-08-18 §5, "null → valor" sem exceção); (b) é o dado
   que decide se o mecanismo de "ano já declarado" (mesmo parecer, §6)
   dispara. **Nunca usado para calcular o ano do custo** — só a data do
   pagamento faz isso.
3. **O custo sempre conta no ano do PAGAMENTO, nunca no ano do anexo**
   (regime de caixa, ponto fechado desde 2026-08-18). Se a DAA do ano do
   pagamento **ainda não** foi entregue quando o comprovante chega: grava
   normal, sem drama. Se **já** foi entregue: mostra o delta antes de gravar,
   grava, e abre **pendência persistente** de avaliar retificadora com o
   contador (CRC) — o app nunca decide nem redige a retificadora sozinho.
   Mesmo detector do §6 do parecer de 2026-08-18, não um mecanismo novo — e
   reabre a mesma lacuna já nomeada lá (falta no modelo "DAA do ano X entregue
   em DD/MM/AAAA"; hoje o proxy é "ano anterior ao corrente"). O ticket desta
   dor deve reaproveitar esse proxy, não inventar um segundo.
4. **Sobre o caso concreto (Francisco Almeida)**: o parecer não confirma
   sozinho qual das duas situações se aplica (falta a data de pagamento), mas
   o fato da obra já está registrado em `73-…md` — *"todos os valores
   inputados até agora são de 2026"*, ano corrente, DAA de 2026 ainda não
   entregue. **Aplica a linha 1 da tabela do parecer**: hoje, sem drama, sem
   retificadora em jogo. Isso muda quando a obra cruzar para depois da
   próxima DAA entregue.
5. **Sobre prioridade**: o contador não vê CRC bloqueado nem prazo fiscal
   vencendo hoje — o defeito, na pior direção, faz o Mateus pagar mais
   imposto no futuro (base de custo subdeclarada), nunca menos. A escolha
   P0×P1 fica com o PO.

## Classificação

**P1 — fricção de processo, não P0 fiscal.** Mantenho a classificação
original da D56 (`29-2026-08-24-reconciliacao-contai-009.md`), agora
reforçada pelo parecer: não há imposto, multa ou CRC vencendo hoje por causa
desta lacuna — o risco é futuro e condicional (só vira urgente se um anexo
tardio cair depois da DAA do ano correspondente já ter sido entregue, o que
ainda não é o caso de nenhum pagamento registrado nesta obra). Ainda assim, é
uma dor que já causou abandono de tarefa uma vez (o Mateus foi tentar resolver
e não conseguiu) e que bloqueia, na prática, o próprio mecanismo que a meta 1
do produto ("nenhum pagamento sem documento hábil") pressupõe existir —
documentar depois. Isso pesa a favor de tratar como P1 **alto**, não como
"depois" — não escalo para P0 porque a régua do projeto reserva P0 para
"perder isso custa imposto ou multa", e aqui não há perda, há um caminho de
correção que falta.

## User story

**US-D56 — Anexar comprovante que faltou, dias ou semanas depois do pagamento**

Como dono da obra, revisando pendências **em casa, sentado**, ao encontrar um
pagamento "pago sem comprovante" para o qual já tenho o comprovante em mãos,
quero anexá-lo diretamente em `/pagamento/[id]`, para que o pagamento saia do
"Custo em risco no IR" e passe a contar como custo confirmado no ano em que
foi de fato pago — sem precisar reescrever nem recriar o registro.

**Critério de aceite verificável:**

1. `/pagamento/[id]` mostra um controle de anexo quando `comprovantePath` é
   `null` (hoje mostra só o aviso vermelho, sem ação nenhuma) — anexo
   continua obrigatório no sentido de que não há "salvar sem comprovante"
   aqui, só existe "anexar" ou "deixar como está".
2. Existe uma função de escrita (RPC, mesmo padrão de
   `anexar_arquivo_documento`: só grava se `comprovante_path is null`, guarda
   por trigger contra sobrescrita direta pela tabela) que grava o arquivo E a
   **data do anexo** (metadado novo, timestamptz, nunca usado para calcular
   ano de custo) E o rastro completo (entidade/id, campo, antes, depois,
   quando, quem, motivo — parecer 2026-08-18 §5).
3. Depois do anexo, o pagamento sai do agregado "Custo em risco no IR" e
   passa a compor "Custo confirmado" **no ano da `data_pagamento`**, nunca no
   ano em que o anexo aconteceu — coberto por teste unitário que ancora um
   pagamento de um ano anterior e confirma que o custo aparece nesse ano, não
   no ano corrente do anexo.
4. Se a DAA do ano do pagamento já tiver sido entregue (mesmo detector de
   "ano já declarado" do parecer 2026-08-18 §6 — reaproveitado, não
   reimplementado), a tela mostra o delta antes de confirmar e, depois de
   gravar, abre uma pendência persistente com o texto do parecer
   `2026-09-26-anexo-tardio-de-comprovante-d56.md` §3 (linha 2 da tabela),
   citado literalmente — nunca decide ou redige retificadora sozinho.
   Se a DAA ainda não foi entregue, grava sem esse aviso.
5. Gate Fiscal: revisão do `contador` confirma que todo texto de consequência
   em tela é cópia literal do parecer, não parafraseado.

## Filtro de escopo — o que ficou de fora e por quê

- **Escopo restrito a `pagamento.comprovantePath`.** Não expande para
  `documento` (já resolvido por `anexar_arquivo_documento`) nem para
  `favorecido` vazio (o `contador` já **recusou** essa exceção explicitamente
  no Gate 4 do CONTAI-009, `29-2026-08-24-…md`) — nenhum dos dois tem dor
  relatada agora.
- **Não resolve a lacuna geral do proxy "DAA do ano X entregue em DD/MM/AAAA"**
  — é dívida nomeada desde 2026-08-18, este ticket só reaproveita o
  mecanismo que existir no momento (proxy atual ou o definitivo, a depender
  de sequenciamento — ver pergunta 2).
- **Não decide nem gera retificadora** — isso é CRC, fora do produto por
  desenho, em qualquer ticket.
- **Não muda `alocarCusto`/regime de caixa** — o critério 3 trava isso
  explicitamente: o mecanismo de alocação por ano já existe e está correto
  (`CONTAI-056`); este ticket só destrava a ENTRADA de um comprovante que
  faltava, não recalcula regra.
- **Não desenha a tela** — mock é trabalho do `designer`, com o texto do
  aviso de "ano já declarado" copiado do parecer, não inventado.

## Perguntas abertas

1. O controle de anexo em `/pagamento/[id]` deve reaproveitar o mesmo padrão
   pesado de "anexo obrigatório" da captura (`/adicionar/pagamento`), ou um
   controle mais simples é aceitável aqui, já que é correção pontual e não o
   fluxo principal de registro? Decide o `designer`, mas influencia o
   tamanho do ticket.
2. Este ticket deve finalmente implementar o proxy real "DAA do ano X
   entregue em DD/MM/AAAA" (a lacuna nomeada desde 2026-08-18, e que este
   caso agora tem motivo concreto para acionar), ou continua usando o proxy
   improvisado atual ("ano anterior ao corrente") até outro ticket tratar
   disso à parte? Muda bastante o tamanho do escopo.
3. Concorda com a classificação P1 (não há imposto/multa vencendo hoje,
   confirmado pelo `contador`), ou prefere elevar a P0 considerando que já
   bateu de frente com essa lacuna tentando fechar uma pendência real e não
   conseguiu?

## O que NÃO foi feito aqui

- Não foi escrito mock (`design/mocks/`) — aguarda resposta da pergunta 1 e
  prioridade do Mateus antes do `/design`.
- Não foi aberto ticket em `docs/tickets/` — este é o registro do backlog;
  vira ticket no `/tickets-req` quando a fila chegar nele.
