# CONTAI-080 — pré-vínculo compromisso↔nota antes do pagamento (fluxo PIX/boleto)

**Cenário: gestão** (em casa, sentado — mesma família de telas de `/compromisso/[id]/valor`, `/pagamento/[id]/ligar`). O "Teste do Canteiro" não se aplica. 375px não é piso obrigatório, mas nenhuma das 5 telas tocadas pode quebrar nele — são recombinações de shells já em produção.

## Nível do mock: **1** (tela nova `/compromisso/[id]/pre-vincular`), com os blocos 2 a 5 em **Nível 2** (spec + ASCII pontual) dentro deste mesmo arquivo — recombinam padrões já em produção (`/pagamento/[id]/ligar`, `/compromisso/[id]/page.tsx`, `/documento/[id]/page.tsx`, `/compromisso/[id]/confirmar/page.tsx`), sem decisão de layout nova a não ser a tela 1.

Passa de 100 linhas — sinalizado: são 5 telas tocadas, cada uma com Gate Fiscal próprio (ADENDO 6, 7 e 8 do parecer de 18/08).

**Gate Fiscal consumido** (não redecidido aqui, só desenhado em cima): ADENDO 6 §J.0-J.5, ADENDO 7 §K.1-K.5, ADENDO 8 §L.1-L.4 de `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`. Todo texto entre `>` abaixo é cópia literal desses parágrafos — nenhuma palavra fiscal foi redigida por mim.

**Arquitetura consumida** (`cto-obra`, não redecidida): tabela nova `compromisso_documento_previsto` (N:M, editável, sem valor, sem situação própria); `documentoOrigemId` continua existindo, separado, imutável desde a criação (CONTAI-064); **N**, em toda esta spec, é sempre "**união pré-vínculos ∪ documentoOrigemId, deduplicada**" — nunca só um dos dois lados.

---

## 1. Tela nova — `/compromisso/[id]/pre-vincular`

### 1.1 Onde entra o CTA — `app/(gestao)/compromisso/[id]/page.tsx`

No bloco `data-acoes="agendamento"` (as mesmas linhas ~204-243 que o CONTAI-073 já tocou), visível **só quando `situacao === "aberto"`** — mesma guarda do bloco inteiro, sem condição própria. Entra **logo depois** da ação primária (Registrar o pagamento / Ver a fatura) e **antes** das duas correções — agrupa "preparar o pagamento" antes de "corrigir o agendamento", pela mesma lógica de agrupamento que already levou "Mudou a data" + "Corrigir o valor previsto" a ficarem juntas no CONTAI-073:

```
[ Registrar o pagamento ]        (ou "Ver a fatura", se origem = cartão)
[ Ligar notas a este agendamento ]  ← NOVO
[ Mudou a data ]
[ Corrigir o valor previsto ]
[ Marcar que não vai ser pago ]
```

`<BotaoLink href={`/compromisso/${c.id}/pre-vincular`}>Ligar notas a este agendamento</BotaoLink>` — variante secundária, mesma dos vizinhos.

> ⚠️ **REVISTO pelo Gate 2 (D2)**: o CTA e o bloco do §2 **NÃO aparecem** para `origem === "cartao"`, e a rota recusa se alcançada à mão. A quitação por fatura não conta N e não pergunta nada, então as duas variantes do ADENDO 8 §L.2 seriam falsas nas duas pontas. Cartão é o **CONTAI-081**, inteiro. O parágrafo original abaixo fica registrado, e não apagado, porque a revisão é nomeada.

Redação original: aparece **também** para `origem === "cartao"` (o caso de fundo do ADENDO 6 é fornecedor com boleto/PIX, mas o parecer não restringe por origem, e uma compra de cartão pode igualmente corresponder a mais de uma nota antes da fatura fechar).

### 1.2 Campos — contrato do CONTAI-034

| campo | rótulo | tipo | nasce | obrigatório |
|---|---|---|---|---|
| — | Nota de origem (se houver) | leitura, fixa, não desmarcável | `compromisso.documentoOrigemId` resolvido | — |
| `fMarcados` | seleção múltipla de documentos | checkboxes | **com o estado atual gravado** (pré-vínculos já salvos vêm marcados) | não — pode salvar com zero marcados (remove todos) |

**Não é campo fiscal**: pré-vínculo não exige anexo (§4 do parecer — a exigência de documentação hábil é condição para compor custo, e pré-vínculo não compõe custo nenhum), não tem valor próprio, não tem situação. A disciplina "campo vazio pergunta, campo preenchido afirma" aqui vira "**o estado gravado é o que carrega, nunca um default**": a tela não pré-marca nada que já não estivesse salvo, e salvar com tudo desmarcado é ato explícito (remove todos os pré-vínculos), não um estado inicial.

### 1.3 ASCII

```
┌─────────────────────────────────────────────┐
│ ‹ Agendamento                                │
│ Ligar notas a este agendamento               │
│ WK Construções · Obra Cachoeira do Bom Jesus │
├─────────────────────────────────────────────┤
│ ┌─ Nota de origem — herdada ───────────────┐ │
│ │ 🔒 NF de serviço nº 1042 · WK Construções │ │
│ │    R$ 3.200,00                            │ │
│ │    Vinculada na criação deste agendamento │ │
│ │    — não pode ser removida aqui.          │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ [ Buscar por favorecido, valor ou nº... ]    │ (só se >5 documentos)
│                                               │
│ Notas desta obra                             │
│ ┌───────────────────────────────────────────┐ │
│ │ ☑ Superbeton — concreto usinado           │ │
│ │   NF de material          R$ 4.850,00     │ │
│ ├───────────────────────────────────────────┤ │
│ │ ☐ Superbeton — concreto usinado           │ │
│ │   NF de material          R$ 2.100,00     │ │
│ ├───────────────────────────────────────────┤ │
│ │ ☐ Marcenaria Ilha         R$ 6.400,00     │ │
│ │   NF de serviço                            │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ ⚠ A soma marcada (R$ 4.850,00) passa do      │
│   valor previsto deste agendamento           │
│   (R$ 3.200,00). Pré-vínculo não tem teto —  │
│   confira se não é engano.                   │
├─────────────────────────────────────────────┤
│         [ Salvar 1 nota pré-ligada ]         │
│              Cancelar                        │
└─────────────────────────────────────────────┘
```

### 1.4 Fluxo completo

```
/compromisso/[id]  →  [Ligar notas a este agendamento]  →  /compromisso/[id]/pre-vincular
                                                                    │
                          ┌─────────────────────────────────────────┼─────────────────────────┐
                          │                                         │                          │
                  situacao !== aberto                    situacao === aberto,        erro ao carregar
                  (guarda, sem form)                       carrega OK                          │
                          │                                         │                    EstadoErro +
                  Banner âmbar, "Voltar"                    lista de documentos          tentar de novo
                  único botão                               da obra (exceto a
                                                              nota de origem),
                                                              pré-marcados = os já
                                                              salvos em
                                                              compromisso_documento_previsto
                                                                    │
                                                        documentos.length === 0
                                                        (excluída a origem)?
                                                          │              │
                                                        sim             não
                                                          │              │
                                                  Card vazio:      lista completa +
                                                  "Nenhuma nota    busca (se >5) +
                                                  registrada       aviso de soma
                                                  nesta obra       (não-bloqueante)
                                                  ainda" + CTA
                                                  "Registrar o
                                                  documento agora"
                                                          │              │
                                                          └──────┬───────┘
                                                                 ▼
                                                    [Salvar N notas pré-ligadas]
                                                                 │
                                                    grava o DIFF (adiciona os
                                                    novos marcados, remove os
                                                    que saíram da seleção),
                                                    numa chamada só
                                                                 │
                                                   ┌─────────────┴─────────────┐
                                                   │                           │
                                                sucesso                     erro
                                                   │                           │
                                        router.push para              Banner vermelho,
                                        /compromisso/[id] —           marcações continuam
                                        sem tela de sucesso            como estavam, nada
                                        intermediária (mesma           foi gravado, tenta
                                        decisão do CONTAI-073)          de novo
                                                   │
                                        "sucesso" visível = o
                                        chip/texto do §2 abaixo
                                        aparecendo no detalhe
```

### 1.5 Regras de conteúdo da lista

- **Universo**: todos os `documentos` da obra (`painel.documentos`), **qualquer tipo e status** — inclusive quarentena e boleto. Mesma abrangência de `documentoOrigemId`, que já aceita qualquer tipo hoje (o CTA "Registrar o pagamento desta nota" existe em `PagamentosDesteDocumento` para os três tipos e para quarentena). Restringir a pré-vínculo a "só nota hábil" criaria uma assimetria sem base fiscal — pré-vínculo não é custo (§J.1), então a condição de habilidade documental é irrelevante aqui.
- **Excluída da lista**: o documento cujo id `=== compromisso.documentoOrigemId` — ele aparece só no card fixo do topo, para não haver duas representações do mesmo fato (uma editável, uma não).
- **Sem chip de cobertura/teto**: nenhum `Chip` "Coberta por inteiro"/"Vínculo parcial", nenhuma seção "Mostrar N já cobertas" — decisão já fechada pelo `cto-obra`: aqui o candidato é de **nota**, não de pagamento real, e a semântica de teto do CONTAI-074 não se aplica (§J.4 — soma livre antes da conversão).
- **Sem sugestão automática de ordenação por favorecido/valor** (não é candidato de pagamento real — não há `Pagamento` para comparar). Simplificação deliberada de escopo: ordenar só coloca primeiro os documentos com `favorecidoId === compromisso.favorecidoId` (quando o agendamento tem favorecido), preservando a ordem de chegada dentro de cada grupo — sem rótulo de "sugestão" na tela, é só posição.
- **Busca**: reaproveita `filtrarCandidatos` de `lib/gestao/busca-candidatos.ts` e o mesmo limiar (`MINIMO_PARA_BUSCAR = 5`) e placeholder ("Buscar por favorecido, valor ou número da nota…") das duas telas `ligar` — o documento aqui também tem `numero`, então o índice inclui os três campos.
- **Linha visual**: mesmo componente/estilo de `<label className="flex min-h-[44px] cursor-pointer gap-3 rounded-[10px] ...">` de `/pagamento/[id]/ligar`, com checkbox + favorecido + valor + tipo — **sem** a linha de "já ligada a: ..." e sem `Consequencia` por linha.
- **Aviso de soma livre, não-bloqueante** (§J.4, "consequência de produto... desenho exato é do designer"): quando a soma dos `valorCentavos` marcados excede `compromisso.valorPrevistoCentavos`, `Banner cor="amb" role="status"`, sempre visível nesse caso, nunca impedindo salvar:
  > A soma marcada ({formatarBRL(somaMarcada)}) passa do valor previsto deste agendamento ({formatarBRL(compromisso.valorPrevistoCentavos)}). Pré-vínculo não tem teto — confira se não é engano.

### 1.6 Os 4 estados

- **Carregando**: `Carregando rotulo="Carregando as notas desta obra"` — carrega `compromisso`, `painel` (documentos) e os pré-vínculos já salvos (`carregarPreVinculosDoCompromisso(id)` — nome proposto, ver §7).
- **Vazio**: só quando `painel.documentos` (excluída a nota de origem) tem zero itens — Card central: "Nenhuma nota registrada nesta obra ainda." + `BotaoLink href="/adicionar/documento"` "Registrar o documento agora" (mesmo padrão do vazio de `/pagamento/[id]/ligar`). Se existir nota de origem, o card fixo dela continua aparecendo acima do vazio — o "vazio" é só da lista editável.
- **Erro**: ao carregar → `EstadoErro` + tentar de novo; ao salvar → `Banner cor="red" role="alert"`, marcações preservadas, nada gravado.
- **Sucesso**: sem tela própria — `router.push` direto para `/compromisso/[id]`, que agora mostra o chip/texto do §2.

### 1.7 Gravação — contrato funcional

```ts
salvarPreVinculos(entrada: {
  compromissoId: string;
  documentoIds: string[]; // o conjunto final marcado, nunca a nota de origem
}): Promise<void>
```

Grava o **diff** contra o que estava salvo (insere os novos, remove os que saíram), numa chamada — mesma preocupação de corrida do CONTAI-073 §7 (RPC ou função que valide/grave num ato só, a confirmar no Gate 2). Não grava nada relativo a `documentoOrigemId` (imutável, outro campo).

---

## 2. Chip/texto em `/compromisso/[id]`

**Onde**: dentro do `Card` que já tem `Linha rotulo="Situação"`, `Linha rotulo="Como vai ser pago"` e `Linha rotulo="Ainda falta pagar"` — o bloco novo entra **logo depois** da linha "Ainda falta pagar" e **antes** da `div data-acoes="agendamento"` (os 5 botões, contando o novo do §1.1). Só renderiza quando `aberto` **e** `N > 0` (união pré-vínculos ∪ `documentoOrigemId`, deduplicada). Recalculado a cada render (§L.3 — nunca guardado junto do chip, porque a lista é editável a qualquer momento antes da confirmação).

**Chip curto**, mesmo peso visual do chip "Agendado" (`cor="amb"` `peso="vazado"`, nunca vermelho, nunca verde):

> **Pré-vínculo — ainda não é custo**

**Texto expandido**, logo abaixo do chip, dentro do mesmo `Card`, escolhido pelo N **atual**:

**Variante N=1** (literal, ADENDO 8 §L.2):

> Você ligou este agendamento a [Nota nº X — R$ valor] antes de pagar. Isso é
> só uma intenção registrada: enquanto o pagamento não for confirmado, esse
> valor não entra no custo de aquisição, não abate a base do INSS e não
> aparece em nenhum relatório da declaração. Quando você confirmar o
> pagamento, o sistema vai vincular esta nota automaticamente — sem
> perguntar de novo.

**Variante N≥2** (literal, ADENDO 8 §L.2):

> Você ligou este agendamento a [Nota nº X — R$ valor], [Nota nº Y — R$
> valor] antes de pagar. Isso é só uma intenção registrada: enquanto o
> pagamento não for confirmado, esse valor não entra no custo de aquisição,
> não abate a base do INSS e não aparece em nenhum relatório da declaração.
> Quando você confirmar o pagamento, o sistema vai te perguntar se este
> pré-vínculo ainda vale.

`[Nota nº X — R$ valor]` interpola número (ou tipo, se a nota não tiver número — boleto, por exemplo) + valor de cada documento resolvido, na ordem em que os pré-vínculos foram criados (mais a nota de origem, se houver, sempre listada — ela participa do texto igual às demais, é só imutável na tela de edição).

---

## 3. Chip/texto em `/documento/[id]`

**Onde**: dentro de `PagamentosDesteDocumento` (`app/(gestao)/documento/[id]/page.tsx`), como um `Card` **novo e aditivo** — mesma família de `blocoSemArquivo`/`blocoRetencao` do mesmo arquivo (aditivo, nunca um `return` a mais).

- No ramo **`pagamentos.length === 0`** ("Sem pagamento ligado"): entra **dentro do `Card` existente**, logo depois da `Consequencia` ("O custo existe... / {motivoNaoGeraCusto}") e **antes** de `{acoes}`.
- No ramo **normal** (`pagamentos.length > 0`): entra como **`Card` próprio**, entre o `Card` de status (Chip "Custo comprovado"/"Não gera custo confirmado") e o `Card` "Pagamentos desta nota".

Renderiza em **qualquer um dos dois ramos**, sempre que houver **1+ compromissos** (`situacao === "aberto"`) pré-ligando este documento — via `documentoOrigemId === documento.id` **ou** via linha em `compromisso_documento_previsto`. Não depende de a nota já ter ou não pagamento real ligado (o caso do concreto: uma nota pode ter 1 parcela já paga e 2 compromissos abertos pré-ligados para as parcelas seguintes).

**Chip**, mesmo peso do §2: `Chip cor="amb" peso="vazado"` **"Pré-vínculo — ainda não é custo"**.

**Texto**, com N = quantidade de compromissos que pré-ligam esta nota:

**N=1** (literal, ADENDO 6 §J.2, bloco da NOTA):

> [Favorecido] — previsto R$ valor para DD/MM/AAAA está pré-ligado a esta
> nota, mas nenhum pagamento aconteceu ainda. Esta nota continua sem
> pagamento vinculado até que um pagamento de verdade seja confirmado e
> ligado a ela — ela segue contando em "Notas hábeis sem pagamento
> vinculado".

**N≥2** — mesma frase, extensão pela convenção de lista em colchetes que o próprio parecer já usa no bloco irmão do compromisso (§J.2, texto do detalhe do COMPROMISSO: "[Nota nº X][, Nota nº Y]"). Não é texto fiscal novo — é a mesma frase aplicada a uma lista, com a concordância verbal ajustada:

> [Favorecido X] — previsto R$ valorX para DD/MM/AAAA[, Favorecido Y —
> previsto R$ valorY para DD/MM/AAAA] estão pré-ligados a esta nota, mas
> nenhum pagamento aconteceu ainda. Esta nota continua sem pagamento
> vinculado até que um pagamento de verdade seja confirmado e ligado a ela
> — ela segue contando em "Notas hábeis sem pagamento vinculado".

⚠️ Este bloco usa uma função **diferente** de `agendamentosPorDocumento` (`lib/fiscal/compromisso.ts`), que hoje **elege um só** compromisso por documento (para o card único da Home/`/despesas`, CONTAI-072). Aqui é preciso **listar todos**, sem eleição — a Home mostra "1 aviso por nota" de propósito, o detalhe da nota precisa mostrar a situação completa. Função nova, sinalizada em §7.

---

## 4. Bloco N≥2 em `/compromisso/[id]/confirmar`

**Onde no fluxo**: não é um passo visível a mais no formulário (data → valor → encargos/menor → comprovante continuam idênticos). É um **novo ramo depois da gravação**, no lugar do `router.push` final. Hoje `salvar()` faz 4 passos internos (comprovante → `criarPagamento` → `registrarDiferenca` → `quitarCompromisso`) e sempre termina com `router.push(/pagamento/${pagamentoId})`. O bloco novo intercepta **só essa última linha**:

```
...PASSO 4 (quitarCompromisso) concluído com sucesso...
                    │
     N = união(pré-vínculos, documentoOrigemId) deduplicada
     (carregada no useEffect inicial, junto com o compromisso)
                    │
        ┌───────────┴───────────┐
        │                       │
      N < 2                   N ≥ 2
        │                       │
  router.push          troca a tela por:
  (/pagamento/id)      bloco de revisão (abaixo),
  — comportamento      SEM navegar ainda
  igual a hoje
```

O pagamento **já está salvo** neste ponto (mesma garantia de retry do B4 já documentada no arquivo) — o bloco de revisão não é mais uma etapa de gravação do pagamento, é só a decisão sobre os vínculos.

**Texto exato** (literal, ADENDO 6 §J.3), substituindo `ColunaDeDetalhe` inteira por este bloco (mesmo padrão de tela cheia que os outros estados terminais desta página já usam):

> **Confirmar este pagamento também confirma o vínculo com [Nota nº X — R$
> valor][, Nota nº Y — R$ valor], como você já tinha indicado?**
> [ Sim, confirmar os vínculos ]  [ Revisar antes de confirmar ]

**Os dois botões**:

- **"Sim, confirmar os vínculos"** (`variante="primary"`) → chama `criarVinculos` para os N documentos resolvidos (mesma função de `lib/data.ts` que `/pagamento/[id]/ligar` já usa, com `documentoHabil: ehDocumentoHabil(doc)` por item) → sucesso: `router.push(/pagamento/${pagamentoId})`. Erro: banner vermelho, **nada de navegar**, os vínculos ficam por confirmar (o pagamento continua salvo — retry seguro, é só repetir o clique).
- **"Revisar antes de confirmar"** → `router.push(/pagamento/${pagamentoId}/ligar)`, **sem** query param — a tela de destino resolve sozinha o que pré-marcar (ver §5). Não perde o que já estava pré-ligado: nada foi apagado, só não foi confirmado ainda.

`N=0`: nenhuma mudança (comportamento de hoje). `N=1`: sem UI nova — a marcação automática já aconteceu dentro de `quitarCompromisso`/RPC (ADENDO 7 §K.2), e o `router.push` direto de hoje já reflete isso corretamente.

---

## 5. Candidatos pré-marcados em `/pagamento/[id]/ligar`

Dois elementos novos, os dois só aparecem quando existe um compromisso de origem para este pagamento (`compromissos.find(c => c.pagamentoIds.includes(pagamento.id))` — a tela passa a carregar `carregarCompromissos(painel.obra.id)` também, e, se achar o compromisso, `carregarPreVinculosDoCompromisso` dele). Sem query param: a tela deriva tudo do estado gravado, funciona igual se o Mateus chegar aqui direto (não só vindo do botão "Revisar" do §4).

**(a) Candidatos pré-marcados** — os documentos da **união** (§4) que **ainda não** estão em `pagamento.documentoIds` (ou seja, ainda são candidatos de verdade) nascem com `marcados.includes(id) === true` desde o primeiro render — **exceção nomeada** à doutrina "nada nasce marcado" (o próprio ticket já autoriza). Cada linha marcada assim ganha, ao lado das marcas existentes (`sugestao`/`jaLigadoA`), o mesmo `Chip cor="amb" peso="vazado"` do §2/§3:

> **Pré-vínculo — ainda não é custo**

O checkbox continua **destravado** — ele pode desmarcar se, ao ver o pagamento de verdade, decidir que aquela nota não corresponde (mesma razão do §J.3: revalidação, não confirmação automática).

**(b) Já ligados automaticamente** — os documentos da união que **já estão** em `pagamento.documentoIds` (`pronto.jaLigados`, campo que a tela já carrega hoje e não renderiza) ganham um `Card` novo, **acima** da lista de candidatos, listando cada um com `Chip cor="grn" peso="vazado"` **"Ligado automaticamente"** + `Dica`:

> Ligado ao confirmar o agendamento — você já tinha indicado isso antes de
> pagar. Não é mais candidato aqui.

Isto nomeia, na tela, exatamente o caso que o ticket pede: a nota de origem (ou qualquer documento da união) que a automação de N=1 do CONTAI-065/ADENDO 7 já vinculou de verdade não aparece como checkbox — ela some da lista de candidatos por construção (`documentosCandidatos` já filtra `!pagamento.documentoIds.includes(d.id)`), e sem este card o Mateus não teria como saber que ela não sumiu por engano.

Demais itens de `pronto.jaLigados` que **não** pertencem à união (vínculo de outra origem) aparecem no mesmo `Card`, sem o chip/texto acima — só o fato ("já ligado"), sem a explicação de automação, que não se aplica a eles.

---

## 6. Perguntas técnicas em aberto (não bloqueiam o Gate — para o `cto-obra`/Gate 2)

1. Nome exato da tabela (proposto `compromisso_documento_previsto`, já fechado pelo `cto-obra`), da função de leitura (`carregarPreVinculosDoCompromisso`) e da função de gravação/diff (`salvarPreVinculos`) — nomes propostos por analogia, decisão final é do Gate 2.
2. Se `salvarPreVinculos` precisa de RPC atômica para o diff (mesma dúvida que o CONTAI-073 §7 já deixou em aberto para o valor previsto) — proposta, não fechada aqui.
3. Confirmar que `quitarCompromisso`/a RPC de propagação (ADENDO 7 §K.2) já implementa a condição "N=1 sobre a união" e não mais "documentoOrigemId sozinho" — se a implementação de hoje ainda dispara a propagação incondicionalmente por `documentoOrigemId`, ela precisa mudar para olhar a união antes de decidir entre automático (N=1) e manual (N≥2); do contrário, um compromisso com `documentoOrigemId` + 1 pré-vínculo (união=2) ligaria a origem sozinha e deixaria só a segunda nota para revisão, quebrando a garantia do §4 ("revisão cobre TODOS os N de uma vez"). É achado técnico deste Gate, não decisão fiscal nova — a regra fiscal (união, não campo isolado) já está no ADENDO 7/8.
4. Função nova que **lista** (não elege) todos os compromissos abertos que pré-ligam um documento, para o §3 — `agendamentosPorDocumento` existente faz eleição de 1 e não serve aqui; nome proposto `compromissosQuePreLigam(documentoId, compromissos, preVinculos)`.
5. Onde mora fisicamente `carregarPreVinculosDoCompromisso` (uma linha por `compromisso_documento_previsto`, ou já resolvida para `Documento[]`) — decisão de camada de dados, não de tela.

Nenhuma pergunta de fluxo, campo ou texto de tela ficou em aberto — as cinco acima são só de nome/mecânica de implementação.

---

## Campos

- NÃO É CONTROLE — seção no formato do contrato do `CONTAI-034`
  (`lib/design/campos-do-spec.ts`). Ela é a fonte da trava; a tabela em prosa de
  §1.2 fica como leitura humana, e as quatro telas dos §2 a §5 não acrescentam
  controle nenhum — são chip, texto e botão.

### `/compromisso/[id]/pre-vincular` — a tela nova

- `fMarcados` "seleção múltipla de notas desta obra" (1.3) — checkbox por nota —
  DEFAULT DECLARADO: o ESTADO GRAVADO em `compromisso_documento_previsto` (as
  notas já pré-ligadas vêm marcadas, e nada mais) — **não é campo fiscal**:
  pré-vínculo é intenção, não compõe custo, não abate INSS e não vai a relatório
  nenhum (ADENDO 6 §J.1). Salvar com tudo desmarcado é ato explícito (remove
  todos), nunca estado inicial.
- `fBusca` "Buscar por favorecido, valor ou número da nota…" — texto livre —
  SEM DEFAULT — filtro de EXIBIÇÃO, não persiste e não toca vínculo
  (CONTAI-078); não decide consequência nenhuma.
- NÃO É CONTROLE — a nota de origem (`compromisso.documentoOrigemId`) aparece em
  LEITURA, fixa, sem checkbox: é única e imutável desde a criação do agendamento
  (CONTAI-064/065), e esta tela não a toca.

### As quatro telas existentes — nenhum id novo

- `documentosCandidatos` "Documentos desta obra" (§5) — multisseleção (checkbox
  por candidato) em `/pagamento/[id]/ligar` — DEFAULT DECLARADO: **e é a ÚNICA
  exceção à doutrina "nada nasce marcado" no produto** — nascem marcados os
  documentos da UNIÃO (pré-vínculos ∪ nota de origem) do agendamento que
  originou este pagamento e que ainda NÃO estão ligados formalmente. Depois da
  correção do D1 do Gate 2, no ramo N≥2 isso inclui a **nota de origem**: ela
  deixou de ser propagada antes do toque, então chega aqui como candidato
  pré-marcado em vez de fato consumado. Autorização:
  ADENDO 7 §K.2/§K.3 — a marca vem de *"uma declaração do próprio Mateus, feita
  com o dedo, antes do pagamento"*, não de heurística do app (o que o §5.5 de
  17/08 proíbe). Cada linha marcada assim leva o chip "Pré-vínculo — ainda não é
  custo", o checkbox continua destravado, e **nada nasce marcado por
  semelhança** — `sugestao` continua sendo só ordenação. Sem agendamento de
  origem, nada vem marcado, exatamente como antes deste ticket.
- NÃO É CONTROLE — o resto do que o CONTAI-080 acrescenta em
  `/pagamento/[id]/ligar` (§5) é leitura: o card "Já ligados a este pagamento",
  com o chip **"Ligado ao confirmar o agendamento"**, âmbar vazado. ⚠️ O §5
  acima propõe "Ligado automaticamente" em verde; o **Gate 2 trocou os dois**
  (não-bloqueante 1): verde é a cor de "Custo comprovado" e o documento ligado
  pode ser boleto ou quarentena, e "automaticamente" ficou falso para o ramo
  N≥2, que nasce do clique em "Sim, confirmar os vínculos".
- NÃO É CONTROLE — `/compromisso/[id]/confirmar` (§4) ganha um bloco de decisão
  com dois BOTÕES (`Sim, confirmar os vínculos` / `Revisar antes de confirmar`),
  fora do alcance da enumeração de controles de formulário, e nenhum campo novo.
- NÃO É CONTROLE — `/compromisso/[id]` (§2) e `/documento/[id]` (§3) recebem só
  chip + texto de consequência, em leitura, mais um `BotaoLink` de navegação.
