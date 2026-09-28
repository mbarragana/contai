# CONTAI-078 — busca na lista de candidatos de vínculo

**Cenário: gestão** (mesmas telas do CONTAI-074). Nível 2 — bloco/estado a
mais em tela existente; spec + ASCII, sem HTML. Referência:
`design/mocks/CONTAI-074.md` (marca "já ligado a", bloco colapsado,
`Consequencia` ao marcar — nada disso muda).

## Onde o campo aparece

Só quando `pronto.candidatos.length > 5` (TOTAL: visíveis + cobertos, antes
de qualquer filtro). Abaixo de 6, ordenação já resolve — campo não renderiza
e nenhuma regra deste ticket entra em vigor. Posição: logo abaixo do `Card`
"Sugestão é ordenação, não vínculo", acima de `Passo`/lista/card vazio/bloco
colapsado.

```
[ Sugestão é ordenação, não vínculo. ]      (Card, já existe)
[ Buscar por favorecido ou valor…    ]      ← NOVO, só se total > 5
Pagamentos desta obra                        (Passo)
[ ] Favorecido ......... R$ X,XX
[ ] Favorecido ......... R$ X,XX
( bloco "Mostrar N já cobertos", se houver )
```

`<input type="text">` simples — mesmo padrão do filtro de `despesas/page.tsx`
(sem componente novo, sem ícone real de lupa). `onChange` filtra a cada
tecla, sem debounce (lista inteira já em memória, substring local).

## Campos

- `termoBusca` — texto livre, **não é campo fiscal**: nasce `""`, não
  persiste (recarregar zera, mesmo padrão de `revelarCobertos`) — SEM DEFAULT.
  O marcador está aqui porque o campo nasce vazio de fato, não por disciplina
  fiscal: essa disciplina protege afirmação fiscal, e busca não afirma nada,
  só filtra.
- NÃO É CONTROLE — `/documento/[id]/ligar` (candidato = pagamento):
  `aria-label="Buscar pagamentos"`,
  `placeholder="Buscar por favorecido ou valor…"`.
- NÃO É CONTROLE — `/pagamento/[id]/ligar` (candidato = documento):
  `aria-label="Buscar notas"`,
  `placeholder="Buscar por favorecido, valor ou número da nota…"` (índice
  inclui `numero` da nota, já fixado pelo `cto-obra`).

## Onde o "Mostrar N já cobertos" conta N

**Do subconjunto FILTRADO dos cobertos**, sempre — busca vazia dá o mesmo N
de hoje; com busca ativa, `cobertosFiltrados = filtrarCandidatos(cobertos,
termoBusca)` e o rótulo usa `cobertosFiltrados.length`. Filtro reduzindo
24→3 cobertos: botão vira **"Mostrar 3 pagamentos já cobertos"**, não 19 nem
24. O bloco continua **colapsado por padrão** mesmo com match lá dentro
(critério do PO) — só a contagem reage, a visibilidade não. Revelado, a
lista mostra os `cobertosFiltrados` (não os 24); digitar depois de revelado
re-filtra a mesma lista, sem estado extra. Some por completo (sem "Mostrar
0…") quando `cobertosFiltrados.length === 0`, revelado ou não.

## Estado novo: vazio-por-filtro (distinto do vazio-de-verdade)

O card de vazio-de-verdade de hoje ("💸 Nenhum pagamento para ligar" / "📄
Nenhum documento para ligar" + `Consequencia` de custo fora do Custo
confirmado) passa a depender do conjunto **SEM filtro**
(`visiveisBase.length === 0`: não existe, na obra, candidato com saldo
livre). Não muda de condição nem de texto por causa da busca — é verdade
estrutural, aparece igual com ou sem termo digitado.

O card **novo** só entra quando `termoBusca` não é vazio **e** o filtro zera
a parte visível (`visiveisFiltrados.length === 0`), com dois textos:

**(a) Nada bate em lugar nenhum** (`cobertosFiltrados.length === 0` também):
título `🔎 Nada encontrado para "{termo}"`; corpo *"Nenhum pagamento desta
obra combina com esse texto. Confira a grafia ou tente um valor
diferente."*; botão `[ Limpar busca ]`.

**(b) Só bate entre os já cobertos** (`cobertosFiltrados.length > 0`):
título `🔎 Nada encontrado para "{termo}" nos pagamentos livres`; corpo
*"Pode estar entre os {N} já ligados a outra nota — abra "Mostrar {N}…"
logo abaixo para conferir."*; botão `[ Limpar busca ]`.

Nos dois casos, **sem `Consequencia`** — inverso do card de hoje: a ausência
é do filtro, não do pagamento/documento, não há custo fiscal em risco a
anunciar. `Passo` "Pagamentos desta obra" não renderiza junto. Espelhar em
`/pagamento/[id]/ligar` trocando pagamento↔nota (mesmo padrão do CONTAI-074).

`[Limpar busca]` = `Botao variante="ghost"`, `onClick={() => setTermoBusca("")}`
— não mexe em `revelarCobertos`.

## Navegação

Sem rota nova, sem submit: filtro síncrono em memória a cada `onChange`.
Marcar candidato, salvar e revelar cobertos continuam iguais — a busca só
reduz o array antes de renderizar.

## Decisões e perguntas abertas

- Nome de função/arquivo (`filtrarCandidatos` em
  `lib/gestao/busca-candidatos.ts`, `normalizar` promovida para
  `lib/texto.ts`) é decisão do `cto-obra` — só refleti aqui.
- Minha decisão: busca **nunca revela `cobertos` automaticamente**, mesmo
  quando o único match está lá dentro — o usuário ainda clica "Mostrar N…".
  Consistente com o CONTAI-074 (revelar é ação explícita) e evita que digitar
  uma letra reordene a tela sem toque direto.
- Nada pendente para o `contador`: os dois textos novos não afirmam fato
  fiscal, só ausência de resultado de busca.
