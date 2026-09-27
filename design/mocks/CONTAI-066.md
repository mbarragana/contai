# CONTAI-066 — compra de cartão retroativa: atalho até confirmar + texto de contexto

Cenário: **captura** (`/adicionar/compra-cartao`, rota de `(captura)`) — mas
com a ressalva do próprio ticket: quem está na tela é o Mateus fazendo
backfill em casa, sentado. 375px continua piso (não quebrar), mas o "Teste do
Canteiro" (uma mão, pressa) não é a régua de julgamento deste delta.

**Nível confirmado: 2.** Dois textos condicionais numa tela e num formulário
já existentes + troca de destino/rótulo de um link já existente. Sem rota
nova, sem estado novo, sem campo novo. Mesma classe do CONTAI-063.

## Campos

- SEM CAMPOS — nenhum campo novo. Nenhuma disciplina de campo fiscal (vazio
  pergunta, preenchido afirma, anexo obrigatório) entra em jogo — os textos
  são wayfinding, não afirmação fiscal (Gate Fiscal, item 4: "dor de
  navegação").

## 0. Condição única, usada nos três pontos abaixo
`faturaVencida = dataVencimento !== "" && dataVencimento <= hojeIso()` no
formulário; `fase.dataVencimento <= hojeIso()` na tela "Agendado" (já
preenchida, dispensa o guard). Comparação lexicográfica de string ISO
`YYYY-MM-DD`, padrão já usado no arquivo. Sem o guard, `"" <= hojeIso()` é
`true` e o texto apareceria antes de o campo ser preenchido.

## 1. Formulário — frase extra no banner âmbar existente
Arquivo: `page.tsx`, `Banner cor="amb"` ("Esta compra nasce sempre
agendamento...", ~linha 446). Não criar banner novo — acrescentar frase ao
final do mesmo banner, condicional a `faturaVencida`:

```
<Banner cor="amb" role="status">
  <strong>Esta compra nasce sempre agendamento</strong> — o dinheiro só sai
  quando a fatura for paga. O favorecido é o <strong>lojista</strong>, nunca
  o banco nem a administradora.
  {faturaVencida ? (
    <> Esta fatura já venceu: o próximo passo depois de salvar é confirmar
    esse pagamento e anexar o comprovante da fatura.</>
  ) : null}
</Banner>
```

Texto exato: **"Esta fatura já venceu: o próximo passo depois de salvar é
confirmar esse pagamento e anexar o comprovante da fatura."**

Nota de posição: o banner vem antes do campo "Vencimento da fatura" na
árvore (só existe após "Parcelado? → À vista"). Intencional (critério 3): o
banner reage a `dataVencimento` assim que o Mateus digita, mesmo acima do
campo. Não mover o banner — fora de escopo.

## 2. Tela "Agendado" — Dica nova dentro do Card existente
Dentro de `<Card className="border-dashed border-amb">`, logo depois da
`<Dica>` já existente ("A data da compra não decide ano nenhum..."), como
segundo parágrafo `<Dica>` no mesmo Card — não Card novo, não Banner novo:

```
<Dica>
  A data da compra <strong>não decide ano nenhum</strong>. Quem decide é o
  dia em que a fatura (ou a parte dela) for paga.
</Dica>
{fase.dataVencimento <= hojeIso() ? (
  <Dica>
    Esta fatura já venceu. O próximo passo é confirmar esse pagamento e
    anexar o comprovante da fatura.
  </Dica>
) : null}
```

Texto exato: **"Esta fatura já venceu. O próximo passo é confirmar esse
pagamento e anexar o comprovante da fatura."** Mesma substância do item 1
(critério 2, não é terceiro texto), no presente porque a compra já foi
salva. Não contradiz a Dica fiscal acima: aquela fala de "quando o custo
entra"; esta, de "onde ir agora".

## 3. Tela "Agendado" — link primário do rodapé
Hoje é sempre `BotaoLink href={/fatura/${fase.faturaId}}`, texto "Ver a
fatura". Passa a condicional:

| `dataVencimento <= hoje` | href | rótulo |
|---|---|---|
| **true** (fatura vencida) | `/fatura/${fase.faturaId}/confirmar` | **"Confirmar o pagamento"** |
| **false** (vencimento futuro, atual) | `/fatura/${fase.faturaId}` | "Ver a fatura" (inalterado) |

O rótulo muda com o destino: "Ver a fatura" apontando para a confirmação
seria wayfinding falso — não é alegação fiscal, é o botão descrevendo o
destino real. Os outros dois `BotaoLink` ("Registrar outra compra", "Voltar
ao início") não mudam.

## 4. Fora de escopo (herdado do ticket)
- Rótulo "Agendar — não entra no custo" — não muda (critério 4, 4 seletores
  E2E). Nenhum campo de anexo em `/adicionar/compra-cartao` (critério 6).
- Nenhuma mudança em `criarCompraCartao` / `decidirRegistro` (critério 5).
  Card "Nota de origem" e Banner vermelho de ressalva — inalterados.

## Decisões e perguntas abertas
Nenhuma bloqueante. Os dois textos são paráfrases da mesma frase; nenhum
reescreve a Dica fiscal nem introduz categoria/percentual novo — coberto
pelo Gate Fiscal do ticket
(`docs/pareceres/2026-09-26-comprovante-por-item-compra-cartao.md`: "achado
de navegação, não fiscal"). Rótulo "Confirmar o pagamento" (item 3) e as
duas frases (itens 1-2) ficam sujeitos à checagem byte a byte do `contador`
no critério 7.
