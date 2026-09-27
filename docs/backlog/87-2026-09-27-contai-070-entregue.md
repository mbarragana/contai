# Gate 4 fechado, `CONTAI-070` entregue — 2026-09-27

## Resultado

Gate 4 (`po`), **12/12 critérios PASS**, sem migration, sem retrabalho.
Sugestão automática de `composicao`+`tributo` a partir do(s) rótulo(s) lidos
na linha de retenção — segunda metade da mesma decisão do Mateus que já tinha
produzido o `CONTAI-069` (CNO), agora estendida ao tributo, **sobrepondo** a
reprovação "sem exceção" do `contador` no parecer
`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md` (Pergunta 1). Registro
completo da decisão, com os dois pareceres,
`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md` (ADENDO).

## O que entrou

- `lib/extracao/tributo-rotulo.ts` (novo) — `sugerirTributoDoRotulo(rotulos)`:
  três passagens (marcador de combinação vence primeiro; exatamente uma
  categoria, a mesma em todos os rótulos empatados; nunca "melhor palpite").
  Corpus de teste desproporcional ao código, de propósito (é a única defesa
  contra classificar errado).
- `lib/extracao/retencao-texto.ts` ganha `rotulosEmpatados: string[]` em
  `SugestaoLinhaRetencao` — o conjunto INTEIRO que colapsou na mesma linha
  (CONTAI-068), não só o primeiro. `sugerirTributoDoRotulo` exige unanimidade
  entre eles.
- `app/api/sugerir-retencao/route.ts` devolve `tributoSugerido` como campo
  **IRMÃO** de `sugestao`, nunca dentro de `SugestaoLinhaRetencao` — divergência
  de arquitetura em relação ao mock original (que desenhava
  `categoriaSugerida` DENTRO do tipo), **julgada melhoria legítima no Gate 2**
  do `cto-obra`: o tipo `SugestaoLinhaRetencao`/`SugestaoDeLinha` continua
  garantindo, por construção, que `eDescontoEfetivo`/`quemRecolhe` não cabem
  ali; o campo irmão deixa a exceção do tributo visível no tipo da resposta,
  em vez de escondida dentro do tipo que serve de trava.
- `lib/fiscal/retencao.ts`: `linhaSugerida` ganha segundo parâmetro
  `tributoSugerido` (default `null`) — os dois campos nascem e morrem como
  PAR, nunca meio par; `SugestaoDeLinha` continua intocada.
- `app/_components/retencao.tsx` (`FormularioDeLinha`): estado único
  `origemComposicaoTributo` ("manual" | "sugerida" | null) governa os DOIS
  campos juntos — estruturalmente impossível representar um sugerido e o
  outro manual. Troca de anexo zera só a parte SUGERIDA; resposta manual
  sobrevive.
- `docs/tickets/CONTAI-038.md`: critério 14 ganhou exceção nomeada
  (`composicao`/`tributo`, sob as condições do `CONTAI-070`) para um Gate 0
  futuro não ler "proibido, sem exceção" e reverter a feature por engano.

## Prova de conformidade

`npm run quality` completo, stack local de pé: **1185 Vitest / 373
Playwright**, lint e typecheck limpos. Cobertura inclui o contraexemplo real
do parecer ("Total das Retenções (ISSQN / Federais)" → `null`), a colisão
ISS×INSS por fronteira de palavra, grupos PIS/COFINS/CSLL não abertos, e a
troca de anexo matando só a parte sugerida (unit + `e2e/captura-retencao-
desktop.spec.ts` 8.1–8.4).

**Arquivos alterados após o último APPROVE do cto-obra: nenhum.**

## Dívida nova — D88

Achado do `cto-obra` no Gate 2, não-bloqueante: a palavra-chave de IRRF em
`lib/extracao/tributo-rotulo.ts` é `/\bIR(RF|PJ)?\b/i` — case-insensitive
nessa sigla específica de 2 letras casaria o verbo comum "ir" (ex.: "Valor a
ir" sugeriria IRRF por engano). Risco baixo na prática (o rótulo ainda
precisa fechar a aritmética total−líquido do parser e passar pelo veto de
`RE_NAO_TRIBUTARIO` antes de chegar ao classificador), mas a sigla nua "IR"
deveria exigir maiúsculas (case-sensitive) para fechar de vez a brecha. É
vocabulário de classificação fiscal — precisa de olhar do `contador` antes de
virar ticket. Registrado como dívida, sem implementar.
