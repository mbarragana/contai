/**
 * Ler o que já está no acervo — CONTAI-027, rodada 1 (dor D35).
 *
 * O bucket `acervo` é privado desde a migration 0002 e continua privado: nada
 * aqui gera URL pública. O que existe é link ASSINADO e temporário, pedido no
 * clique (`criarLinkDeLeitura`, em lib/data.ts). Este módulo é só a parte
 * PURA — nome, extensão, texto e classificação da recusa —, para que ela seja
 * testável sem browser e sem banco.
 */

/**
 * O prefixo que o PRÓPRIO app carimba no nome ao subir o arquivo:
 * `${usuarioId}/${pasta}/${crypto.randomUUID()}-${nome}` (`subirParaAcervo`,
 * em lib/data.ts). Ele existe para o objeto não colidir no bucket, não para
 * ser lido.
 */
const UUID_DO_UPLOAD =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

/**
 * O nome que o Mateus vê: último segmento do caminho, **menos o UUID que o
 * upload carimbou na frente**.
 *
 * ⚠️ Isto é uma divergência deliberada em relação ao "`path.split("/").pop()`,
 * como já se faz hoje". Só tirando o prefixo o nome fica legível: o carimbo
 * tem 37 caracteres e, a 375px, empurra o nome de verdade para a nona linha —
 * o item vira um bloco de hexadecimal com um `.pdf` no fim. A dor D35 é
 * "acervo que ninguém consegue ler"; entregar um nome ilegível seria fechá-la
 * pela metade. Nada de fiscal se perde: o UUID é artefato de armazenamento, o
 * caminho completo continua gravado no banco e é ele que vai para o dossiê.
 *
 * ⚠️ NÃO existe tamanho nem data de anexação aqui, e a ausência é deliberada:
 * o mock mostra "184 KB · anexado em 12/08/2026" porque lá o arquivo está na
 * mão do navegador. Aqui o que o app tem é um `text` no banco. Perguntar o
 * tamanho ao Storage (`list()`) por item de lista seria uma chamada por linha
 * para enfeitar — e a data que ele devolve é a do upload do objeto, não a do
 * ato de anexar. Mostrar o que se sabe; não inventar o resto.
 */
export function nomeDoArquivoNoAcervo(path: string): string {
  const nome = path.split("/").pop();
  if (!nome || nome === "") return path;
  const semCarimbo = nome.replace(UUID_DO_UPLOAD, "");
  // Arquivo cujo nome inteiro ERA o carimbo: aí o carimbo é tudo o que existe
  // para mostrar, e some-lo deixaria o item anônimo.
  return semCarimbo === "" ? nome : semCarimbo;
}

/**
 * O rótulo da miniatura (PDF, JPG…). Sai da extensão do próprio caminho — é
 * dado que o app tem. Sem extensão reconhecível vira "—": o item continua
 * legível pelo nome, que é o que identifica o papel.
 */
export function extensaoDoArquivoNoAcervo(path: string): string {
  const nome = nomeDoArquivoNoAcervo(path);
  const ponto = nome.lastIndexOf(".");
  if (ponto <= 0 || ponto === nome.length - 1) return "—";
  const extensao = nome.slice(ponto + 1);
  if (!/^[A-Za-z0-9]{1,4}$/.test(extensao)) return "—";
  return extensao.toUpperCase();
}

/**
 * O dono de um caminho do acervo é o PRIMEIRO segmento — é o que a policy
 * `acervo_dono_select` (0002_storage.sql) compara com `auth.uid()`:
 * `(storage.foldername(name))[1] = auth.uid()::text`.
 */
export function donoDoCaminhoNoAcervo(path: string): string {
  return path.split("/")[0] ?? "";
}

/** Textos do mock aprovado (design/mocks/CONTAI-027.html, telas 1 e 1b). */
export const ACERVO_FALHA_AO_ABRIR =
  "Não consegui abrir agora. O papel continua no acervo — o que falhou foi o link de leitura. Nada foi perdido.";
export const ACERVO_NEGADO =
  "Este arquivo não é seu. O acervo só abre para o dono.";

/**
 * Os dois desfechos ruins de abrir um papel. `falha` ganha "Tentar de novo";
 * `negado` NÃO ganha — retry não conserta "não é seu", e botão que não resolve
 * nada é a porta que não abre (mesma família da D36).
 */
export type MotivoDeNaoAbrir = "falha" | "negado";

/**
 * O Storage devolveu "não encontrei este objeto"?
 *
 * O corpo real do stack local, conferido contra o `/storage/v1/object/sign`:
 * HTTP 400 com `{"statusCode":"404","error":"not_found","code":"NoSuchKey"}`.
 * O storage-js reempacota isso num `StorageApiError` com `status`,
 * `statusCode` e `code` — os três são aceitos aqui porque a versão da
 * biblioteca já mudou o nome desse campo antes.
 */
function ehObjetoNaoEncontrado(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  const { status, statusCode, code } = erro as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
  };
  return (
    code === "NoSuchKey" ||
    statusCode === "404" ||
    statusCode === 404 ||
    status === 404
  );
}

/**
 * Qual dos dois estados de erro o item mostra.
 *
 * ⚠️ **Isto não é verificação de autorização, e a ordem prova**: a chamada ao
 * Storage já aconteceu e já foi RECUSADA quando esta função roda. A única
 * autorização é a policy `acervo_dono_select` — nenhum ramo daqui abre nada,
 * nenhum ramo daqui pula a chamada. O que se decide aqui é a REDAÇÃO da
 * recusa.
 *
 * Por que a redação precisa de ajuda: o Storage **não distingue** os dois
 * casos. Conferido no stack local, o objeto de outro usuário que EXISTE e o
 * caminho que não existe voltam idênticos — `404 / NoSuchKey`. É consequência
 * direta da RLS: o que a policy esconde não existe para quem pergunta. Se eu
 * carimbasse "não é seu" em todo 404, estaria afirmando dono para um objeto
 * que pode simplesmente ter sumido; se carimbasse "tentar de novo" em todos,
 * ofereceria retry para o caso em que ele nunca vai funcionar.
 *
 * O desempate é o próprio caminho, lido com a MESMA regra da policy: caminho
 * fora da pasta do dono nunca abriria, aconteça o que acontecer — logo,
 * `negado`. Caminho dentro da pasta dele que voltou 404 é falha de leitura ou
 * buraco no acervo, e aí `falha` (com "Tentar de novo") é a resposta honesta.
 */
export function classificarFalhaDeAbertura(
  erro: unknown,
  path: string,
  usuarioId: string,
): MotivoDeNaoAbrir {
  if (!ehObjetoNaoEncontrado(erro)) return "falha";
  return donoDoCaminhoNoAcervo(path) === usuarioId ? "falha" : "negado";
}
