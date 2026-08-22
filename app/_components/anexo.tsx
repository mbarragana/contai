"use client";

/**
 * O papel do acervo, em LISTA, com **Abrir** — CONTAI-027, rodada 1
 * (critérios 2 a 6; mock `design/mocks/CONTAI-027.html`, telas 1 e 1b).
 *
 * Antes deste componente o app não abria anexo nenhum, em tela nenhuma: três
 * telas mostravam o nome do arquivo e uma delas mandava "confira antes de
 * digitar" sem oferecer com o quê conferir. É a dor D35, e ela morde a meta 3 —
 * acervo que ninguém consegue ler não cumpre prazo de decadência nenhum.
 *
 * ⚠️ **Nasce em lista, e isso é decisão do mock, não gosto**: é o mesmo item
 * nas sete superfícies, e a rodada 2 (N anexos por lançamento) só acrescenta
 * linhas. Um componente de item único compraria a segunda rodada de mock que
 * este ticket existe para evitar.
 *
 * ⚠️ **O que o item NÃO mostra, e não é esquecimento**: tamanho do arquivo,
 * data de anexação e o campo `papel`. O mock desenha os três porque lá o
 * arquivo está na mão do navegador; aqui o que existe no banco é um caminho de
 * texto. `papel` nasce na rodada 2 (critério 14) e ainda não tem coluna. Campo
 * que o app não sabe não se preenche — nem com chamada extra ao Storage para
 * parecer que sabe.
 */

import { useState } from "react";

import {
  ACERVO_FALHA_AO_ABRIR,
  ACERVO_NEGADO,
  extensaoDoArquivoNoAcervo,
  nomeDoArquivoNoAcervo,
} from "@/lib/acervo";
import { AcervoNegadoError, criarLinkDeLeitura } from "@/lib/data";

/**
 * Os QUATRO estados são do ITEM, não da tela: numa lista de três papéis, um
 * pode falhar enquanto os outros dois abrem. Estado de tela apagaria essa
 * diferença e faria o Mateus achar que perdeu os três.
 */
type EstadoDoItem = "pronto" | "abrindo" | "falha" | "negado";

export function ItemDeAnexo({ path }: { path: string }) {
  const [estado, setEstado] = useState<EstadoDoItem>("pronto");

  async function abrir() {
    /**
     * ⚠️ A aba é aberta ANTES do `await`, e isto não é estilo.
     *
     * O alvo real é o Safari do iPhone: `window.open` chamado depois de um
     * `await` perdeu o gesto do usuário e é BLOQUEADO. O clique abriria uma
     * aba em branco que nunca navega — e o E2E não pegaria, porque o Playwright
     * não simula bloqueio de pop-up. Abrindo em branco no ato do clique e
     * navegando depois, o gesto continua valendo.
     */
    const aba = window.open("", "_blank");
    if (aba) {
      // O papel abre no domínio do Storage; a aba não precisa de referência de
      // volta para cá.
      aba.opener = null;
    }
    setEstado("abrindo");
    try {
      const url = await criarLinkDeLeitura(path);
      if (aba) aba.location.replace(url);
      // Sem aba (pop-up bloqueado mesmo assim, ou WebView que não abre outra):
      // navegar aqui é melhor do que engolir o clique. O app é PWA e o voltar
      // do aparelho traz de volta.
      else window.location.assign(url);
      setEstado("pronto");
    } catch (erro) {
      aba?.close();
      setEstado(erro instanceof AcervoNegadoError ? "negado" : "falha");
    }
  }

  const comErro = estado === "falha" || estado === "negado";

  return (
    <div
      data-anexo={path}
      data-estado={estado}
      className={`mt-2 flex items-start gap-2.5 rounded-lg border px-2.5 py-2 first:mt-0 ${
        comErro ? "border-red bg-red-bg" : "border-line bg-white"
      }`}
    >
      <div
        aria-hidden
        className="flex h-[54px] w-11 flex-none items-center justify-center rounded-md border border-line bg-soft text-[10px] font-bold tracking-wide text-mut"
      >
        {extensaoDoArquivoNoAcervo(path)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold [overflow-wrap:anywhere]">
          {nomeDoArquivoNoAcervo(path)}
        </div>
        {comErro ? (
          <p role="alert" className="mt-1 text-[11.5px] text-red">
            {estado === "negado" ? ACERVO_NEGADO : ACERVO_FALHA_AO_ABRIR}
          </p>
        ) : null}
      </div>

      <div className="flex-none">
        {estado === "abrindo" ? (
          <span role="status" className="text-[12px] text-mut">
            abrindo…
          </span>
        ) : estado === "negado" ? (
          /* Sem botão, de propósito: "Tentar de novo" não conserta "não é
             seu" — seria a porta que não abre da D36, com outro rótulo. */
          <span aria-hidden className="text-[12px] text-mut">
            —
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void abrir()}
            className={`min-h-[44px] rounded-lg border bg-white px-3 text-[13px] font-semibold ${
              estado === "falha"
                ? "border-red text-red"
                : "border-ink text-ink"
            }`}
          >
            {estado === "falha" ? "Tentar de novo" : "Abrir"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A lista. Recebe caminhos — mesmo onde hoje só existe um, porque é o mesmo
 * componente que a rodada 2 vai alimentar com N.
 *
 * `vazio` é opcional: onde a ausência de papel já tem texto fiscal próprio na
 * tela (pagamento sem comprovante, desembolso sem anexo), esta lista **não
 * reescreve** o aviso — ela simplesmente não aparece.
 */
export function ListaDeAnexos({
  titulo,
  paths,
  vazio,
}: {
  titulo: string;
  paths: readonly string[];
  vazio?: string;
}) {
  if (paths.length === 0 && !vazio) return null;

  return (
    <div className="mt-1">
      <div className="font-semibold">
        {titulo}
        {paths.length > 1 ? ` (${paths.length})` : ""}
      </div>
      <div className="mt-2">
        {paths.length === 0 ? (
          <p className="text-[12px] text-mut">{vazio}</p>
        ) : (
          paths.map((path) => <ItemDeAnexo key={path} path={path} />)
        )}
      </div>
    </div>
  );
}
