# Parecer fiscal — Gate Fiscal do CONTAI-005, rodada 2 (Gate 2 de implementação)

- **Data**: 2026-09-20
- **Autor**: agente `contador` (autoridade fiscal do projeto)
- **Veredicto**: duas perguntas de composição, levantadas pelo `lead-engineer`
  no Gate 2 de implementação, **respondidas com decisão definitiva** — a
  primeira rodada exige **REQUEST CHANGES** sobre a fórmula então implementada;
  a segunda rodada, já corrigida, **APPROVE**.

> Este parecer é curto de propósito: registra as duas decisões da rodada 2 com
> o fundamento completo, para existir como fonte citável — não reabre a
> discussão da rodada 1, que está em
> `docs/pareceres/2026-08-16-gate-fiscal-contai-004-005.md`, Parte 2.

---

## 1. Terceira parcela do headline: "pago sem comprovante" entra em "Custo em risco no IR"

**Pergunta do Gate 2**: `pago_sem_comprovante` e `diferenca_sem_explicacao`
nasceram depois do parecer de 16/08 (CONTAI-019/025) e hoje não entram na soma
do headline. São a mesma moeda fiscal das duas parcelas já cobertas
(quarentena + pago sem nota), ou moeda diferente?

**Decisão — `pago_sem_comprovante` ENTRA, como terceira parcela.**

Fundamento `[Certain]`: o art. 17 da IN SRF 84/2001 exige uma condição
**composta** — dispêndio **comprovado** **e** documentação **hábil e idônea**.
As duas parcelas originais falham a perna documental (quarentena: documento
existe mas fora do CPF; pago sem nota: documento não existe). `pago sem
comprovante` falha a **outra perna da mesma condição**: o dispêndio existe e
tem (ou não) documento hábil, mas falta a prova de que o desembolso saiu da
conta do declarante. Para PF isso é ainda mais direto: "sem o rastro bancário
não existe condição 3 — não é custo mal documentado, é custo inexistente para
efeito de prova" (ADENDO 2 do parecer de 18/08, §5). Mesma natureza (dispêndio
real e conhecido desta obra), mesma unidade (reais que hoje não compõem custo
de aquisição), mesma consequência (não sustenta custo até o documento faltante
chegar) — logo, mesma soma.

Isso vale tanto para PJ quanto para PF: a gravidade âmbar (PJ) ou vermelha (PF)
do card da pendência é severidade de resolução — quão fácil/urgente é
resolver — e não muda a moeda fiscal da parcela.

**Construção que impede dobra de contagem**: (a) "pago sem nota" e (c) "pago
sem comprovante" são **mutuamente exclusivas por construção**, não por
disciplina de quem escreve o código depois. Sem comprovante, o valor elegível
do pagamento é zero (regra já vigente desde o CONTAI-019/ADENDO 2), logo o
excedente "sem nota" também é zero — só (c) tem valor. Com comprovante, (c) é
zero por definição — só (a) pode ter valor. Um pagamento nunca aparece com
saldo positivo nas duas parcelas ao mesmo tempo.

**`diferenca_sem_explicacao` FICA FORA — decisão, não omissão.**

Fundamento `[Certain]`: a natureza fiscal dessa pendência é **indeterminada**
no momento em que ela existe. Os desfechos possíveis incluem `nao_compoe_custo`
(mora, multa, item não incorporado ao imóvel) e `erro_digitacao` — em ambos, o
valor **nunca seria custo de aquisição**, mesmo com toda a documentação do
mundo. Somar esse valor ao headline afirmaria a perda de um custo que pode não
existir, o mesmo defeito de unidade que já exclui boleto e INSS da soma
(parecer de 16/08, §1 e §2: "a soma corresponde a alguma apuração?" — para
`diferenca_sem_explicacao`, a resposta é não, porque parte dela pode nunca ter
sido elegível). A pendência continua vermelha e visível na lista, fora do
headline.

---

## 2. Base de exposição do INSS: `nf_servico_sem_cno` entra, deduplicada por documento

**Pergunta do Gate 2**: `nf_servico_sem_cno` (CONTAI-007) também significa
"nota não abate a aferição", mas hoje só `servico_sem_retencao` compõe
`exposicaoInssBaseCentavos`. A mesma nota pode ter as duas pendências ao mesmo
tempo — como somar sem contar o documento duas vezes?

**Decisão — `nf_servico_sem_cno` ENTRA, com dedup por `documento.id`.**

Fundamento `[Certain]`: retenção de 11% e CNO impresso são **duas pernas
independentes da mesma pergunta** — "esta nota reduz a base da aferição
**deste** CNO?". Falta de retenção e falta de identificação do CNO são causas
diferentes do mesmo efeito (nota que não abate); a unidade é idêntica nas duas
(base em reais, nunca reais de imposto — R2 do parecer de 16/08), então somar
as duas famílias respeita a moeda, desde que o mesmo documento não seja
contado duas vezes quando carrega as duas pendências simultaneamente.

**Regra exata de dedup**:

```
exposicaoInssBaseCentavos =
  Σ, uma vez por documento.id, de documento.valorCentavos
  para todo documento onde:
    documento.tipo == "nf_servico"
    E documento.status != "quarentena"
    E ( documento.retencao11 != true
        OU (obra.cno != null E documento.notaTrazCno == false) )
```

A união tem de ser calculada **sobre os documentos**, nunca somando os dois
arrays de `pendencias` já filtrados por tipo — uma nota com as duas pendências
apareceria duas vezes na soma se a fonte fosse a lista de pendências, e é
exatamente esse double-count que a regra existe para impedir. As duas
pendências continuam existindo e aparecendo em tela como cards separados
(são aditivas para fins de exibição); é só o **agregado numérico** que soma o
valor do documento uma única vez.

Sem CNO na obra, a segunda condição não existe — mesmo silêncio já ratificado
no CONTAI-007: não se cobra do prestador um CNO que a obra ainda não tem
registrado.

---

## Nota à parte, fora do escopo deste parecer

A exclusão de `terrenoPagoSemComprovante` (CONTAI-025) do headline "Custo em
risco no IR" foi discutida na mesma revisão e **não está fechada por este
parecer**: pela mesma lógica do item 1 acima (perna de comprovação do art. 17),
ela é candidata a ser a mesma moeda, e a exclusão atual é herança de escopo do
CONTAI-010, não uma fronteira fiscal decidida. Fica registrada como dívida
fiscal em aberto, pendente de ticket e parecer próprios — não decidir por
paráfrase aqui.

**Nada neste parecer autoriza o sistema a assinar ou substituir declaração.**
