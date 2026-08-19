# CONTAI-023 — Tirar "regime de caixa" das quatro telas que sobraram

## Tipo e Prioridade

- **Tipo**: correção de texto de tela (vocabulário fiscal)
- **Prioridade**: **P2** — não serve nenhuma das três metas diretamente; serve
  o entendimento que evita o erro que a meta 1 previne. Ver *Filtro de escopo*.
- **Origem**: dor **D31** do `docs/backlog.md`, aberta pelo `lead-engineer` no
  Gate 1b do `CONTAI-019` e **promovida a ticket pelo `po` no Gate 4** (18/08),
  junto com o reescopo do **critério 7** do 019.
- **Gate 0 (mock)**: **não se aplica.** Nenhuma tela muda de estrutura, de
  campo, de fluxo ou de estado — trocam-se sentenças em telas existentes. Chamar
  isso de mock-first seria cerimônia.
- **Gate Fiscal**: **FECHADO, e sem consulta nova.** O texto substituto já está
  ratificado pelo `contador` no **§F.5** do parecer de 18/08 e já existe em
  produção, em constante: `DATA_QUE_VALE_PARA_O_CUSTO`
  (`lib/fiscal/pagamento.ts`). **Não se escreve frase nova neste ticket** — se
  alguma tela precisar de redação diferente, isso é pergunta ao `contador`, não
  improviso do implementador.
- **Tamanho**: **S.** Quatro trechos, nenhuma lógica.

## Dor de Origem

O **critério 7 do `CONTAI-019`** proíbe *"regime de caixa"* em tela. O Gate 1b
trocou **nas telas que aquele ticket abriu** e deixou o resto, com um argumento
que o `po` aceitou no Gate 4:

> trocar texto fiscal em tela que ninguém revisou nesta rodada passa no build,
> passa no teste, e só aparece no dedo do Mateus.

O recorte do **trabalho** está certo. O que não podia ficar é o **resto sem
ID**: dor solta num backlog de 1.800 linhas não tem quem a pegue, e o critério 7
não podia continuar dizendo *"nunca"* enquanto foi cumprido *"nas telas que este
ticket toca"* — **ajustar a régua ao que se entregou é como se apaga um
requisito** (é a **D29** aplicada a requisito em vez de locator). O critério 7
passou a nomear seu escopo; este ticket é o resto.

**Por que a frase sai** (decisão 10 do fechamento de 18/08, ratificada em §F.5):
*"regime de caixa"* é o **nome** da regra, não a regra. Para um usuário de uma
pessoa só, o nome **não ensina nada** — e o exemplo ensina.

## As quatro ocorrências

⚠️ **Quatro, não três.** O relatório de Gate 4 do `po` contou três e errou pelo
mesmo mecanismo descrito abaixo.

| Arquivo | Linha | Texto hoje |
|---|---|---|
| `app/adicionar/page.tsx` | 35 | *"…pagamento é o que define o ano do custo (regime de caixa)."* |
| `app/adicionar/documento/page.tsx` | 365 | *"conta pela data do pagamento ligado — regime de caixa"* |
| `app/documento/[id]/page.tsx` | 139 | *"— regime de caixa"* |
| `app/documento/[id]/page.tsx` | **157-158** | *"Este pedaço da nota **não vira custo**: regime de / caixa — sem desembolso não há dispêndio."* |

## ⚠️ Como procurar — a receita já falhou DUAS vezes

1. **Gate 1b**: `grep "regime de caixa"` perdeu as ocorrências que o formatador
   quebrou em duas linhas. A lista nasceu com cinco itens e estava incompleta.
2. **Gate 4 (`po`)**: a receita corrigida — buscar por **`de caixa`** — **também
   é insuficiente**. Na linha 157 o Prettier quebra **entre `de` e `caixa`**:

```
              Este pedaço da nota <strong>não vira custo</strong>: regime de
              caixa — sem desembolso não há dispêndio. Ele passa a contar
```

**Receita correta**: `grep -rn "caixa" app/` — a **palavra sozinha**. Qualquer
separador que contenha espaço pode virar quebra de linha; só o token indivisível
é seguro.

**Generalize antes de fechar**: isto não é sobre esta frase. Toda varredura de
texto de tela procura pela **palavra mais longa que não pode ser quebrada**,
nunca pela frase. Vale para as próximas.

## Critérios de Aceite

1. [ ] **`grep -rn "caixa" app/` não devolve nenhuma ocorrência em texto
   renderizado.** Comentário de código pode citar a expressão (dois já citam,
   explicando por que ela saiu) — o que não pode é chegar ao olho do Mateus.
2. [ ] **Nenhuma frase nova é escrita.** O texto substituto é o do §F.5, e ele
   já existe em constante: `DATA_QUE_VALE_PARA_O_CUSTO`
   (`lib/fiscal/pagamento.ts`). Onde a frase inteira não couber, **corta-se o
   nome da regra e mantém-se a explicação** — nunca se inventa redação.
   > **A data que vale para o custo é a do pagamento, não a da nota. Nota de
   > dezembro paga em janeiro é custo do ano seguinte.**
3. [ ] ⚠️ **O exemplo fica.** A decisão 10 é explícita: *"é ele que ensina, e a
   sentença abstrata sozinha é esquecível"*. Trocar a frase por só a primeira
   sentença é cumprir a letra e perder o motivo.
4. [ ] **A ocorrência de `app/documento/[id]/page.tsx:157-158` está no escopo**,
   e o critério existe porque ela é a que escapa de toda busca ingênua.
5. [ ] **Nenhuma lógica muda.** O diff é de string. Se algum arquivo exigir
   mudança de estrutura para caber a frase, isso vira pergunta ao `designer` —
   não entra aqui em silêncio.
6. [ ] **Unitário que trava a regressão**: uma asserção sobre o texto exportado
   das telas tocadas, ou — mais barato e mais durável — um teste que varre
   `app/` procurando `caixa` em JSX e falha nomeando o arquivo. **A segunda
   opção é a preferida**: ela protege as telas futuras, e o histórico deste
   ticket é de três varreduras manuais e dois erros de contagem.

## Filtro de escopo — por que P2 e não corte

*O `po` é obrigado a dizer quando um requisito não serve as três metas. Este
não serve nenhuma delas diretamente, e mesmo assim fica.*

- **Não serve a meta 1** (nenhum pagamento sem documento hábil): não muda
  validação nenhuma.
- **Não serve a meta 2** (relatórios prontos): não toca saída.
- **Não serve a meta 3** (acervo que sobrevive à decadência): não toca acervo.

**Por que não é corte**: as três telas restantes são de **documento**, e é
exatamente ali que nasce a confusão entre **data da nota** e **data do
pagamento** — o erro que joga custo no ano errado, que é o item que a meta 2
existe para evitar. O ganho é de **entendimento**, não de mecanismo, e por isso
é **P2 e não P1**. É honesto dizer que ele pode esperar; não é honesto dizer que
ele não vale nada.

**Se a fila apertar, este é dos primeiros a ceder.** Registrado assim de
propósito.

## Out of Scope

- **Reescrever a frase do §F.5.** Ela é ratificada pelo `contador`; mudar a
  redação exige parecer, não gosto.
- **Varrer outros termos fiscais em tela** (*"quarentena"*, *"documento
  hábil"*, *"aferição"*). Nenhum deles foi reprovado por ninguém, e varredura
  sem critério é como se troca texto certo por texto pior.
- **Qualquer mudança de layout.** Se a frase não couber, a pergunta é do
  `designer`.

## Dependências

- **Bloqueado por**: nada. As telas existem e o texto está ratificado.
- **Relacionado**: `CONTAI-019` (critério 7, de onde este recorte saiu) e a dor
  **D29** — a família "asserção que erra na direção de aprovar" é a mesma que
  produz "varredura que erra na direção de dizer que acabou".
