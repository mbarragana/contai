## Auditoria não planejada — 2026-08-22 — extrair spec dos mocks virou revisão de texto fiscal

Os 10 specs (`design/mocks/*.md`) foram gerados para **baratear leitura**: 673 KB
de HTML viraram 117 KB, e o Gate 1 do `CONTAI-021` passou de 152 KB para 19 KB.

A economia era o objetivo. **O que os specs acharam vale mais.** Obrigar quatro
`designer` a copiar *literalmente* todo texto com consequência fiscal — sem
parafrasear, devolvendo dúvida em vez de decidir — fez a leitura virar auditoria.

### O achado grave: erro fiscal **em produção**

`app/_components/registrado.tsx:61`, no ar, depois de **todo** registro:

> "Salvo em **{obraNome}**. Original guardado no acervo — fica disponível até a
> venda + 5 anos."

**Dois erros, e o `contador` insiste que o segundo é o pior:**

1. **"venda + 5 anos"** — atalho errado, corrigido em 2026-08-16. O relógio é o
   do CTN art. 173, I; venda em 2028 → 31/12/2034; **obra não vendida = prazo
   indefinido**. A frase autoriza descartar documento antes da hora.
2. **"Original guardado"** — contraria o F3 do mesmo parecer (*"o papel é a
   prova; o arquivo do contai é o localizador"*). Convida ao descarte do **papel**
   com a mesma força. Corrigir só o prazo deixaria a pior das duas no ar.

Era a **única** afirmação do app sobre prazo de guarda. → **`CONTAI-030`**,
corrigido em 2026-08-22, com o texto sancionado pelo `contador`:

> "Salvo em **{obraNome}**. Arquivo guardado no acervo — nada se apaga, e o
> prazo de guarda só começa a correr depois da venda."

Três decisões dentro dessa frase: **"Arquivo"** (nem "Original" nem "Cópia" —
XML de NF-e *é* original, recibo escaneado não é; as duas palavras mentem em
metade dos casos); **nenhum número de prazo** (o app não sabe a data da venda,
nem da última DAA — prazo em tela seria palpite); **"guarde o papel" fora do
banner** (é condicional ao tipo do documento, e o banner aparece depois de tudo).

### O erro estava no PARECER também — e a ordem de conserto importa

`docs/pareceres/2026-08-16-gate-fiscal-contai-011.md`, F3, dizia *"5 anos
contados do primeiro dia do ano seguinte à **declaração que informar a venda**"*
— o que contradiz o F1 do próprio parecer, que ancora na **última DAA que
declarou qualquer parcela** do ganho. Venda parcelada com recebimento em 2028 e
2029 tem **duas** DAA; "a que informar a venda" é a primeira, e adotá-la **joga
um ano fora** do prazo de guarda.

⚠️ **O parecer foi corrigido primeiro, e essa ordem não é detalhe.** O LEIA-ME
do dossiê em `CONTAI-011.html` copia esse bloco **literalmente**, por exigência
do critério 13. Consertar o mock antes do parecer faria a próxima cópia
literal **reintroduzir o erro**.

**Regra que fica**: quando texto de tela é cópia literal de parecer, o conserto
começa no parecer. Sempre.

### Os outros quatro achados, todos ainda abertos

| Onde | O quê |
|---|---|
| `CONTAI-002` `#s7` (mock **aprovado**) | diz *"para voltar, você precisa do link no e-mail"* — resíduo da versão anterior à decisão de 2026-08-10 (código de 6 dígitos, **sem link**). O mock se contradiz: o `#s2` do mesmo arquivo diz o contrário |
| `CONTAI-027` `inpDataS2` | tem `value="2026-08-21"` no HTML, contra o texto da própria tela (*"o app nunca inventa a data"*) |
| `CONTAI-019` `meio` e `cEncargos` | nascem preenchidos (PIX, 0.00). Demonstração ou default pretendido? Default em campo fiscal é proibido — os specs assumiram SEM DEFAULT e devolveram a pergunta |
| `CONTAI-009` `#s7` | *"o ano sai da data do pagamento, não da data da nota"* é redação do **designer**, **sem carimbo do `contador`** |

Nenhum foi corrigido: texto com consequência fiscal se copia do parecer, não se
reescreve. Estão registrados na seção `## Dúvidas` do spec de cada mock.

### A lição de processo

**Mock aprovado envelhece em silêncio.** O `CONTAI-001` e o `CONTAI-002` foram
aprovados e implementados; a regra do prazo mudou em 16/08 e a do login em
10/08, e **nenhum dos dois textos foi revisitado**. Não havia mecanismo para
isso — mock é HTML de 150 KB que ninguém relê inteiro.

O spec é esse mecanismo, por acidente: ele lista os textos fiscais **isolados,
com a origem ao lado**, num arquivo de 100 linhas que dá para reler. Quando um
parecer mudar, dá para varrer os 10 specs em minutos.

⚠️ **Custo desta sessão, dito por extenso porque foi o Mateus quem pagou**: 8
subagentes, dos quais 4 `designer` lendo 673 KB de HTML. A extração dos specs
foi cara e é **de uma vez só**. O que ela destrava é permanente; o que ela
custou, não se repete.
