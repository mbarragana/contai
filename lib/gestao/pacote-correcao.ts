/**
 * **CONTAI-088 — o pacote de correções, em função pura.**
 *
 * O ponto de entrada `/documento/[id]/documento-novo` não grava nada: ele
 * ROTEIA. Quem recebe um documento substituto costuma receber número, valor e
 * retenção errados no mesmo papel, e até aqui cada correção exigia voltar ao
 * detalhe, reabrir a tela irmã e **subir o mesmo PDF de novo** — foi assim que
 * nasceram duas cópias do `NFSE_261` no acervo (dor de origem,
 * `docs/backlog/103-2026-10-05-ponto-entrada-unico-correcao-documento.md`).
 *
 * ⚠️ **O que viaja entre as telas é o `arquivo_path`, nunca um
 * `documento_anexo.id`** (Viabilidade do ticket): o contrato das RPCs é
 * `p_anexo_path text`, e cada ato grava uma LINHA NOVA em `documento_anexo`
 * apontando para o mesmo objeto do bucket. Um objeto, N atos, N rastros.
 *
 * ⚠️ **Nenhuma regra fiscal mora aqui, e a ausência é o Gate Fiscal do ticket**:
 * o pacote é roteamento de UI sobre três RPCs já aprovadas. O motivo
 * (`PassoMotivo`) é perguntado DENTRO de cada correção e **nunca** atravessa
 * este módulo — a obrigatoriedade de anexo é função do motivo daquela correção
 * específica (parecer `2026-08-18-correcao-de-documento-registrado.md` §5).
 */

/** As três correções que o pacote sabe enfileirar — e só elas. */
export type CorrecaoDoPacote = "numero" | "valor" | "retencao";

/**
 * A ordem de navegação, fixa.
 *
 * ⚠️ **Não é regra fiscal, é ordem** (critério 4 do ticket, e o Gate Fiscal é
 * literal: *"não há ordem obrigatória entre número, valor e retenção — nenhuma
 * depende do resultado das outras"*). Ela existe para que o mesmo conjunto de
 * marcações produza sempre a mesma sequência, e não porque alguma correção
 * precise vir antes de outra.
 */
export const ORDEM_DO_PACOTE: readonly CorrecaoDoPacote[] = [
  "numero",
  "valor",
  "retencao",
] as const;

/**
 * Como cada correção é nomeada nos botões de avanço ("Continuar: corrigir **o
 * valor** →"). Artigo junto do rótulo porque as três frases do spec já vêm
 * assim — "corrigir o número", "corrigir a retenção".
 */
const ROTULO_DA_CORRECAO: Record<CorrecaoDoPacote, string> = {
  numero: "o número",
  valor: "o valor",
  retencao: "a retenção",
};

/**
 * O mínimo que este módulo precisa de `useSearchParams` — e é só `get`.
 * Tipar pela forma (e não por `ReadonlyURLSearchParams`) é o que deixa o teste
 * passar um `URLSearchParams` do runtime, sem nada do Next.
 */
export interface ParametrosDeBusca {
  get(nome: string): string | null;
}

/**
 * O que ainda falta do pacote, na ordem canônica.
 *
 * - `null` → **não há pacote**: a rota foi aberta direto, e ela se comporta
 *   exatamente como antes deste ticket (critério 11).
 * - `[]` → há pacote e esta é a ÚLTIMA correção dele. É por isso que o
 *   `?pacote=` continua na URL mesmo vazio: "estou num pacote que acabou" e
 *   "não estou em pacote nenhum" são estados diferentes.
 *
 * ⚠️ **Whitelist, e o que não está nela é ignorado em silêncio** — nunca erro de
 * tela. A querystring é digitável à mão e chega de link velho; o pior desenho
 * possível seria uma tela de correção que se recusa a abrir porque alguém
 * colou `?pacote=lixo`. Token desconhecido simplesmente não entra na fila.
 */
export function lerPacote(params: ParametrosDeBusca): CorrecaoDoPacote[] | null {
  const bruto = params.get("pacote");
  if (bruto === null) return null;
  const pedidas = new Set(bruto.split(",").map((t) => t.trim()));
  return ORDEM_DO_PACOTE.filter((c) => pedidas.has(c));
}

/**
 * O papel indicado pela entrada do pacote, ou `null` quando não há indicação.
 *
 * ⚠️ `?anexo=` **vazio é ausência de indicação**, e é o caminho normal da
 * PRIMEIRA correção quando o Mateus escolheu "vou anexar um arquivo novo": o
 * upload acontece lá dentro, e é o path resultante que segue para as próximas.
 * Por isso vazio e ausente voltam iguais — a diferença entre os dois não tem
 * consequência nenhuma para quem chama.
 *
 * ⚠️ E o que volta daqui **não autoriza nada**: quem decide se este path pode
 * ser usado é a tela, comparando-o com `carregarAnexosDoDocumento(d.id)`
 * (critério 11). Path que não está no documento não pré-seleciona chip nenhum e
 * nunca chega à RPC.
 */
export function lerAnexoDoPacote(params: ParametrosDeBusca): string | null {
  const bruto = params.get("anexo");
  if (bruto === null) return null;
  const limpo = bruto.trim();
  return limpo === "" ? null : limpo;
}

export interface ProximaDoPacote {
  correcao: CorrecaoDoPacote;
  /** "o número" / "o valor" / "a retenção" — entra nos dois textos de botão. */
  rotulo: string;
  /** A rota da próxima correção, já com o `?pacote` restante e o `?anexo`. */
  href: string;
}

/**
 * A próxima correção do pacote, com o link pronto — ou `null` quando não há.
 *
 * `anexoUsado` é o path que a correção ATUAL de fato usou (o chip escolhido ou
 * o objeto que ela acabou de subir). Quem chama já sabe esse valor sem
 * round-trip: a RPC inseriu a linha em `documento_anexo` no mesmo ato, então o
 * path existe no banco quando a próxima tela carregar e tentar casar o chip.
 */
export function proximaDoPacote(
  documentoId: string,
  pacote: readonly CorrecaoDoPacote[] | null,
  anexoUsado: string | null,
): ProximaDoPacote | null {
  if (pacote === null) return null;
  const emOrdem = ORDEM_DO_PACOTE.filter((c) => pacote.includes(c));
  const [proxima, ...resto] = emOrdem;
  if (proxima === undefined) return null;
  // `URLSearchParams` e não concatenação: o path do acervo tem `/` e caracteres
  // do nome do arquivo, e ele precisa chegar inteiro do outro lado.
  const query = new URLSearchParams({
    pacote: resto.join(","),
    anexo: anexoUsado ?? "",
  });
  return {
    correcao: proxima,
    rotulo: ROTULO_DA_CORRECAO[proxima],
    href: `/documento/${documentoId}/corrigir/${proxima}?${query.toString()}`,
  };
}

/** O botão PRIMÁRIO da tela de sucesso, em modo pacote (spec, §textos). */
export function textoContinuar(proxima: ProximaDoPacote): string {
  return `Continuar: corrigir ${proxima.rotulo} →`;
}

/**
 * O "Cancelar" do passo do campo, em modo pacote (spec, §textos).
 *
 * Pular **não grava nada** e não pede confirmação: nada foi gravado neste passo
 * ainda, diferente de abandonar um formulário com dado digitado.
 */
export function textoPular(proxima: ProximaDoPacote): string {
  return `Pular esta e continuar: corrigir ${proxima.rotulo} →`;
}
