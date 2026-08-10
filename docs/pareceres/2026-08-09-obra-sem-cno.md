# Parecer fiscal — obra em curso sem CNO

- **Data**: 2026-08-09
- **Autor**: agente `contador` (autoridade fiscal do projeto)
- **Provocação**: respostas do Mateus de 2026-08-09 — as duas obras já estão em
  andamento, cada uma com matrícula própria e unidade autônoma única, e **uma
  delas não tem CNO**.
- **Consome**: `docs/tickets/CONTAI-003.md` (critério 3), `CONTAI-007`.
- **Estado**: vigente, **com adendo de 2026-08-10** (ver o fim do arquivo): o
  atraso do CNO conta-se do VENCIMENTO do prazo, não da data de início, e a
  confirmação "Salvar mesmo assim" é rótulo de botão, não caixa obrigatória.

> Transcrição do parecer emitido pelo agente `contador`. As marcações
> `[Certain]` / `[Likely]` / `[Guessing]` são dele e indicam o grau de
> confiança — onde ele diz que precisa de confirmação, **precisa mesmo**, e
> nada aqui substitui contador humano (CRC) na assinatura da declaração.

---

## Ponto de partida

O prazo perdido não é o problema caro. O problema caro é que **cada nota de
serviço que a empreiteira emitir enquanto essa obra não tiver CNO é uma nota
que pode não ser mais corrigível** — e o poder de cobrar correção dela acaba no
dia em que a última parcela for paga. A ação urgente de hoje não está no
software: é registrar o CNO no e-CAC e falar com a empreiteira **antes da
próxima parcela**.

**Verificação que pode derrubar metade deste parecer** [Likely]: se essa obra
foi contratada por **empreitada total** a uma construtora (ela responde pelo
projeto inteiro, detém a responsabilidade técnica/ART e fornece o material), o
CNO é **dela**, não do Mateus, e a regularização também. Pelos fatos já
registrados no `CLAUDE.md` — material comprado no CPF dele e prestadores PF
avulsos — isso é empreitada parcial e o CNO é dele. Confirmar com uma pergunta:
*"a empreiteira fornece o material e assina a ART da obra inteira?"*
(registrada como **Q14** no backlog).

## 1. Obrigação e prazo

**Prazo: 30 dias contados do início da obra** — Lei 8.212/91, art. 49, II
[Likely, confiança alta]. O CNO substituiu a matrícula CEI, instituído pela
IN RFB 1.845/2018. **A IN de consolidação vigente hoje não está confirmada** —
a numeração precisa ser conferida antes de ir para texto de tela. A obrigação
em si não depende de qual IN está vigente.

**Está em atraso** se a obra começou há mais de 30 dias.

**A dispensa não salva**: a hipótese do art. 30, VIII da Lei 8.212/91
(residencial unifamiliar, tipo econômico, uso próprio, **sem mão de obra
assalariada**) [Likely] não se aplica — há empreiteira PJ e prestadores PF
pagos.

**Consequências, em ordem de custo real:**

1. **Aferição sem deduções** (a mais cara). Sem CNO, a mão de obra já
   contratada e paga não é reconhecida na aferição do SERO. A base é apurada
   pela obra (área/CUB) e o que a reduz é a remuneração declarada **vinculada
   àquele CNO**. Nada vinculado = base cheia: paga-se de novo o INSS que já foi
   pago dentro do preço da empreiteira.
2. **Impedimento de venda.** A averbação da construção na matrícula exige CND
   da obra (Lei 8.212/91, art. 47, II) [Likely, confiança alta]. Sem CNO não há
   aferição; sem aferição não há CND; sem CND não há averbação; sem averbação o
   banco do comprador não financia e o cartório não lavra.
3. **Multa por atraso** — existe (art. 92 da Lei 8.212/91 e Decreto 3.048/99),
   com valores reajustados por portaria anual. **Valor não cravado** [Guessing
   no valor, Likely na existência]. É a menor das três e não deve ser o
   argumento que aparece em tela.

Esperar não melhora: a exigência de CND para averbar não decai.

## 2. O que fazer agora

**Registro**: e-CAC (Cadastros → CNO) ou o portal/app do CNO, com gov.br do
titular ou certificado digital. Não há auditoria prévia — o responsável declara
e o CNO nasce na hora. O sistema **aceita data de início retroativa**; obra em
andamento é caso previsto [Likely].

**Declarar a data de início REAL.** Duas razões:

- Data falsa em cadastro fiscal previdenciário tem risco de caracterização
  penal quando reduz contribuição (CP, art. 337-A) [Likely].
- **Mentir custa mais caro que a verdade**: declarando o início como hoje, tudo
  que foi executado e pago antes fica **fora do período do CNO**, e essas notas
  perdem qualquer chance de reduzir a base. Encolhe-se justamente a janela em
  que as deduções valeriam, para escapar de uma multa administrativa menor.

A data de início define o período de apuração e, portanto, **quais notas e
declarações do prestador são elegíveis para abater a base** — por isso precisa
ser campo do produto, não informação que fica só no e-CAC.

## 3. Efeito sobre os pagamentos já feitos

São duas apurações e as respostas são **opostas**.

**IRPF / custo de aquisição: indiferente ao CNO. Nada se perdeu.** A condição
do art. 17 da IN SRF 84/2001 é documentação hábil e idônea **e** discriminação
na declaração [Certain quanto ao que a norma exige]. Nota no CPF dele, paga e
comprovada, é custo com ou sem CNO. Único efeito colateral: o texto da
discriminação costuma citar o CNO — enquanto não existir, aquele item sai sem a
menção. Não invalida o custo.

**Aferição INSS: há dano, parcialmente reversível — por enquanto.**

- Notas de serviço PJ já emitidas **sem CNO impresso** não abatem a base
  daquele CNO: não há vínculo entre elas e a obra.
- **O caminho de correção não é a nota — é a declaração do prestador.** A
  retificação dos eventos de **EFD-Reinf** da empreiteira (série R-2000),
  passando a informar o CNO, é o que vincula o valor ao CNO [Likely].
  Retificação é possível dentro do prazo decadencial.
- **Carta de correção não resolve**: em NF-e a CC-e não altera valores, datas
  nem destinatário; em NFS-e a regra é municipal (Florianópolis) e o caminho
  usual é cancelamento e reemissão, em janela curta. **Prazo do município não
  confirmado** [Guessing] — conferir no portal.

**Sequência prática, nesta ordem:** (1) registrar o CNO hoje com a data real;
(2) mandar o número à empreiteira **por escrito**; (3) exigir CNO impresso em
todas as notas dali para frente; (4) pedir reemissão/substituição onde o
município permitir e, no mínimo, **retificação da EFD-Reinf** de todas;
(5) só então liberar a próxima parcela. **A alavanca é o saldo a pagar** —
depois do último pagamento, é pedido de favor.

## 4. Consequência para o produto

**Recomendação: (b) — obra sem CNO é aceita, com pendência de consequência
fiscal explícita. Não bloquear.**

A formulação "anexa o CNO **se existir**" está errada no que ensina: "se
existir" é linguagem de campo opcional, e o CNO não é opcional — está **em
falta**. A diferença entre "opcional" e "em falta com prazo vencido" é a
diferença entre campo em branco e dívida aberta na tela.

**Por que não bloquear:** empurraria para a planilha exatamente a obra que está
acumulando documento hoje, e destruiria a apuração que **funciona sem CNO** (o
custo de aquisição no IRPF) para proteger a que **já está danificada e que o
app não consegue consertar** (a aferição).

**Por que não ignorar:** a consequência é impedimento de venda, e ela **piora a
cada nota nova**. Pendência que não cresce pode esperar; esta cresce.

### Texto de tela — cadastro da obra, ao escolher "ainda não tenho CNO"

> ⚠️ **A primeira frase foi corrigida pelo adendo de 2026-08-10** — [N] conta do
> vencimento. A redação vigente está no adendo, no fim deste arquivo.
>
> **Obra sem CNO — pendência aberta**
>
> O CNO é obrigatório e o prazo é de 30 dias contados do início da obra
> (Lei 8.212/91, art. 49). Esta obra começou em **[data de início]** — o
> registro está **[N] dias** em atraso.
>
> Enquanto não houver CNO:
> • as notas da empreiteira saem sem CNO impresso e **não abatem a aferição do
> INSS** desta obra — esse INSS vai ser cobrado de novo na regularização;
> • sem aferição fechada não sai a regularização; sem regularização a
> construção não é averbada na matrícula; **sem averbação o banco do comprador
> não financia e o cartório não lavra.**
>
> **O que não muda:** as notas no seu CPF continuam valendo como custo de
> aquisição no IRPF. Continue registrando aqui.
>
> **Próximo passo:** registre o CNO no e-CAC informando a **data real de início
> ([data])**, não a data de hoje. Declarar data posterior joga para fora da
> aferição tudo que você já pagou.
>
> [Já registrei — informar o CNO]

### Texto de tela — ao registrar NF de serviço PJ numa obra sem CNO

> **Nota de serviço em obra sem CNO**
>
> Esta nota **não vai abater a aferição do INSS** desta obra: sem CNO, a
> empreiteira não tem como imprimir o CNO na nota nem informá-lo na EFD-Reinf.
> O valor entra normalmente como **custo de aquisição no IRPF**.
>
> **Enquanto ainda houver parcelas a pagar**, exija da empreiteira: (a) CNO
> impresso nas próximas notas e (b) reemissão ou retificação da EFD-Reinf das
> notas já emitidas. Depois do último pagamento você perde a força para pedir.
>
> Salvar mesmo assim [ ] · Ver as [N] notas desta obra emitidas sem CNO
>
> ⚠️ **Corrigido pelo adendo de 2026-08-10**: "Salvar mesmo assim" é o RÓTULO DO
> BOTÃO de salvar, não uma caixa a marcar. Exigir marcação a cada nota seria
> bloqueio disfarçado, que este mesmo parecer rejeita.

> Este segundo texto é o gancho que faz agir: a tela de cadastro se vê uma vez
> na vida.

## 5. Retenção de 11% sem CNO

**A retenção não some, mas ela nunca foi o que amarra o valor à obra — o CNO
é.** A aferição do SERO procura a remuneração da mão de obra **declarada pelo
prestador vinculada àquele CNO** (EFD-Reinf/DCTFWeb). Sem CNO, o valor retido é
recolhido e aproveitado pela **empreiteira** como crédito dela. **O que se
perde é do Mateus**: ele pagou esse INSS dentro do preço e não recebe
abatimento na aferição.

Isso **reforça** o item 4 em vez de mudá-lo: não vira motivo para bloquear
(bloquear não recupera valor nenhum) e vira motivo para o produto **listar** as
notas emitidas na janela sem CNO — é exatamente a lista que a empreiteira
precisa receber para retificar.

### Incerteza estrutural registrada — pergunta nº 1 para o CRC

[Likely, precisa de confirmação humana] O `CLAUDE.md` fixa "só NF de serviço PJ
**com retenção de 11%** abate". O art. 31 da Lei 8.212/91 dirige a obrigação de
reter à "**empresa** contratante"; o dono de obra PF é equiparado a empresa
apenas "em relação a segurado que lhe presta serviço" (art. 15, parágrafo
único) — o que trata do prestador **PF**, não da retenção sobre nota de PJ.

Ou seja: é discutível que o Mateus, como tomador PF, esteja **obrigado** a
reter da empreiteira, e a dedução na aferição pode depender da **declaração
vinculada ao CNO**, com ou sem retenção. Isso decide se `retencao_11 = não` é
**fatal** ou apenas **sinal** — e hoje o app trata como fatal.

**Não mudar o código com base neste parágrafo.** É a pergunta mais barata de
fazer e mais cara de errar do projeto.

## Ações fora do software

1. Registrar o CNO no e-CAC com a **data real de início**.
2. Mandar o número à empreiteira **por escrito**.
3. Exigir CNO impresso e retificação da EFD-Reinf das notas anteriores
   **antes de liberar a próxima parcela**.
4. Levar ao CRC a pergunta do item 5.

---

## Adendo de 2026-08-10 — como se conta o atraso e o que é "Salvar mesmo assim"

Provocado pelo `lead-engineer` no Gate 1 do CONTAI-003, ao encontrar duas
leituras possíveis entre este parecer e o mock aprovado. Emitido pelo agente
`contador`; transcrição.

### 1. [N] dias em atraso conta do VENCIMENTO, não do início [Certain]

O prazo é de 30 dias contados do início (Lei 8.212/91, art. 49, II). Estar "em
atraso" só existe **depois** de vencido o prazo. Obra iniciada em 15/03/2026,
com hoje em 10/08/2026: vencimento 14/04/2026 e **118 dias de atraso** — não
148. O mock somava o prazo ao atraso e afirmava, na mesma frase, "o prazo é de
30 dias" e "148 dias em atraso"; é contradição que o leitor resolve
subtraindo, e número inflado em tela fiscal contamina a confiança nas outras.

Redação vigente do primeiro parágrafo, nos três estados:

> **Em atraso** — "O CNO é obrigatório e o prazo é de 30 dias contados do
> início da obra (Lei 8.212/91, art. 49). Esta obra começou em [início] — o
> prazo venceu em [vencimento] e o registro está **[N] dias em atraso**."
>
> **Vencendo hoje** — "… Esta obra começou em [início] — o prazo vence hoje."
>
> **Dentro do prazo** — "… Esta obra começou em [início] — o prazo vence em
> [vencimento], faltam [N] dias. Registre antes da primeira nota da
> empreiteira."
>
> **Sem data de início** — não renderizar frase de prazo nenhuma; pedir a data.

**O bloco de consequências é idêntico nos três estados e sempre visível.** O
dano à aferição não começa no dia 31: nota de serviço emitida no dia 3 sem CNO
já não abate. O prazo governa a multa, que é a menor das três consequências.

### 2. "Salvar mesmo assim" é rótulo de botão, não caixa obrigatória [Certain]

Marcação obrigatória a cada NF de serviço é **bloqueio disfarçado** — atrito
recorrente sem alternativa a oferecer, na obra que acumula documento hoje. Vira
carimbo em duas semanas, e carimbo fabrica a confiança falsa de "eu li". O
efeito de aviso vem do texto, que continua acima do botão; o botão nomeia o que
está sendo feito.

**Nada disto muda a decisão (b)**: obra sem CNO é aceita, com pendência de
consequência fiscal explícita, e nunca bloqueada.
