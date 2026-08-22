"use client";

/**
 * Escolher N papéis ANTES de gravar, cada um com o seu `papel` — CONTAI-027,
 * rodada 2 (critérios 8, 9b e 14; mock `design/mocks/CONTAI-027.html`, telas
 * 2, 2d e 1c).
 *
 * ⚠️ **Nada aqui sobe para o acervo.** O upload acontece no Gravar, na tela
 * que usa este componente — e é por isso que "Tirar da lista" só existe aqui.
 * Depois de gravado, o acervo só cresce: `terreno_desembolso_anexo` não tem
 * DELETE para `authenticated` (migration 0010).
 *
 * ⚠️ **O caminho de captura não alonga** (critério 8 + Teste do Canteiro): é
 * UM campo de arquivo, como hoje. Quem anexa um só papel escolhe o arquivo,
 * diz o que ele é e grava — nenhuma tela nova, nenhuma confirmação nova,
 * nenhuma navegação nova. O `multiple` é o que muda, e ele não custa toque
 * nenhum a quem leva um arquivo só.
 *
 * ⚠️ **`papel` nasce VAZIO e sem pré-seleção** (critério 14): campo com
 * consequência fiscal não tem default. Quem decide qual papel é qual é o
 * Mateus — "o app não tem como saber, e não deve fingir que tem".
 */

import { useId } from "react";

import { ErroCampo, Escolha, Rotulo } from "@/app/_components/campos";
import { extensaoDoArquivoNoAcervo } from "@/lib/acervo";
import { PAPEIS_DE_ANEXO, ROTULO_DO_PAPEL } from "@/lib/fiscal/terreno";
import type { PapelDeAnexo } from "@/lib/types";

/** Um papel escolhido, ainda não gravado. `papel: null` = falta responder. */
export interface AnexoEscolhido {
  /** Chave estável da lista: dois arquivos de mesmo nome são dois itens. */
  chave: string;
  arquivo: File;
  papel: PapelDeAnexo | null;
}

let sequencia = 0;

export function anexoEscolhido(arquivo: File): AnexoEscolhido {
  sequencia += 1;
  return { chave: `anexo-${sequencia}`, arquivo, papel: null };
}

/** Quantos ainda não têm papel — é o que trava o Gravar, com o número na cara. */
export function semPapel(itens: readonly AnexoEscolhido[]): number {
  return itens.filter((i) => i.papel === null).length;
}

/**
 * Os comprovantes desta escolha. ⚠️ Conta PAPEL, não arquivo: é a régua do §6
 * do parecer, e a contagem de arquivos é justamente o erro que a redação
 * anterior do critério 12 trazia.
 */
export function comprovantesEscolhidos(
  itens: readonly AnexoEscolhido[],
): number {
  return itens.filter((i) => i.papel === "comprovante").length;
}

const OPCOES_DE_PAPEL = PAPEIS_DE_ANEXO.map((valor) => ({
  valor,
  texto: ROTULO_DO_PAPEL[valor],
}));

function tamanho(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(kb)).toLocaleString("pt-BR")} KB`;
}

export function EscolhaDeAnexos({
  rotulo,
  ajuda,
  itens,
  onChange,
  erro,
}: {
  rotulo: string;
  ajuda: string;
  itens: readonly AnexoEscolhido[];
  onChange: (itens: AnexoEscolhido[]) => void;
  erro?: string;
}) {
  const id = useId();

  function acrescentar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    onChange([...itens, ...Array.from(lista).map(anexoEscolhido)]);
  }

  const faltando = semPapel(itens);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>
        <Rotulo>{rotulo}</Rotulo>
      </label>
      <input
        id={id}
        type="file"
        multiple
        accept=".pdf,image/*"
        onChange={(e) => {
          acrescentar(e.target.files);
          // Zerado para que escolher DE NOVO o mesmo arquivo dispare o evento:
          // sem isto, "escolhi, tirei da lista, escolhi de novo" não faria nada.
          e.target.value = "";
        }}
        aria-invalid={erro ? true : undefined}
        className={`min-h-[44px] rounded-lg border bg-white px-3 py-2.5 text-[13px] ${
          erro ? "border-red" : "border-line"
        }`}
      />
      <p className="text-[12px] text-mut">{ajuda}</p>

      {itens.length === 0 ? (
        <p className="text-[12px] text-mut">Nenhum papel escolhido ainda.</p>
      ) : (
        <div data-anexos-novos={itens.length}>
          {itens.map((item) => (
            <div
              key={item.chave}
              data-anexo-novo={item.arquivo.name}
              data-papel={item.papel ?? ""}
              className="mt-2 rounded-lg border border-line bg-white px-2.5 py-2 first:mt-0"
            >
              <div className="flex items-start gap-2.5">
                <div
                  aria-hidden
                  className="flex h-[54px] w-11 flex-none items-center justify-center rounded-md border border-line bg-soft text-[10px] font-bold tracking-wide text-mut"
                >
                  {extensaoDoArquivoNoAcervo(item.arquivo.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold [overflow-wrap:anywhere]">
                    {item.arquivo.name}
                  </div>
                  <div className="text-[11.5px] text-mut">
                    {tamanho(item.arquivo.size)} · escolhido agora, ainda não
                    gravado
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChange(itens.filter((i) => i.chave !== item.chave))
                  }
                  className="min-h-[44px] flex-none px-1 text-[12px] font-semibold text-mut underline"
                >
                  Tirar da lista
                </button>
              </div>

              <div className="mt-2">
                <Escolha
                  rotulo="O que é este papel?"
                  opcoes={OPCOES_DE_PAPEL}
                  valor={item.papel}
                  onChange={(papel) =>
                    onChange(
                      itens.map((i) =>
                        i.chave === item.chave ? { ...i, papel } : i,
                      ),
                    )
                  }
                  erro={
                    item.papel === null && erro
                      ? "Escolha um — sem isso este papel não grava."
                      : undefined
                  }
                />
                <p className="mt-1 text-[11.5px] text-mut">
                  Na ordem: o dinheiro saiu · o que eu comprei · o que eu
                  combinei.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {faltando > 0 ? (
        <p className="text-[12px] text-mut">
          {faltando === 1
            ? "1 papel ainda sem resposta."
            : `${faltando} papéis ainda sem resposta.`}
        </p>
      ) : null}

      <ErroCampo mensagem={erro} />
    </div>
  );
}
