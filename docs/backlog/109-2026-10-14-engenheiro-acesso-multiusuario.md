# Relato — 2026-10-14 — engenheiro da obra acessando o sistema em nome do Mateus

## Origem (relato)

O Mateus tem um engenheiro que cuida das compras e acerta os serviços da
obra:

> "tenho um engenheiro da obra que cuida de todas as compras e acerta os
> serviços"

Hoje o fluxo é intermediado por WhatsApp/e-mail: o engenheiro manda a nota
(foto/PDF) pro Mateus, e o Mateus baixa e sobe manualmente no sistema. O
pedido é que o engenheiro **acesse o sistema diretamente**, em nome dele, e
faça essa parte:

> "seria ainda mais fácil pra mim se ao invés de ele me mandar a nota fiscal
> e eu baixar e subir no sistema, fizéssemos o processo inteiro pelo
> sistema"

## Dor extraída

Documento passa por um intermediário informal (WhatsApp/e-mail) antes de
entrar no sistema — risco de perda, atraso ou de nunca subir, porque depende
de duas pessoas e duas etapas manuais em vez de uma captura direto na fonte
(quem já está com a nota em mãos). Secundariamente, é trabalho duplicado do
Mateus (baixar + subir) que o próprio engenheiro poderia fazer de uma vez.

## Escopo da divisão de papéis — fechado nesta conversa, não reabrir

- **Engenheiro pode**: cadastrar `documento` (nota, com anexo obrigatório),
  criar `compromisso` (agendamento de pagamento — vencimento, valor
  previsto, favorecido), com todos os detalhes, exatamente como o Mateus
  faria.
- **Só o Mateus pode**: confirmar/registrar o `pagamento` de verdade — o ato
  que afirma que o dinheiro saiu da conta.
- O que o engenheiro cadastra aparece como **pendente** pro Mateus revisar —
  não é confirmação automática de nada.

Citação da correção do próprio Mateus sobre onde cai a linha: "essa pessoa
já colocaria a data do vencimento, adicionaria a nota e todos os detalhes
[...] Daí eu adiciono o pagamento ou agendamento de pagamento" — corrigido
por ele mesmo depois para deixar claro que o agendamento/compromisso também
pode ser feito pelo engenheiro; o que fica exclusivo do Mateus é a
confirmação do pagamento.

## Filtro das três metas

Argumento a favor da **meta 1** (nenhum pagamento sem documento hábil):
capturar o documento direto na fonte, por quem já está com ele em mãos,
reduz o número de etapas em que a nota pode se perder ou atrasar, comparado
ao atalho atual via WhatsApp/e-mail + upload manual. Não é conveniência
pura — é fricção de processo recorrente com efeito real sobre a chance de
documento entrar (ou não) no sistema. Por isso **P1**, não P0 (não é regra
fiscal sendo descumprida hoje) e não P2 (não é mero capricho).

## Precedente técnico que já existe — não repetir a investigação

`docs/backlog/63-2026-09-23-export-acervo-em-espera.md` e a nota "🛑 Em
espera" no topo de `docs/tickets/README.md`: o `CONTAI-011`/`049`/`050`
(export do acervo pro Google Drive) foi **pausado em 2026-09-23** porque o
desenho assumia "destino único, credencial central" e não escalava para
multiusuário — e a condição escrita para reabrir foi *"só quando o fluxo
comum de despesas e apuração de custo estiver estável e correto"*. Hoje toda
tabela relevante (`documento`, `pagamento`, `compromisso`, `obra`, etc.) tem
RLS do tipo `user_id = auth.uid()` — dono único, sem conceito de
colaborador.

Este relato é a **mesma pergunta de fundo chegando por uma dor real**, não
hipotética. O Mateus já foi avisado dessa tensão nesta conversa e decidiu
conscientemente seguir mesmo assim ("sim, vamos na opção 2") — registra-se
como decisão dele de prosseguir, não como reabertura do filtro de escopo
pelo PO.

## User story

**Como** o Mateus, que delega as compras e o acerto de serviços da obra a um
engenheiro de confiança, **quando** chega uma nota ou se fecha um
compromisso de pagamento com um fornecedor/prestador, **eu quero** que o
engenheiro cadastre o documento (com anexo) e crie o agendamento
diretamente no sistema, em um acesso próprio dele, **para que** eu não
dependa mais de receber a nota por WhatsApp/e-mail e subir manualmente, e
para que eu sempre revise — como pendente — o que ele cadastrou antes de
confirmar que o pagamento realmente saiu.

### Critérios de aceite

1. Existe um papel "colaborador" vinculado à obra do Mateus, distinto do
   papel "dono"; o colaborador loga com credencial própria (nunca
   compartilha a conta do Mateus).
2. O colaborador pode cadastrar `documento` com anexo obrigatório, sujeito
   às mesmas validações de documento hábil já vigentes para o dono (sem
   anexo, sem data, sem CNO impresso = pendência, igual ao fluxo manual
   atual).
3. O colaborador pode criar `compromisso` (vencimento, valor previsto,
   favorecido) vinculado a um documento, com os mesmos campos e a mesma
   disciplina fiscal (campo vazio pergunta, campo preenchido afirma; sem
   default em campo fiscal) do fluxo do dono.
4. O colaborador **não tem** acesso à ação de confirmar/registrar
   `pagamento` — bloqueado tanto na UI quanto no nível de dados (RLS/API);
   não é só esconder botão.
5. Todo `documento`/`compromisso` criado pelo colaborador aparece em uma
   fila "pendente de revisão" visível para o Mateus, com indicação de quem
   criou e quando.
6. O rastro de autoria (quem criou o registro) é permanente — sobrevive à
   revisão e à confirmação do pagamento feita depois pelo Mateus; não é
   sobrescrito nem apagado.
7. O acervo documental (meta 3) e os relatórios anuais (meta 2) permanecem
   íntegros e completos quando o documento/compromisso foi criado pelo
   colaborador, não pelo Mateus — nenhuma saída do sistema perde ou
   duplica esse registro por causa de quem o criou.

## Perguntas abertas (no máximo 3)

1. O colaborador deve ver **todos** os documentos/compromissos da obra
   (inclusive os que o Mateus já revisou/confirmou) ou só os que ele mesmo
   criou mais a fila de pendentes? Decide se o RLS é "colaborador com visão
   total da obra" ou "colaborador restrito ao que cadastra".
2. É só um colaborador por obra (o engenheiro) ou o modelo já precisa
   suportar mais de um ao mesmo tempo, ou troca de colaborador no meio da
   obra? Afeta se basta um campo simples ou se precisa de tabela de
   papéis/convites.
3. Como o colaborador entra a primeira vez — o Mateus cadastra o e-mail
   dele diretamente (sem fluxo de convite, dado que é só uma ou duas
   pessoas) ou precisa existir convite/aceite?

## Respostas do Mateus, 2026-10-14 — fecham as 3 perguntas acima

1. **Visibilidade: configurável, as duas opções existem.** Não é "ou/ou" —
   o colaborador pode ter visão restrita (só o que cadastra + pendentes) OU
   visão total da obra, a depender de uma configuração por colaborador.
   Implica um campo de permissão por vínculo colaborador↔obra, não uma
   constante fixa no código.
2. **Múltiplos colaboradores desde já.** Não é "1 engenheiro fixo" — o
   modelo precisa suportar N colaboradores por obra, com gestão de lista
   (adicionar, remover acesso). Reabre a complexidade que a opção "só 1"
   evitaria; aceito conscientemente pelo Mateus.
3. **Cadastro direto por e-mail, sem convite/aceite.** O Mateus informa o
   e-mail do colaborador numa tela, o acesso é liberado — sem fluxo de link
   de convite nem estado "convidado, aguardando aceite".

Essas três respostas **fecham** as perguntas 1-3 acima — não reabrir no
`/tickets-req`.

## Fora de escopo (não decidido aqui)

- **Dimensionamento (S/M/L/XL) e fatiamento** — isso é mudança de
  arquitetura (autenticação multiusuário, RLS por papel em várias tabelas,
  convite/gestão de acesso, rastro de autoria). Trabalho do Passo 3 do
  `/tickets-req`, consulta obrigatória ao `cto-obra`; não dimensionado aqui.
- **Comunicação com o empreiteiro** continua fora do produto (escopo
  declarado no `CLAUDE.md`) — este requisito é sobre o colaborador operar
  *dentro* do sistema, não sobre o sistema conversar com ele fora dele.
- **Cronograma de obra / orçamento vs. realizado de engenharia** — fora de
  escopo declarado, não tocado por este relato.

## Próximo passo

`/tickets-req` com consulta ao `cto-obra` (viabilidade/tamanho do
multiusuário) e ao `contador` se alguma regra de documentação hábil mudar
dependendo de quem captura (hipótese: não muda — documento é documento
independente de quem o cadastrou — mas fica para o Gate Fiscal confirmar).
