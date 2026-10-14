# CONTAI-096 Visibilidade "total": leitura de pagamento já confirmado

## Tipo e Prioridade
feature — P1 — completa a opção "total" de visibilidade fechada pelo Mateus
(resposta 1 do backlog 109). Depende de `CONTAI-093`; independente de
`CONTAI-094`/`CONTAI-095`.

## Dor de Origem
`docs/backlog/109-2026-10-14-engenheiro-acesso-multiusuario.md`, resposta do
Mateus: "visibilidade: configurável, as duas opções existem [...] o
colaborador pode ter visão restrita [...] OU visão total da obra". Sem esta
fatia, "total" cobriria documento/compromisso (`CONTAI-094`/`095`) mas nunca
o que já foi efetivamente pago — a visão ficaria incompleta e o colaborador
poderia, por exemplo, criar um compromisso para uma nota que já tem
pagamento confirmado, sem saber.

## User Story
**Como** o Mateus, quando configuro a visibilidade de um colaborador como
"total", **quero** que ele também veja (sem poder agir) os pagamentos já
confirmados da obra, **para que** ele tenha o quadro completo ao decidir o
que cadastrar, sem nunca poder criar, editar ou confirmar nada que já é meu
de direito exclusivo.

## Critérios de Aceite

1. [ ] Migration `0033`: RLS de `pagamento` — a policy única
   `dono_pagamento for all` é dividida em `pagamento_select (user_id =
   auth.uid() or visibilidade_na_obra(obra_id) = 'total')`,
   `pagamento_insert` e `pagamento_update` (ambas só dono) — três policies
   separadas, de propósito, para o "nunca" (insert/update) ficar legível no
   SQL e não depender de interpretar um `for all` combinado.
2. [ ] Mesmo split `select`-only (dono ou visibilidade total) em
   `pagamento_documento`, `compromisso_pagamento`, `pagamento_diferenca`,
   `documento_anexo` e `revisao` (histórico/detalhe do que já foi pago).
3. [ ] `storage.objects`: `select` do comprovante ganha `exists (select 1
   from pagamento p where p.comprovante_path = name)` na mesma regra de
   visibilidade — colaborador com visão total pode abrir o comprovante de um
   pagamento já confirmado; nunca envia/substitui.
4. [ ] `/documento/[id]`, `/compromisso/[id]`, `/pagamento/[id]`: quando o
   colaborador tem visibilidade "total" e está olhando um registro que não é
   dele (já confirmado pelo dono, ou criado por outro colaborador), **todos**
   os botões de ação desaparecem condicionalmente — nunca edita, nunca
   confirma, nunca liga/desliga vínculo. Isso vale também por navegação
   direta a sub-rotas de ação (`/documento/[id]/ligar`,
   `/pagamento/[id]/comprovante`, `/compromisso/[id]/confirmar` etc.) — a
   RLS de escrita (critério 1-2) garante que a gravação é recusada mesmo se
   a tela chegar a renderizar; a UI não depende disso para decidir o que
   mostrar.
5. [ ] As três telas do critério 4 ganham um indicador textual discreto no
   topo, para o colaborador com visão total ("Modo leitura — ações são
   exclusivas do dono da obra"), com peso visual de legenda — não é banner
   de alerta, não usa a paleta de pendência fiscal. Texto exato em
   `design/mocks/CONTAI-096.md` (pergunta aberta).
6. [ ] Nenhum texto fiscal muda nas três telas: quarentena, consequência de
   CNO, retenção etc. continuam aparecendo exatamente como para o dono — o
   colaborador com visão "total" vê o estado fiscal real, só não pode agir
   sobre ele.
7. [ ] Home, `/despesas`, `/pendencias` e relatórios anuais continuam fora do
   alcance do colaborador em qualquer configuração de visibilidade —
   "total" é só sobre as três telas de detalhe do critério 4, nunca sobre os
   agregados/números fiscais (reafirma o critério 12 da `CONTAI-093`, não
   reabre).
8. [ ] GRANT: nenhum verbo novo (as tabelas já têm os verbos necessários);
   `e2e/privilegios.spec.ts` atualizado para refletir as três policies
   separadas de `pagamento`.
9. [ ] E2E novo (`e2e/colaborador-visibilidade-total.spec.ts`, Postgres
   local, client autenticado): colaborador com visão "total" lê `pagamento`/
   `pagamento_documento`/comprovante de um registro do dono; colaborador com
   visão "restrita" **não** lê nada disso (nem o próprio, porque colaborador
   nunca cria pagamento); tentativa de colaborador com visão total dar
   `insert`/`update` em `pagamento` é recusada pela RLS; navegação direta a
   `/pagamento/[id]/comprovante` por colaborador com visão total não produz
   gravação nenhuma mesmo que a tela renderize.

## Out of Scope
- Qualquer ação de escrita do colaborador sobre `pagamento` — permanece
  impossível em qualquer configuração de visibilidade, reafirmado pelo Gate
  Fiscal do `CONTAI-095` (confirmação de pagamento é exclusiva do Mateus,
  sempre).
- Home, `/despesas`, `/pendencias`, relatórios anuais com dados agregados
  para o colaborador — fechado no escopo da `CONTAI-093` (critério 12),
  reafirmado aqui, não reaberto.
- Tela própria de "sem permissão" para navegação direta a sub-rota de ação —
  decidido tratar só no nível de dados (RLS); se a UI chegar a renderizar
  algo antes de descobrir que não pode gravar, isso é comportamento
  aceitável nesta fatia (ver Pergunta Aberta 2).

## Gate Fiscal (Contador)

**1. Toca regra fiscal?** Não diretamente — nenhuma classificação, data de
pagamento, retenção ou documentação hábil muda. Toca **exposição** de dado
fiscal sensível (CPF, valor) a um terceiro dentro do próprio sistema do
Mateus.

**2. Confirmação do Gate Fiscal da `CONTAI-093`**: isso é questão de
produto/privacidade (LGPD), não fiscal — não há regra tributária sobre quem,
dentro de um sistema privado do próprio contribuinte, pode ver o quê. O
único ponto tributário adjacente (sigilo fiscal, art. 198 CTN) regula o
dever de sigilo da Receita Federal perante terceiros, não a segregação
interna de um sistema privado. **Não travar este ticket no Gate Fiscal por
isso** — a decisão de oferecer a opção "total" já foi tomada pelo Mateus
(resposta 1 do relato); este Gate Fiscal só confirma que não há objeção
tributária à leitura em si.

**3. Confirmar/registrar `pagamento` continua exclusivo do Mateus, sempre**
— reafirmação da regra já fixada no Gate Fiscal do `CONTAI-095`; esta fatia
só abre leitura, nunca escrita.

## Pre-mortem
1. **O Mateus concede "total" sem pensar na exposição de CPF/valor de
   prestadores PF** a um colaborador que só precisava ver notas e
   compromissos — a tela de gestão de colaboradores (`CONTAI-093`) não
   distingue visualmente o peso dessa decisão; mitigação possível (texto de
   consequência ao marcar "total") é dívida de produto, não implementada
   aqui.
2. **Navegação direta a sub-rota de ação renderiza parcialmente antes de a
   gravação ser recusada**, criando uma experiência confusa (formulário que
   parece editável, mas nunca salva) — aceito como comportamento desta
   fatia (Out of Scope), mas é fricção real se acontecer na prática.
3. **Um relatório ou view futura some pagamento na soma por engano** ao
   reaproveitar a policy de leitura ampliada — mitigado por este ticket não
   tocar nenhuma função de soma (`alocarCusto`, `resumo.ts`), só RLS de
   leitura ponto a ponto; qualquer tela de agregado continua dono-only
   (critério 7).

## Viabilidade (CTO)
- **Modelo de dados**: nenhuma tabela nova. Migration `0033`: RLS de
  `pagamento` e tabelas dependentes (`pagamento_documento`,
  `compromisso_pagamento`, `pagamento_diferenca`, `documento_anexo`,
  `revisao`) ganham `select` condicional a `visibilidade_na_obra = 'total'`.
- **Arquivos**: `supabase/migrations/0033_pagamento_visibilidade_total.sql`,
  `app/(gestao)/documento/[id]/page.tsx`, `app/(gestao)/compromisso/[id]/page.tsx`,
  `app/(gestao)/pagamento/[id]/page.tsx` (indicador de modo leitura +
  ocultação condicional de ações), `e2e/colaborador-visibilidade-total.spec.ts`,
  `e2e/privilegios.spec.ts`.
- **Complexidade: S/M.** Independente de `CONTAI-094`/`095` — pode ser
  implementado e revisado em paralelo com qualquer uma das duas, desde que
  `CONTAI-093` já esteja em produção.
- **Dívidas**: nenhuma nova além das já registradas nas fatias anteriores.

## Dependências
Bloqueado por `CONTAI-093`. Independente de `CONTAI-094`/`CONTAI-095`.

## Perguntas Abertas
1. Texto exato do indicador "modo leitura" (designer).
2. Quando o colaborador com visão total navega direto para uma sub-rota de
   ação por URL — a UI deve mostrar uma tela de "sem permissão" própria, ou
   fica só no nível de dados (RLS) sem a tela renderizar o formulário?
   Afeta se um quarto estado ("sem permissão") precisa ser desenhado nessas
   sub-rotas (designer, pergunta 2) — tratado como Out of Scope nesta
   versão; revisitar se a experiência confusa (pre-mortem 2) se mostrar
   incômoda na prática.
3. O Mateus quer algum aviso de consequência ao marcar visibilidade "total"
   para um colaborador (ex.: "ele vai ver CPF e valores de pagamentos da
   obra inteira")? Não implementado nesta fatia nem na `CONTAI-093`;
   registrar como dívida se o Mateus confirmar que quer.

## Cenário e checagem final
**Gestão**, versão read-only — consulta sentada ao acervo, sem ação, sem
formulário, sem anexo. Não é captura; o "Teste do Canteiro" não se aplica.
São as mesmas telas de gestão que já existem, herdam o tratamento de desktop
que já têm — nada novo a decidir em breakpoint ou densidade.

Varredura de condição fiscal órfã: a única condição citada (visibilidade é
questão de produto/privacidade, não fiscal) está explicitamente marcada como
"fora de competência fiscal" pelo próprio Gate Fiscal — não é condição
tributária órfã, é a ausência documentada de uma.

Veredito: **APROVADO**, condicionado à Pergunta Aberta 1 (não bloqueia
arquitetura nem RLS, só redação final de tela).

---

## Design (nível 2)
Descrição completa em `design/mocks/CONTAI-096.md`: delta de visibilidade
condicional de ação em três telas já existentes, sem campo novo, sem estado
novo de carregamento/erro/vazio — só o indicador textual de "modo leitura" e
a ausência condicional de botões.
