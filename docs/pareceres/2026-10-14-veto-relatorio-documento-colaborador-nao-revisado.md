# Veto às saídas anuais por documento de colaborador não revisado

- **Data**: 2026-10-14 · **Autor**: agente `contador`
- **Provocação**: Gate Fiscal do `CONTAI-094` (acesso multiusuário — colaborador
  cadastra `documento`). O `cto-obra` perguntou se um documento cadastrado por
  colaborador, ainda sem revisão/confirmação do Mateus, veta as saídas anuais
  (Bens e Direitos, Pagamentos Efetuados, aferição INSS) da mesma forma que
  "sem arquivo" veta hoje.
- **Normativo para**: `CONTAI-094` (fila de revisão do colaborador) e qualquer
  ticket futuro que leia afirmações de documentação hábil feitas por alguém
  que não é o declarante.
- **Combina, sem rederivar**: `docs/pareceres/2026-08-23-anexo-no-desembolso-do-terreno.md`
  (ADENDO 2 §A.4 — "o arquivo que falta É o documento hábil") e
  `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` (ADENDO §A —
  compromisso vencido sem resposta bloqueia relatório, por ser fato pendente
  de resposta do declarante).

> `[Certain]` / `[Likely]` / `[Guessing]` são meus. Nada aqui substitui
> contador humano (CRC).

---

## 1. Resposta direta

**Sim, veta — mas por fundamento diferente do "sem arquivo", e isso muda o
que destrava o veto.**

Se um `documento` foi cadastrado por colaborador **e** nenhuma das afirmações
de documentação hábil que ele registrou (nota no CPF do titular? CNO
impresso? há retenção destacada?) tiver revisão/confirmação explícita do
Mateus → **marcar** pendência própria ("pendente de revisão do titular",
visualmente distinta do chip "Nota sem arquivo") **e** vetar as três saídas
anuais enquanto a pendência existir.

## 2. Por que o efeito é igual mas a causa não é

- **"Sem arquivo" veta porque falta o documento hábil em si** — sem o
  arquivo não há prova nenhuma (ADENDO 2 §A.4 do parecer de 2026-08-23: "o
  arquivo que falta É o documento hábil"). `podeGerarRelatorioAnual` veta sem
  olhar pagamento, porque não há nada para fundamentar.
- **Aqui o arquivo existe** — o anexo é obrigatório na captura do colaborador,
  com a mesma validação do fluxo do dono. O que falta não é o documento: é o
  **ato do declarante** confirmando os fatos que o colaborador registrou
  sobre ele. A condição 4 do custo de aquisição (discriminação na DAA —
  `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md` §1) é ato
  exclusivo do Mateus como declarante; o sistema não tem base para tratar a
  leitura do colaborador como fato assentado para uma saída que alimenta a
  própria declaração dele até que ele confirme.
- **Logo, não é a mesma condição de veto — é um veto paralelo com o mesmo
  efeito prático.** Destrava com a revisão do Mateus (confirmar ou corrigir
  a afirmação), nunca com upload de arquivo, porque o arquivo já está lá.

## 3. Automático × revisão humana

- **Automático**: marcar a pendência "pendente de revisão do titular" +
  vetar as três saídas anuais enquanto não houver revisão.
- **Só o Mateus**: revisar/confirmar (ou corrigir) a afirmação do colaborador
  sobre o documento — esse ato, e só ele, libera o veto.
- **Nunca recusa o registro em si** — o documento grava sempre no acervo,
  mesma disciplina de "nunca recusa fato consumado" já fixada para outras
  pendências do produto.

## 4. CRC

Sem CRC envolvido neste parecer — é decisão de modelagem de produto sobre
quando uma afirmação de terceiro (não-declarante) vira fato confiável para
alimentar a declaração, não é interpretação de norma tributária nova.

## 5. Limite

Isto é extensão lógica combinando dois pareceres já vigentes, aplicada a um
caso novo (documento cadastrado por quem não é o declarante) — não é
reinterpretação de nenhum dos dois. Qualquer ticket que implemente este veto
cita este arquivo, não os dois originais isoladamente, para o rastro de
"quem decidiu o quê" ficar em um lugar.
