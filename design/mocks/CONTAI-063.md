# CONTAI-063 — quarta opção no dropdown de Situação (`/despesas`): isolar "Sem pagamento ligado"

Cenário: **gestão** (`/despesas`, em casa, sentado — revisão da tabela para decidir o que falta agendar/registrar). Teste do Canteiro não se aplica.

**Nível confirmado: 2.** Uma opção a mais num `<select>` que já existe, em tela já existente, sem rota nova, sem layout novo, sem estado novo além do que os outros dois filtros de Situação já cobrem (banner de "0 com estes filtros" já existe e já é genérico — ver seção 3). Estruturalmente idêntico ao precedente já registrado no spec do CONTAI-060 ("os `<select>` de Situação/Tipo já existentes em `/despesas` são nível 2"). Não há decisão de densidade, hierarquia ou quebra em 375px em aberto: o controle é o mesmo `<select>` de sempre, só ganha um `<option>`.

## Campos

- SEM CAMPOS — é filtro de leitura (não grava nada), mesma natureza de Situação/Tipo/Busca hoje. Nenhuma disciplina de campo fiscal (vazio pergunta, preenchido afirma, anexo obrigatório) se aplica aqui.

## 1. Rótulo, posição e comportamento

```
[ Todas as situações ▾ ]        [ Todos os documentos ▾ ]     [ Buscar favorecido… ]      N de M lançamentos em 2026

  ┌ Todas as situações
  │ Só comprovadas
  │ Só com pendência
  └ Sem pagamento ligado   ← NOVA, no fim da lista
```

- **Rótulo exato: "Sem pagamento ligado"** — reaproveita literalmente o texto do chip já exibido linha a linha (`CHIP_SEM_PAGAMENTO`, `lib/fiscal/despesas.ts:119`). Não inventa um segundo nome para a mesma coisa; quem já reconhece o chip na tabela reconhece a opção no dropdown. Não leva o prefixo "Só" das outras duas ("Só comprovadas", "Só com pendência") porque "Sem pagamento ligado" já é autoexplicativo sozinho — "Só sem pagamento ligado" soa estranho e não ganha clareza.
- **Posição: no fim da lista**, depois de "Só com pendência". Motivo: as três opções atuais formam uma progressão de leitura (tudo → o que já está ok → o que está em risco); "Sem pagamento ligado" é o terceiro estado do parecer §5.2 — nem comprovado, nem em risco — e entra como adição ao final, não intercalada, para não reordenar o que já existe e para não implicar hierarquia de urgência que ela não tem (ela é neutra por desenho, critério que este ticket não muda).
- **Comportamento do filtro**: com a opção selecionada, a tabela mostra exclusivamente as linhas que carregam o chip "Sem pagamento ligado" — nenhuma linha comprovada, nenhuma linha em pendência. Compõe com Tipo, Busca e (quando `CONTAI-060` estiver em produção) Ano exatamente como "Só comprovadas" e "Só com pendência" compõem hoje: E lógico entre os filtros ativos, sem exceção de ordem.
- As três opções existentes **não mudam**: mesmo rótulo, mesma posição relativa entre si, mesmo comportamento — a opção nova é estritamente aditiva.

## 2. Contagem da barra

Sem texto novo. Reaproveita o padrão já existente e genérico:

- `"{total} lançamentos em {ano|todos os anos}"` quando `visiveis === total`;
- `"{visiveis} de {total} lançamentos em {ano|todos os anos}"` quando o filtro reduz a lista.

Não há necessidade de uma frase específica tipo "N notas sem pagamento ligado" — a contagem já é genérica em relação ao valor de Situação selecionado (o mesmo texto serve para "Comprovadas", "Pendência" ou esta opção nova).

## 3. Estado vazio (0 linhas com o filtro ativo)

Sem estado novo. Reaproveita o banner âmbar genérico que já existe para "filtro ativo zerou a lista" (`visiveis.length === 0` em `app/(gestao)/despesas/page.tsx:188-202`):

> **Nenhum lançamento com estes filtros.** A obra tem {linhasDoAno.length} {lançamento(s)} em {ano} — o filtro é que está escondendo.
> [Mostrar todos]

Esse banner já é agnóstico ao valor de Situação (não cita "comprovadas" nem "pendência" por nome hoje) — não precisa de variante para "Sem pagamento ligado". O botão "Mostrar todos" já reseta para `FILTROS_PADRAO`, saindo dessa opção também.

## 4. Fora de escopo (herdado do relato, reafirmado aqui)

- Nome interno do valor do filtro (`FiltroSituacao`) e mecanismo de correspondência (novo literal vs. checar `linha.situacoes` por chip) — decisão do `cto-obra`/`lead-engineer`, não do design.
- Nenhuma mudança na cor/neutralidade do chip `CHIP_SEM_PAGAMENTO` nem em `temPendencia` — continua nem comprovado, nem em risco.
- Nenhuma ação em lote a partir da lista filtrada.
- Não espelha em `/pendencias` (não é pendência).

## Decisões e perguntas abertas

Nenhuma pergunta bloqueante. Rótulo e posição fechados acima; texto de contagem e estado vazio não precisam de variante nova porque os existentes já são genéricos o bastante. Sequenciamento de código (depois do `CONTAI-060` fechar `lib/fiscal/despesas.ts`) já está registrado no backlog de origem e não é decisão de design.
