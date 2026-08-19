"use client";

/**
 * Acesso ao Supabase. Traduz as rows do PostgREST (numeric como string) para
 * os tipos de domínio em centavos; as regras fiscais ficam em lib/fiscal/*,
 * fora daqui.
 */

import { podeQuitar } from "@/lib/fiscal/compromisso";
import { podeVincular } from "@/lib/fiscal/vinculo";
import { numericParaCentavos, centavosParaNumeric } from "@/lib/money";
import {
  BUCKET_ACERVO,
  getSupabase,
  getUsuarioId,
  SemSessaoError,
} from "@/lib/supabase";
import type {
  Compromisso,
  CompromissoDataHistoricoRow,
  CompromissoInsert,
  CompromissoPagamentoRow,
  CompromissoRow,
  Documento,
  DocumentoInsert,
  DocumentoRow,
  FavorecidoInsert,
  Obra,
  ObraInsert,
  ObraRow,
  OrigemCompromisso,
  Pagamento,
  PagamentoDiferencaRow,
  PagamentoDocumentoRow,
  PagamentoInsert,
  PagamentoRow,
  QuitacaoRecusadaRow,
  ResolucaoDiferenca,
  TipoFavorecido,
} from "@/lib/types";

/**
 * O emitente do documento, com o CNPJ/CPF junto: quem registra o pagamento a
 * partir da nota precisa dos DOIS para não recriar o favorecido com typo.
 */
type ComFavorecido = {
  favorecido: { nome: string; documento: string } | null;
};
/** Pagamento também precisa do tipo: PF espera recibo, PJ espera NF. */
type ComFavorecidoTipado = {
  favorecido: { nome: string; tipo: TipoFavorecido } | null;
};
/**
 * Compromisso só precisa do NOME para a agenda. O `favorecido_id` continua
 * sendo a identidade — o casamento da sugestão de quitação é por ele, nunca
 * por nome (adendo §C: "CNPJ errado não é typo, é outro favorecido").
 */
type ComFavorecidoSimples = { favorecido: { nome: string } | null };

/**
 * Obra pedida por id que não existe (link velho, obra apagada em outro
 * aparelho). NUNCA é motivo para o app cair na primeira obra da conta: quem
 * chama abre a lista e deixa o Mateus escolher (critério 6).
 */
export class ObraNaoEncontradaError extends Error {
  constructor() {
    super("Obra não encontrada nesta conta.");
    this.name = "ObraNaoEncontradaError";
  }
}

function paraObra(row: ObraRow): Obra {
  return {
    id: row.id,
    nome: row.nome,
    cno: row.cno,
    matricula: row.matricula,
    cartorio: row.cartorio,
    municipio: row.municipio,
    valorTerrenoCentavos: numericParaCentavos(row.valor_terreno) ?? 0,
    valorItbiCentavos: numericParaCentavos(row.valor_itbi) ?? 0,
    valorEscrituraRegistroCentavos:
      numericParaCentavos(row.valor_escritura_registro) ?? 0,
    dataInicioObra: row.data_inicio_obra,
    cnoRegistradoEm: row.cno_registrado_em,
    unidadesAutonomas: row.unidades_autonomas,
    origemDesmembramentoLoteamento: row.origem_desmembramento_loteamento,
  };
}

function paraDocumento(row: DocumentoRow & ComFavorecido): Documento {
  return {
    id: row.id,
    obraId: row.obra_id,
    tipo: row.tipo,
    status: row.status,
    valorCentavos: numericParaCentavos(row.valor),
    vencimento: row.vencimento,
    classificacao: row.classificacao,
    destinatarioCpfOk: row.destinatario_cpf_ok,
    retencao11: row.retencao_11,
    motivoQuarentena: row.motivo_quarentena,
    favorecidoNome: row.favorecido?.nome ?? null,
    favorecidoDocumento: row.favorecido?.documento ?? null,
    arquivoPath: row.arquivo_path,
  };
}

/**
 * A composição do desembolso vem da tabela `pagamento_diferenca` (1:1), e não
 * de colunas de `pagamento` — critério 2 do CONTAI-019. Quem não tem linha lá
 * chega aqui com 0/0/null, que é o caso da esmagadora maioria dos pagamentos.
 */
const SEM_DIFERENCA = {
  encargosCentavos: 0,
  naoExplicadoCentavos: 0,
  resolucaoDiferenca: null,
} as const;

function paraDiferenca(row: PagamentoDiferencaRow) {
  return {
    encargosCentavos: numericParaCentavos(row.encargos) ?? 0,
    naoExplicadoCentavos: numericParaCentavos(row.nao_explicado) ?? 0,
    resolucaoDiferenca: row.resolucao,
  };
}

function paraPagamento(
  row: PagamentoRow & ComFavorecidoTipado,
  documentoIds: string[],
  diferenca: PagamentoDiferencaRow | undefined,
): Pagamento {
  return {
    ...(diferenca ? paraDiferenca(diferenca) : SEM_DIFERENCA),
    id: row.id,
    obraId: row.obra_id,
    valorCentavos: numericParaCentavos(row.valor) ?? 0,
    dataPagamento: row.data_pagamento,
    meio: row.meio,
    status: row.status,
    favorecidoId: row.favorecido_id,
    favorecidoNome: row.favorecido?.nome ?? null,
    favorecidoTipo: row.favorecido?.tipo ?? null,
    comprovantePath: row.comprovante_path,
    documentoIds,
  };
}

/**
 * Todas as obras da conta, da mais antiga para a mais nova.
 *
 * Sem sessão o banco não devolve linha nenhuma (desde a migration 0005 o papel
 * `anon` nem chega na policy: falta GRANT), e "nenhuma obra cadastrada" seria
 * diagnóstico errado para quem só não está logado — por isso a sessão é
 * exigida aqui, e a falta dela sobe como SemSessaoError (critério 5 do
 * CONTAI-002), não como lista vazia.
 *
 * O `limit(1)` que existia aqui era o bug do critério 6: com duas obras, todo
 * documento da segunda caía silenciosamente na primeira.
 */
export async function carregarObras(): Promise<Obra[]> {
  await getUsuarioId();
  const { data, error } = await getSupabase()
    .from("obra")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ObraRow[]).map(paraObra);
}

/** Uma obra pela identidade. Id que não existe é erro, nunca "pega outra". */
export async function carregarObra(id: string): Promise<Obra> {
  await getUsuarioId();
  const { data, error } = await getSupabase()
    .from("obra")
    .select("*")
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  const row = (data as ObraRow[] | null)?.[0];
  if (!row) throw new ObraNaoEncontradaError();
  return paraObra(row);
}

export interface EntradaObraBanco {
  nome: string;
  municipio: string | null;
  matricula: string | null;
  cartorio: string | null;
  cno: string | null;
  cnoRegistradoEm: string | null;
  dataInicioObra: string;
  valorTerrenoCentavos: number;
  valorItbiCentavos: number;
  valorEscrituraRegistroCentavos: number;
  unidadesAutonomas: number;
  origemDesmembramentoLoteamento: boolean;
}

function paraLinhaObra(entrada: EntradaObraBanco): ObraInsert {
  return {
    nome: entrada.nome,
    municipio: entrada.municipio,
    matricula: entrada.matricula,
    cartorio: entrada.cartorio,
    cno: entrada.cno,
    cno_registrado_em: entrada.cnoRegistradoEm,
    data_inicio_obra: entrada.dataInicioObra,
    valor_terreno: centavosParaNumeric(entrada.valorTerrenoCentavos),
    valor_itbi: centavosParaNumeric(entrada.valorItbiCentavos),
    valor_escritura_registro: centavosParaNumeric(
      entrada.valorEscrituraRegistroCentavos,
    ),
    unidades_autonomas: entrada.unidadesAutonomas,
    origem_desmembramento_loteamento: entrada.origemDesmembramentoLoteamento,
  };
}

export async function criarObra(entrada: EntradaObraBanco): Promise<string> {
  const { data, error } = await getSupabase()
    .from("obra")
    .insert(paraLinhaObra(entrada))
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * O cadastro é editável depois (critério 5): o CNO sai depois do início da
 * obra e o ITBI/escritura pode ser pago meses depois da compra do terreno.
 */
export async function atualizarObra(
  id: string,
  entrada: EntradaObraBanco,
): Promise<void> {
  const { error } = await getSupabase()
    .from("obra")
    .update(paraLinhaObra(entrada))
    .eq("id", id);
  if (error) throw error;
}

export interface PainelDados {
  obra: Obra;
  documentos: Documento[];
  pagamentos: Pagamento[];
}

function indexarDiferencas(
  linhas: PagamentoDiferencaRow[],
): Map<string, PagamentoDiferencaRow> {
  return new Map(linhas.map((d) => [d.pagamento_id, d]));
}

function agruparVinculos(linhas: PagamentoDocumentoRow[]): Map<string, string[]> {
  const docsPorPagamento = new Map<string, string[]>();
  for (const v of linhas) {
    const lista = docsPorPagamento.get(v.pagamento_id) ?? [];
    lista.push(v.documento_id);
    docsPorPagamento.set(v.pagamento_id, lista);
  }
  return docsPorPagamento;
}

/**
 * Tudo que a home precisa, SEMPRE de uma obra só — nada é somado entre obras
 * (Bens e Direitos não soma entre matrículas, aferição não soma entre CNOs).
 * Sem sessão, `getUsuarioId` já falha explicitamente.
 */
export async function carregarPainel(obraId: string): Promise<PainelDados> {
  await getUsuarioId();
  const supabase = getSupabase();
  const obra = await carregarObra(obraId);

  const [documentos, pagamentos, vinculos, diferencas] = await Promise.all([
    supabase
      .from("documento")
      .select("*, favorecido(nome, documento)")
      .eq("obra_id", obra.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("pagamento")
      .select("*, favorecido(nome, tipo)")
      .eq("obra_id", obra.id)
      .order("data_pagamento", { ascending: false }),
    supabase.from("pagamento_documento").select("*"),
    supabase.from("pagamento_diferenca").select("*"),
  ]);

  if (documentos.error) throw documentos.error;
  if (pagamentos.error) throw pagamentos.error;
  if (vinculos.error) throw vinculos.error;
  if (diferencas.error) throw diferencas.error;

  const docsPorPagamento = agruparVinculos(
    (vinculos.data ?? []) as PagamentoDocumentoRow[],
  );
  const porPagamento = indexarDiferencas(
    (diferencas.data ?? []) as PagamentoDiferencaRow[],
  );

  return {
    obra,
    documentos: ((documentos.data ?? []) as (DocumentoRow & ComFavorecido)[]).map(
      paraDocumento,
    ),
    pagamentos: (
      (pagamentos.data ?? []) as (PagamentoRow & ComFavorecidoTipado)[]
    ).map((row) =>
      paraPagamento(row, docsPorPagamento.get(row.id) ?? [], porPagamento.get(row.id)),
    ),
  };
}

/**
 * Um painel por obra, para a LISTA de obras contar as pendências de cada uma.
 * A lista mostra contagem, nunca dinheiro (critério 14) — dois valores lado a
 * lado convidam a uma soma que não existe em declaração nenhuma.
 */
export async function carregarPaineis(): Promise<PainelDados[]> {
  await getUsuarioId();
  const supabase = getSupabase();
  const obras = await carregarObras();
  if (obras.length === 0) return [];

  const [documentos, pagamentos, vinculos, diferencas] = await Promise.all([
    supabase
      .from("documento")
      .select("*, favorecido(nome, documento)")
      .order("created_at", { ascending: false }),
    supabase
      .from("pagamento")
      .select("*, favorecido(nome, tipo)")
      .order("data_pagamento", { ascending: false }),
    supabase.from("pagamento_documento").select("*"),
    supabase.from("pagamento_diferenca").select("*"),
  ]);

  if (documentos.error) throw documentos.error;
  if (pagamentos.error) throw pagamentos.error;
  if (vinculos.error) throw vinculos.error;
  if (diferencas.error) throw diferencas.error;

  const docsPorPagamento = agruparVinculos(
    (vinculos.data ?? []) as PagamentoDocumentoRow[],
  );
  const porPagamento = indexarDiferencas(
    (diferencas.data ?? []) as PagamentoDiferencaRow[],
  );

  return obras.map((obra) => ({
    obra,
    documentos: ((documentos.data ?? []) as (DocumentoRow & ComFavorecido)[])
      .filter((row) => row.obra_id === obra.id)
      .map(paraDocumento),
    pagamentos: ((pagamentos.data ?? []) as (PagamentoRow & ComFavorecidoTipado)[])
      .filter((row) => row.obra_id === obra.id)
      .map((row) =>
        paraPagamento(row, docsPorPagamento.get(row.id) ?? [], porPagamento.get(row.id)),
      ),
  }));
}

export async function carregarDocumento(id: string): Promise<Documento> {
  const { data, error } = await getSupabase()
    .from("documento")
    .select("*, favorecido(nome, documento)")
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  const row = (data as (DocumentoRow & ComFavorecido)[] | null)?.[0];
  if (!row) throw new Error("Documento não encontrado.");
  return paraDocumento(row);
}

export async function carregarPagamento(id: string): Promise<Pagamento> {
  const supabase = getSupabase();
  const [pagamento, vinculos, diferenca] = await Promise.all([
    supabase
      .from("pagamento")
      .select("*, favorecido(nome, tipo)")
      .eq("id", id)
      .limit(1),
    supabase.from("pagamento_documento").select("*").eq("pagamento_id", id),
    supabase.from("pagamento_diferenca").select("*").eq("pagamento_id", id).limit(1),
  ]);
  if (pagamento.error) throw pagamento.error;
  if (vinculos.error) throw vinculos.error;
  if (diferenca.error) throw diferenca.error;

  const row = (pagamento.data as (PagamentoRow & ComFavorecidoTipado)[] | null)?.[0];
  if (!row) throw new Error("Pagamento não encontrado.");
  return paraPagamento(
    row,
    ((vinculos.data ?? []) as PagamentoDocumentoRow[]).map((v) => v.documento_id),
    ((diferenca.data ?? []) as PagamentoDiferencaRow[])[0],
  );
}

/**
 * Correção da obra de um registro já salvo (critério 13). A regra fiscal que
 * decide SE pode mover está em lib/fiscal/obra.ts (`podeCorrigirObra`) — aqui
 * só grava. O erro deste campo é silencioso e descoberto tarde; um produto que
 * só previne e não conserta perde o caso real.
 */
export async function moverDocumentoDeObra(
  id: string,
  obraDestinoId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("documento")
    .update({ obra_id: obraDestinoId })
    .eq("id", id);
  if (error) throw error;
}

export async function moverPagamentoDeObra(
  id: string,
  obraDestinoId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("pagamento")
    .update({ obra_id: obraDestinoId })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Sobe o original para o acervo. O caminho começa com o user_id porque é isso
 * que a policy do bucket exige (0002_storage.sql).
 */
export async function subirParaAcervo(
  arquivo: File,
  pasta: "documento" | "comprovante",
): Promise<string> {
  const usuarioId = await getUsuarioId();
  const seguro = arquivo.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const caminho = `${usuarioId}/${pasta}/${crypto.randomUUID()}-${seguro}`;

  const { error } = await getSupabase()
    .storage.from(BUCKET_ACERVO)
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined });
  if (error) throw error;
  return caminho;
}

/**
 * Reaproveita o favorecido pelo CNPJ/CPF; cria se for a primeira vez.
 *
 * Upsert em vez de select-then-insert: com dois toques no "Salvar" (ou um
 * retry de rede) as duas chamadas liam "não existe" e criavam favorecidos
 * duplicados, quebrando a agregação CPF-por-CPF. O conflito é resolvido pela
 * unicidade (user_id, documento) da migration 0003.
 *
 * ⚠️ `ignoreDuplicates` — O NOME DE QUEM JÁ EXISTE NUNCA É SOBRESCRITO.
 *
 * Sem ele, o upsert virava `on conflict do update` e gravava por cima do nome:
 * um typo digitado hoje RENOMEAVA o favorecido em todos os registros
 * anteriores, em silêncio. Adendo de 2026-08-18 do parecer
 * `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`, §3 e §4:
 *
 *   nenhum registro novo pode alterar retroativamente dado de registro
 *   anterior [...] nome de favorecido muda por ato deliberado, com rastro —
 *   nunca como efeito colateral de registrar um pagamento.
 *
 * O dano é fora do app: a DAA já entregue é documento fechado, e renomear
 * retroativamente faz o acervo contar uma história diferente da que foi
 * declarada — quem explica isso numa intimação, anos depois, é o Mateus.
 *
 * Consequência aceita e deliberada: nome gravado errado NÃO se corrige por
 * aqui. A correção é ato próprio, com rastro, e não existe hoje.
 *
 * `ignoreDuplicates` manda `Prefer: resolution=ignore-duplicates`, que o
 * PostgREST traduz em `on conflict do nothing` — e aí a linha que já existia
 * NÃO volta no retorno. Por isso o segundo passo: quem já estava lá é lido, e
 * é o id dele que vale.
 */
export async function garantirFavorecido(entrada: {
  nome: string;
  documento: string;
  tipo: TipoFavorecido;
}): Promise<string> {
  const linha: FavorecidoInsert = {
    nome: entrada.nome,
    documento: entrada.documento,
    tipo: entrada.tipo,
  };
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("favorecido")
    .upsert(linha, { onConflict: "user_id,documento", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;

  const criado = (data as { id: string }[] | null)?.[0];
  if (criado) return criado.id;

  // Já existia: o cadastro dele fica como está, e o nome digitado agora é
  // descartado de propósito (ver acima). A RLS já restringe ao dono, então o
  // documento sozinho identifica a linha — é a chave única da migration 0003.
  const existente = await supabase
    .from("favorecido")
    .select("id")
    .eq("documento", entrada.documento)
    .limit(1);
  if (existente.error) throw existente.error;
  const row = (existente.data as { id: string }[] | null)?.[0];
  if (!row) throw new Error("Não foi possível identificar o favorecido.");
  return row.id;
}

/**
 * O favorecido pela identidade. Existe porque a tela de confirmação precisa do
 * TIPO (PJ × PF) para dizer o peso da pendência "pago sem comprovante", e
 * derivá-lo de outros pagamentos do mesmo favorecido erra justamente no
 * PRIMEIRO pagamento a ele — que é quando não há de onde derivar. O §G.3
 * reserva o vermelho ao favorecido **não identificado**; aqui ele está
 * identificado, e o tipo está na tabela.
 */
export async function carregarFavorecido(
  id: string,
): Promise<{ id: string; nome: string; tipo: TipoFavorecido } | null> {
  const { data, error } = await getSupabase()
    .from("favorecido")
    .select("id, nome, tipo")
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  return (
    (data as { id: string; nome: string; tipo: TipoFavorecido }[] | null)?.[0] ??
    null
  );
}

export async function criarDocumento(
  insert: Omit<DocumentoInsert, "valor"> & { valorCentavos: number },
): Promise<string> {
  const { valorCentavos, ...resto } = insert;
  const linha: DocumentoInsert = {
    ...resto,
    valor: centavosParaNumeric(valorCentavos),
  };
  const { data, error } = await getSupabase()
    .from("documento")
    .insert(linha)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function criarPagamento(
  insert: Omit<PagamentoInsert, "valor"> & { valorCentavos: number },
): Promise<string> {
  const { valorCentavos, ...resto } = insert;
  const linha: PagamentoInsert = {
    ...resto,
    valor: centavosParaNumeric(valorCentavos),
  };
  const { data, error } = await getSupabase()
    .from("pagamento")
    .insert(linha)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Tentativa de ligar registros de obras diferentes (critério 11 do
 * CONTAI-018). É erro de regra, não de rede: a tela mostra o motivo, e o
 * `mensagemDeErro` abaixo já o repassa por ser um `Error` com mensagem.
 */
export class VinculoEntreObrasError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "VinculoEntreObrasError";
  }
}

/**
 * Um vínculo a criar. As obras viajam junto porque a guarda do critério 11 é
 * do CÓDIGO: `pagamento_documento` não tem `obra_id` nem check, e a policy
 * `dono_vinculo` só exige mesmo DONO — ela deixaria passar um vínculo entre
 * duas obras do próprio Mateus, que somaria custo entre matrículas.
 */
export interface VinculoNovo {
  pagamentoId: string;
  documentoId: string;
  obraDoPagamentoId: string;
  obraDoDocumentoId: string;
  /** Decide o `status` derivado do pagamento — nunca o cálculo do custo. */
  documentoHabil: boolean;
}

/**
 * Cria os vínculos em UMA chamada.
 *
 * A gravação com array é UMA statement no Postgres: ou entram todas as linhas,
 * ou nenhuma. É o que sustenta a promessa da tela de erro (mock s3e): "nada foi
 * ligado — a nota continua como estava". Não existe transação multi-statement
 * pelo PostgREST, então a atomicidade que se pode prometer é exatamente esta, e
 * é por isso que a gravação não é dividida em um loop.
 *
 * Ligar de novo o que já está ligado não é erro — é o mesmo fato afirmado
 * duas vezes. Mas engolir o 23505 do `insert` puro seria ENGOLIR A FALHA: sem
 * `on conflict`, a violação da PK composta ABORTA A STATEMENT INTEIRA. Marcando
 * [A, já ligado em outra aba] + [B, novo], o Postgres devolve 23505, e B NÃO
 * ENTRA — a tela navegaria como sucesso e o `status = 'conciliado'` seria
 * gravado sem vínculo nenhum por trás.
 *
 * Por isso o `upsert` com `ignoreDuplicates`: ele manda
 * `Prefer: resolution=ignore-duplicates`, que o PostgREST traduz em
 * `on conflict do nothing`. Isso NÃO exige o privilégio de UPDATE (não há
 * `do update set`) — a migration 0006 continua concedendo só `insert` e
 * `delete`, que são os verbos que o app executa. A linha já existente é
 * ignorada, a nova entra, e qualquer outro erro sobe: dele a tela sabe falar
 * ("nada foi ligado").
 */
export async function criarVinculos(vinculos: VinculoNovo[]): Promise<void> {
  if (vinculos.length === 0) return;

  for (const v of vinculos) {
    const permissao = podeVincular(
      { obraId: v.obraDoPagamentoId },
      { obraId: v.obraDoDocumentoId },
    );
    if (!permissao.ok) throw new VinculoEntreObrasError(permissao.motivo);
  }

  const { error } = await getSupabase()
    .from("pagamento_documento")
    .upsert(
      vinculos.map((v) => ({
        pagamento_id: v.pagamentoId,
        documento_id: v.documentoId,
      })),
      { onConflict: "pagamento_id,documento_id", ignoreDuplicates: true },
    );
  if (error) throw error;

  // `status = 'conciliado'` é gravado como CONSEQUÊNCIA do vínculo (critério
  // 7) e não é lido por cálculo fiscal nenhum — quem calcula custo é
  // `lib/fiscal/vinculo.ts`, a partir das linhas acima. Por isso a falha desta
  // gravação NÃO invalida o vínculo e não pode virar erro de tela: o vínculo,
  // que é o fato, já está no banco.
  const comHabil = [
    ...new Set(vinculos.filter((v) => v.documentoHabil).map((v) => v.pagamentoId)),
  ];
  if (comHabil.length > 0) {
    await getSupabase()
      .from("pagamento")
      .update({ status: "conciliado" })
      .in("id", comHabil);
  }
}

/**
 * Desfaz um vínculo (critério 15). Nada é apagado além dele: a nota e o
 * pagamento continuam registrados, com os arquivos no acervo.
 *
 * O DELETE existe no papel `authenticated` desde a migration 0006, e a
 * justificativa está lá: vínculo errado infla o custo de aquisição que vai
 * para a declaração, e correção que exige SQL é a dor D9 de volta.
 */
export async function apagarVinculo(
  pagamentoId: string,
  documentoId: string,
  /** Sobra algum documento hábil ligado a este pagamento depois de desligar? */
  seguemDocumentosHabeis: boolean,
): Promise<void> {
  const { error } = await getSupabase()
    .from("pagamento_documento")
    .delete()
    .eq("pagamento_id", pagamentoId)
    .eq("documento_id", documentoId);
  if (error) throw error;

  if (!seguemDocumentosHabeis) {
    // Mesma nota do `criarVinculos`: consequência, não pré-requisito.
    await getSupabase()
      .from("pagamento")
      .update({ status: "aguardando_nf" })
      .eq("id", pagamentoId);
  }
}

// ══ CONTAI-019 · compromisso, quitação e diferença ══════════════════════
//
// ⚠️ Nada daqui entra em `PainelDados`, e a omissão é deliberada. `app/page.tsx`
// faz `calcularResumo({ ...dados, ano })`: um campo `compromissos` no painel
// viajaria por esse spread até a porta do cálculo de custo. A agenda tem
// carregador PRÓPRIO — o compromisso e os números da declaração nunca chegam
// juntos na mesma variável (critério 3; parecer §2).

function paraCompromisso(
  row: CompromissoRow & ComFavorecidoSimples,
  pagamentoIds: string[],
  adiamentos: number,
): Compromisso {
  return {
    id: row.id,
    obraId: row.obra_id,
    favorecidoId: row.favorecido_id,
    favorecidoNome: row.favorecido?.nome ?? null,
    valorPrevistoCentavos: numericParaCentavos(row.valor_previsto) ?? 0,
    dataPrevista: row.data_prevista,
    origem: row.origem,
    documentoOrigemId: row.documento_origem_id,
    situacao: row.situacao,
    motivoCancelamento: row.motivo_cancelamento,
    dataCompra: row.data_compra,
    pagamentoIds,
    adiamentos,
  };
}

/**
 * A agenda de UMA obra. Sem sessão, `getUsuarioId` já falha explicitamente —
 * "nenhum agendamento" seria diagnóstico errado para quem só não está logado.
 */
export async function carregarCompromissos(
  obraId: string,
): Promise<Compromisso[]> {
  await getUsuarioId();
  const supabase = getSupabase();

  const [compromissos, vinculos, historico] = await Promise.all([
    supabase
      .from("compromisso")
      .select("*, favorecido(nome)")
      .eq("obra_id", obraId)
      .order("data_prevista", { ascending: true, nullsFirst: false }),
    supabase.from("compromisso_pagamento").select("*"),
    supabase.from("compromisso_data_historico").select("*"),
  ]);
  if (compromissos.error) throw compromissos.error;
  if (vinculos.error) throw vinculos.error;
  if (historico.error) throw historico.error;

  const pagamentosPorCompromisso = new Map<string, string[]>();
  for (const v of (vinculos.data ?? []) as CompromissoPagamentoRow[]) {
    const lista = pagamentosPorCompromisso.get(v.compromisso_id) ?? [];
    lista.push(v.pagamento_id);
    pagamentosPorCompromisso.set(v.compromisso_id, lista);
  }

  // "adiado N×" (critério 34): a contagem é de LINHAS de histórico, porque
  // append-only garante que cada mudança deixou exatamente uma.
  const adiamentos = new Map<string, number>();
  for (const h of (historico.data ?? []) as CompromissoDataHistoricoRow[]) {
    adiamentos.set(h.compromisso_id, (adiamentos.get(h.compromisso_id) ?? 0) + 1);
  }

  return ((compromissos.data ?? []) as (CompromissoRow & ComFavorecidoSimples)[]).map(
    (row) =>
      paraCompromisso(
        row,
        pagamentosPorCompromisso.get(row.id) ?? [],
        adiamentos.get(row.id) ?? 0,
      ),
  );
}

export async function carregarCompromisso(id: string): Promise<Compromisso> {
  await getUsuarioId();
  const supabase = getSupabase();
  const [compromisso, vinculos, historico] = await Promise.all([
    supabase.from("compromisso").select("*, favorecido(nome)").eq("id", id).limit(1),
    supabase.from("compromisso_pagamento").select("*").eq("compromisso_id", id),
    supabase.from("compromisso_data_historico").select("*").eq("compromisso_id", id),
  ]);
  if (compromisso.error) throw compromisso.error;
  if (vinculos.error) throw vinculos.error;
  if (historico.error) throw historico.error;

  const row = (compromisso.data as (CompromissoRow & ComFavorecidoSimples)[] | null)?.[0];
  if (!row) throw new Error("Agendamento não encontrado.");
  return paraCompromisso(
    row,
    ((vinculos.data ?? []) as CompromissoPagamentoRow[]).map((v) => v.pagamento_id),
    ((historico.data ?? []) as CompromissoDataHistoricoRow[]).length,
  );
}

/** O histórico completo da data prevista, do mais antigo ao mais novo. */
export async function carregarHistoricoDeData(
  compromissoId: string,
): Promise<CompromissoDataHistoricoRow[]> {
  const { data, error } = await getSupabase()
    .from("compromisso_data_historico")
    .select("*")
    .eq("compromisso_id", compromissoId)
    .order("registrado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CompromissoDataHistoricoRow[];
}

export interface EntradaCompromisso {
  obraId: string;
  favorecidoId: string | null;
  /** O campo se chama **valor previsto**, nunca "valor" (Gate Fiscal 6.3). */
  valorPrevistoCentavos: number;
  /** `null` só é alcançável pelo saldo de quitação parcial, nunca na criação. */
  dataPrevista: string | null;
  origem: OrigemCompromisso;
  documentoOrigemId: string | null;
  dataCompra: string | null;
}

export async function criarCompromisso(
  entrada: EntradaCompromisso,
): Promise<string> {
  const linha: CompromissoInsert = {
    obra_id: entrada.obraId,
    favorecido_id: entrada.favorecidoId,
    valor_previsto: centavosParaNumeric(entrada.valorPrevistoCentavos),
    data_prevista: entrada.dataPrevista,
    origem: entrada.origem,
    documento_origem_id: entrada.documentoOrigemId,
    data_compra: entrada.dataCompra,
  };
  const { data, error } = await getSupabase()
    .from("compromisso")
    .insert(linha)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * "Não saiu" — critério 22. **Não apaga**: fica registrado como cancelado, com
 * o motivo (parecer §3). O check `compromisso_cancelado_exige_motivo` recusa a
 * gravação sem motivo, então a exigência não depende só da tela.
 */
export async function cancelarCompromisso(
  id: string,
  motivo: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("compromisso")
    .update({ situacao: "cancelado", motivo_cancelamento: motivo })
    .eq("id", id);
  if (error) throw error;
}

/**
 * "Mudou a data" — critério 33. **O MESMO compromisso**: mesmo id, mesmos
 * vínculos, mesmo saldo. Não cancela e não cria compromisso novo.
 *
 * A linha de histórico entra ANTES do update, e é de propósito: se o update
 * falhar, sobra um registro de tentativa (ruído legível); se o histórico
 * falhasse depois de um update bem-sucedido, a data anterior teria sido
 * DESTRUÍDA sem rastro, que é o que o append-only proíbe. Não há transação
 * multi-statement pelo PostgREST — então a ordem é a garantia possível, e ela
 * erra para o lado de preservar o fato.
 *
 * Data nova no passado é aceita (é correção legítima) e o item fica vencido na
 * hora — critério 34.
 */
export async function mudarDataPrevista(
  id: string,
  dataAnterior: string | null,
  dataNova: string | null,
): Promise<void> {
  const supabase = getSupabase();
  const historico = await supabase
    .from("compromisso_data_historico")
    .insert({ compromisso_id: id, data_anterior: dataAnterior, data_nova: dataNova });
  if (historico.error) throw historico.error;

  const { error } = await supabase
    .from("compromisso")
    .update({ data_prevista: dataNova })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Liga um pagamento já gravado a um compromisso e, quando é o caso, fecha o
 * compromisso.
 *
 * ⚠️ **`quitaIntegralmente` é decisão HUMANA, nunca cálculo** (critério 13 e
 * adendo §D): valor menor exige escolha explícita entre "quita o compromisso"
 * e "falta pagar o resto", sem default e sem pré-seleção. O app não infere a
 * partir do valor porque **nenhum dos dois erros é mais barato**: assumir
 * desconto fecha um compromisso ainda devido e mata o alerta; assumir parcial
 * deixa um saldo fantasma que trava o relatório anual.
 *
 * ⚠️ **Este é o único caminho que cria vínculo de quitação, e ele só é chamado
 * a partir de um toque** (critério 41).
 */
export async function quitarCompromisso(entrada: {
  compromisso: Pick<Compromisso, "id" | "obraId" | "dataPrevista">;
  pagamento: Pick<Pagamento, "id" | "obraId">;
  quitaIntegralmente: boolean;
  /** Quando fica saldo: a nova data prevista, ou `null` = "sem data definida". */
  novaDataPrevista?: string | null;
}): Promise<void> {
  const permissao = podeQuitar(entrada.compromisso, entrada.pagamento);
  if (!permissao.ok) throw new VinculoEntreObrasError(permissao.motivo);

  const supabase = getSupabase();
  const vinculo = await supabase.from("compromisso_pagamento").upsert(
    { compromisso_id: entrada.compromisso.id, pagamento_id: entrada.pagamento.id },
    { onConflict: "compromisso_id,pagamento_id", ignoreDuplicates: true },
  );
  if (vinculo.error) throw vinculo.error;

  if (entrada.quitaIntegralmente) {
    const { error } = await supabase
      .from("compromisso")
      .update({ situacao: "quitado" })
      .eq("id", entrada.compromisso.id);
    if (error) throw error;
    return;
  }

  // Quitação parcial: o compromisso SEGUE ABERTO com saldo, e o saldo **não é
  // custo de nada** (critério 29). A nova data prevista é pedida na tela —
  // sem ela o saldo nasceria vencido-sem-resposta e travaria o relatório anual
  // para sempre (adendo §D). `null` é "sem data definida", que é resposta.
  if (entrada.novaDataPrevista !== undefined) {
    // A data ANTERIOR é a que o compromisso tinha — passar `null` aqui
    // apagaria do rastro justamente o dado que o critério 34 exibe
    // ("para 25/08 (era 10/08)").
    await mudarDataPrevista(
      entrada.compromisso.id,
      entrada.compromisso.dataPrevista,
      entrada.novaDataPrevista,
    );
  }
}

/**
 * A composição do desembolso, gravada UMA vez, no ato da confirmação.
 *
 * ⚠️ Só `resolucao`/`resolvido_em` mudam depois (critério 32): **o valor da
 * diferença nunca muda**. É por isso que esta função e `resolverDiferenca`
 * são separadas, e é por isso que a segunda não aceita valor nenhum — o
 * privilégio de UPDATE existe na tabela, e a guarda de o que ele toca é aqui.
 */
export async function registrarDiferenca(entrada: {
  pagamentoId: string;
  encargosCentavos: number;
  naoExplicadoCentavos: number;
}): Promise<void> {
  const { error } = await getSupabase().from("pagamento_diferenca").insert({
    pagamento_id: entrada.pagamentoId,
    encargos: centavosParaNumeric(entrada.encargosCentavos),
    nao_explicado: centavosParaNumeric(entrada.naoExplicadoCentavos),
    // `resolucao` nasce NULL — o "não sei ainda" do §F.2, o único estado
    // inicial permitido, porque é o único que não afirma nada.
  });
  if (error) throw error;
}

/**
 * A resolução da diferença (§F.2), que é ato do Mateus e não do app.
 *
 * **Resolver não apaga o registro da diferença** (critério 32, acervo
 * append-only do CONTAI-009): os valores continuam lá, e o que entra é a
 * classificação com a data em que ela foi feita.
 */
export async function resolverDiferenca(
  pagamentoId: string,
  resolucao: ResolucaoDiferenca,
): Promise<void> {
  const { error } = await getSupabase()
    .from("pagamento_diferenca")
    .update({ resolucao, resolvido_em: new Date().toISOString() })
    .eq("pagamento_id", pagamentoId);
  if (error) throw error;
}

/**
 * O "não" da sugestão de quitação, registrado POR PAR (critério 39).
 *
 * O app não repergunta daquele par — repetir ensina a dispensar sem ler — e
 * segue livre para sugerir outros pares. ⚠️ Isto **não** é resposta ao vencido
 * e **não** desbloqueia o relatório anual (adendo §A, corolário 4): recusar um
 * par não diz nada sobre o compromisso.
 */
export async function recusarQuitacao(
  pagamentoId: string,
  compromissoId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("quitacao_recusada")
    .upsert(
      { pagamento_id: pagamentoId, compromisso_id: compromissoId },
      { onConflict: "pagamento_id,compromisso_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function carregarRecusasQuitacao(): Promise<
  { pagamentoId: string; compromissoId: string }[]
> {
  const { data, error } = await getSupabase().from("quitacao_recusada").select("*");
  if (error) throw error;
  return ((data ?? []) as QuitacaoRecusadaRow[]).map((r) => ({
    pagamentoId: r.pagamento_id,
    compromissoId: r.compromisso_id,
  }));
}

/**
 * Mensagem de erro para a UI, sem vazar detalhe técnico irrelevante.
 *
 * O PostgREST NÃO devolve `error` como `Error`: sem `throwOnError`, o que vem
 * é um objeto simples (`{ message, details, hint, code }`), e é ele que os
 * `throw error` daqui propagam. Só o ramo `instanceof Error` fazia toda
 * violação de RLS, de check constraint (`documento_quarentena_coerente`) e de
 * unicidade (`favorecido_dono_documento_unico`) chegar ao Mateus como "não foi
 * possível falar com o servidor" — ou seja, como problema de rede. Ele tentaria
 * de novo para sempre, e o registro nunca entraria.
 */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error && erro.message) return erro.message;
  if (typeof erro === "object" && erro !== null && "message" in erro) {
    const { message } = erro as { message?: unknown };
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return "Não foi possível falar com o servidor. Tente de novo.";
}

/**
 * Critério 5 do CONTAI-002: "sem sessão" e "banco fora" NÃO são o mesmo erro.
 *
 * Os dois davam a mesma tela com o mesmo botão "Tentar de novo" — e tentar de
 * novo nunca resolveu falta de sessão: o Mateus ficaria batendo no botão até
 * desistir de registrar. Cada causa leva à ação que resolve ela (entrar de
 * novo × repetir a chamada), e quem decide isso é o TIPO do erro, nunca o
 * texto da mensagem.
 */
export type ErroDeTela =
  | { tipo: "sem_sessao" }
  | { tipo: "falha"; mensagem: string };

export function classificarErro(erro: unknown): ErroDeTela {
  if (erro instanceof SemSessaoError) return { tipo: "sem_sessao" };
  return { tipo: "falha", mensagem: mensagemDeErro(erro) };
}
