"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ListaDeEscolha } from "@/app/_components/obra";
import {
  AppBar,
  Banner,
  BotaoLink,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Rodape,
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
      <>
        <AppBar titulo="contai" sub="Primeiro acesso" />
        <Corpo>
          <div className="mt-6 text-center">
            <div className="text-[15px] font-semibold">
              Nenhuma obra cadastrada
            </div>
            <p className="mt-2 text-[12px] text-mut">
              O contai guarda documento e pagamento por obra, porque cada obra é
              uma matrícula na sua declaração e um CNO na aferição do INSS.
              Comece cadastrando a primeira.
            </p>
          </div>
        </Corpo>
        <Rodape>
          <BotaoLink href="/obras/nova" variante="primary">
            Cadastrar a primeira obra
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  return (
    <>
      <AppBar titulo="Suas obras" sub="Escolha em qual você vai mexer" />
      <Corpo>
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
          </>
        ) : null}
      </Corpo>
      <Rodape>
        <BotaoLink href="/obras/nova">+ Nova obra</BotaoLink>
      </Rodape>
    </>
  );
}
