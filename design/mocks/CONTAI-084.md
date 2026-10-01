# CONTAI-084 — criador em lote de parcelas (compra no cartão)

**Cenário: gestão** (em casa, sentado — lança a compra do concreto
R$45.000/3x depois do fato). "Teste do Canteiro" não se aplica: densidade e
passos a mais são aceitáveis, contanto que `/adicionar/compra-cartao`
(captura individual) continue intocada.

## Nível do mock: **1** — rota nova `/adicionar/compra-cartao/parcelas`

Rota irmã, não um modo da tela atual (decisão do `cto-obra`: isola a herança
de nota por `?documento=`, que esta rota nunca lê). Casca `app/(captura)/`
(sem sidebar, `larga:max-w-[940px]`, CONTAI-047). Tela 1 usa
`COLUNA_DO_FORMULARIO` (556px), como as demais de `/adicionar/*`; a Tela 2
(até 24 linhas) usa a largura `larga` inteira — 556px forçaria quebra de
linha em cada valor/data.
**Gate Fiscal consumido** (fechado fora deste documento): divisão em N
partes iguais, resíduo inteiro na ÚLTIMA parcela; nenhuma parcela herda
`documento_origem_id`; vínculo com nota fora de escopo (pré-vínculo, depois,
uma a uma); cadência mensal a partir da semente. `RECUSA_PARCELADO`/ADENDO 5
**não muda**: cada linha nasce evento fiscal independente, "à vista" por
construção.

**Texto fiscal novo: nenhum** — sem campo de controle fiscal direto
(`notaNoCpf`/retenção só no registro de nota/pagamento individual). Dois
textos são REAPROVEITADOS, adaptados — pedem checagem rápida do `contador`
antes do Gate 1: a doutrina do campo "Parcelado?" ausente e o banner padrão
de cartão, pluralizado — ambos no §2.

## 1. Fluxo

RECUSA_PARCELADO (banner existente) → clique "Lançar as parcelas em lote →"
→ **[formulario]** Tela 1 → "Gerar as N parcelas" (só com os 6 campos
válidos) → **[revisao]** Tela 2, campos comuns viram resumo fixo no topo com
"Editar dados comuns" (volta à Tela 1; se já houve edição manual, confirma
antes de descartar) → "Confirmar as N parcelas" (só com soma == total) →
**[salvando]** RPC `compra_cartao_gravar_lote`, botão "ocupado" →
**[sucesso]** Tela 3, ou erro (rede, soma recusada no servidor, sessão
caída): volta a **[revisao]** com a MESMA lista editada (nada se perde) +
Banner vermelho no topo com o motivo + "Tentar de novo". Vazio = a própria
Tela 1 em branco — gerar sempre produz N≥2 linhas.

## 2. Tela 1 — campos comuns

`AppBar titulo="Lançar parcelas em lote" sub="Compra no cartão"`. Banner
`cor="amb"` (confirmar texto com `contador`): *"Estas compras nascem sempre
agendamento — o dinheiro só sai quando cada fatura for paga. O favorecido é
o lojista, nunca o banco nem a administradora."* Campos, mesmos componentes
de `compra-cartao/page.tsx`: Favorecido (nome); CNPJ/CPF (`tipoPorDocumento`
decide o rótulo); `CamposCurtos` com Data da compra + Vencimento da 1ª
fatura (ajuda: *"A data da compra é só registro. O vencimento da 1ª fatura é
a semente: as próximas vencem no mesmo dia dos meses seguintes."*); Valor
total; Número de parcelas (stepper inteiro, min 2 max 24 — erros nomeados:
*"Abaixo de 2 não é lote — lance em `/adicionar/compra-cartao`."* e *"Máximo
24 parcelas por lote."*).

Ajuda fixa do stepper, abaixo dele — **texto acrescentado no Gate 1 e
ratificado pelo `contador` nesta rodada** (registrado aqui para não ficar só
no código): *"Cada parcela vira uma compra separada, na fatura em que ela
vence."* É a instrução do ADENDO 5 §I.1 dita no lugar onde o Mateus escolhe o
N — não promete nada sobre ano de custo, só nomeia o que o lote produz.

`Dica` fixa abaixo do último campo: *"Nenhuma parcela aqui pergunta se é
parcelada — cada uma já nasce um evento à vista, sozinha. Vínculo com nota
não é feito aqui: depois de criadas, ligue cada parcela em pré-vínculo."*
Rodapé: `BotaoSalvar` "Gerar as N parcelas →" (desabilitado nomeando o que
falta, padrão `faltando` de `compra-cartao`); `BotaoLink` "Voltar".

## 3. Tela 2 — revisão (largura `larga`)

Resumo fixo no topo (só leitura): Favorecido · Documento · Data da compra,
com link "Editar dados comuns". Abaixo, tabela (≥880px) / cartões
empilhados (<880px, mesmos 3 dados por linha):

```
 #   Vencimento        Valor (R$)
 1   15/10/2026  ✎     15.000,00   ✎
 2   15/11/2026  ✎     15.000,00   ✎
 3   15/12/2026  ✎     15.000,01   ✎   ← resíduo aqui
 ───────────────────────────────────────
 Soma: R$ 45.000,01 de R$ 45.000,00 — sobra R$ 0,01
 [Confirmar as N parcelas]  (desabilitado)
```

Geração (ao entrar, ou regenerar): valor = `total ÷ N` truncado em centavos
nas N-1 primeiras, resíduo inteiro na última; vencimento = mesmo dia do mês
da semente +1 por parcela — mês sem esse dia (ex. 31 em abril) cai no último
dia do mês E ganha etiqueta âmbar: *"ajustada — abril não tem dia 31"*.
Ambos editáveis por linha sempre; editar não apaga a etiqueta.

Validação em tempo real, cabeçalho e totais **sticky** (24 linhas não cabem
na altura útil): soma == total → verde, habilita o botão; soma < total →
*"Falta R$X,XX para a soma bater com o valor total."*, âmbar; soma > total →
*"Sobra R$X,XX — a soma passou do valor total."*, vermelho; data
vazia/inválida → *"Preencha a data da parcela N para continuar."*
**Densidade**: linha compacta (~40px), não `Card` por parcela (24 cards
rolaria demais) — `#` + 2 campos editáveis inline, sem modal. Abaixo de
880px vira cartões empilhados, mesmos 3 dados, sem perder a edição.

## 4. Tela 3 — sucesso

`AppBar titulo="Parcelas lançadas" sub="N parcelas · Favorecido"`. Banner
âmbar: *"N parcelas agendadas. Nada entrou em custo ainda."* Lista das N
linhas confirmadas (Vencimento, Valor, link "Ver a fatura" ou "Confirmar o
pagamento" se já vencida — regra `faturaVencida` de hoje). Um único Banner
vermelho (não repetido por linha) com a ressalva já existente da tese do ano
de pagamento da fatura (texto verbatim de `compra-cartao`). Rodapé:
`BotaoLink` "Voltar ao início", `Botao` "Lançar outro lote" (remonta por
`key`, padrão de `aoRegistrarOutra`).

`Dica` entre a lista e o Banner vermelho — **texto acrescentado no Gate 1 e
ratificado pelo `contador` nesta rodada** (registrado aqui para não ficar só
no código): *"Nenhuma delas está ligada a nota. O vínculo é feito depois,
parcela por parcela, no pré-vínculo de cada agendamento."* É o critério 10
dito ao Mateus no único momento em que ele poderia supor o contrário — acabou
de criar N parcelas de uma compra que provavelmente tem uma nota só. Afirma o
que o sistema fez (nasceram sem origem) e aponta o ato que falta, sem prometer
custo nenhum.

## Campos

- NÃO É CONTROLE — seção no formato do contrato do `CONTAI-034`
  (`lib/design/campos-do-spec.ts`). A rota é
  `/adicionar/compra-cartao/parcelas`, e os ids abaixo são os `data-campo` que
  a tela repete.
- NÃO É CONTROLE — ⚠️ **o campo `parc` ("Parcelado?") NÃO existe aqui**, e a
  ausência é a decisão fiscal do §2 (critério 5 do ticket): cada linha gerada já
  nasce evento à vista por construção, ADENDO 5 §I.1. Não é default omitido; é
  campo que não se aplica.

### Tela 1 — os campos comuns, preenchidos uma vez

- `lFavorecido` "Favorecido" — **SEM DEFAULT**. O lojista, nunca o banco nem a
  administradora.
- `lFavorecidoDocumento` "CNPJ / CPF do favorecido" — **SEM DEFAULT**.
  `tipoPorDocumento` decide o rótulo; nada é inferido do nome.
- `lValorTotal` "Valor total da compra" — **SEM DEFAULT**. É a base da divisão
  em centavos (critério 7).
- `lCompra` "Data da compra" — **SEM DEFAULT**. Só registro: não decide
  ano-calendário nenhum.
- `lVenc1` "Vencimento da 1ª fatura" — **SEM DEFAULT**. É a SEMENTE do gerador
  de datas (critério 8).
- `lParcelas` "Número de parcelas" — **SEM DEFAULT**. Stepper inteiro, 2 a 24,
  com erro nomeado nos dois extremos. Nasce vazio de propósito: "2"
  pré-escolhido seria o lote mais comum virando default silencioso.
- NÃO É CONTROLE — o banner âmbar de agendamento (§2) e a `Dica` da ausência do
  campo "Parcelado?" são texto fiscal, sem controle nenhum.

### Tela 2 — a revisão das N linhas

- `lVencParcela` "Vencimento da parcela N" — **DEFAULT DECLARADO: a sugestão do
  gerador de datas (mesmo dia do mês da semente, +1 mês por parcela), visível,
  editável linha a linha e com etiqueta âmbar nomeando a parcela cuja data foi
  ajustada por o mês não ter aquele dia (critério 8)**. Um id para as N linhas:
  o número da parcela vai no nome acessível de cada campo.
- `lValorParcela` "Valor da parcela N" — **DEFAULT DECLARADO: a sugestão da
  divisão em centavos (`total ÷ N` truncado nas N-1 primeiras, resíduo inteiro
  na última — critério 7), visível, editável linha a linha, e a confirmação
  fica bloqueada enquanto a soma das N não for exatamente o valor total
  (critério 9)**.
- NÃO É CONTROLE — resumo fixo dos dados comuns, cabeçalho e linha de totais
  `sticky`, e os botões "Editar dados comuns" / "Confirmar as N parcelas".

### Tela 3 — sucesso

- NÃO É CONTROLE — a tela é leitura: lista das N parcelas confirmadas com link
  por linha, o banner único da ressalva do ano de pagamento da fatura e os dois
  botões de saída. Nenhum campo.

## Perguntas abertas

Nenhuma de requisito (Framing/Gate Fiscal/Viabilidade já fechados) — só as
duas confirmações de texto com o `contador` citadas acima.
