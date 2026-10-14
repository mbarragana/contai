# CONTAI-094 — Colaborador cadastra documento; fila de revisão do dono

Nível 2 — reaproveita a tela de captura de documento já especificada
(`/adicionar/documento`, incluindo o tratamento desktop de
`captura-no-desktop-v1.md`) e acrescenta campo/estado em três superfícies já
existentes: Home, `/despesas`, e uma lista própria do colaborador.

## Cenário — dois lados da mesma fatia

- Para o colaborador cadastrando: **captura**, no sentido pleno do
  CLAUDE.md — ele está com a nota em mãos, a janela é o momento do
  pagamento/recebimento da nota. A rota é a mesma `/adicionar/documento`,
  "adaptada por papel": mesmos campos, mesmas validações, mesma quarentena,
  ≤3 interações, anexo obrigatório no ato — nada disso muda. A única
  diferença de captura é o destino do registro (entra como "pendente de
  revisão" em vez de já contar como confirmado pelo dono) e, por isso, o
  texto da tela de confirmação final precisa dizer isso.
  Pela decisão do Mateus de 2026-09-22, essa rota também ganha tratamento
  desktop — o que já está especificado em `captura-no-desktop-v1.md` vale
  aqui sem mudança adicional: mesma casca de takeover, mesmo stepper
  decorativo, mesmo rail de anexo+resumo acima de 880px, mesmo colapso no
  piso de 375px. Este ticket não redesenha a tela de captura, só a usa.
- Para o dono revisando a fila: **gestão** — Home (dashboard do shell
  desktop) e `/despesas`, exatamente o cenário "em casa, sentado, revisando
  antes de decidir".

## Delta 1 — tela de confirmação da captura (dentro de `/adicionar/documento`)

Quando quem salva é colaborador, o texto final de sucesso precisa comunicar
"isto ainda vai para revisão do Mateus antes de contar como confirmado".
**Texto exato: pergunta aberta** (copy de produto, não fiscal).

## Delta 2 — Home (dashboard do shell de gestão)

Card novo, ao lado dos painéis já existentes (Pendências urgentes / Despesas
recentes / Agenda), com rótulo "N registros do colaborador aguardando
revisão" e link "Ver fila (N) →" para `/despesas` já com o filtro de revisão
aplicado.

Tratamento visual **neutro/informativo**, deliberadamente separado da
paleta vermelho/âmbar da fila de pendências fiscais — isto não é uma dívida
documental, é um item de fluxo de trabalho, e misturar as duas cores
arrisca o colaborador (ou o Mateus, de relance) ler "registro pendente de
revisão" como "pendência fiscal".

Estado vazio: card não aparece (mesma regra de "zero é fato bom" que já rege
os outros KPIs) ou aparece esmaecido com "Nenhum registro aguardando
revisão" — **pergunta aberta sobre qual dos dois**.

## Delta 3 — `/despesas`

Novo filtro (ao lado de Situação/Tipo/Busca): "Aguardando revisão". Cada
linha criada por colaborador ganha uma segunda linha de texto "criado por
{nome} em dd/MM/aaaa" (mesmo padrão tipográfico secundário que a tabela já
usa para a nota de agendamento no `CONTAI-057`/`091`) e uma ação "Revisado"
na célula de Ação.

Clicar em "Revisado" não deve parecer uma confirmação de pagamento — botão
secundário/ghost, nunca o mesmo peso visual do botão que confirma pagamento.

## Delta 4 — lista do colaborador (tela filha da shell `093`)

Dentro da área do colaborador, uma lista dos documentos que ele cadastrou
(ou do acervo inteiro, se visibilidade = total), cada item com chip
"Pendente de revisão" / "Revisado".

Constantes propostas, não-fiscais, em paralelo às `CHIP_*` existentes de
`lib/fiscal/despesas.ts`: `CHIP_PENDENTE_REVISAO = "Pendente de revisão"` e
`CHIP_REVISADO = "Revisado"` — cor neutra (mesma régua da Delta 2), nunca as
cores de gravidade fiscal (vermelho/âmbar/verde), porque isto não é uma
dívida fiscal.

## Campos

Nenhum campo novo no formulário de captura (reaproveitado intacto). O que é
novo é **metadado de autoria** (quem criou, quando, revisado ou não) — não
é campo fiscal, então a disciplina de "nasce vazio" não se aplica a ele; mas
vale notar onde a tela TEM campo fiscal: o formulário de documento em si
continua com todos os campos fiscais de sempre (nota no CPF?, CNO impresso,
etc.), nascendo vazios exatamente como hoje, independente de quem está
logado.

## Textos com consequência fiscal

Nenhum texto fiscal novo — a quarentena/validação do documento usa as mesmas
constantes de sempre, copiadas, nunca reescritas. Os textos novos desta
fatia (confirmação adaptada, "aguardando revisão", rótulos dos chips) são
copy de produto/workflow, não consequência fiscal — não precisam ir ao
`contador`, mas a exata redação ainda não está fechada.

## Perguntas abertas

1. Texto exato da tela de confirmação quando quem salva é colaborador.
2. Card da Home quando N=0: não aparece, ou aparece esmaecido?
3. Os rótulos `CHIP_PENDENTE_REVISAO`/`CHIP_REVISADO` propostos são
   aceitáveis, ou o `po` já tem outra nomenclatura em mente (ex.:
   "Aguardando revisão" em vez de "Pendente de revisão", para não colidir
   semanticamente com "pendência" fiscal)?
4. Botão "Revisado" em `/despesas`: ação de um clique sem confirmação, ou
   exige um passo de confirmação (visto que é o que torna o registro
   "oficialmente revisado" pelo dono, e libera o veto às saídas anuais)?
