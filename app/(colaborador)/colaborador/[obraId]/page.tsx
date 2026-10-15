"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  AppBar,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  EstadoErro,
} from "@/app/_components/ui";
import {
  carregarMeusVinculos,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import type { VinculoDaObra } from "@/lib/types";

/**
 * **Tela (c) do CONTAI-093 — a área de UMA obra, pelo olho do colaborador.**
 *
 * Nasceu na Emenda 2026-10-14, quando a tela (b) deixou de ser destino final:
 * com 2+ obras possíveis, "o que eu tenho a fazer" é sempre por obra. É aqui
 * que as fatias `CONTAI-094`/`095` penduram a lista de documentos e
 * compromissos do colaborador — nesta fatia, não há nada a listar ainda.
 *
 * ⚠️ **O texto do "nada a fazer ainda" é NEUTRO, e é uma pendência de produto
 * declarada** (Pergunta Aberta 5 do ticket / 4 do spec de design, sem resposta
 * do Mateus nesta data): a pergunta é se ele anuncia o que chega em `094`/`095`
 * ou se fica neutro. Anunciar funcionalidade que não existe é promessa que o
 * app não cumpre, então até a resposta dele a tela diz o que é verdade hoje e
 * para aí.
 */

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  /**
   * ⚠️ **Estado além dos quatro do spec de design, e ele existe porque a ROTA
   * tem id na URL.** O spec desenhou loading/vazio/erro/sucesso para uma tela
   * que se alcança por clique; esta também se alcança por link velho, por
   * histórico do navegador e por obra cujo acesso acabou de ser revogado. Sem
   * este ramo, os três casos cairiam no "nada a fazer ainda" — que afirmaria
   * acesso a uma obra que a pessoa não tem mais.
   */
  | { fase: "sem_acesso" }
  | { fase: "pronto"; vinculo: VinculoDaObra };

export default function AreaDaObraDoColaborador() {
  const params = useParams<{ obraId: string }>();
  const obraId = params.obraId;

  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        // A mesma leitura da tela (b), e de propósito: é a única consulta do
        // colaborador que traz nome e cidade da obra com colunas NOMEADAS. Ler
        // a obra por `carregarObra` traria a linha inteira (CNO, matrícula) —
        // ver a nota de `carregarMeusVinculos` em `lib/data.ts`.
        const vinculos = await carregarMeusVinculos();
        if (cancelado) return;
        const vinculo = vinculos.find(
          (v) =>
            v.obraId === obraId &&
            v.removidoEm === null &&
            v.nomeDaObra !== null,
        );
        setEstado(vinculo ? { fase: "pronto", vinculo } : { fase: "sem_acesso" });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [obraId, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  const nomeDaObra =
    estado.fase === "pronto" ? (estado.vinculo.nomeDaObra ?? undefined) : undefined;

  return (
    <>
      <AppBar titulo="contai" sub={nomeDaObra} />
      <Corpo>
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando a obra" />
        ) : null}

        {estado.fase === "erro" ? (
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {estado.fase === "sem_acesso" ? (
          <Card>
            <div className="text-[14px] font-semibold">
              Você não tem acesso a esta obra
            </div>
            <p className="mt-1.5 text-[12.5px] text-mut">
              O acesso pode ter sido removido, ou este link é de outra obra.
            </p>
          </Card>
        ) : null}

        {estado.fase === "pronto" ? (
          <Card>
            {/*
              Estado "vazio" e estado "sucesso" são o MESMO conteúdo nesta fatia
              (spec de design): não há documento nem compromisso para listar
              ainda, então não há diferença visível a desenhar. Quando a `094`
              trouxer a lista, é este cartão que vira o estado vazio dela.
            */}
            <div className="text-[14px] font-semibold">Nada a fazer ainda</div>
            <p className="mt-1.5 text-[12.5px] text-mut">
              Você já tem acesso a esta obra. Ainda não há nada para você fazer
              por aqui.
            </p>
          </Card>
        ) : null}

        {estado.fase === "pronto" || estado.fase === "sem_acesso" ? (
          <BotaoLink href="/colaborador">Trocar obra</BotaoLink>
        ) : null}
      </Corpo>
    </>
  );
}
