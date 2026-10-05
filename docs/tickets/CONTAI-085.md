# CONTAI-085 Corrigir número/série de documento já registrado

## Tipo e Prioridade
feature — **P0 fiscal** — mesmo critério do CONTAI-021 ("a partir do
instante em que uma nota for registrada errada, isto é P0, porque hoje não
existe desfazer"): aqui não é typo, é substituição pela prestadora (nota
261 cancelada, nota 263 vigente), mesma classe de dano ao acervo.

## Dor de Origem
Dívida **D89**, `docs/backlog/101-2026-10-05-correcao-nota-substituida-com-retencao-nova.md`:
o campo `numero`/`serie` já está pré-aprovado como corrigível pelo parecer
`docs/pareceres/2026-08-18-correcao-de-documento-registrado.md` §1, mas a
tela nunca foi construída — a coluna não existia no schema na época do
CONTAI-021; o CONTAI-004 já a entregou há semanas. Caso real: NFS-e
PerfuraTec nº 261 (já registrada, R$59.901,00) foi cancelada pela
prestadora e substituída pela nº 263 — mesmo valor, número diferente.

## User Story
Como dono da obra, sentado em casa, quando a prestadora cancela e reemite
uma nota com número novo, quero corrigir o número/série do documento já
registrado, anexando a nota nova como prova, para que o acervo pare de
apontar para um papel cancelado como se fosse o vigente.

## Critérios de Aceite
1. [ ] Proposta nível 1 em `design/mocks/CONTAI-085.md`.
2. [ ] Rota nova `/documento/[id]/corrigir/numero`, mesmo molde de
   `corrigir/valor` (`PassoMotivo`, `ListaDeAnexos`, `CampoArquivo`) MAS
   **sem** o bloco de "custo confirmado por ano" (número nunca move custo
   — não ocultar via CSS, cortar o bloco inteiro do código).
3. [ ] Dois campos: **Número** (texto, obrigatório) e **Série** (texto,
   opcional — `null` é valor legítimo, comum em NFS-e municipal).
   Comparação **textual literal** contra o gravado (zeros à esquerda
   preservados, nunca parse numérico).
4. [ ] Se número E série digitados forem idênticos, como texto, aos já
   gravados, botão desabilitado "Nada a corrigir" — mesmo padrão das
   outras 3 correções.
5. [ ] Ao gravar, reroda `duplicataDe()` (já existe,
   `lib/fiscal/documento.ts:321`) contra os documentos da mesma obra,
   **excluindo o próprio documento sendo corrigido** — mesma obra + mesmo
   `favorecido_id` + mesmo número + mesma série → aviso **NÃO-BLOQUEANTE**
   (reuso do texto já em produção, `adicionar/documento/page.tsx:1690-1701`:
   "Essa nota já foi registrada em... conta o custo em dobro"), nunca
   recusa a gravação.
6. [ ] Anexo **obrigatório** quando `motivo = "emitente_corrigiu_a_nota"`
   (recusa gravar sem anexo) — mesmo padrão das outras 3 correções. Só
   aceita motivo `emitente_corrigiu_a_nota`/`erro_de_digitacao_minha`/`outro`
   (nunca `arquivamento_corrigido` nem `comprovante_chegou_depois`).
7. [ ] `documento.arquivo_path` **NÃO muda** (imutável por trigger desde a
   migration `0014`) — a nota nova entra em `documento_anexo` (append-only),
   nunca substitui o arquivo original. Texto de consequência, verbatim:
   *"`documento.arquivo_path` não muda. A nota nova entra como anexo
   adicional do documento — o arquivo original continua lá. O dossiê lista
   os dois arquivos."*
8. [ ] Rastro: tabela `revisao` (`entidade='documento'`, `entidade_id`,
   `campo='numero'` e/ou `'serie'`, `antes`, `depois` — texto literal,
   `quando`, `quem`, `motivo`, `motivo_texto`) — uma linha de `revisao`
   por campo que de fato mudou, mesmo `ato_id`.
9. [ ] "Anos afetados" sempre vazio/nenhum — número nunca move custo
   (parecer §0(a)); a tela **não mostra** bloco de custo confirmado por
   ano (critério 2).
10. [ ] Migration `0027`: `revisao_campo_da_entidade` ganha `'numero'` e
    `'serie'` para `entidade = 'documento'`.
11. [ ] RPC nova `corrigir_numero_documento(...)` — **não estende**
    `corrigir_documento` (a guarda "depois `is null` → exception" daquela
    função é errada para `serie`, que pode ser `null` legitimamente). Ambos
    iguais → exception "nada a corrigir". `emitente_corrigiu_a_nota` sem
    anexo → exception.
12. [ ] `revoke execute ... from public, anon` + `grant ... to authenticated`
    na mesma migration; `FUNCOES_ESPERADAS` de `e2e/privilegios.spec.ts`
    atualizado com o nome da função nova.
13. [ ] `lib/database.types.ts` atualizado à mão com a função nova.
14. [ ] Link novo em `/documento/[id]`, junto dos outros links de correção:
    "Corrigir o número/série — hoje: Nº {numero}".
15. [ ] Histórico de correções do documento mostra `numero: 261 → 263`
    (e `serie` se também mudou).

## Out of Scope
- **Trocar `favorecido_id`/CNPJ do emitente na mesma tela** — já tem tela
  própria (`corrigir/emitente`); emitente não mudou no caso real.
- **Mudar `valorCentavos` na mesma tela** — se um caso futuro mudar número
  *e* valor, são duas correções/duas telas, nunca um formulário combinado
  (mesma objeção que o `cto-obra` já fez contra "formulário genérico" no
  CONTAI-021).
- **"Marcar como duplicata de X"** — o próprio parecer §1 chama isso de
  "fora deste parecer, mas irmão dele": é anotação, não edição de campo;
  ticket separado.
- **Cobrar o excedente da PerfuraTec, confirmar ISS com a Prefeitura,
  pagar guia** — fora do software, ação humana já registrada em memória
  de projeto.
- **`chave_acesso`/código de verificação** — fora desta rodada.

## Gate Fiscal (Contador)
**Ratificação literal** do parecer `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`
§1 (linha `numero`/`serie`: "CORRIGÍVEL COM CONDIÇÃO... como transcrição,
texto literal, zeros à esquerda preservados. Ao gravar, reroda a checagem
de duplicidade: colidindo com outro documento do mesmo emitente/série na
mesma obra → aviso + revisão humana") e §7 (duplicidade como ação
automática do sistema, nunca bloqueio).

- Comparação **textual literal**, zeros à esquerda preservados — nunca
  parse numérico.
- Duplicidade: **aviso não-bloqueante**, nunca recusa — só o Mateus decide
  qual duplicata é a boa (§7, "só o Mateus").
- Rastro: campo/antes/depois/quando/quem/motivo, igual às outras 3
  correções (§5, "Rastro obrigatório em TODA correção... com ou sem
  pagamento vinculado").
- **"Anos afetados" sempre vazio** — confirmado por §0(a): o único campo
  de `documento` que move custo entre anos é `valor`; `numero`/`serie`
  não participa desse cálculo em nenhuma hipótese. Não é "N/A" especial
  desta correção — é consequência direta da doutrina, vale para todo
  campo fora de `valor`.
- Se `motivo = emitente_corrigiu_a_nota`, o documento novo é anexado **no
  mesmo ato**, sem exceção (§5, "duas regras duras").

Automático: recusar edição de campos não-corrigíveis, rerodar duplicidade,
gravar rastro. Só o Mateus: decidir se é erro de transcrição ou erro do
papel; qual duplicata é a boa. Doutrina de aferição INSS/custo de
aquisição: intocada — número nunca entrou nela.

## Pre-mortem
1. **Zeros à esquerda**: se a comparação "igual ao gravado" ou a checagem
   de duplicidade for implementada com parse numérico em vez de
   comparação de string literal, "0263" e "263" colidem (ou deixam de
   colidir) de forma errada — contraria o parecer §1 explicitamente.
2. **Duplicidade contra si mesmo**: a checagem precisa excluir o próprio
   documento sendo corrigido da busca — senão todo "gravar" dispara
   falso-positivo.
3. **Dead code copiado de `corrigir/valor`**: risco real de copiar também
   o bloco de "custo confirmado por ano, antes→depois" sem perceber que
   para `numero`/`serie` ele é sempre vazio — cortar o bloco por completo,
   não ocultar com CSS.

## Viabilidade (CTO)
- **Modelo de dados**: migration `0027_corrigir_numero_documento.sql` —
  `revisao_campo_da_entidade` ganha `'numero'`/`'serie'` em
  `entidade = 'documento'`. Sem tabela/coluna nova
  (`documento_anexo.revisao_id` já existe desde a `0009`). Sem GRANT de
  tabela — só privilégio de função + `FUNCOES_ESPERADAS`.
- **RPC**: `corrigir_numero_documento(p_documento_id uuid, p_numero text,
  p_serie text, p_motivo motivo_revisao, p_motivo_texto text default null,
  p_anexo_path text default null) returns uuid`. Um ato, um `ato_id`, uma
  linha de `revisao` por campo mudado (`is distinct from`); `p_numero`
  nunca `null` (R2 do CONTAI-004). Ambos iguais → `raise exception`.
  `emitente_corrigiu_a_nota` sem anexo → exception. `arquivamento_corrigido`
  e `comprovante_chegou_depois` → exception. `revisao_gravar_anos(...,
  '[]')` — anos sempre vazio.
- **Tela**: `app/(gestao)/documento/[id]/corrigir/numero/page.tsx`, cópia
  de `corrigir/valor/page.tsx` cortando o bloco de custo por ano e
  `anosAfetadosDeUmaObra`. Duplicidade via `duplicataDe()` no client,
  renderizada como aviso não-bloqueante acima do botão.
- **Arquivos**: migration `0027`, `lib/data.ts`
  (`corrigirNumeroDoDocumento`), `lib/database.types.ts`,
  `corrigir/numero/page.tsx`, `corrigir.tsx` (rótulos `ROTULO_CAMPO` para
  `numero`/`serie`), `documento/[id]/page.tsx` (link), `e2e/privilegios.spec.ts`,
  `e2e/corrigir-numero.spec.ts`.
- **Complexidade: S.**
- **Dívidas**: nenhuma nova.

## Dependências
Bloqueado por / Bloqueia: nenhum. **Independente** — vai primeiro na
ordem de implementação (destrava parte do caso real e é onde o
CONTAI-086 vai oferecer "usar a nota já anexada aqui").

## Perguntas Abertas
Nenhuma. Checagem de implementação, não bloqueante: confirmar que
`carregarPainel` já devolve os documentos no formato que `duplicataDe`
espera, sem round-trip extra (nota do `designer`).

## Cenário e checagem final
**Gestão** — correção documental, em casa, sentado, não captura no
canteiro. Serve à meta 1 (documento hábil correto) e à meta 3 (acervo
correto no prazo de decadência). Sem condição fiscal órfã — toda condição
cita o parecer de origem no mesmo trecho. Sem UI que quebre disciplina de
campo fiscal (nenhum campo fiscal nasce preenchido).
**Veredito: APROVADO.** Pronto para `/develop`, primeiro da sequência.
