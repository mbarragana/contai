# CONTAI-012 — Manter o projeto Supabase acordado

## Tipo e Prioridade

- **Tipo**: chore de infraestrutura
- **Prioridade**: **P1**
- **Origem**: desmembrado do CONTAI-011 pelo `po` em 2026-08-16 (4ª revisão da
  fila). O argumento do auto-pause estava sendo usado para promover a US-011
  para a R1; o `po` rejeitou a promoção e separou o problema barato do caro.
- **Posição na fila**: **NÃO entra na R1.** Não captura dado e não é feature.
  Entra na **lista de infraestrutura de deploy**, no mesmo lugar em que "push do
  repo" e "conectar a Vercel" sempre estiveram: não é escopo de release, é
  condição para produção existir.
- **Gate 0 (mock)**: não se aplica — sem tela.
- **Gate Fiscal**: **sem impacto fiscal.** Este ticket não toca documento, não
  toca valor, não toca data e não produz saída para declaração. Registrado assim
  em vez de inventar regra.

## A frase que precisa estar escrita, senão isto vira teatro

> **O CONTAI-012 não copia nada, não toca no acervo e não conta como meta 3.**
> Ele mantém o projeto acordado. **O acervo continua sem cópia até a US-011
> (CONTAI-011).**

Sem essa frase, marcar este ticket como feito produz falsa sensação de proteção
— que é pior do que não ter feito nada, porque para de gerar urgência.

## Dor de Origem

[Certain quanto ao mecanismo; [Likely] quanto à janela exata de ~7 dias]
O plano gratuito do Supabase **pausa projetos com baixa atividade** num período
de ~7 dias. Projeto pausado = **app inteiro fora do ar**, com restauração
manual pelo dashboard.

O cenário concreto: o Mateus abre o contai no canteiro, com uma nota na mão e
uma mão livre, e o app não responde. Para destravar, precisa entrar no dashboard
do Supabase pelo celular. Duas semanas de obra parada bastam para isso
acontecer.

O contai não tem **nenhuma** rotina agendada hoje: `.github/workflows/` tem só
`ci.yml`, sem `schedule`, e o CI sobe stack local — nunca toca o projeto remoto.
O app só é aberto quando chega uma nota.

**Precedente que prova o padrão nesta conta**: o projeto vizinho
`../surf-forecast` está no **mesmo plano gratuito** e nunca pausa — não por
configuração especial, mas porque tem trabalho agendado batendo no banco todo
dia (`.github/workflows/daily-refresh.yml`, cron `0 7 * * *`;
`notify-users.yml`, cron `0 8-10 * * *`), com `SUPABASE_SERVICE_ROLE_KEY` como
secret do repositório.

**Ajuste factual, que reduz um pouco a urgência**: projeto pausado no free tier
**não perde dado** — perde disponibilidade, e restaura por botão. O dano é o app
fora do ar, não o acervo sumindo. Continua sendo dano real, e é **dano de
deploy**, não de acervo. É exatamente por isso que este ticket existe separado
do CONTAI-011.

## User Story

Como dono da obra, quero que o projeto Supabase de produção não seja pausado por
inatividade, para que o app esteja no ar quando eu abrir no canteiro depois de
semanas sem registrar nada.

## Critérios de Aceite

1. [ ] Existe um workflow agendado que faz uma **leitura barata** no Postgres de
   produção e um `head` no bucket `acervo`, sem escrever nada.
2. [ ] A periodicidade é **menor que a janela de pause** com folga — diária, não
   semanal. Semanal empata com a janela e não tem margem para uma execução
   falhar.
3. [ ] **Falha é visível.** Se o workflow falhar, o Mateus fica sabendo por um
   canal que ele lê. E-mail padrão do GitHub Actions **conta como mínimo aqui**
   (diferente do CONTAI-011, porque o dano é disponibilidade e recuperável, não
   perda irreversível).
4. [ ] O segredo fica **só no secret store do GitHub**, com escopo mínimo e
   caminho de revogação documentado. O repositório **é público**.
5. [ ] O workflow tem `workflow_dispatch` além do `schedule`, para dar para
   rodar à mão quando se quiser testar ou destravar.
6. [ ] `timeout-minutes` explícito — job pendurado não pode consumir a cota de
   Actions.
7. [ ] ⚠️ **Nota obrigatória no README do workflow**: [Likely] o GitHub
   **desativa workflows agendados após ~60 dias sem atividade de commit** no
   repositório. Como este job precisa viver anos, incluindo períodos sem
   ninguém commitar, o ticket registra o risco e — se a mitigação do recibo
   commitado do CONTAI-011 ainda não existir — deixa explícito que o workflow
   pode se desligar sozinho e ninguém ser avisado.

## Out of Scope

- **Copiar qualquer coisa.** É o CONTAI-011.
- **Monitoramento de uptime do app** (a URL da Vercel responder). Outro
  problema, outra ferramenta.
- **Migrar de plano.** Se o Mateus decidir pagar o Supabase, este ticket perde a
  razão de existir — e essa é a solução mais simples que existe para o problema.

## Dependências

- **Só faz sentido quando houver projeto remoto em uso**, ou seja, depois do
  primeiro deploy. Antes disso, não há nada para manter acordado.
- Não depende do CONTAI-002 nem do CONTAI-011.

## Viabilidade (CTO)

- **Complexidade: S.** Um arquivo `.github/workflows/manter-acordado.yml` e,
  no máximo, um script de dez linhas.
- **Bônus real, e é o motivo de fazer isto cedo**: ele constrói o andaime que o
  CONTAI-011 herda — workflow agendado, credencial de servidor para um projeto
  Supabase privado, e canal de alerta em falha. Cedo, barato e testado com carga
  leve; a carga pesada vem depois, com parecer.
- ⚠️ **Herda a decisão de credencial do CONTAI-011**: um job de servidor não tem
  sessão de usuário, e as policies do bucket amarram o caminho a `auth.uid()`.
  Se este ticket for feito primeiro, é ele quem **introduz no projeto a primeira
  credencial que ignora a RLS** — e a premissa "o MVP não usa secret key" morre
  aqui, não no CONTAI-011. Atualizar o comentário do `.env.example` junto.
- Alternativa que dispensa o segredo, a avaliar no Gate 2: se uma leitura numa
  tabela com policy pública bastar para contar como atividade, o job pode usar
  só a publishable key. [Guessing] — não se sabe qual tráfego o Supabase conta
  como atividade. Vale medir antes de introduzir a service key por causa disto.

## Pre-mortem

1. **O job roda, e o projeto pausa mesmo assim** — porque o tráfego que ele gera
   não é o que o Supabase conta como atividade [Guessing]. Modo de falha mais
   provável do ticket, e o único jeito de descobrir é observar por algumas
   semanas depois do deploy.
2. **O workflow se desliga sozinho** pelos 60 dias sem commit (critério 7), e
   ninguém percebe até o app estar fora do ar.
3. **Vira desculpa para adiar o CONTAI-011** — "o projeto não pausa mais, o
   acervo está seguro". É por isso que a frase do topo é obrigatória.

## Teste do Canteiro

Não se aplica — sem tela. O teste equivalente: passar o período de pause sem
abrir o app e, no fim dele, abrir a URL de produção no celular e ver o app
responder de primeira.
