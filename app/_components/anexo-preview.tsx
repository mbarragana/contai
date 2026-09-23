"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  ABRIR_PDF_EM_ABA,
  BAIXAR_ARQUIVO,
  CONSULTA_PDF_EM_NOVA_ABA,
  LIGHTBOX_DICA,
  LIGHTBOX_TITULO,
  modoDoPreview,
  PDF_EM_NOVA_ABA_EXPLICACAO,
  PREVIEW_INDISPONIVEL,
  PREVIEW_INDISPONIVEL_CONSEQUENCIA,
  previewDoAnexo,
  type ModoDoPreview,
} from "@/lib/preview-anexo";

/**
 * **CONTAI-048 — ver o anexo, sem sair do formulário.**
 *
 * Fonte do desenho: `design/mocks/CONTAI-048.md` + `.html` (Estados B–F).
 *
 * ⚠️ **Tudo aqui é VISUALIZAÇÃO.** Nenhum componente deste arquivo lê o
 * conteúdo do arquivo, preenche campo, sugere valor ou bloqueia gravação —
 * critérios 2 e 4 do ticket. Falha de preview degrada para "não deu para
 * exibir" + download, e o "Salvar" continua exatamente como estava.
 */

/**
 * O blob URL do arquivo anexado — criado ao anexar, revogado ao TROCAR de
 * arquivo ou ao desmontar.
 *
 * ⚠️ **Nunca revogar em `onLoad`** (nota do `cto-obra` para o Gate 1): Safari
 * e Chrome relêem o `data`/`src` em situações que o app não controla (voltar
 * da aba, remontagem, impressão) e a imagem viraria um quadrado quebrado.
 *
 * ⚠️ **Divergência deliberada da nota do `cto-obra`, que dizia "revogar ao
 * fechar o Lightbox".** A MESMA URL alimenta a miniatura do rail, que continua
 * na tela depois de o modal fechar, e a aba nova do PDF no celular, que segue
 * aberta atrás do app. Revogar no fechamento mataria as duas. O que a nota
 * quer garantir — que a URL não vaze para sempre — é atendido pela troca de
 * arquivo e pelo desmonte, que é o superconjunto seguro.
 */
export function useUrlDoAnexo(arquivo: File | null): string | null {
  // `useMemo` e não `useState` + efeito: a URL nasce no MESMO render em que o
  // arquivo muda. Guardada em estado, haveria um frame com o `src` apontando
  // para a URL já revogada do arquivo anterior — imagem quebrada piscando a
  // cada troca. Se o React descartar o memo, o efeito abaixo roda de novo e a
  // limpeza revoga exatamente a URL que ele tinha visto.
  const url = useMemo(
    () => (arquivo ? URL.createObjectURL(arquivo) : null),
    [arquivo],
  );

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}

/**
 * `true` quando o PDF NÃO pode ser embutido — tela estreita ou ponteiro grosso.
 * Ver o porquê (e por que a consulta é negativa) em `CONSULTA_PDF_EM_NOVA_ABA`.
 *
 * `useSyncExternalStore` em vez de `useState` + `useEffect` porque o valor
 * precisa estar certo no PRIMEIRO render do controle: um `<button>` que vira
 * `<a>` um frame depois é um alvo que se move debaixo do dedo. O snapshot do
 * servidor é `false` e nunca é usado de verdade — o rail só existe depois de o
 * usuário anexar um arquivo, o que não acontece durante a hidratação.
 */
export function usePdfEmNovaAba(): boolean {
  const inscrever = useMemo(
    () => (aoMudar: () => void) => {
      const consulta = window.matchMedia(CONSULTA_PDF_EM_NOVA_ABA);
      consulta.addEventListener("change", aoMudar);
      return () => consulta.removeEventListener("change", aoMudar);
    },
    [],
  );
  return useSyncExternalStore(
    inscrever,
    () => window.matchMedia(CONSULTA_PDF_EM_NOVA_ABA).matches,
    () => false,
  );
}

/** O modo de exibição do anexo atual — tipo do arquivo × dispositivo de entrada. */
export function useModoDoPreview(arquivo: File | null): ModoDoPreview {
  const emNovaAba = usePdfEmNovaAba();
  return modoDoPreview(previewDoAnexo(arquivo), emNovaAba);
}

/**
 * O controle "ver o documento", nas duas formas que ele pode ter.
 *
 * ⚠️ **`<a target="_blank">` de verdade quando o PDF vai para outra aba, nunca
 * `window.open` depois de um `await`**: navegador de celular só deixa abrir aba
 * DENTRO do gesto de toque, e uma abertura assíncrona é bloqueada em silêncio —
 * o Mateus tocaria e nada aconteceria.
 */
export function ControleVerDocumento({
  modo,
  url,
  rotulo,
  rotuloPdfEmNovaAba,
  onAbrir,
  className,
  "data-ver": dataVer,
}: {
  modo: ModoDoPreview;
  url: string | null;
  rotulo: string;
  /** O rótulo muda quando o clique SAI do app: dizer para onde se está indo. */
  rotuloPdfEmNovaAba: string;
  onAbrir: () => void;
  className: string;
  "data-ver": string;
}) {
  if (modo === "sem-preview" || !url) return null;

  if (modo === "pdf-em-nova-aba") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener"
        data-ver={dataVer}
        className={className}
      >
        {rotuloPdfEmNovaAba}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onAbrir}
      data-ver={dataVer}
      className={className}
    >
      {rotulo}
    </button>
  );
}

type EstadoDaImagem = "carregando" | "pronta" | "erro";

/**
 * **Estado E do Gate 0 — o Lightbox.** É aqui que CNPJ, valor e data ficam
 * legíveis; a miniatura do rail só confirma "é este o papel".
 *
 * Fecha por X, Esc e clique fora; o foco fica preso dentro enquanto está
 * aberto. Em `larga` é um painel centralizado de até 840px; no piso ocupa a
 * tela inteira (Estado F), sem virar rota — o formulário continua montado
 * atrás, com tudo o que já foi digitado.
 *
 * ⚠️ **`url` é `string`, não `string | null`, e não existe estado de "abrindo
 * o arquivo".** `useUrlDoAnexo` cria a URL no MESMO render em que o arquivo
 * muda (é `useMemo`, não efeito), então nunca há um frame com arquivo e sem
 * URL. Quem monta este componente já monta com as duas coisas na mão — o
 * `null` fica na guarda da chamada, onde ele é real. O único carregamento que
 * existe aqui é o da IMAGEM (`EstadoDaImagem`), que é rede/decodificação do
 * navegador, não da URL.
 */
export function LightboxDoAnexo({
  arquivo,
  url,
  modo,
  onFechar,
}: {
  arquivo: File;
  url: string;
  modo: ModoDoPreview;
  onFechar: () => void;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const [ampliado, setAmpliado] = useState(false);
  const [imagem, setImagem] = useState<EstadoDaImagem>("carregando");

  // Arquivo trocado com o modal aberto: volta ao começo em vez de mostrar o
  // zoom e o erro do arquivo anterior. Zerado no RENDER, não num efeito — é o
  // padrão do projeto para estado que acompanha uma prop (`useEsperaLonga`, em
  // `ui.tsx`) e o que o `react-hooks/set-state-in-effect` cobra.
  const [urlVista, setUrlVista] = useState(url);
  if (urlVista !== url) {
    setUrlVista(url);
    setAmpliado(false);
    setImagem("carregando");
  }

  useEffect(() => {
    botaoFechar.current?.focus();
  }, []);

  const aoTeclar = useCallback(
    (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onFechar();
        return;
      }
      if (evento.key !== "Tab") return;
      const caixa = painel.current;
      if (!caixa) return;
      const focaveis = caixa.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      if (!evento.shiftKey && ativo === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      } else if (evento.shiftKey && ativo === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      }
    },
    [onFechar],
  );

  useEffect(() => {
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoTeclar]);

  const podeAmpliar = modo === "imagem" && imagem === "pronta";

  return (
    <div
      data-lightbox="anexo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 larga:p-6"
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={`${LIGHTBOX_TITULO} — ${arquivo.name}`}
        className="flex h-full w-full flex-col overflow-hidden bg-paper larga:h-auto larga:max-h-[90vh] larga:max-w-[840px] larga:rounded-[14px] larga:border larga:border-line"
      >
        <div className="flex flex-none items-center justify-between gap-2.5 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13px] font-bold">{LIGHTBOX_TITULO}</div>
            <div className="truncate text-[11.5px] text-mut">
              {arquivo.name}
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            {podeAmpliar ? (
              <button
                type="button"
                data-lightbox-zoom
                onClick={() => setAmpliado((antes) => !antes)}
                className="min-h-[36px] rounded-lg border border-line bg-white px-3 text-[12px] font-semibold"
              >
                {ampliado ? "Ajustar" : "Ampliar (100%)"}
              </button>
            ) : null}
            <button
              ref={botaoFechar}
              type="button"
              aria-label="Fechar"
              onClick={onFechar}
              className="min-h-[36px] px-2 text-[18px] text-mut"
            >
              ✕
            </button>
          </div>
        </div>

        <div
          data-lightbox="corpo"
          className={`relative min-h-0 flex-1 overflow-auto bg-soft ${
            ampliado
              ? "flex items-start justify-start"
              : "flex items-center justify-center"
          }`}
        >
          {modo === "imagem" ? (
            <>
              {imagem === "carregando" ? (
                <p className="absolute p-6 text-[12.5px] text-mut">
                  Carregando a imagem…
                </p>
              ) : null}
              {imagem === "erro" ? (
                <FalhaDoPreview url={url} nome={arquivo.name} />
              ) : (
                // ⚠️ `key={url}` — trocar só o `src` não faz Safari/Chrome
                // recarregarem de forma confiável quando o arquivo muda.
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={url}
                  src={url}
                  alt={`Documento anexado: ${arquivo.name}`}
                  onLoad={() => setImagem("pronta")}
                  onError={() => setImagem("erro")}
                  className={
                    ampliado
                      ? "max-w-none"
                      : "max-h-full max-w-full object-contain"
                  }
                />
              )}
            </>
          ) : modo === "pdf-embutido" ? (
            // O visualizador nativo do navegador já traz zoom, paginação e
            // busca. `children` do `<object>` é o fallback — `<embed>` sozinho
            // não tem nenhum.
            <object
              key={url}
              data={url}
              type="application/pdf"
              data-lightbox-pdf
              className="h-full min-h-[70vh] w-full bg-white"
            >
              <FalhaDoPreview url={url} nome={arquivo.name} />
            </object>
          ) : modo === "pdf-em-nova-aba" ? (
            // Só chega aqui se a largura/ponteiro mudarem com o modal aberto —
            // no caminho normal o próprio controle do rail já é o `<a>`.
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-[12.5px] text-mut">
                {PDF_EM_NOVA_ABA_EXPLICACAO}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener"
                className="rounded-[10px] border border-ink px-4 py-2.5 text-[13.5px] font-bold"
              >
                {ABRIR_PDF_EM_ABA}
              </a>
            </div>
          ) : (
            <FalhaDoPreview url={url} nome={arquivo.name} />
          )}
        </div>

        <div className="flex-none border-t border-line px-4 py-2.5 text-[11.5px] text-mut">
          {LIGHTBOX_DICA}
        </div>
      </div>
    </div>
  );
}

/**
 * **Critério 2 — falha de preview NUNCA é gate.** Formato que o navegador não
 * abre, PDF que o visualizador recusa, imagem corrompida: tudo cai aqui, com o
 * download do próprio arquivo e a frase que diz que o registro não depende
 * disto. Nada de `role="alert"`: não é erro do usuário nem da gravação.
 */
function FalhaDoPreview({ url, nome }: { url: string; nome: string }) {
  return (
    <div
      data-lightbox="falha"
      className="flex flex-col items-center gap-2.5 p-6 text-center"
    >
      <p className="text-[13px] font-semibold">{PREVIEW_INDISPONIVEL}</p>
      <p className="text-[12px] text-mut">
        {PREVIEW_INDISPONIVEL_CONSEQUENCIA}
      </p>
      {/* `download` de blob funciona em iOS ≥ 13 (nota do `cto-obra`). */}
      <a
        href={url}
        download={nome}
        className="rounded-[10px] border border-line bg-white px-4 py-2.5 text-[13px] font-semibold"
      >
        {BAIXAR_ARQUIVO}
      </a>
    </div>
  );
}
