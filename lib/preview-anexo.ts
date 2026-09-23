/**
 * **CONTAI-048 — o que dá para MOSTRAR do arquivo anexado, e como.**
 *
 * Parte PURA da visualização do anexo: nada aqui toca DOM, blob URL ou React —
 * é só a decisão de "este arquivo vira imagem, PDF ou nada" e de "este PDF
 * cabe embutido ou tem que abrir numa aba". Fica separado para ser testável
 * sem browser, que é onde a decisão por dispositivo de entrada (critério 3 do
 * ticket) pode ser provada de verdade: o `webkit` do Playwright roda em Linux
 * e não tem visualizador de PDF nenhum.
 *
 * ⚠️ **Isto é VISUALIZAÇÃO, nunca leitura.** Nada deste módulo lê conteúdo de
 * arquivo, sugere campo ou responde pergunta fiscal — `notaNoCpf`,
 * `retencao_na_nota` e `cnoNaNota` continuam sendo perguntas ao usuário
 * (critério 4 do ticket). O preview mostra o papel; quem confere é o Mateus.
 */

/** O que o app consegue exibir de um anexo. */
export type PreviewDoAnexo = "imagem" | "pdf" | "sem-preview";

/**
 * ⚠️ **XML não entra aqui, e a ausência é decisão do Gate 0 (Estado D).**
 * Marcação bruta não ajuda a conferir CNPJ/valor/data, e a extração de XML
 * (fast-xml-parser) já é determinística — não depende de conferência visual
 * como o PDF via Gemini.
 */
const EXTENSOES_DE_IMAGEM = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "avif",
  "bmp",
]);

function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  if (ponto <= 0 || ponto === nome.length - 1) return "";
  return nome.slice(ponto + 1).toLowerCase();
}

/**
 * O tipo de preview de um anexo, pelo MIME e — só quando ele falta — pela
 * extensão.
 *
 * O MIME vem primeiro porque é o que o navegador afirma. A extensão é rede de
 * segurança para os casos reais em que `File.type` chega vazio (arquivo vindo
 * de app de terceiro no Android, alguns compartilhamentos do iOS): sem ela, uma
 * foto tirada no canteiro cairia em "sem-preview" e o botão sumiria sem motivo
 * visível. Extensão desconhecida devolve "sem-preview" — nunca chuta.
 */
export function previewDoAnexo(
  arquivo: { name: string; type: string } | null,
): PreviewDoAnexo {
  if (!arquivo) return "sem-preview";
  const tipo = arquivo.type.toLowerCase();
  if (tipo.startsWith("image/")) return "imagem";
  if (tipo === "application/pdf") return "pdf";
  if (tipo === "" || tipo === "application/octet-stream") {
    const extensao = extensaoDe(arquivo.name);
    if (extensao === "pdf") return "pdf";
    if (EXTENSOES_DE_IMAGEM.has(extensao)) return "imagem";
  }
  return "sem-preview";
}

/**
 * ⚠️ **A consulta que decide o destino do PDF — critério 3 do ticket, achado
 * do `cto-obra` em 2026-09-23.**
 *
 * `<object type="application/pdf">` em iOS/WebKit **não** cai no fallback de
 * download: ele renderiza e **trava na 1ª página**, sem scroll interno, sem
 * toolbar e sem zoom próprio. Um documento de 3 páginas mostra 1 e não avisa
 * que existem outras — degradação silenciosa, que é pior que erro, e que
 * nenhum teste automatizado deste projeto pega.
 *
 * ⚠️ **A consulta é NEGATIVA de propósito** ("quando NÃO embutir"). Escrever a
 * positiva (`(min-width: 880px) and (pointer: fine)`) faria qualquer ambiente
 * que não declara ponteiro nenhum — headless, alguns leitores de tela — cair no
 * caminho de aba nova por acidente. Aqui o embutido é o padrão e a aba nova é a
 * exceção nomeada: tela abaixo do breakpoint da captura (`--breakpoint-larga`,
 * 880px) **ou** ponteiro grosso (dedo).
 */
export const CONSULTA_PDF_EM_NOVA_ABA =
  "(max-width: 879.98px), (pointer: coarse)";

/** Como o anexo será mostrado — a decisão única, usada pelo rail e pelo modal. */
export type ModoDoPreview =
  "imagem" | "pdf-embutido" | "pdf-em-nova-aba" | "sem-preview";

/**
 * Junta o tipo do arquivo com o dispositivo de entrada.
 *
 * `emNovaAba` é o resultado de `CONSULTA_PDF_EM_NOVA_ABA` — quem o mede é o
 * componente; aqui só se decide o que fazer com ele. Imagem não muda por
 * largura nenhuma (Gate 0, Estado E): só PDF tem dois destinos.
 */
export function modoDoPreview(
  preview: PreviewDoAnexo,
  emNovaAba: boolean,
): ModoDoPreview {
  if (preview === "imagem") return "imagem";
  if (preview === "pdf") return emNovaAba ? "pdf-em-nova-aba" : "pdf-embutido";
  return "sem-preview";
}

/**
 * XML — o "sem-preview" NOMEADO (Estado D do Gate 0), distinto do formato
 * desconhecido. Só ele ganha a frase que explica a ausência do botão; um
 * `.docx` qualquer não merece uma explicação sobre extração determinística.
 */
export function ehXml(arquivo: { name: string; type: string } | null): boolean {
  if (!arquivo) return false;
  return (
    arquivo.type.toLowerCase().includes("xml") ||
    extensaoDe(arquivo.name) === "xml"
  );
}

/** Textos da visualização. Nenhum deles tem consequência fiscal (Gate 0). */
export const VER_DOCUMENTO_LARGA = "🔍 Ver documento";
export const VER_DOCUMENTO_PISO = "Ver documento";
export const ABRIR_PDF_EM_ABA = "Abrir PDF";
export const LIGHTBOX_TITULO = "Documento anexado";
/**
 * ⚠️ Pre-mortem 2 do ticket: nenhum texto pode sugerir conferência automática.
 * A frase diz o que a tela faz (mostrar o papel), não o que ela valida.
 */
export const LIGHTBOX_DICA = "Confira o que está no papel contra o formulário.";
export const PREVIEW_INDISPONIVEL =
  "Não foi possível exibir este arquivo aqui.";
/** Critério 2: falha de preview nunca é gate. Isto é o que a tela diz por isso. */
export const PREVIEW_INDISPONIVEL_CONSEQUENCIA =
  "Isso não atrapalha o registro — o arquivo vai para o acervo do mesmo jeito quando você salvar.";
export const BAIXAR_ARQUIVO = "Baixar arquivo";
export const XML_SEM_PREVIEW =
  "XML não tem visualização — os dados vêm da extração determinística, não de conferência visual.";
export const PDF_EM_NOVA_ABA_EXPLICACAO =
  "O PDF abre no visualizador do seu navegador, em aba própria — lá dá para rolar todas as páginas e ampliar.";
