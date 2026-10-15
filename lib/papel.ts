/**
 * **CONTAI-093 — quem é quem, em funções puras.**
 *
 * Nada aqui toca Supabase, `window` ou React: as três perguntas do ticket
 * ("sou dono ou colaborador desta obra?", "quem criou este registro?", "qual
 * shell abre no login?") são decisões sobre dados que a camada de dados já
 * trouxe. É o que permite provar as três no Vitest, sem browser e sem banco.
 *
 * ⚠️ **Nenhuma regra fiscal mora aqui, e isso não é acidente.** O Gate Fiscal
 * do ticket é explícito: visibilidade entre colaboradores é questão de
 * produto/privacidade, sem regra de IRPF/ganho de capital/CNO-SERO por trás. Se
 * um dia alguém precisar de `lib/fiscal/*` neste arquivo, a pergunta mudou de
 * natureza e o ticket é outro.
 */

/** Papel de um usuário DENTRO DE UMA OBRA. */
export type PapelNaObra = "dono" | "colaborador";

/**
 * Papel da SESSÃO — qual shell o app abre. Mesmos dois valores de
 * `PapelNaObra`, e o tipo é deliberadamente o mesmo: um terceiro valor
 * ("visitante", "sem papel") seria um estado que nenhuma tela sabe desenhar.
 */
export type PapelDaSessao = PapelNaObra;

/**
 * Dono ou colaborador NESTA obra.
 *
 * ⚠️ A pergunta é sempre por obra, nunca global — é a mesma lição da correção
 * de `visibilidade_na_obra` na Emenda 2026-10-14: a mesma pessoa pode ser
 * colaboradora de duas obras do Mateus com visibilidades diferentes, e
 * (por decisão fora de escopo) dona de uma obra própria enquanto colabora em
 * outra. "Papel" sem obra ao lado é a pergunta mal feita.
 */
export function papelNaObra(
  donoDaObraUserId: string,
  usuarioId: string,
): PapelNaObra {
  return donoDaObraUserId === usuarioId ? "dono" : "colaborador";
}

/** O que `nomeDoAutor` precisa saber sobre um vínculo para resolver o nome. */
export interface AutoriaConhecida {
  /** `null` = vínculo ainda pendente (conta não existe): não resolve autor. */
  colaboradorUserId: string | null;
  nome: string;
}

export interface ContextoDeAutoria {
  /** Quem está olhando a tela. */
  usuarioId: string;
  /** O dono do acervo — `obra.user_id`, que é também `documento.user_id`. */
  donoUserId: string;
  /**
   * Os vínculos da obra que o observador CONSEGUE ler. Para o dono são todos
   * (ativos e removidos — é por isso que o nome sobrevive à revogação,
   * critério 13); para o colaborador, pela RLS da 0030, é só o dele.
   */
  colaboradores: AutoriaConhecida[];
}

/**
 * ⚠️ **Texto de produto, não técnico, e é a resposta PROVISÓRIA da Pergunta
 * Aberta 7 do ticket** (proposta do pipeline: sem nome). Quando um colaborador
 * vê um item criado por OUTRO colaborador, a RLS não lhe dá como ler o nome do
 * outro, e expor esse nome custaria uma função `security definer` nova — o
 * Mateus ainda não decidiu se vale. Até ele decidir, a tela diz o que sabe.
 */
export const AUTOR_DESCONHECIDO = "Outro colaborador";
export const AUTOR_EU = "Você";
export const AUTOR_DONO = "Dono da obra";

/**
 * Como exibir "criado por" de um registro.
 *
 * A ordem das cláusulas é o desenho: **eu** antes de **dono** porque, para o
 * Mateus olhando o próprio acervo, as duas são verdadeiras e "Você" é a que
 * informa. **Dono** antes do vínculo porque o dono nunca tem linha em
 * `obra_colaborador` (a constraint `obra_colaborador_nao_e_o_dono` o proíbe), e
 * procurá-lo lá devolveria `AUTOR_DESCONHECIDO` para o próprio dono da obra.
 */
export function nomeDoAutor(
  criadoPor: string,
  ctx: ContextoDeAutoria,
): string {
  if (criadoPor === ctx.usuarioId) return AUTOR_EU;
  if (criadoPor === ctx.donoUserId) return AUTOR_DONO;
  const vinculo = ctx.colaboradores.find(
    (c) => c.colaboradorUserId !== null && c.colaboradorUserId === criadoPor,
  );
  return vinculo ? vinculo.nome : AUTOR_DESCONHECIDO;
}

/** O que a camada de dados conta para decidir o shell (critério 16). */
export interface ContagensDaSessao {
  /** Obras com `user_id = auth.uid()` — as que ele POSSUI. */
  obrasProprias: number;
  /**
   * Linhas de `obra_colaborador` com `colaborador_user_id = auth.uid()`,
   * **ativas OU removidas**.
   *
   * ⚠️ Contar as removidas é decisão, não descuido: quem teve o acesso revogado
   * continua abrindo o shell de colaborador — onde a tela (b) diz "você ainda
   * não foi vinculado a nenhuma obra" — em vez de cair no shell de dono e
   * receber um convite para "cadastrar a primeira obra". A segunda opção
   * ofereceria ao engenheiro da obra uma obra própria dentro do app do Mateus.
   */
  vinculosDeColaborador: number;
}

/**
 * **Qual shell abre no login** (critério 16, Emenda 2026-10-14).
 *
 * A ordem é a decisão inteira:
 *
 * 1. **possui obra → `'dono'`**, sempre, mesmo que também colabore em obra de
 *    terceiros. É a consequência ACEITA que o Out of Scope do ticket nomeia:
 *    esse usuário nunca vê os vínculos de colaborador dele enquanto tiver obra
 *    própria. Não é bug a corrigir sem decisão nova do Mateus — é o preço de
 *    não ter dois shells abertos ao mesmo tempo, que ninguém desenhou;
 * 2. **não possui obra mas tem vínculo → `'colaborador'`**;
 * 3. **nem obra nem vínculo → `'dono'`**, que é o PRIMEIRO ACESSO do Mateus:
 *    conta nova, nenhuma obra, e o que ele precisa é da tela que cadastra a
 *    primeira. Mandar este caso para `/colaborador` daria "você não foi
 *    vinculado a nenhuma obra" a quem acabou de criar a própria conta.
 */
export function papelDaSessao(contagens: ContagensDaSessao): PapelDaSessao {
  if (contagens.obrasProprias > 0) return "dono";
  if (contagens.vinculosDeColaborador > 0) return "colaborador";
  return "dono";
}

/** A rota raiz de cada shell. Constantes porque guarda e login têm de concordar. */
export const ROTA_DO_COLABORADOR = "/colaborador";
export const ROTA_DO_DONO = "/";

/**
 * Para onde mandar depois do login, dado o papel e o destino pedido.
 *
 * ⚠️ O destino pedido VENCE quando ele já é do shell certo: quem abre
 * `/colaborador/<obra>` por um link não pode ser jogado na lista de obras. O
 * que a guarda corrige é o destino do shell ERRADO — inclusive o `/` default,
 * que é a home do dono.
 */
export function destinoDoPapel(papel: PapelDaSessao, destino: string): string {
  const doColaborador =
    destino === ROTA_DO_COLABORADOR ||
    destino.startsWith(`${ROTA_DO_COLABORADOR}/`) ||
    destino.startsWith(`${ROTA_DO_COLABORADOR}?`);

  if (papel === "colaborador") {
    return doColaborador ? destino : ROTA_DO_COLABORADOR;
  }
  return doColaborador ? ROTA_DO_DONO : destino;
}
