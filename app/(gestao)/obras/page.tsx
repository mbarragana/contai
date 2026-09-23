"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ListaDeEscolha } from "@/app/_components/obra";
import {
  Banner,
  BotaoLink,
  Carregando,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import {
  carregarPaineis,
  classificarErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { calcularResumo } from "@/lib/fiscal/resumo";
import { hojeIso } from "@/lib/hoje";
import { gravarObraPreferida } from "@/lib/obra-ativa";
import type { Obra } from "@/lib/types";

/**
 * Tela 2 do mock — a porta de entrada quando não há obra ativa confiável, e o
 * escape do "Trocar obra".
 *
 * Sem valor em dinheiro nenhum, de propósito (critério 14): Bens e Direitos não
 * soma entre matrículas e a aferição não soma entre CNOs, então dois valores
 * lado a lado estão a uma soma mental de virar um número que não existe em
 * declaração nenhuma. Identidade e estado acionável bastam para escolher.
 */

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; paineis: PainelDados[] };

/**
 * **CONTAI-051 — o teto de largura que faltou na migração para o shell.**
 *
 * Esta página nunca entrou nos tickets `040`/`043`-`046`: até aqui ela devolvia
 * um Fragment cru, e como `app/(gestao)/layout.tsx` não impõe teto no `<main>`,
 * os cards de `ListaDeEscolha` esticavam pela largura toda do shell ao lado de
 * dois botões presos em `max-w-[430px]` — a mesma inconsistência que reprovou o
 * Conceito 1 do `CONTAI-039`.
 *
 * ⚠️ **Não é `ColunaDeDetalhe`, e a diferença é de FAMÍLIA, não de estilo**
 * (critério 1 do ticket). `ColunaDeDetalhe`/`CabecalhoDaTela`
 * (`app/_components/detalhe.tsx`) são das telas cujo título é DADO carregado e
 * que têm UMA ação de página. `/obras` é da família "lista/escolha de nível
 * superior da sidebar", como `/despesas` e `/pendencias`: o título vem da ROTA,
 * por `tituloDaView`, e nenhuma tela desta família chama `CabecalhoDaTela`.
 * Aplicar a moldura de detalhe aqui seria encaixar uma lista na casca errada só
 * porque é o padrão mais recente.
 *
 * ⚠️ **640px é o número reaproveitado, não o componente.** É a única medida de
 * "coluna de leitura" que o shell já tem (`ColunaDeDetalhe`), reaproveitada aqui
 * para não nascer um terceiro número mágico ao lado de 430/640 — `/obras` fica
 * irmã visual das telas de detalhe que o usuário vê logo depois (`/obras/[id]`,
 * `/documento/[id]`), **não** por ser o destino da navegação do clique: o clique
 * num card chama `escolher()`, que grava a preferência e vai para a HOME, que é
 * full-width. A coluna muda de largura nessa transição de qualquer jeito, e esse
 * argumento — errado — foi retirado no Gate 2 do `CONTAI-051`.
 *
 * Full-width foi descartado pelo mesmo motivo medido no Gate 2 do `039`: card de
 * três linhas, sem coluna de dado nenhuma, lê pior esparso por 900px+ do que
 * numa coluna. `/despesas` continua full-width porque lá há uma tabela de sete
 * colunas para preencher — aqui não há.
 *
 * ⚠️ **O teto mora AQUI, nunca dentro de `ListaDeEscolha`** (critério 6): o
 * mesmo componente é usado por `TelaTrocarObra`, dentro da coluna de formulário
 * de `(captura)`, e um `max-width` interno vazaria a decisão de largura do
 * shell de gestão para a casca de captura.
 *
 * Envolve TODOS os estados — carregando, erro, vazio e pronto —, porque o teto é
 * da tela e não de um ramo dela. `gap-3` é o mesmo do `<main>` que a envolve: a
 * moldura muda, o ritmo interno não.
 */
function ColunaDeEscolha({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-coluna="escolha"
      className="flex w-full max-w-[640px] flex-col gap-3"
    >
      {children}
    </div>
  );
}

export default function Obras() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const paineis = await carregarPaineis();
        if (!cancelado) setEstado({ fase: "pronto", paineis });
      } catch (erro) {
        if (!cancelado) {
          setEstado({ fase: "erro", erro: classificarErro(erro) });
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  /** Escolha explícita — o único jeito de uma obra virar a obra ativa. */
  const escolher = useCallback(
    (obra: Obra) => {
      gravarObraPreferida(obra.id);
      router.push("/");
    },
    [router],
  );

  const hoje = hojeIso();
  const ano = Number(hoje.slice(0, 4));
  const vazio = estado.fase === "pronto" && estado.paineis.length === 0;

  if (vazio) {
    // Tela 3 — primeiro acesso. Antes disto era `ObraAusenteError` numa tela
    // de erro sem saída, e matrícula/CNO/valor do terreno só entravam por SQL.
    return (
      <ColunaDeEscolha>
        <div className="mt-6 text-center">
          <div className="text-[15px] font-semibold">
            Nenhuma obra cadastrada
          </div>
          <p className="mt-2 text-[12px] text-mut">
            O contai guarda documento e pagamento por obra, porque cada obra é
            uma matrícula na sua declaração e um CNO na aferição do INSS. Comece
            cadastrando a primeira.
          </p>
        </div>
        <div className="mt-4">
          <BotaoLink href="/obras/nova" variante="primary">
            Cadastrar a primeira obra
          </BotaoLink>
        </div>
      </ColunaDeEscolha>
    );
  }

  return (
    <ColunaDeEscolha>
      {estado.fase === "carregando" ? (
        <Carregando rotulo="Carregando as obras" />
      ) : null}

      {estado.fase === "erro" ? (
        <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
      ) : null}

      {estado.fase === "pronto" ? (
        <>
          <Banner cor="amb" role="status">
            <strong>Escolha a obra.</strong> O app não escolhe por você — um
            documento na obra errada infla a base de INSS da outra e trava a
            regularização daquele CNO.
          </Banner>

          <ListaDeEscolha
            obras={estado.paineis.map((p) => p.obra)}
            hoje={hoje}
            onEscolher={escolher}
            pendenciasPorObra={
              new Map(
                estado.paineis.map((p) => [
                  p.obra.id,
                  calcularResumo({ ...p, ano }).pendencias.length,
                ]),
              )
            }
          />

          <Dica>
            Sem valores em dinheiro aqui de propósito: dois números lado a lado
            viram uma soma mental, e não existe total das duas obras em
            declaração nenhuma. O dinheiro mora dentro da obra.
          </Dica>

          {/* ⚠️ CONTAI-040: era `Rodape` fixo, peça do fluxo de 430px. Dentro
              do shell a ação fecha a lista, que é onde ela é lida.
              ⚠️ CONTAI-051: o `max-w-[430px]` que sobrava aqui saiu — a largura
              agora é a da `ColunaDeEscolha`, a mesma da lista logo acima. */}
          <div>
            <BotaoLink href="/obras/nova">+ Nova obra</BotaoLink>
          </div>
        </>
      ) : null}
    </ColunaDeEscolha>
  );
}
