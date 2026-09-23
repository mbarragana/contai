# CONTAI-049 (011-B) — Triagem completa do objeto órfão

## 🛑 EM ESPERA — decisão do Mateus, 2026-09-23

Junto com `CONTAI-011` e `CONTAI-050`: todo o trio de "Export do acervo"
assume destino único (Drive do Mateus, credencial central) e não escala para
multiusuário — ver o bloco completo em `docs/tickets/CONTAI-011.md`. Não
iniciar `/develop` deste ticket até o Mateus resolver essa lacuna de
requisito. **Retomar só quando o fluxo comum de despesas/apuração de custo
estiver estável.**

## Tipo e Prioridade

- **Tipo**: meta 3 (acervo íntegro) — completa o critério 15 original do
  `CONTAI-011`
- **Prioridade**: **P0** (mesma prioridade do 011-A: sem triagem, o export
  periódico nunca fecha na presença de órfão — critério 15 do `CONTAI-011`
  já deixa a detecção visível, mas dar destino é deste ticket)
- **Origem**: fatiamento do `CONTAI-011` em 2026-09-23 — ver
  `docs/tickets/CONTAI-011.md` (cabeçalho) e
  `docs/backlog/62-2026-09-23-fatiamento-contai-011.md`
- **Gate 0 (mock)**: herdado do `CONTAI-011.html`/`.md` v1 (aprovado
  2026-08-16) — telas `#s10` (lista), `#s11` (três destinos), `#s12`
  (Vincular), `#s13` (Engano), `#s14` (Documento da obra), `#s15` (limpa).
  **Precisa de retoque do `designer`** antes do Gate 1: o mock desenhou
  "vincular" como um destino único e genérico; a decisão do `contador`
  abaixo o divide em duas sub-rotas quando o documento-alvo já tem arquivo.
- **Gate Fiscal**: decisão do `contador` em 2026-09-23, transcrita abaixo —
  **não é parecer novo em arquivo próprio**, é resposta direta à consulta do
  `po` sobre o achado do `lead-engineer`. Se este ticket tocar regra fiscal
  nova além do que está aqui, o `contador` revisa de novo no Gate 1.

## Dor de Origem

O `CONTAI-011` original previa três destinos para objeto órfão no bucket
(vinculado / descartado / anotado como documento sem vínculo), e o Gate
Fiscal de 2026-08-16 tornou isso **bloqueante**: órfão no pacote é "gasto não
declarado" aos olhos de quem confere o dossiê. O `po` fatiou o critério 15
para fora do `CONTAI-011` (que agora só *detecta e mostra* o órfão) porque o
`lead-engineer`, ao tentar o Gate 1, achou uma restrição de modelo que
ninguém tinha visto: a migration `0014` só permite "vincular" um arquivo a um
`documento` que **ainda não tem arquivo nenhum** — a função
`anexar_arquivo_documento` opera `where arquivo_path is null`, e o trigger
`documento_arquivo_path_imutavel` proíbe reescrever `arquivo_path` uma vez
preenchido.

## Decisão do `contador` (2026-09-23) — a restrição fica, "vincular" vira duas rotas

> Transcrição da resposta do agente `contador` à consulta do `po`.

**A restrição da 0014 está correta e não muda.** Ela existe para impedir um
erro fiscal real: reescrever `arquivo_path` depois que `destinatario_cpf_ok`
e `retencao_11` já foram afirmados **com o papel à vista** apagaria o lastro
dessas duas respostas sem deixar rastro — o mesmo "flip barato" que a 0014 já
nomeia e proíbe em outro contexto. Não é lacuna de modelo a corrigir.

**Consequência: "vincular" (destino 1 da triagem) não é uma ação só — são
duas rotas, e o mock hoje trata como se fosse uma:**

- **Rota (a) — documento-alvo SEM arquivo** (`arquivo_path is null`). É o
  "vincular" pleno, via `anexar_arquivo_documento`, que **reafirma**
  `destinatario_cpf_ok`/`retencao_11` com o papel em vista nesse ato. É o
  caso mais comum de órfão (upload antes do insert, retry) e **já funciona
  hoje, sem mudança de modelo**.
- **Rota (b) — documento-alvo JÁ TEM arquivo**. "Vincular" aqui nunca pode
  significar reescrever `arquivo_path`. O caminho é `documento_anexo`
  (migration 0009) como **anexo adicional do mesmo desembolso** — o mesmo
  papel que essa tabela já cumpre para carta de correção/nota substitutiva.
  Regra fiscal explícita: vincular um órfão como anexo adicional **nunca
  reabre nem herda** `destinatario_cpf_ok`/`retencao_11` — essas respostas
  continuam valendo para o arquivo original. Se o órfão for, de fato, um
  papel que muda a resposta fiscal (ex.: nota substitutiva com CNPJ
  diferente), **isso não é "vincular direto"** — é correção, e passa pelo
  fluxo já existente (`corrigir_documento`, `motivo =
  'emitente_corrigiu_a_nota'`, que já exige anexo no mesmo ato).
- **A tela de triagem (`#s11`/`#s12`) precisa distinguir as duas sub-rotas**
  quando o documento-alvo já tiver arquivo — não oferecer um "vincular"
  genérico que a função recusaria em runtime.

⚠️ **Nota técnica do `contador`, para o `cto-obra` decidir no Gate 1**:
`documento_anexo` hoje não tem coluna `papel` (comprovante/nota/contrato) —
que a seção "Restrições vindas do CONTAI-027" do próprio `CONTAI-011`
(011-A) já exige para o índice do dossiê. Se a rota (b) entrar neste ticket,
essa coluna provavelmente nasce junto (migration nova); se o `CONTAI-027`
ainda não trouxe isso, o `cto-obra` decide se a rota (b) espera por ele ou se
a coluna nasce aqui e o `027` a reaproveita. **Isto não bloqueia o Gate 0
nem a rota (a)** — é decisão de sequenciamento, não de fiscal.

### Destino 3 — "documento legítimo sem vínculo" (categoria nova, precisa de migration)

Confirmado pelo `contador`: `documento.valor` é `not null` desde a migration
0001, então esta categoria **não cabe** na tabela `documento` existente —
precisa de tabela nova (nome sugerido: `documento_obra_sem_gasto` ou
equivalente, decisão do `cto-obra`).

**Campos, decididos pelo `contador`:**

- **`tipo`** (obrigatório) — lista: **Alvará · ART/RRT · Matrícula do imóvel
  · Habite-se · Projeto aprovado · Contrato de empreitada · CND da obra ·
  Outro**. Lista confirmada como correta para esta categoria — **escritura
  do terreno e comprovante de ITBI ficam FORA dela**: são documentos com
  valor e favorecido (cartório, prefeitura) e por isso pertencem ao custo de
  aquisição (destino 1/`documento`, não destino 3) — colocá-los aqui
  apagaria em silêncio um custo real da composição de Bens e Direitos. Se um
  órfão for a escritura ou o comprovante de ITBI, o caminho é vinculá-lo a um
  `documento` com valor e favorecido (rota (a) ou (b) acima); se esse
  registro nunca existiu no app (comum em terreno financiado anterior ao
  CNO), é lacuna de produto separada — **pergunta aberta para o `po`/
  `cto-obra`, fora deste ticket**.
- **`obra`** (obrigatório) — "o dossiê é por obra, e um documento sem obra
  não entra em dossiê nenhum".
- **`numero`** — **obrigatório** para Alvará, ART/RRT, Matrícula do imóvel,
  Habite-se e CND da obra (nascem com numeração própria de um órgão/cartório/
  conselho — sem o número o papel entra no acervo mas não é conferível junto
  à fonte emissora décadas depois). **Opcional** para Projeto aprovado e
  Contrato de empreitada (este último tipicamente não tem numeração formal).
- **`orgao_emissor`** — **não existe como campo à parte** para os cinco tipos
  acima: o tipo já implica o órgão (prefeitura / CREA-CAU / cartório de
  registro de imóveis / Receita-INSS); pedir de novo é redundância.
- **Tipo "Outro"** — exige **descrição livre obrigatória** do que é e de quem
  emitiu (texto), já que nem tipo nem órgão estão implícitos.
- **`data do documento`** — opcional, sem validação (herdado do mock,
  não questionado pelo `contador`).

## Critérios de Aceite

1. [ ] Objeto sem vínculo (detectado pelo `CONTAI-011`/011-A) aparece em uma
   tela de triagem, listado individualmente, com link para visualizar o
   arquivo antes de decidir.
2. [ ] **Rota (a) — vincular a documento sem arquivo**: busca/seleção do
   documento-alvo restrita a documentos com `arquivo_path is null`; ao
   confirmar, roda `anexar_arquivo_documento` e o app **repergunta** CPF no
   CPF e retenção (nunca herda resposta anterior — mesma disciplina da 0014).
3. [ ] **Rota (b) — vincular como anexo adicional a documento que já tem
   arquivo**: grava em `documento_anexo` (ou tabela que o `cto-obra` decidir
   no Gate 1), **sem** tocar `destinatario_cpf_ok`/`retencao_11` do documento
   original. Se o usuário indicar que o papel muda a resposta fiscal, a tela
   redireciona para o fluxo de correção (`corrigir_documento`) em vez de
   oferecer "vincular".
4. [ ] **Destino "descartado"**: marca o objeto como lixo de retry, sem
   apagar do bucket (acervo append-only — "engano não apaga", mock `#s13`);
   motivo é campo livre, opcional, sem default.
5. [ ] **Destino "documento legítimo sem vínculo"**: migration nova (tabela
   fora de `documento`), campos conforme a seção "Destino 3" acima, sem
   nenhum default em campo fiscal (tipo e obra obrigatórios, sem
   pré-seleção).
6. [ ] Um objeto sem destino **continua bloqueando o fechamento do export**
   (herdado do critério 15 original do `CONTAI-011`) — a triagem é o que
   resolve esse bloqueio, item por item.
7. [ ] Nenhum dos três destinos é default; não existe "pular" a triagem.

## Dependências

- **`CONTAI-011` (011-A)** — entrega a detecção que alimenta a lista deste
  ticket (`ultimoExport`, contagem de órfãos). Não precisa esperar o 011-A
  em produção para começar o design/Gate 1 deste ticket, mas precisa dele
  para ter dado real para testar.
- **`CONTAI-027`** — ver nota técnica acima sobre a coluna `papel` em
  `documento_anexo`; decisão de sequenciamento é do `cto-obra` no Gate 1.

## Fora de Escopo

- Resolver a lacuna de "escritura/ITBI sem `documento` correspondente" —
  registrada acima como pergunta aberta, não como critério deste ticket.
- Qualquer coisa do dossiê sob demanda — `CONTAI-050`/011-C.

## Veredicto (po, 2026-09-23)

**Destravado, mas não "pronto para `/develop`" ainda**: falta o retoque do
mock (rotas (a)/(b) distintas na tela de vincular) pelo `designer`, e a
decisão de sequenciamento da coluna `papel` pelo `cto-obra`. Nenhum dos dois
é bloqueio fiscal — é Gate 0/Gate 1 normal. Entra na fila atrás do 011-A.
