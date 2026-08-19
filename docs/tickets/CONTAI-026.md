# CONTAI-026 — Terreno recebido (herança, doação, permuta): custo sem desembolso

## Tipo e Prioridade
lacuna de captura — **P2**. Nasceu no **Gate 2 do CONTAI-010** (2026-08-19),
achado do `contador`. **Não afeta o Mateus** (o terreno dele é financiado), e é
por isso que é P2 e não P1.

## A lacuna

O CONTAI-010 criou `obra.natureza_aquisicao_terreno` com quatro valores, e o
quarto é **`recebido`** (herança, doação, permuta). A tela de cadastro explica
corretamente, com texto do parecer, que nesse caso *"há data de aquisição **sem
desembolso**; o custo é o valor constante na declaração do doador/de cujus"* —
que é a resposta do `contador` à pergunta 3 do Gate Fiscal.

**Mas não existe forma de registrar esse custo.** Todo `terreno_desembolso`
`pago` exige data de pagamento, e não há tipo para "valor constante na
declaração do doador". Quem escolher `recebido` fica com **custo de terreno
zero** e nenhuma tela dizendo por quê.

É a mesma família do bloqueador 2 do Gate 2 do CONTAI-010 (o R$ 0,00 que
afirmava ser situação de Bens e Direitos) — só que aqui o zero é **estrutural**,
não circunstancial.

## Por que o critério 4 do CONTAI-010 não foi implementado

Ele foi escrito como uma **restrição negativa**, e como restrição foi cumprido:
*"o critério 3 vale só para aquisição onerosa; terreno recebido tem data de
aquisição sem desembolso, então 'valor sem data é ingravável' não pode ser
absoluto"*. O ticket **não** especificou o campo positivo — onde o valor mora,
que documento o sustenta, que data ele carrega. A implementação seguiu o ticket.

## Critérios de Aceite (minuta)

1. [ ] Com `natureza = recebido`, a obra ganha **valor de aquisição + data de
       aquisição**, sem exigir data de pagamento nem comprovante de desembolso.
2. [ ] O **documento hábil é outro**: a **declaração do doador/de cujus** (ou o
       formal de partilha / escritura de doação). Anexo obrigatório no ato,
       como todo o resto.
3. [ ] Esse valor entra no acumulado do imóvel **pelo ano da data de aquisição**.
4. [ ] Enquanto não for preenchido, a obra `recebido` mostra **pendência de
       complemento**, nunca R$ 0,00 mudo.
5. [ ] ITBI e escritura/registro **continuam sendo desembolsos datados** —
       receber o terreno não isenta de pagar o que se paga para transferi-lo.

## Gate Fiscal
**Obrigatório.** Perguntas ao `contador`, e nenhuma é retórica:
1. Herança, doação e permuta têm o **mesmo** tratamento de custo, ou a permuta
   (que tem contrapartida) segue outra regra?
2. Qual documento sustenta o valor numa **intimação** — a DAA do doador basta,
   ou é preciso o formal de partilha / a escritura?
3. A **data** que vale é a do óbito, a da partilha, a da escritura ou a do
   registro?

## Dependências
- **Bloqueado por**: CONTAI-010 (entregue).
- **Não bloqueia nada** hoje: nenhuma obra cadastrada usa `recebido`.
