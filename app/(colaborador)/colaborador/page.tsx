"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  AppBar,
  Botao,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import {
  carregarMeusVinculos,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import { gravarObraPreferida } from "@/lib/obra-ativa";
import type { VinculoDaObra } from "@/lib/types";

/**
 * **Tela (b) do CONTAI-093 — em que obras eu colaboro.**
 *
 * ⚠️ **Deixou de ser o destino final do login na Emenda 2026-10-14**, quando o
 * Mateus respondeu que um colaborador pode ter acesso a mais de uma obra dele ao
 * mesmo tempo. Aqui não se renderiza documento, compromisso nem "nada a fazer
 * ainda": isto é uma lista com uma ação por cartão, e o conteúdo vive na tela
 * (c), por obra (`/colaborador/[obraId]`).
 *
 * ⚠️ **Nenhum número fiscal, e nem por acidente**: cada cartão mostra nome e
 * cidade, que é o que `carregarMeusVinculos` pede ao banco (`obra(nome,
 * municipio)` — colunas nomeadas, nunca `obra(*)`). CNO, matrícula, valor de
 * terreno e custo acumulado não passam por esta tela em caminho nenhum.
 */

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; vinculos: VinculoDaObra[] };

export default function ObrasDoColaborador() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const vinculos = await carregarMeusVinculos();
        if (cancelado) return;
        // Só os ATIVOS entram na lista. O carregador devolve os removidos
        // também (é deles que `papelDaSessao` precisa), e um vínculo removido
        // nem tem obra para mostrar: a policy `obra_select` da 0030 para de
        // devolver a linha no instante em que o acesso é revogado.
        setEstado({
          fase: "pronto",
          vinculos: vinculos.filter(
            (v) => v.removidoEm === null && v.nomeDaObra !== null,
          ),
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
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

  /**
   * ⚠️ **Reaproveita o MECANISMO de obra ativa, nunca a tela `/obras`**
   * (critério 12). `gravarObraPreferida` é o mesmo `lib/obra-ativa.ts` que o
   * dono usa — é o que faz a obra escolhida valer para as telas que as fatias
   * `094`/`095` vão pendurar aqui. A tela `/obras` do dono fica fora de alcance
   * por desenho: ela é dono-only e tem um botão de criar obra que o colaborador
   * não pode acionar.
   *
   * ⚠️ **Exige o clique mesmo com UMA obra só** (spec de design, estado de
   * sucesso): a preferência de obra ativa nasce de ação explícita, nunca de
   * auto-escolha — a mesma régua do `TelaTrocarObra` do dono. Obra escolhida
   * pelo app é a porta de "número fiscal atribuído à obra errada".
   */
  const entrar = useCallback(
    (obraId: string) => {
      gravarObraPreferida(obraId);
      router.push(`/colaborador/${obraId}`);
    },
    [router],
  );

  return (
    <>
      <AppBar titulo="contai" sub="Obras em que você colabora" />
      <Corpo>
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando as suas obras" />
        ) : null}

        {estado.fase === "erro" ? (
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {estado.fase === "pronto" && estado.vinculos.length === 0 ? (
          <Card>
            <div className="text-[14px] font-semibold">
              Você ainda não foi vinculado a nenhuma obra
            </div>
            {/*
              Dois estados caem aqui e o texto cobre os dois sem mentir sobre
              qual é: nunca vinculado, e acesso revogado (o vínculo removido
              continua existindo no banco, mas a obra não vem mais com ele).
              Dizer "seu acesso foi removido" exigiria afirmar algo que esta
              tela não tem como distinguir — e afirmar errado aqui é pior do que
              ser genérico.
            */}
            <p className="mt-1.5 text-[12.5px] text-mut">
              Quando o dono da obra conceder o acesso, ela aparece aqui.
            </p>
          </Card>
        ) : null}

        {estado.fase === "pronto" && estado.vinculos.length > 0 ? (
          <>
            {estado.vinculos.map((vinculo) => (
              <Card key={vinculo.id} data-obra-colaborador={vinculo.obraId}>
                <div className="text-[14.5px] font-semibold">
                  {vinculo.nomeDaObra}
                </div>
                {vinculo.municipio ? (
                  <div className="mt-px text-[12.5px] text-mut">
                    {vinculo.municipio}
                  </div>
                ) : null}
                <div className="mt-2.5">
                  <Botao
                    variante="primary"
                    onClick={() => entrar(vinculo.obraId)}
                  >
                    Entrar nesta obra
                  </Botao>
                </div>
              </Card>
            ))}
            <Dica>
              Você entra em uma obra por vez. Para trocar, volte a esta lista.
            </Dica>
          </>
        ) : null}
      </Corpo>
    </>
  );
}
