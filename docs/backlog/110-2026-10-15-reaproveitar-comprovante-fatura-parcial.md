# Relato — 2026-10-15 — mesmo comprovante subido 4+ vezes numa fatura paga parcial

## Origem (relato)

Caso real, vivido nesta sessão: uma fatura de cartão em 3 desembolsos
parciais (R$15.621,25 + R$8.780,00 + R$3.581,94) gerou 7 `pagamento`s pra
favorecidos diferentes (Ilhamix Concreto; Casas Da Água Mat. — 3 lojas). O
Mateus usou o fluxo **"Fatura paga · parcial"**
(`/fatura/[id]/parcial` → `/fatura/[id]/alocar`), que não tem campo de
comprovante nenhum. O comprovante real (um PIX/transferência cobrindo a
fatura inteira) precisou ser anexado DEPOIS, um a um, em cada `pagamento`
individual, via `/pagamento/[id]/comprovante` (CONTAI-061).

> "temos que adicionar este fluxo agora para eu não precisar subir
> novamente o mesmo comprovante de pagamento 4 vezes e poder só vincular
> ao que acabei de subir."

## Dor extraída

O mesmo arquivo de comprovante precisa ser re-upload manual N vezes (uma
por `pagamento` gerado da fatura/desembolso), só porque:
(a) a tela de alocação parcial (`/fatura/[id]/parcial`,
`/fatura/[id]/alocar`) não captura anexo nenhum, e
(b) a tela de anexo retroativo (`/pagamento/[id]/comprovante`, CONTAI-061)
só oferece upload de arquivo novo — nenhuma tela de
confirmação/compromisso/comprovante hoje oferece "escolher anexo já
existente" (confirmado por leitura de código:
`app/(gestao)/compromisso/[id]/confirmar/page.tsx:721-728`,
`app/(gestao)/pagamento/[id]/comprovante/page.tsx:355-362`,
`app/(gestao)/fatura/[id]/confirmar/page.tsx:374-398` — só `CampoArquivo`).

Não é dor hipotética de arquitetura: é fricção de processo repetida e
mensurável (4+ uploads redundantes do mesmo arquivo numa única sessão de
conciliação).

## Precedente técnico e dívida já nomeada — não repetir a investigação

1. **Já existe dívida registrada para a causa-raiz do lado desembolso**:
   `docs/tickets/CONTAI-061.md`, seção "Out of Scope" — *"`fatura_
   desembolso.comprovante_path` tem a mesma lacuna — fica fora deste
   ticket, registrada como dívida nova **D56-b**"*. Este relato é a mesma
   lacuna (fatura/desembolso sem campo de comprovante) chegando como dor
   real, com volume concreto, não hipótese.
2. **O padrão de reaproveitar anexo já existe no produto**, mas restrito a
   outros anexos do MESMO `documento`: `ChipsDeAnexoExistente`
   (`app/_components/corrigir.tsx:459-507`), usado em `corrigir/numero`,
   `corrigir/valor`, `corrigir/retencao`, `documento-novo`
   (CONTAI-086/087/088). Nunca foi usado com fonte "outro registro"
   (outro `pagamento`).
3. **Sem restrição de modelo de dados impedindo reaproveitar**:
   `pagamento.comprovante_path` não tem `unique`; o trigger
   `pagamento_comprovante_path_imutavel`
   (`supabase/migrations/0019...sql:70-89`) só impede REESCREVER um path
   já preenchido, nunca impede o MESMO path em `pagamento`s diferentes. A
   própria RPC de confirmação de fatura (`0013_fatura.sql` e evoluções em
   0020/0021/0024) já copia deliberadamente o mesmo `comprovante_path` pra
   N `pagamento`s quando a fatura é paga **integral** — comentário no
   código chama isso de "denormalização deliberada, não bug". A lacuna é
   só no caminho **parcial**.
4. **Parecer fiscal já validou o princípio, em contexto vizinho**
   (desembolso de terreno): `docs/tickets/CONTAI-027.md:404-427` §1 —
   "dupla contagem por anexo é impossível por construção... anexar o
   mesmo comprovante a dois lançamentos não infla custo nenhum". Não há
   risco fiscal em reaproveitar o mesmo arquivo entre `pagamento`s.
5. **Contorno manual que funciona hoje, sem elegância**: baixar o
   comprovante já anexado e subir de novo em cada tela — duplica o objeto
   no Storage (`crypto.randomUUID()` novo por upload), mas não viola nada.

## Filtro das três metas

Não é obrigação fiscal nova (item 4 acima já afasta risco de dupla
contagem) — então não é P0. Mas também não é conveniência pura: alimenta a
**meta 1** (nenhum pagamento sem documento hábil) de forma indireta e real
— quanto mais upload redundante uma conciliação de fatura exige, maior a
chance de o Mateus pular o anexo em algum dos `pagamento`s "de trás" só
pelo cansaço do fluxo, deixando custo em risco no IR sem necessidade. É
fricção de processo com efeito sobre comportamento de captura, não mero
capricho de UX. **P1.**

(Segunda vez que esse gap aparece na mesma sessão — a primeira foi um caso
isolado resolvido subindo de novo manualmente; esta é pedido explícito de
correção, com volume concreto de 7 `pagamento`s numa fatura só.)

## User story

**Como** o Mateus, conciliando em casa, sentado, uma fatura de cartão paga
em parcelas/desembolsos que geram vários `pagamento`s a favorecidos
diferentes, **quando** eu já tenho o comprovante real daquele desembolso
(um PIX/transferência cobrindo o valor todo) e preciso anexá-lo a cada
`pagamento` gerado dali, **eu quero** subir o arquivo uma única vez e
vinculá-lo aos demais `pagamento`s do mesmo desembolso/fatura sem
reenviar o arquivo, **para que** a confirmação de uma fatura parcial com N
favorecidos não custe N uploads do mesmo comprovante.

### Critérios de aceite

1. Ao anexar comprovante a um `pagamento` que pertence a um
   `fatura_desembolso`/`fatura` com outro(s) `pagamento`(s) irmão(s) **já
   com `comprovante_path` preenchido**, a tela oferece reaproveitar esse
   anexo (mesmo padrão visual do `ChipsDeAnexoExistente`), sem exigir novo
   upload.
2. Confirmar o reaproveitamento grava, no `pagamento` atual, o **mesmo**
   `comprovante_path` do irmão escolhido — verificável por dois ou mais
   `pagamento`s da mesma fatura apontando para idêntico
   `comprovante_path` no banco, sem gerar objeto novo no Storage.
3. Quando nenhum `pagamento` irmão da mesma fatura/desembolso tem
   comprovante ainda, a tela comporta-se como hoje (só upload) — sem
   regressão no caminho já existente.
4. O trigger `pagamento_comprovante_path_imutavel` continua valendo: o
   reaproveitamento só é possível enquanto o `comprovante_path` do
   `pagamento` de destino está `null`; tentativa de reaproveitar sobre um
   `pagamento` que já tem comprovante falha explicitamente, igual já vale
   para upload novo (CONTAI-061, critério 5).
5. A ficha **Pagamentos Efetuados** e a discriminação anual continuam
   listando cada `pagamento` como linha própria mesmo quando dois ou mais
   compartilham o mesmo arquivo de comprovante — nenhuma saída do sistema
   soma ou deduplica valor por causa do anexo compartilhado (ancorado no
   parecer `CONTAI-027` §1, já citado).
6. O rastro de revisão (tabela `revisao`, mesmo mecanismo do CONTAI-061)
   registra o reaproveitamento como o que ele é — anexo chegou e foi
   vinculado — identificável como originado de outro `pagamento`, não
   como upload novo.

## Fora de escopo (não decidido aqui)

- **Qual é a solução arquitetural certa** — anexar no `fatura_desembolso`
  e propagar automaticamente pros N `pagamento`s gerados dali (fecha
  D56-b por completo, resolve a causa-raiz do caminho "parcial"), ou
  generalizar o `ChipsDeAnexoExistente` pra oferecer "outros `pagamento`s
  da mesma fatura/desembolso com comprovante" como fonte nova (resolve o
  efeito, sem mudar o fluxo de alocação), ou as duas. Decisão de
  dimensionamento e desenho é do `cto-obra` no `/tickets-req` — não fecho
  isso aqui para não amarrar a solução antes da hora.
- **Generalizar ainda mais** (reaproveitar qualquer anexo recente do
  acervo da obra, não só da mesma fatura/desembolso) — fica para o
  `cto-obra` avaliar se compensa; o escopo mínimo deste relato (mesma
  fatura/desembolso) não deve ficar sem solução esperando a generalização
  maior.
- **Export do comprovante compartilhado pro Google Drive** (CONTAI-011)
  não muda — é o mesmo arquivo, exportado uma vez; nenhum ajuste de
  escopo necessário aí.

## Perguntas abertas (no máximo 3)

1. Quando há **mais de um** `pagamento` irmão já com comprovante na mesma
   fatura/desembolso (ex.: dois arquivos diferentes, upload parcial feito
   em momentos diferentes), a tela mostra todos como opção e o Mateus
   escolhe, ou assume que só pode haver um comprovante "oficial" por
   fatura e sinaliza divergência? Decide se o componente precisa de lista
   ou só de "o" anexo da fatura.
2. Isso deve valer também para `/fatura/[id]/parcial` →
   `/fatura/[id]/alocar` diretamente (anexar ANTES de gerar os N
   `pagamento`s, fechando D56-b por completo) ou só retroativamente em
   `/pagamento/[id]/comprovante` (o caminho que o relato descreveu)? Isso
   é exatamente a pergunta de arquitetura que fica pro `cto-obra`, mas
   decide se o ticket cobre uma tela ou duas.
3. ✅ Nenhuma — as duas perguntas acima bastam; não forço uma terceira.

## Respostas do Mateus, 2026-10-15 — fecham as 2 perguntas acima

1. **Múltiplos irmãos com comprovantes diferentes: listar todos pra
   escolher.** Não assumir "um oficial" — mostrar um chip por anexo
   distinto já usado por outro pagamento da mesma fatura, mesmo padrão de
   lista do `ChipsDeAnexoExistente`.
2. **Cobrir as duas pontas.** O fix fecha `D56-b` na raiz (anexar
   comprovante já em `/fatura/[id]/parcial`→`/alocar`, propagando pros N
   `pagamento`s gerados) **e** resolve o caso retroativo (reaproveitar
   entre `pagamento`s já existentes via `/pagamento/[id]/comprovante`).
   Escopo de duas telas, não uma.

Não reabrir essas duas no `/tickets-req`.

## Próximo passo

`/tickets-req`, com consulta obrigatória ao `cto-obra` sobre qual das duas
abordagens (ou ambas) resolve D56-b + esta dor com menor dimensionamento,
e confirmação do `contador` de que o texto de tela do reaproveitamento (se
houver) não inventa afirmação fiscal nova — só reaproveita o que já foi
validado no parecer do CONTAI-027.
