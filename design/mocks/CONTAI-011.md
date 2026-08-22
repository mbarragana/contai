# CONTAI-011 — spec do mock
Nível: 1 (HTML navegável)   Cenário: gestão   Arquivo: CONTAI-011.html
Telas: 23   Status no mock: "Mock NÃO aprovado — aprovação é ato do Mateus"

## Telas e estados
- **Home · linha de estado do export** (`#s1`–`#s7`): 6 estados no MESMO lugar, muda o peso não a posição —
  sucesso `#s1` "Cópia do acervo há 3 dias · 412 arquivos" | erro/atrasado `#s2` (CTA "Ver o que aconteceu")
  | vazio `#s3` "O acervo nunca foi copiado" (CTA "Ligar a cópia semanal") | erro/token `#s4` (CTA
  "Reconectar o Google Drive") | loading `#s5` (skeleton neutro, nunca verde) | erro/desconhecido `#s6`
  "Não deu para saber quando foi a última cópia" (retry "Tentar de novo") | bloqueado `#s7` (CTA "Dar destino aos 3")
- **Acervo — detalhe** (`#s8`): sucesso. Sem loading, sem vazio. Erro é `#s9`.
- **Acervo — falha + retry** (`#s9`): erro (retry "Reconectar o Google Drive"); saída alternativa "Gerar dossiê agora"
- **Triagem — lista** (`#s10`): sucesso c/ 3 itens; vazio/sucesso é `#s15`; sem loading; sem erro
- **Triagem — os três destinos** (`#s11`): sucesso; sem loading/vazio/erro
- **Destino 1 · Vincular** (`#s12`), **Destino 2 · Engano** (`#s13`), **Destino 3 · Documento da obra** (`#s14`):
  só sucesso; sem loading, vazio ou erro
- **Triagem — limpa** (`#s15`): vazio-positivo "Nenhum arquivo sem destino." (sem CTA obrigatório; "Voltar ao início")
- **Dossiê — escolher obra** (`#s16`): sucesso (2 obras); sem vazio/loading/erro
- **Dossiê — confirmar** (`#s17`): sucesso
- **Dossiê — gerando** (`#s18`): loading com progresso abandonável
- **Dossiê — pronto** (`#s19`): sucesso
- **Dossiê — entregar** (`#s20`): sucesso; sem vazio (lista de acesso sempre com ao menos 1)
- **Dossiê — falhou** (`#s21`): erro (retry "Tentar de novo" + saída secundária "Gerar assim mesmo, com a falta declarada")
- **LEIA-ME (prévia)** (`#s22`): estático
- **Avisos** (`#s23`): sucesso; toggle de 2 opções

## Campos
- `motivo do descarte` (`#s13`) — texto livre — OPCIONAL ("Por quê? (opcional)") — sem validação — vazio, placeholder "ex.: subiu duas vezes"
- `tipo de documento da obra` (`#s14`) — seleção — OBRIGATÓRIO (*) — lista: Alvará · ART/RRT · Matrícula do imóvel · Habite-se ·
  Projeto aprovado · Contrato de empreitada · CND da obra · Outro — SEM DEFAULT — campo fiscal
- `obra` (`#s14`) — seleção — OBRIGATÓRIO (*) — "o dossiê é por obra, e um documento sem obra não entra em dossiê nenhum" — SEM DEFAULT — campo fiscal
- `data do documento` (`#s14`) — data — opcional (sem *) — sem validação declarada — SEM DEFAULT
- `para quem` (`#s20`) — e-mail — OBRIGATÓRIO (*) — sem validação declarada — SEM DEFAULT
- `quem é` (`#s20`) — texto — opcional — sem validação — SEM DEFAULT
- `avisos` (`#s23`) — toggle 2 opções ["só quando falhar" | "a cada cópia"] — default desenhado: "só quando falhar" (declarado como pergunta M3 em aberto)

## Textos com consequência fiscal
- "Não entra no custo de aquisição. Peça a nota no seu CPF." — card de quarentena na home (`#s1`)
- "Não é falha da cópia — é pendência que já existia. Pagamento sem documento hábil não sustenta custo de aquisição."
  — `#s8`, card "Sem comprovante no acervo" (fonte: R7 do parecer do contador, 2026-08-16)
- "“órfão no pacote é documento sem vínculo com pagamento nenhum — numa conferência levanta *‘e este gasto, por que não está declarado?’*”"
  — `#s10` (cópia literal — parecer do contador, CONTAI-011 seção Dependências, 2026-08-16)
- "Isto não apaga nada. O arquivo continua no acervo — o contai não tem como apagar do acervo, de propósito. O que muda é
  que ele para de bloquear a cópia e fica fora do pacote." — `#s13`
- "Documento que descreve a obra e não é um gasto: não tem favorecido, não tem valor, não entra no custo de aquisição.
  Guardar é obrigatório; somar seria erro." — `#s14`
- "Uma obra por vez, sem opção de “as duas”. Não existe declaração que some as duas obras no lado dos bens: cada matrícula é um item." — `#s16`
- "O índice traz nome e CPF/CNPJ completos dos prestadores. Trate o pacote como documento privado: quem receber, recebe os
  dados deles também." — `#s17` (R8 do parecer, LGPD e terceiros)
- "Só quem você nomear aqui consegue abrir. Não existe link aberto: o pacote tem todas as suas notas, com CPF e CNPJ de terceiros." — `#s20`
- "Este pacote não será reescrito. Se um valor, uma data ou a obra de um registro mudar depois, o próximo pacote é novo e
  cita este — e os dois continuam existindo." — `#s19` (R5 do parecer, 2026-08-16)
- "O pacote não é gerado incompleto de propósito. Um dossiê que parece completo e não está faz parar de procurar — e a hora
  de descobrir isso não é na venda." — `#s21`
- **LEIA-ME.txt** (`#s22`, cópia literal da "versão longa" do F3 — parecer de 2026-08-16, não reescrita nem resumida):
  "**Este arquivo é uma cópia, não o original**
  Documento que nasceu em papel — recibo assinado, comprovante impresso, contrato — só teria o mesmo valor do original se a
  digitalização seguisse os requisitos técnicos e a assinatura digital ICP-Brasil da Lei 12.682/2012 e do Decreto 10.278/2020.
  O contai não faz isso: o que ele guarda é cópia simples.
  Na prática: a cópia serve para localizar, conferir e não perder. Se a Receita pedir, quem responde é o papel.
  **Guarde o original assinado** enquanto o imóvel não for vendido, e por 5 anos contados do primeiro dia do ano seguinte à última declaração que informar qualquer parcela do ganho — venda parcelada tem mais de uma.
  Nota fiscal eletrônica (NF-e / NFS-e) é diferente: ela já nasce digital, o arquivo é o original e não há papel a guardar."
- **"Por quanto tempo guardar"** (`#s22`, trechos copiados do F1 e da Q10 — parecer de 2026-08-16):
  "O relógio é o da decadência tributária: 5 anos contados do primeiro dia do exercício seguinte àquele em que o lançamento
  poderia ter sido efetuado — CTN, art. 173, I.
  Obra não vendida = prazo indefinido.
  O relógio nunca dispara exclusão automática — só informa.
  Regra prática: guardar o maior dos dois relógios (o do imposto de renda e o previdenciário), contado o previdenciário da
  regularização/CND da obra."
- **"O que este pacote NÃO contém"** (`#s22` e `#s17`, lista do F4 — critério 13(c)): escritura / contrato de compra do
  terreno · certidão da matrícula com o registro da compra · guia e comprovante do ITBI · guia e comprovante de escritura e
  registro · ART/RRT do responsável técnico · habite-se / certidão de conclusão · CND da obra e averbação na matrícula.
  Em `#s17` a lista aparece como: nada da Casa do Morro · escritura do terreno · certidão da matrícula · ITBI · habite-se ·
  CND da obra · "número e data de emissão das notas — ainda não existem no contai"

## Navegação
- Home (qualquer estado) → Acervo `#s8` ou Falha `#s9` — toque na linha de estado / CTA do estado
- Home bloqueada `#s7` → Triagem `#s10` — "Dar destino aos 3"
- Triagem `#s10` → Destinos `#s11` — toque num arquivo | `#s11` → `#s12`/`#s13`/`#s14` — escolha do destino (sem default, sem "pular")
- `#s12`/`#s13`/`#s14` → Triagem limpa `#s15` — salvar a decisão; qualquer um → `#s11` "Voltar"
- Acervo `#s8` → `#s16` dossiê | `#s22` LEIA-ME | `#s23` avisos — cards de ação
- `#s16` → `#s17` → `#s18` → `#s19` → `#s20` — escolher obra, confirmar, gerar, pronto, entregar
- `#s18` → `#s21` — falha na conferência final; `#s21` → `#s18` (retry) ou `#s19` (gerar com falta declarada)
- Acervo falha `#s9` → `#s16` — "Gerar dossiê agora" (saída manual dentro do erro)

## Decisões de design visíveis no mock
- A linha de estado do export tem **posição fixa** na home; o que muda entre os 6 estados é o peso visual, nunca o lugar.
- O gatilho de vermelho é **2× a cadência** (semanal → âmbar de 7 a 14 dias, vermelho a partir de 14).
- A linha conta **arquivos fora da cópia**, não só "há N dias" — "38 arquivos em um lugar só" é perda, "há 23 dias" é métrica.
- **Silêncio conta como falha**: se a fonte do estado não responde, a tela mostra erro, nunca verde otimista (nem no loading).
- Triagem: nenhum dos 3 destinos é default e não existe "pular"; "engano" não apaga arquivo (acervo append-only, é reversível).

## Dúvidas
- **Prazo de guarda — texto do LEIA-ME.** "e por 5 anos contados do primeiro dia do ano seguinte à declaração que informar a
  venda" (`#s22`) não é idêntico à regra do CLAUDE.md ("última DAA que declarou **qualquer parcela** do ganho"). Copiado como
  está; **conferir com o contador antes do Gate 1**. O card "Por quanto tempo guardar" da mesma tela já traz o CTN art. 173, I.
- O próprio mock trava: "a numeração da Lei 12.682/2012 / Decreto 10.278/2020 precisa ser conferida na legislação vigente
  antes de ir para o produto" (`#s22`).
- **De onde o app lê o estado do export?** (`#s6`, marcada como bloqueante do Gate 2) — o recibo está em
  `docs/export/ultimo-export.md`, no repositório, e o app na Vercel não lê o Git. Sem fonte alcançável, o critério 6(c) não existe.
- **"Reconectar o Google Drive" (`#s4`, `#s9`) pode existir?** O refresh token vive em GitHub Secret e o app não escreve lá.
- **`drive.file` alcança conceder/revogar permissão** nos arquivos que o app criou (`#s20`)? Se não, o critério 11 fica sem verificador.
- **Conflito de escopo do dossiê** (`#s17`): critério 12 manda incluir Bens e Direitos + Pagamentos Efetuados + recibo da DAA;
  R6 do parecer diz que o dossiê do comprador não deve conter a outra obra nem cópia da DAA. Duas versões, ou critério 12 só p/ acervo próprio?
- **Campos obrigatórios da categoria "documento da obra"** (`#s14`): tipo e obra bastam, ou número e órgão emissor também?
  A lista de tipos é leitura do F4, não lista confirmada do produto.
- **"Gerar assim mesmo, com a falta declarada"** (`#s21`) existe mesmo? Critério 5 manda falhar alto — desenhado como saída consciente.
- Busca do vínculo (`#s12`) alcança registros de **outra obra**? O arquivo órfão não sabe de que obra é.
