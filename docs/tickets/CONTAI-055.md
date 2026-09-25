# CONTAI-055 Sugestão de retenção pré-preenche o repeater da captura

## Tipo e Prioridade
feature — P1 — fricção de processo. Integração pura de dois tickets já
prontos (`CONTAI-053` + `CONTAI-054`); nenhuma regra fiscal nova.

## Dor de Origem
`docs/backlog/71-2026-09-25-retencao-na-captura-e-extracao-deterministica.md`,
US-B (metade de UI). Fatiado do `CONTAI-054` original pelo `cto-obra` no
Gate de viabilidade: a lib/rota de sugestão (`CONTAI-054`) é isolável e
testável sozinha, mas a superfície onde a sugestão aparece só existe depois
que o `CONTAI-053` cria o repeater na captura — construir uma superfície
provisória em `/documento/[id]` "para testar antes" seria feature nova
disfarçada de atalho, não uma antecipação real.

## User Story
Como dono da obra que respondeu "destacada" numa nota com padrão
reconhecível, quero que o primeiro formulário de linha do repeater (trazido
pelo `CONTAI-053`) já venha com rótulo e valor preenchidos pela leitura
automática (`CONTAI-054`), para eu só confirmar em vez de digitar.

## Critérios de Aceite
1. [ ] Ao anexar o PDF e responder "destacada" em `/adicionar/documento`
   (tela larga), a captura chama `POST /api/sugerir-retencao`; se vier
   sugestão, o primeiro `FormularioDeLinha` nasce com `rotuloLiteral` e
   `valorCentavos` preenchidos — os quatro campos de classificação fiscal
   continuam sempre vazios.
2. [ ] A sugestão é visualmente identificada como sugestão (mesma UX já usada
   para os demais campos que a extração de documento preenche hoje) e é
   sempre editável/substituível antes de salvar — nenhum valor sugerido é
   gravado sem o "Salvar" do documento.
3. [ ] Sem sugestão (nota sem padrão reconhecido pelo `CONTAI-054`, ou
   scan/foto sem texto embutido), a experiência é idêntica à do `CONTAI-053`
   sozinho — formulário nasce vazio, sem regressão.
4. [ ] Falha da chamada a `/api/sugerir-retencao` (rede, timeout) nunca
   bloqueia o registro — a captura segue com o formulário vazio, mesma
   disciplina de "sugestão que falha não impede o Salvar" já aplicada à
   extração de documento hoje.

## Out of Scope
- Qualquer coisa em `/documento/[id]` — documentos legados não ganham
  sugestão retroativa.
- Tudo que já é escopo do `CONTAI-053` (o repeater em si) ou do `CONTAI-054`
  (o parser/rota) — este ticket só liga os dois.

## Gate Fiscal (Contador)
Reafirma, sem regra nova: os quatro campos de classificação fiscal
(`composicao`, `tributo`, `e_desconto_efetivo`, `quem_recolhe`) nunca vêm da
extração, herdado integralmente do Gate Fiscal do `CONTAI-054`. Nenhum
critério deste ticket pode reabrir essa fronteira.

## Viabilidade (CTO)
Complexidade S — é só integração dos dois já prontos: chamar a rota no
momento em que o gate vira "destacada", e passar o resultado como valor
inicial do `FormularioDeLinha` (que o `CONTAI-053` já deve deixar preparado
para receber um `inicial?` opcional).

## Dependências
- Bloqueado por: `CONTAI-053` (precisa do repeater existir) e `CONTAI-054`
  (precisa da rota existir).
- Bloqueia: nenhum.

## Perguntas Abertas
- Design: nível 2, pequeno — o estado "campo pré-preenchido por sugestão"
  pode entrar como uma variação a mais no mesmo `/design` do `CONTAI-053`,
  em vez de um spec próprio. Decidir no momento do `/design` do `053`.

## Cenário e checagem final
**Captura**, mesma variante de tela larga do `CONTAI-053`. **Veredito:
APROVADO**, bloqueado até `CONTAI-053` e `CONTAI-054` estarem prontos.
