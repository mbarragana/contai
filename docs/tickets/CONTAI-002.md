# CONTAI-002 — Autenticação real (entrar e sair do app)

## Tipo e Prioridade
enabler — **P0** — bloqueador de deploy. Sem isto o app publicado é
inutilizável: criar usuário no dashboard do Supabase e injetar sessão no
`localStorage` pelo DevTools do celular não sobrevive ao uso real.

## Dor de Origem
Relato 003 (2026-08-09): *"criar um ticket para login e criação de nova obra"*.
Fato técnico que a motivou: RLS está ligada em toda tabela (`0001_init.sql`),
o app exige sessão e **não existe tela de login**. Em desenvolvimento isso é
suprido por `supabase/seed.sql` (usuário `mateus@contai.local`); em produção
não há seed.

## User Story
Como dono da obra, no canteiro, de celular, quero entrar no app com o meu
e-mail e continuar logado entre visitas, para registrar uma nota sem passar
pelo dashboard do Supabase.

## Critérios de Aceite
1. [ ] Mock aprovado pelo Mateus (tela de login, estado de espera do link,
       erro de link expirado) em `design/mocks/`, 375px, uma mão
2. [ ] Login por magic link / OTP no e-mail (Supabase Auth), sem senha
3. [ ] A sessão persiste entre aberturas do app — fechar e reabrir o PWA não
       pede login de novo
4. [ ] Rota pedida sem sessão → redireciona para o login e **volta para a rota
       pedida** depois de entrar (o deep link do lembrete do Google Calendar,
       US-002, não pode cair na home)
5. [ ] Erro "sem sessão" é distinguível em tela do erro "banco fora" — hoje os
       dois viram a mesma tela (ligado a CONTAI-006)
6. [ ] Existe logout, e ele limpa a sessão
7. [ ] E2E afirma o **estado gravado, não a tela**: cliente sem sessão não lê
       nenhuma linha de `obra`, `documento` ou `pagamento` — a RLS é a única
       guarda do acervo fiscal (CPF, CNO, notas)
8. [ ] `supabase/seed.sql` deixa de ser o caminho de criação de usuário em
       produção; segue existindo só para dev/e2e

## Gate Fiscal (Contador)
**Não aplicável — este ticket não carrega regra fiscal.** A consulta ao
contador em 2026-08-09 (Q7–Q10) não produziu nenhuma exigência sobre
autenticação. Registro a única consequência fiscal indireta:

- **Se** a sessão cair no meio de um registro → o dado já digitado **não pode
  sumir em silêncio**: o documento que não é registrado no canteiro tende a
  não ser registrado nunca, e custo não comprovado não existe
  (IN SRF 84/2001 art. 17).

## Out of Scope
- Multiusuário / convidar o contador para ver a obra — não serve nenhuma das
  três metas hoje e alarga a superfície da RLS
- Senha, SSO, 2FA, recuperação de conta por outro canal
- Cadastro de obra e obra ativa — **CONTAI-003** (deploy conjunto, ver abaixo)

## Pre-mortem
1. Magic link abre no navegador padrão e não no PWA instalado → ele "loga" numa
   aba e o app continua deslogado. Mitigação: testar o fluxo no celular real
   antes de dar DONE, não só no e2e
2. Sessão expira em silêncio no meio do formulário de documento → ele digita
   tudo e perde no "salvar". Mitigação: critério 5 + preservar o formulário
3. Login vira fricção diária no canteiro (link no e-mail toda vez) → ele para
   de registrar na hora. Mitigação: critério 3 é o critério que mais importa
   deste ticket

## Viabilidade (CTO)
- Supabase Auth com magic link; `@supabase/ssr` para sessão em Server
  Components (o app é Next.js 16 App Router)
- Nada muda no schema. `auth.uid()` já é o default de `user_id` em todas as
  tabelas
- Complexidade: **S/M**

## Dependências
- **Bloqueado por**: mock aprovado (critério 1)
- **Bloqueia**: qualquer uso do app em produção
- **Deploy conjunto obrigatório com CONTAI-003**: sozinho, este ticket entrega
  um login que desemboca em `ObraAusenteError` — beco sem saída. Os dois são
  tickets separados (trabalho e teste independentes), mas **uma única release**

## Perguntas Abertas
- Nenhuma que bloqueie. O e-mail de login é o `mateus.barragana@gmail.com`
  (assumido; se for outro, só muda o dado do primeiro acesso)

## Teste do Canteiro
- Metas atendidas: nenhuma diretamente — é o que **destrava** as três em
  produção. Registro isso com honestidade: é infraestrutura, não valor fiscal
- Uma mão, com pressa: sim, se o critério 3 segurar (não pedir link toda vez)
- **Veredito: APROVADO** — condicionado a mock aprovado
