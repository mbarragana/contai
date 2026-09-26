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
1. [x] Ao anexar o PDF e responder "destacada" em `/adicionar/documento`
   (tela larga), a captura chama `POST /api/sugerir-retencao`; se vier
   sugestão, o primeiro `FormularioDeLinha` nasce com `rotuloLiteral` e
   `valorCentavos` preenchidos — os quatro campos de classificação fiscal
   continuam sempre vazios.
2. [x] A sugestão é visualmente identificada como sugestão (mesma UX já usada
   para os demais campos que a extração de documento preenche hoje) e é
   sempre editável/substituível antes de salvar — nenhum valor sugerido é
   gravado sem o "Salvar" do documento.
3. [x] Sem sugestão (nota sem padrão reconhecido pelo `CONTAI-054`, ou
   scan/foto sem texto embutido), a experiência é idêntica à do `CONTAI-053`
   sozinho — formulário nasce vazio, sem regressão.
4. [x] Falha da chamada a `/api/sugerir-retencao` (rede, timeout) nunca
   bloqueia o registro — a captura segue com o formulário vazio, mesma
   disciplina de "sugestão que falha não impede o Salvar" já aplicada à
   extração de documento hoje.
5. [x] O `rotuloLiteral` sugerido aparece em destaque visual na tela de
   confirmação (não só o valor pré-preenchido, discreto) — recomendação dos
   dois revisores do Gate 2 do `CONTAI-054`: o parser pode sugerir uma linha
   de desconto (não só retenção) se a aritmética fechar por coincidência, e
   o rótulo visível é a única defesa contra aceitar sem olhar.

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

✅ **Entregue em 2026-09-25.** 5/5 critérios PASS — Gate 4 (`po`). Gate 2
técnico (`cto-obra`) achou um bug de borda real: a sincronização da
sugestão no `FormularioDeLinha` usava duas condições diferentes para
"campo vazio" (uma para o texto exibido, outra para o valor em centavos),
e um texto parcialmente digitado como "1," (que `parseValorInput` rejeita)
fazia o valor herdar a sugestão em silêncio enquanto a tela mostrava outra
coisa — corrigido com uma condição única, provado por um E2E que atrasa a
resposta da rota de propósito para expor a janela exata do bug. Gate 2
fiscal (`contador`) aprovou sem pendência. Último ticket do backlog 71
(retenção) — **fila de implementação volta a vazia**. 1085 testes
unitários + 313 E2E verdes, sem migration.
