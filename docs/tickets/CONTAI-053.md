# CONTAI-053 Repeater de linha de retenção também na captura, em tela larga

## Tipo e Prioridade
feature — P1 — fricção de processo. Não é obrigação fiscal isolada: a
disciplina que protege as três metas (documento hábil, discriminação anual,
aferição SERO) já está fechada pelo `CONTAI-038`. Aqui só muda ONDE o
formulário aparece.

## Dor de Origem
`docs/backlog/71-2026-09-25-retencao-na-captura-e-extracao-deterministica.md`,
dor 1: *"quando destacada, deve ter um campo para preenchimento tudo junto na
adição do registro, inclusive."* — o Mateus já sabe, no momento da captura,
que a nota tem retenção e qual o valor; ter que voltar depois à tela de
gestão para completar o que já leu na hora é fricção de processo.

## User Story
Como dono da obra registrando uma NF de serviço em casa, sentado, no desktop
(cenário principal de gestão — o `CONTAI-047` já deu à captura uma casca
larga de ~880px com rail lateral), quando respondo o gate "destacada" em
`/adicionar/documento`, quero preencher as linhas de retenção no mesmo
formulário, sem precisar abrir `/documento/[id]` depois, para fechar o
registro de uma vez só enquanto tenho a nota na mão.

## Critérios de Aceite
1. [ ] Proposta de design nível 2 (spec + ASCII do bloco — reuso de
   componente já validado, não fluxo novo) descrita em
   `design/mocks/CONTAI-053.md`, cobrindo: onde o repeater entra na grade de
   `design/mocks/captura-no-desktop-v1.md`, os 4 estados do bloco antes do
   documento existir, a variante de `DICA_GATE_DESTACADA` e da dica final da
   página (hoje dizem "você preenche depois", o que fica falso quando o
   repeater já está visível ali), e o texto da mensagem de resultado parcial
   do critério 3.
2. [ ] Em tela larga (≥880px), ao responder o gate `retencao_na_nota =
   "destacada"` em `/adicionar/documento`, o **formulário de linha**
   (`FormularioDeLinha`, extraído de `app/_components/retencao.tsx` — mesma
   validação e mesmos textos de `lib/fiscal/retencao.ts` usados na gestão)
   aparece na própria tela de captura. **Não é o `BlocoRetencao` inteiro
   embutido** (ele exige `documento.id` já persistido, incompatível com o
   momento da captura) — é o mesmo formulário, reusado, sem reimplementação
   paralela de validação/textos.
3. [ ] As linhas preenchidas na captura são gravadas em `documento_retencao`
   só **depois** que o documento é criado (mesmo padrão não-transacional já
   usado para vínculos, `criarVinculos`). Se a gravação de alguma linha
   falhar, o documento salva normalmente e a confirmação diz quantas linhas
   entraram e quantas não — nunca esconde a falha.
4. [ ] Documento salvo em tela larga com todas as linhas completas (inclusive
   `quem_recolhe` respondido): ao abrir `/documento/[id]` depois, as linhas
   aparecem gravadas, idênticas às que resultariam de digitação na tela de
   gestão, sem pendência `retencao_sem_recolhedor` aberta.
5. [ ] Documento salvo com repeater incompleto ou vazio: salva normalmente; a
   pendência correspondente fica visível em `/documento/[id]`; nunca é lido
   como "sem retenção" (mesma disciplina dos critérios 2 e 5 do `CONTAI-038`).
6. [ ] Em tela estreita (<880px), o formulário de retenção **não** aparece em
   `/adicionar/documento` — comportamento idêntico ao de hoje (gate na
   captura, repeater só na gestão). E2E cobre a ausência como regressão.
7. [ ] Nenhuma linha nasce com `composicao`, `tributo`, `e_desconto_efetivo`
   ou `quem_recolhe` pré-marcados/pré-selecionados, em nenhuma largura —
   mesma proibição de default em campo fiscal de
   `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` (§0, §2) e do
   critério 3 do `CONTAI-038`.
8. [ ] Gate `retencao_na_nota = "nenhuma"` (ou ainda não respondido): nenhum
   campo de retenção aparece na captura, em qualquer largura de tela.
9. [ ] Nenhuma extração automática (fora de escopo deste ticket — ver
   `CONTAI-054`/`CONTAI-055`) preenche `composicao`, `tributo`,
   `e_desconto_efetivo` ou `quem_recolhe` — critério preventivo, para não
   nascer lacuna quando a sugestão chegar.

## Out of Scope
- Extração automática sugerindo `rotulo_literal`/`valor` — `CONTAI-054`/`055`.
- Extração sugerindo a própria resposta do gate `retencao_na_nota` — vetado
  pelo `contador` no relato de origem, não reaberto aqui.
- "Excedente da nota" fechar sozinho quando a retenção é recolhida pela
  empresa — fora de escopo por instrução do relato de origem.
- Qualquer mudança de comportamento em tela estreita — Teste do Canteiro
  continua valendo integralmente para `/adicionar/documento` em <880px.
- Generalização de layout de NFS-e para outros municípios — não é tema deste
  ticket (é UI de captura, não extração).

## Gate Fiscal (Contador)
Toca regra fiscal — reposicionamento de UI da captura já normatizada em
`CONTAI-038`, herda toda a doutrina de `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`.

- Custo de aquisição e base SERO calculados a partir de `documento_retencao`
  são **idênticos** entre `/adicionar/documento` (≥880px) e `/documento/[id]`
  — mesma tabela, mesmo `lib/fiscal/resumo.ts`, nenhuma lógica paralela nova.
  Custo continua `= valor_bruto_nota`, regime de caixa (parecer §6); SERO
  nunca lê nenhuma linha de retenção (parecer §2, `CONTAI-038` critério 13).
- Se `composicao` ∈ {`combinado_nao_aberto`, `nao_sei`} → sistema nunca
  decompõe por tributo, em nenhuma tela, inclusive a nova (parecer ADENDO
  A.1) — herdado por reuso do mesmo componente/textos, não reimplementado.
- Se o repeater fica incompleto ao salvar (linha sem `composicao`, ou
  `e_desconto_efetivo=sim` sem `quem_recolhe`) → essa linha não é gravada; o
  documento salva com `gate=destacada` e as linhas incompletas ficam fora; a
  lacuna vira pendência visível em `/documento/[id]` — nunca lida como "sem
  retenção" (`CONTAI-038` critérios 2 e 5).
- Se a extração automática (`CONTAI-054`/`055`) algum dia tocar esta tela →
  nunca preenche os quatro campos de classificação fiscal, em nenhuma
  largura; só `rotulo_literal`/`valor` podem vir sugeridos (`CONTAI-038`
  critério 14, parecer §3/§4).
- **Revalidar** (verbo exato): que a UI de `/adicionar/documento` reusa o
  mesmo `FormularioDeLinha` da gestão — não uma reimplementação paralela.
  Drift de componente é o vetor mais provável de a proibição de decompor
  "combinado" ou a proibição de default vazar numa tela e sobreviver na
  outra.
- **Achado não-fiscal do contador, corrigido aqui**: a coluna real em
  `documento_retencao` é `valor numeric(14,2)` (reais), não
  `valor_centavos`. O domínio TS usa `valorCentavos: number` (inteiro,
  convertido por `centavosParaNumeric` em `lib/data.ts`) — o ticket cita
  `EntradaLinhaRetencao.valorCentavos` (TS) e `documento_retencao.valor`
  (banco), nunca "valor_centavos" como nome de coluna.

## Pre-mortem
1. **Repeater na captura cresce até apagar a diferença entre "captura" e
   "gestão"**, e alguém decide encolher o Teste do Canteiro também na tela
   estreita "para manter consistência" — o mesmo erro de 2026-08-17/18,
   invertido. Mitigação: critério 6 trava a ausência do repeater abaixo do
   piso via teste automatizado.
2. **"Repeater no mesmo formulário" vira desculpa para pré-preencher
   `composicao`/`tributo`/`quem_recolhe`** com o valor "mais comum" e
   acelerar a captura — default em campo fiscal pela porta da UI nova.
   Mitigação: critério 7 amarra ao parecer e ao critério 3 já validado do
   `CONTAI-038`.
3. **Reimplementação paralela em vez de reuso** — o `lead-engineer` embute o
   `BlocoRetencao` inteiro (que exige `documento.id`) e resolve criando o
   documento antes do "Salvar registro", quebrando o invariante "quem afirma
   é o Salvar" (documento órfão a cada captura abandonada). Mitigação:
   critério 2 já nasce corrigido pelo achado do `cto-obra`, citando a
   extração de `FormularioDeLinha` como a forma certa.
4. **Confirmação de linhas que falharam ao gravar fica silenciosa** — o
   documento salva, mas o usuário não percebe que 1 de 3 linhas não entrou,
   e a pendência só aparece dias depois na revisão anual. Mitigação:
   critério 3 exige a mensagem explícita de quantas entraram/não entraram.

## Viabilidade (CTO)
- **Modelo de dados**: zero mudança. Reuso integral de
  `documento.retencao_na_nota` + `documento_retencao` (migration `0017`). RLS
  já deriva o dono de `documento.user_id` — INSERT logo após `criarDocumento`
  passa sem ajuste.
- **Arquivos e complexidade — M**:
  - `app/_components/retencao.tsx` — separar `FormularioDeLinha`
    (persistência vira prop `onAdicionar`, não `documentoId` fixo); precisa
    de um tipo `LinhaLocal` mínimo (sem `id`, sem "Salvar resposta" imediato).
  - `app/(captura)/adicionar/documento/page.tsx` — estado `linhasPendentes`,
    render condicionado a tela larga + gate "destacada"; loop de insert após
    `criarDocumento`; `Fase.salvo` ganha contagem de falhas; zera
    `linhasPendentes` se o gate ou o tipo do documento mudar.
  - `lib/data.ts` — `criarLinhasRetencao(documentoId, entradas[])`, um único
    `.insert([...])`.
  - `app/_components/registrado.tsx` — aviso de linhas não gravadas.
  - `e2e/retencao.spec.ts` (regressão da gestão) + caso novo ≥880px + caso
    <375px provando ausência do repeater.
- **Tabela nova: não.** Sem migration, sem GRANT, sem entrada em
  `e2e/privilegios.spec.ts`.
- **Dívidas criadas**: documento + linhas em dois statements sem transação
  (mesma classe de dívida dos vínculos — RPC de conserto, não agora);
  `LinhaGravada` (gestão) e `LinhaLocal` (captura) são duas renderizações da
  mesma linha — aceitável hoje, mas acoplam se o layout do detalhe mudar.

## Dependências
- Bloqueado por: nenhum.
- Bloqueia: `CONTAI-055` (a UI que a sugestão do `CONTAI-054` preenche é este
  repeater).

## Perguntas Abertas
- Piso de 880px é o mesmo do `CONTAI-047` — assumido que sim, na ausência de
  objeção.
- Texto exato das duas dicas ("você preenche depois") e da mensagem de
  resultado parcial — decidir no `/design`, não aqui.

## Cenário e checagem final
**Captura** — variante de tela larga do mesmo momento de registro no ato
(não é gestão). Abaixo de 880px nada muda: Teste do Canteiro continua
valendo sem alteração, retenção continua "depois, sentado". Serve à meta 1
(nenhum pagamento sem documento hábil, com a pendência de retenção como
cidadã de primeira classe desde a captura) sem afrouxar a disciplina fiscal.
**Veredito: APROVADO**, com o Gate 0 (design nível 2) pendente antes do
Gate 1.
