"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Rodape,
} from "@/app/_components/ui";
import { carregarObras, classificarErro, type ErroDeTela } from "@/lib/data";
import { podeCorrigirObra } from "@/lib/fiscal/obra";
import type { Obra, TipoDocumento } from "@/lib/types";

/**
 * Tela 16 — correção da obra de um registro já salvo (critério 13).
 *
 * Existe porque este erro é silencioso e se descobre tarde: prevenir sem
 * consertar perderia o caso real, e a alternativa seria SQL na mão — a dor D9
 * voltando pela porta dos fundos.
 *
 * A restrição fiscal está em `podeCorrigirObra`: mover NF de serviço revalida o
 * CNO da nota contra o CNO da obra de destino, para a correção não contrabandear
 * uma nota para uma obra cujo CNO ela não referencia.
 */
export function CorrigirObra({
  titulo,
  sub,
  descricao,
  obraAtualId,
  tipo,
  cnoReferenciado,
  mover,
  voltarHref,
}: {
  titulo: string;
  sub: string;
  descricao: { rotulo: string; valor: string }[];
  obraAtualId: string;
  /** `null` em pagamento: a revalidação de CNO é regra de NF de serviço. */
  tipo: TipoDocumento | null;
  cnoReferenciado: string | null;
  mover: (obraDestinoId: string) => Promise<void>;
  voltarHref: string;
}) {
  const [obras, setObras] = useState<Obra[] | null>(null);
  const [destino, setDestino] = useState<Obra | null>(null);
  const [erro, setErro] = useState<ErroDeTela | null>(null);
  const [movendo, setMovendo] = useState(false);
  const [movido, setMovido] = useState<Obra | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const todas = await carregarObras();
        if (!cancelado) setObras(todas);
      } catch (e) {
        if (!cancelado) setErro(classificarErro(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setErro(null);
    setObras(null);
    setTentativa((t) => t + 1);
  }, []);

  const atual = obras?.find((o) => o.id === obraAtualId) ?? null;
  const outras = (obras ?? []).filter((o) => o.id !== obraAtualId);
  const decisao = destino
    ? podeCorrigirObra({ tipo, cnoReferenciado, cnoDestino: destino.cno })
    : null;

  async function confirmar() {
    if (!destino || !decisao?.permitido) return;
    setMovendo(true);
    setErro(null);
    try {
      await mover(destino.id);
      setMovido(destino);
    } catch (e) {
      setErro(classificarErro(e));
    } finally {
      setMovendo(false);
    }
  }

  if (movido) {
    return (
      <>
        <AppBar titulo="Obra corrigida ✓" sub={movido.nome} />
        <Corpo>
          <Banner cor="grn" role="status">
            Este registro agora está em <strong>{movido.nome}</strong> e sai de
            todas as saídas da obra anterior.
          </Banner>
          <Card>
            {descricao.map((d) => (
              <Linha key={d.rotulo} rotulo={d.rotulo}>
                {d.valor}
              </Linha>
            ))}
            <Linha rotulo="Obra">{movido.nome}</Linha>
          </Card>
        </Corpo>
        <Rodape>
          <BotaoLink href="/" variante="primary">
            Voltar ao início
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  return (
    <>
      <AppBar titulo={titulo} sub={sub} />
      <Corpo>
        {erro ? <EstadoErro erro={erro} onTentarDeNovo={tentarDeNovo} /> : null}
        {obras === null && !erro ? (
          <Carregando rotulo="Carregando as obras" />
        ) : null}

        {obras !== null ? (
          <>
            <Card>
              {descricao.map((d) => (
                <Linha key={d.rotulo} rotulo={d.rotulo}>
                  {d.valor}
                </Linha>
              ))}
              <Linha rotulo="Está em">{atual?.nome ?? "—"}</Linha>
            </Card>

            {outras.length === 0 ? (
              <Banner cor="amb" role="status">
                Só existe uma obra cadastrada — não há para onde mover.
              </Banner>
            ) : (
              <>
                <Dica>Mover para</Dica>
                {outras.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setDestino(o)}
                    aria-pressed={destino?.id === o.id}
                    className={`min-h-[44px] rounded-[10px] border px-[14px] py-3 text-left ${
                      destino?.id === o.id
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-white"
                    }`}
                  >
                    <div className="font-semibold">{o.nome}</div>
                    <div className="mono text-[12px] opacity-80">
                      {o.cno ? `CNO ${o.cno}` : "sem CNO"}
                    </div>
                  </button>
                ))}
              </>
            )}

            {tipo === "nf_servico" ? (
              <Consequencia cor="amb">
                Esta é uma <strong>NF de serviço</strong>: mover para outra obra
                revalida o CNO da nota contra o CNO da obra de destino. Se a nota
                referenciar um CNO diferente, a correção é barrada — senão a nota
                entraria numa obra cujo CNO ela não menciona.
              </Consequencia>
            ) : null}

            {decisao && !decisao.permitido ? (
              <Banner cor="red" role="alert">
                {decisao.motivo}
              </Banner>
            ) : null}
            {decisao && decisao.permitido && decisao.aviso ? (
              <Banner cor="amb" role="status">
                {decisao.aviso}
              </Banner>
            ) : null}
          </>
        ) : null}
      </Corpo>
      <Rodape>
        <Botao
          variante="primary"
          onClick={confirmar}
          disabled={movendo || !destino || decisao?.permitido !== true}
        >
          {movendo ? "Movendo…" : "Mover para a obra escolhida"}
        </Botao>
        <BotaoLink href={voltarHref}>Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
