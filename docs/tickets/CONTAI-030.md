# CONTAI-030 Corrigir o prazo de guarda que o app afirma depois de todo registro

## Roteamento do `/develop`
- **Tipo**: bug (afirmação fiscal errada **em produção**)
- **Prioridade**: **P0** — não move um centavo, e ainda assim é P0: é a **única**
  mensagem do app sobre prazo de guarda, aparece depois de **todo** registro, e
  o que ela autoriza é **descartar documento antes da hora**. Erro que induz
  destruição de prova é irreversível — a meta 3 do produto morre calada
- **UI**: sim, **Nível 3** (só o texto muda) — a proposta é a tabela
  antes/depois abaixo. **Não precisa de mock HTML nem de `/design`**
- **Gate Fiscal**: **SIM, e já está adjudicado** — texto sancionado pelo
  `contador` em 2026-08-22, com origem citada. Copiar, não reescrever
- **Migration**: nenhuma

## Dor de Origem

Achado em 2026-08-22, extraindo os specs dos mocks. Em `app/_components/registrado.tsx:60-61`, **no ar**:

> "Salvo em **{obraNome}**. Original guardado no acervo — fica disponível até a
> venda + 5 anos."

**São dois erros fiscais, não um** — e o `contador` insiste que o segundo é o pior:

1. **"venda + 5 anos"** é o atalho errado corrigido em 2026-08-16. O relógio é o
   do CTN art. 173, I: 5 anos do 1º dia do exercício seguinte à **última DAA que
   declarou qualquer parcela** do ganho. Venda em 2028 → **31/12/2034**. Há um
   segundo relógio, previdenciário. **Obra não vendida = prazo indefinido.**
2. **"Original guardado"** contraria o F3 do mesmo parecer: *"o papel é a prova;
   o arquivo do contai é o localizador"*. Um banner que diz "original guardado"
   **convida ao descarte do papel com a mesma força** que "+5 anos" convida ao
   descarte cedo. Corrigir só o prazo deixaria a pior das duas no ar.

## Proposta — Nível 3 (tabela antes/depois)

| Onde | Antes (no ar / no mock) | Depois (sancionado 2026-08-22) |
|---|---|---|
| `app/_components/registrado.tsx:60-61` | Salvo em **{obraNome}**. Original guardado no acervo — fica disponível até a venda + 5 anos. | Salvo em **{obraNome}**. Arquivo guardado no acervo — nada se apaga, e o prazo de guarda só começa a correr depois da venda. |
| idem, **fallback** se não couber em 2 linhas a 375px | — | Salvo em **{obraNome}**. Arquivo guardado no acervo — o prazo de guarda só começa depois da venda. |
| `design/mocks/CONTAI-001.html:260` (sem nome de obra) | **Salvo.** Original guardado no acervo — fica disponível até a venda + 5 anos. | **Salvo.** Arquivo guardado no acervo — nada se apaga, e o prazo de guarda só começa a correr depois da venda. |
| `design/mocks/CONTAI-009.html:671` | (idêntico ao do código) | (idêntico ao do código) |
| `design/mocks/CONTAI-011.html:1117-1118` (LEIA-ME do dossiê) | Guarde o original assinado enquanto o imóvel não for vendido, e por 5 anos contados do primeiro dia do ano seguinte à **declaração que informar a venda**. | Guarde o original assinado enquanto o imóvel não for vendido, e por 5 anos contados do primeiro dia do ano seguinte à **última declaração que informar qualquer parcela do ganho — venda parcelada tem mais de uma.** |

## Gate Fiscal (Contador) — adjudicado em 2026-08-22

**Origem, para citar e não rederivar**:
`docs/pareceres/2026-08-16-gate-fiscal-contai-011.md` — **F1, linhas 40-44**
(CTN art. 173, I), **acréscimos 2-4, linhas 66-84** (venda 2028 → 31/12/2034;
segundo relógio previdenciário; obra não vendida = indefinido), **linhas 86-91**
(o app não tem como calcular data de término) e **F3, linhas 183-188** (para a
palavra "Arquivo").

**As três decisões embutidas no texto, e por que cada uma:**

1. **"Arquivo"**, nunca "Original" nem "Cópia". XML de NF-e/NFS-e **é** o
   original (F3, 186-188); recibo em papel escaneado **não é**. Qualquer das
   duas palavras **mente em metade dos casos**. "Arquivo" é verdade sempre.
2. **Nenhum número de prazo em tela.** Obra não vendida = prazo indefinido
   [Certain] (F1, 82-84), e o app **não sabe** a data da venda, nem do último
   recebimento, nem da DAA (86-88). Qualquer prazo exibido é palpite. A frase
   afirma só o que é certo hoje e **nunca autoriza descarte**.
3. **"Guarde o papel" fica FORA do banner.** F3, 190-191: dar o aviso em toda
   tela *"seria carimbo — o mesmo vício que o adendo de 2026-08-10 rejeitou"*.
   O aviso é condicional ao tipo do documento; este banner aparece depois de
   tudo. → é o que motiva o **`CONTAI-031`**

⚠️ **ORDEM OBRIGATÓRIA, e ela não é negociável**: o parecer **já foi corrigido**
em 2026-08-22 (nota de correção no corpo dele), porque o texto do LEIA-ME em
`CONTAI-011.html` é **cópia literal** por exigência do critério 13 daquele
ticket. **Enquanto o parecer estivesse errado, "copiar literalmente"
reintroduziria o erro na próxima cópia.** Parecer primeiro, mock depois, código
depois.

## Critérios de Aceite

1. [ ] `app/_components/registrado.tsx` exibe o texto novo, **copiado da tabela
       acima, caractere por caractere** — não reformulado, não "melhorado"
2. [ ] A palavra **"Original"** não aparece mais nesse banner; a palavra
       **"Arquivo"** aparece
3. [ ] Nenhum número de prazo (nem "5 anos", nem "2034") aparece no banner
4. [ ] `grep -rn 'venda + 5' app lib` **não retorna nada**
5. [ ] Os 3 mocks e os 3 specs correspondentes são atualizados com o texto novo
       — spec e mock não podem divergir do código
6. [ ] Teste que trava a regressão: asserção do texto exato do banner, para que
       reescrevê-lo fique vermelho. Texto fiscal sem teste volta
7. [ ] `npm run quality` verde

## Out of Scope

- **Acrescentar o texto longo de prazo ao detalhe do documento** → `CONTAI-031`
- **A trava do papel**: a numeração da Lei 12.682/2012 e do Decreto 10.278/2020
  e a guarda previdenciária (Decreto 3.048/99 art. 225 §5º; Lei 8.212/91 art. 32
  §11) seguem **a confirmar na legislação** (parecer, linhas 335-342). ⚠️ O
  banner sancionado aqui **não depende de nenhuma delas** — por isso entra já
- Qualquer outra revisão de texto de tela

## Pre-mortem

1. **Alguém "melhora" a frase na implementação** e reintroduz um número de
   prazo porque "ficou vago". *Mitigação: critérios 1 e 3 são de rejeição.*
2. **Corrige o código e esquece os mocks**, e o próximo `/develop` que ler o
   spec do `CONTAI-001` reimplanta o texto velho. *Mitigação: critério 5.*
3. **Sai sem teste** e volta na próxima refatoração de componente.
   *Mitigação: critério 6.*

## Viabilidade (CTO)

- **Modelo de dados**: nenhum impacto. Sem tabela, sem `GRANT`, sem migration
- **Arquivos**: `app/_components/registrado.tsx`, 3 HTMLs em `design/mocks/`,
  3 specs `.md`, e o teste novo
- **Complexidade**: **S**. O trabalho todo é não estragar o texto no caminho

## Dependências

- Bloqueado por: nenhum. **Pode ir sozinho e deveria ir antes de tudo** — não
  depende de migration, então não entra na ordem `db push` → `git push`
- Bloqueia: nenhum

## Perguntas Abertas

- Nenhuma. O texto está sancionado e a origem citada

## Cenário e checagem final

**Gestão e captura, os dois** — o banner aparece depois de todo registro, no
canteiro e em casa. Por isso o fallback curto existe: a 375px, duas linhas é o
teto. Serve à **meta 3** de forma direta. Veredito: **APROVADO, P0**.
