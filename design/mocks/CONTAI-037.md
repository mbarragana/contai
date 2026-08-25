# CONTAI-037 — Link por linha em "Pagamentos desta nota" → `/pagamento/${p.id}`

**Nível 3 — tabela antes/depois.** Concordo com a leitura do orquestrador.
Nenhuma tela nova, nenhum componente novo: `BotaoLink` já existe e já é usado
lado a lado com outro `BotaoLink` de ação em telas conhecidas. Não há campo
novo, estado novo, nem decisão de densidade/hierarquia — é um segundo link
numa linha que já tem um. O Mateus julga isto lendo a tabela, não vendo mock.

Achado que reforça o nível 3: o par inverso **já existe em produção**. Em
`app/pagamento/[id]/page.tsx:305`, a tela de detalhe do pagamento já linka de
volta para o documento — `<BotaoLink href={`/documento/${d.id}`}>Ver o
documento</BotaoLink>`. O rótulo escolhido abaixo (`Ver o pagamento`) é o
espelho exato dessa convenção já validada, não uma invenção nova.

Sem campo fiscal, sem texto de consequência, sem anexo — não há disciplina
fiscal em jogo nesta mudança.

---

## Tabela antes/depois

| Pendência | Arquivo:linha | Atual → novo | Origem |
|---|---|---|---|
| Não há como ir da nota ao pagamento vinculado sem passar pela lista de pendências/documento | `app/documento/[id]/page.tsx`, `PagamentosDesteDocumento`, ~206-224 (bloco `<div className="mt-2">` que hoje só tem o `BotaoLink` de "Desligar este pagamento") | Um `BotaoLink` só, para desligar: `<BotaoLink href={`/documento/${documento.id}/desligar?pagamento=${p.id}`}>Desligar este pagamento</BotaoLink>` | → **Dois `BotaoLink`, o novo antes do existente**: `<BotaoLink href={`/pagamento/${p.id}`}>Ver o pagamento</BotaoLink>` seguido do `Desligar este pagamento` já existente, sem alterar href/texto/condição dele | Ticket CONTAI-037; rótulo espelha o par já em produção em `app/pagamento/[id]/page.tsx:305` (`Ver o documento`) |

## Rótulo escolhido

**"Ver o pagamento"** — simétrico ao `"Ver o documento"` que já existe na
direção inversa (`app/pagamento/[id]/page.tsx:305`), mesma convenção verbal
("Ver [artigo] [substantivo]") usada também em `app/page.tsx:376` ("Ver a
despesa") e `app/obras/[id]/page.tsx:137` ("Ver minhas obras"). Nenhum rótulo
novo sendo inventado — reaproveita padrão existente.

Ordem sugerida no markup: `Ver o pagamento` antes de `Desligar este
pagamento` — navegação (ação neutra, reversível) antes de ação destrutiva/de
estado, mesma ordem que a tela irmã (`pagamento/[id]`) usa hoje.
