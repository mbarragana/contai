# CONTAI-033 — spec do mock
Nível: **1** (HTML navegável) — diálogo de confirmação **sem precedente** (nenhum modal existe hoje em
nenhuma tela do app) + rota nova obrigatória (anexar depois, com repergunta em branco). As duas exigem
julgar densidade/leitura em 375px, não só ler texto. Cenário: **misto** — s1 é captura (canteiro), s2–s4
são gestão (em casa). Arquivo: `CONTAI-033.html`. Telas: 5 (4 ★ + 1 ASCII).

## Correção de local — antes de qualquer tela
O card agregado NÃO entra em `app/obras/[id]/page.tsx` (essa rota é o formulário **"Dados da obra"**, sem
`ResumoObra` nenhum). A home/resumo de verdade, com o `CardPagoSemComprovante` irmão, é **`app/page.tsx`**
+ `app/_components/pago-sem-comprovante.tsx`, alimentados por `lib/fiscal/resumo.ts`. O card novo segue
para lá, mesmo padrão visual (`Card className="border-red"`, chip, valor mono, contagem, `Consequencia`,
`BotaoLink`).

## Telas e estados
- **s0** (ASCII): fluxo completo, do formulário sem arquivo até a repergunta baixar a pendência
- **s1 ★** `/adicionar/documento`, captura — formulário preenchido (NF de serviço), anexo vazio.
  **Interativa**: `input[type=file]` real. Clique em "Salvar registro" **sem arquivo** abre o diálogo
  (overlay, sem navegação — canteiro continua 1 tela); **com** arquivo grava direto, comportamento intocado.
- **s2 ★** `/documento/[id]`, gestão — chip **"Nota sem arquivo"** (vermelho), pendência §A.7.2, e duas
  linhas que tornam as guardas 1/2 visíveis, botão "Anexar o arquivo agora"
- **s3 ★** `/documento/[id]/anexar`, gestão — rota **nova**. Interativa: só o campo de arquivo até ele
  escolher um arquivo real; escolher revela a repergunta (CPF + retenção) **em branco**, mesmo já
  respondida no registro original. Botão desabilitado até as duas responderem
- **s4 ★** Home (`app/page.tsx`) — card agregado "Documentos sem arquivo", mesmo componente/visual do
  `CardPagoSemComprovante`, e a linha do veto ao relatório anual (crit. 16, reaproveitado 1:1)

## Textos literais — COPIADOS do brief, fonte: parecer 2026-08-23-anexo-no-desembolso-do-terreno.md, ADENDO 1 §A.7.1–A.7.3
- Diálogo (s1): "Salvar sem o arquivo da nota? / Os dados ficam guardados e servem para cobrar a nota do
  emitente enquanto você ainda tem parcela a liberar. / Sem o arquivo, esta nota não sustenta custo nenhum
  e não abate a aferição do INSS desta obra — o abatimento depende da nota de serviço com a retenção de
  11%, não da lembrança dela. / [ Salvar e cobrar a nota ] [ Anexar agora ]"
- Chip + pendência (s2, s4): "Nota sem arquivo. / Você registrou os dados da nota, mas o arquivo não está
  no acervo. Enquanto não estiver, ela não entra no custo comprovável e não abate a aferição do INSS. /
  Peça o arquivo ao emitente agora: nota que ficou só na conversa desaparece com a conversa, e o próximo
  pagamento é a última hora em que você tem como cobrá-la."
- Repergunta (s3): "Agora com a nota na mão, confirme o que está impresso nela. / Você respondeu de
  memória quando registrou. As perguntas voltam porque agora há papel para conferir — e é o papel que a
  fiscalização lê, não o app."

## Decisões de design
1. **Diálogo é overlay dentro da mesma tela**, não navegação nova — a captura continua em 1 tela/3 passos.
   "Anexar agora" fecha o diálogo e devolve o foco ao campo do anexo, sem perder nada já digitado.
2. **s3 não reusa nenhuma marca da resposta antiga.** As opções nascem sem `.on` mesmo com CPF/retenção já
   gravados no banco — é a leitura literal da guarda 3 ("nunca herdadas").
3. **As duas linhas de guarda em s2** ("Custo confirmado: não, até o arquivo chegar" / "Abate no INSS: não,
   até o arquivo chegar") são **texto meu**, não do parecer — servem para as guardas 1 e 2 aparecerem em
   tela, não só existirem no banco. Ver pergunta 2.
4. **Não inventei um selo para "respondido de memória"** na linha de CPF/retenção de s2 além da frase
   neutra que já está no mock ("respondidas — sem o papel para conferir"): qualquer redação mais forte
   seria consequência fiscal nova, fora do texto adjudicado.
5. **Relatório anual**: reaproveita o veto do crit. 16 do CONTAI-025/036 tal como está — não desenhei tela
   nova, é o mesmo padrão já aprovado, só a linha de texto no banner de s4.

## Critério de aceite guarda-chuva — default fiscal
Nos três campos novos deste ticket — arquivo do documento (s1), e CPF/retenção na **repergunta** (s3) —
vazio pergunta, preenchido afirma, **sem default algum**: sem arquivo o botão nunca grava em silêncio (abre
o diálogo em vez de bloquear); em s3 o botão de confirmar fica desabilitado até as duas perguntas terem
resposta explícita do dedo do Mateus **nesta sessão** — nenhuma resposta anterior é pré-marcada, mesmo que
a base já tenha um valor gravado para este documento.

## Perguntas em aberto — nenhuma delas eu decido sozinho
1. **`po`/`contador`** — cor do chip "Nota sem arquivo": propus **vermelho**, por paridade com "Pago sem
   comprovante" (mesma consequência: fora do custo confirmado + não abate INSS). Confirmar antes do
   `/develop` — cor de pendência carrega peso fiscal desde a D39.
2. **`contador`** — as duas linhas de guarda em s2 (decisão 3 acima): a redação é minha, precisa de
   revisão antes de virar texto de produção.
3. **`po`/`cto-obra`** — o CTA "Ver os documentos" do card agregado (s4) não tem alvo hoje: não existe
   lista de documentos no app (só a lista de desembolsos do terreno). Precisa nascer neste ticket, ou o
   botão aponta para o primeiro documento quando a contagem é 1 e fica sem ação quando é mais de 1?
4. **`cto-obra`** — status do documento salvo sem arquivo (D52): confirmar que não é `quarentena`
   reaproveitado nem `status_documento` novo sem migration — nota de engenharia do parecer §A.3, decisão é
   do `cto-obra`, não minha.
