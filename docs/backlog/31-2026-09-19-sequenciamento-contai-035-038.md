# Sequenciamento CONTAI-035 × CONTAI-038 — 2026-09-19 — o item F recolore uma pendência que o parecer manda apagar

## O conflito

`CONTAI-035` (aprovado, "pronto para `/develop`") tem um **Item F** (critérios
8 e 9): reclassifica a cor da pendência `servico_sem_retencao` em
`lib/fiscal/resumo.ts:563-576` (hoje `gravidade: "amb"` fixo) para
`vermelho se nf_servico, fora de quarentena, retencao_11 !== true (trata
false e null igual), E existe ≥1 pagamento vinculado; senão âmbar`, mais um
site de conferência em `app/documento/[id]/page.tsx:511-537`.

`CONTAI-038` (Gate Fiscal, Viabilidade e Mock fechados, "PRECISA MUDAR antes
do Gate 1" só por causa deste conflito) **apaga essa pendência inteira** —
`servico_sem_retencao` está calibrada numa premissa que
`docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (§2, "reforço
explícito"; ADENDO A.2) já corrigiu: retenção — presente, ausente, ou de
qualquer composição — **nunca** abate a aferição do SERO. `retencao_11` sai
do schema, e uma pendência nova (`retencao_sem_recolhedor`) nasce no lugar,
ligada a `e_desconto_efetivo=true` + resposta "ainda não sei" a "quem
recolhe".

Os dois tickets mexem no mesmo trecho de código com premissas incompatíveis:
um refina a cor de algo que o outro está prestes a extinguir.

## Decisão (`po`, dono da fila)

**Nem a opção 1 nem a opção 2 puras — uma terceira, com um motivo que nem o
Gate Fiscal nem o Gate de Viabilidade do 038 tinham escrito ainda:**

1. **Item F sai do escopo do `CONTAI-035` agora** (critérios 8 e 9 removidos;
   critério 13/D54 — teste-trava — ajustado para cobrir só o item D e a
   exceção nomeada `pj_pago_sem_comprovante`, tirando F da tabela-verdade).
   Recolorir uma pendência que vai ser apagada por premissa fiscal errada não
   é trabalho adiável, é trabalho **descartável**: implementá-lo primeiro
   reforça, ainda que por um ciclo, um sinal ("retenção ausente = mais grave")
   que o parecer de 18/19-09 já invalidou. Reabrir um ticket aprovado para
   **subtrair** um item não exige novo Gate de Mock nem novo Gate Fiscal — não
   muda comportamento nenhum além de remover escopo cuja base fiscal foi
   substituída por parecer mais novo e mais específico.

2. **Ordem na fila: `CONTAI-035` (sem item F) ANTES do `CONTAI-038`.** Razão
   que decide o sentido, e que é de arquitetura, não de fiscal — **sujeita à
   confirmação do `cto-obra`**: o `CONTAI-035` cria `gravidadeDaRegua(...)`
   em `lib/fiscal/gravidade.ts`, o **único produtor** de um tipo `Gravidade`
   branded — "nenhuma pendência nova compila com cor literal chutada"
   (critério 2 do 035). A pendência nova do `CONTAI-038`
   (`retencao_sem_recolhedor`) é exatamente uma pendência nova, no sentido
   que esse critério usa a palavra. Ela deve nascer **já usando** esse
   produtor — não uma cor decidida solta, que precisaria de retrofit depois
   para entrar na malha do tipo branded. Inverter a ordem (038 antes) força
   uma de duas coisas piores: `038` inventa uma cor literal antes de o
   regime existir (violando o espírito do `035` antes mesmo dele nascer), ou
   `038` fica bloqueado esperando `035` de qualquer jeito — só que sem isso
   estar escrito em lugar nenhum.

   **Consequência**: `CONTAI-038` ganha uma dependência formal nova —
   bloqueado por `CONTAI-035` (no mínimo, por `lib/fiscal/gravidade.ts`
   existir) — e um critério a mais: a cor de `retencao_sem_recolhedor` é
   produzida por `gravidadeDaRegua`, nunca por literal.

**O que muda em cada ticket** (mecânica de arquivo — quem edita são as
sessões que tocam `docs/tickets/`, não este diário):
- `CONTAI-035`: remove critérios 8 e 9 (item F, os dois sites); critério 13
  perde F da tabela-verdade do teste-trava.
- `CONTAI-038`: seção Dependências ganha "bloqueado por `CONTAI-035`
  (`lib/fiscal/gravidade.ts` / `gravidadeDaRegua`)"; critério da pendência
  nova cita esse produtor em vez de definir cor solta.
- `docs/tickets/README.md`: `CONTAI-035` mantém ou sobe de posto (fica antes
  do `038`), sem outra mudança de fila motivada por este achado.

## D57 — nova dívida: falta o único campo que de fato abate o SERO

O `CONTAI-038` não cobre — corretamente, por instrução explícita de não
inventar — o campo "esta mão de obra foi declarada no CNO?" (A.5, Pergunta 2,
`docs/pareceres/2026-08-18-nfse-empreitada-simples-nacional.md`, reafirmado
em `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` §2). É o
**único** fato que reduz a base de aferição do SERO — nenhum percentual,
rótulo ou composição de retenção faz isso.

Confirmado por busca em 2026-09-19 (`grep` em `lib/`, `docs/backlog.md`,
`docs/backlog/`, `docs/tickets/`): **zero resultado** — o campo não existe em
schema, tela, ou ticket algum, aberto ou fechado.

Registrado agora para não virar fio perdido (já aconteceu antes — ver
`16-2026-08-22-custo-de-contexto-do-pipeline.md` e a reconciliação do
`CONTAI-009` em `29-2026-08-24-reconciliacao-contai-009.md`). **Não vira
ticket ainda** — fica de pé como dívida nomeada até o Mateus priorizar.
