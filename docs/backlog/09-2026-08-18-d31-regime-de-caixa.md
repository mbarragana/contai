## D31 — "regime de caixa" ainda em três telas que o CONTAI-019 não tocou

⚠️ **Renumerada de D24 para D31 no Gate 4 (18/08).** O ID **D24 já estava
ocupado** pela dor do ano-calendário declarado (tabela acima, linha do Gate
Fiscal do `CONTAI-021`), aberta no mesmo dia. Dois itens com o mesmo nome num
backlog vivo destroem a rastreabilidade que o ID existe para dar: a partir da
colisão, toda referência a "D24" é ambígua e nenhuma das duas dores pode ser
citada em ticket. **D24 = ano-calendário declarado. D31 = esta.**

*Aberta pelo `lead-engineer` no Gate 1b do `CONTAI-019`, 2026-08-18.
**Promovida a ticket no Gate 4**: virou **`CONTAI-023`**, junto com o
reescopo do critério 7 — dor sem ID de ticket não tem quem a pegue.*

O **critério 7 do CONTAI-019 proíbe "regime de caixa" em tela**, e a **decisão
10** do fechamento de 18/08 fixou a frase substituta, ratificada pelo `contador`
em §F.5:

> **A data que vale para o custo é a do pagamento, não a da nota. Nota de
> dezembro paga em janeiro é custo do ano seguinte.**

**O que o Gate 1b trocou** — e só isto, porque a decisão 10 nasceu de um
conflito entre dois mocks **na mesma superfície**, e não autoriza varredura em
tela que ninguém revisou nesta rodada:

- `app/page.tsx` — o parêntese saiu da linha das despesas comprovadas;
- `app/pagamento/[id]/page.tsx` — passou a exibir a frase do §F.5, com o exemplo;
- `app/adicionar/pagamento/page.tsx` — o rótulo do custo deixou de nomear a
  regra, e a frase do §F.5 entrou no campo de data.

**O que FICOU, e onde** — quatro ocorrências, em três telas que este ticket não
abriu:

| Arquivo | Linha | Texto |
|---|---|---|
| `app/adicionar/page.tsx` | 35 | *"…pagamento é o que define o ano do custo (regime de caixa)."* |
| `app/adicionar/documento/page.tsx` | 365 | *"conta pela data do pagamento ligado — regime de caixa"* |
| `app/documento/[id]/page.tsx` | 139 | *"— regime de caixa"* |
| `app/documento/[id]/page.tsx` | 157 | *"Este pedaço da nota não vira custo: regime de…"* |

⚠️ **A receita de busca já falhou DUAS vezes, e a segunda foi minha** (`po`,
Gate 4, 18/08). O Gate 1b descobriu que `grep "regime de caixa"` perde a frase
quebrada pelo formatador — faltavam `app/page.tsx:254-255` (já trocada) e
`app/documento/[id]/page.tsx:157` — e prescreveu buscar por **`de caixa`**.
**Essa receita também é insuficiente**: na linha 157 o formatador quebra
**entre `de` e `caixa`** —

```
              Este pedaço da nota <strong>não vira custo</strong>: regime de
              caixa — sem desembolso não há dispêndio.
```

— e `grep "de caixa"` **não acha**. Foi assim que meu relatório de Gate 4
contou **três** ocorrências onde há **quatro**: o mesmo erro do Gate 1b, um
nível abaixo.

**Receita correta, e é a única que fecha**: `grep -rn "caixa" app/`, a palavra
sozinha. Qualquer separador que contenha espaço pode virar quebra de linha; só
o token indivisível é seguro. **A lição não é sobre esta frase** — vale para
toda varredura de texto de tela: procure pela **palavra mais longa que não pode
ser quebrada**, nunca pela frase.

**Por que não é urgente**: o dano é de vocabulário, não fiscal — *"regime de
caixa"* é o **nome** da regra, e a regra continua certa nas quatro. O argumento
do critério 7 é que o nome **não ensina nada a um usuário de uma pessoa só**, e
esse argumento não expira.

**Por que também não é zero**: as três telas restantes são de **documento**, e é
exatamente ali que a confusão entre data da nota e data do pagamento nasce.
Trocar lá tem mais valor didático do que teve na tela do pagamento.
