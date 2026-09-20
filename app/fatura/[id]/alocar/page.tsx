"use client";

/**
 * ALOCAR O PAGAMENTO — a alocação manual do rotativo (CONTAI-022, mock
 * s7/s7v/s8, critério 9).
 *
 * ⚠️ Alocação é sempre BINÁRIA — a compra inteira ou nada (nunca "meio
 * alocada": isso seria pagamento por proporção, proibido pelo critério 9).
 * O checkbox trava sozinho antes de estourar o valor pago — nunca avisa
 * DEPOIS de estourar.
 *
 * s7v (nada elegível) é estado ALCANÇÁVEL, confirmado pelo `cto-obra`:
 * caminho normal do rotativo quando a última alocação já cobriu o que
 * sobrava. Nunca decidido por teto=0 — só pela ausência de compra `aberto`.
 */

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Corpo,
  Dica,
  EstadoErro,
  Rodape,
} from "@/app/_components/ui";
import {
  alocarPagamentoDeFatura,
  carregarCompromissos,
  carregarFatura,
  classificarErro,
  mensagemDeErro,
  type ErroDeTela,
} from "@/lib/data";
import {
  compromissosAbertosDaFatura,
  nadaElegivelParaAlocacao,
  saldoNaoAlocadoCentavos,
  tetoDeAlocacaoCentavos,
} from "@/lib/fiscal/fatura";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { formatarBRL } from "@/lib/money";
import type { Compromisso, Fatura, FaturaDesembolso } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; fatura: Fatura; compromissos: Compromisso[] }
  | { fase: "salvando"; fatura: Fatura; compromissos: Compromisso[] }
  | { fase: "salvo"; pagas: Compromisso[]; seguem: Compromisso[]; naoAlocado: number };

function AlocarPagamento() {
  const { id } = useParams<{ id: string }>();
  const desembolsoId = useSearchParams().get("desembolso");
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [avisoEstoura, setAvisoEstoura] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const fatura = await carregarFatura(id);
        const todos = await carregarCompromissos(fatura.obraId);
        if (cancelado) return;
        setEstado({ fase: "pronto", fatura, compromissos: todos });
      } catch (e) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(e) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  useEffect(() => {
    if (avisoEstoura) {
      const t = setTimeout(() => setAvisoEstoura(false), 2200);
      return () => clearTimeout(t);
    }
  }, [avisoEstoura]);

  if (estado.fase === "carregando" || estado.fase === "erro") {
    return (
      <>
        <AppBar titulo="Alocar o pagamento" />
        <Corpo>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando a fatura" />
          ) : (
            <EstadoErro erro={estado.erro} />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

  if (estado.fase === "salvo") {
    return (
      <>
        <AppBar titulo="Alocação confirmada" sub="fatura, rotativo" />
        <Corpo>
          <Banner cor="grn" role="status">
            <strong>Salvo.</strong> {estado.pagas.length}{" "}
            {estado.pagas.length === 1 ? "compra virou" : "compras viraram"}{" "}
            pagamento; {estado.seguem.length}{" "}
            {estado.seguem.length === 1 ? "segue" : "seguem"} agendamento
            aberto.
          </Banner>
          {estado.pagas.length > 0 ? (
            <Card>
              <Chip cor="grn">Pago</Chip>
              {estado.pagas.map((c) => (
                <div
                  key={c.id}
                  className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
                >
                  <span className="text-[13px]">{c.favorecidoNome ?? "favorecido não informado"}</span>
                  <span className="mono">{formatarBRL(c.valorPrevistoCentavos)}</span>
                </div>
              ))}
            </Card>
          ) : null}
          {estado.seguem.length > 0 ? (
            <Card className="border-dashed border-amb">
              <Chip cor="amb" vazado>
                Seguem agendamento aberto
              </Chip>
              {estado.seguem.map((c) => (
                <div
                  key={c.id}
                  className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
                >
                  <span className="text-[13px]">{c.favorecidoNome ?? "favorecido não informado"}</span>
                  <span className="mono text-mut">
                    ~ {formatarBRL(c.valorPrevistoCentavos)}
                  </span>
                </div>
              ))}
              <Dica>
                Continuam sujeitas ao bloqueio anual até você responder Foi
                pago / Não vai ser pago / Mudou a data.
              </Dica>
            </Card>
          ) : null}
          {estado.naoAlocado > 0 ? (
            <Dica>
              {formatarBRL(estado.naoAlocado)} não alocados não têm destino
              fiscal afirmado por esta tela — podem ser encargos do
              rotativo, podem ser parte de uma compra em aberto. Fica para
              revisão humana, sem chute do app.
            </Dica>
          ) : null}
        </Corpo>
        <Rodape>
          <BotaoLink href="/adicionar/compra-cartao" variante="primary">
            Registrar outra compra
          </BotaoLink>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

  const { fatura, compromissos } = estado;

  if (!desembolsoId) {
    // Achado do `cto-obra`: s7 aberta sem um desembolso recém-criado
    // precisaria de um seletor de "qual desembolso estou alocando" que o
    // mock não desenhou. Recorte de escopo desta rodada — a tela volta para
    // a fatura, onde os desembolsos aparecem listados.
    return (
      <>
        <AppBar titulo="Alocar o pagamento" />
        <Corpo>
          <Banner cor="amb" role="status">
            Abra esta tela a partir de &quot;Registrar pagamento
            parcial&quot; — ela precisa saber qual valor pago você está
            alocando.
          </Banner>
        </Corpo>
        <Rodape>
          <BotaoLink href={`/fatura/${fatura.id}`}>Voltar à fatura</BotaoLink>
        </Rodape>
      </>
    );
  }

  const desembolso = fatura.desembolsos.find(
    (d): d is FaturaDesembolso => d.id === desembolsoId,
  );

  if (nadaElegivelParaAlocacao(fatura, compromissos)) {
    return (
      <>
        <AppBar
          titulo="Alocar o pagamento"
          sub={desembolso ? `${formatarBRL(desembolso.valorCentavos)} pagos em ${formatarDataBR(desembolso.dataPagamento)}` : undefined}
        />
        <Corpo>
          <Banner cor="amb" role="status">
            Nada para alocar aqui — todas as compras desta fatura já têm
            pagamento vinculado. O valor fica registrado, sem compra
            associada.
          </Banner>
        </Corpo>
        <Rodape>
          <BotaoLink href={`/fatura/${fatura.id}`}>Voltar</BotaoLink>
        </Rodape>
      </>
    );
  }

  const abertas = compromissosAbertosDaFatura(fatura, compromissos);
  const teto = tetoDeAlocacaoCentavos(fatura, compromissos);
  const compromissosSelecionados = abertas.filter((c) => selecionados.has(c.id));
  const somaSelecionada = compromissosSelecionados.reduce(
    (s, c) => s + c.valorPrevistoCentavos,
    0,
  );
  const naoAlocado = saldoNaoAlocadoCentavos(fatura, compromissosSelecionados);

  function alternar(c: Compromisso) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(c.id)) {
        novo.delete(c.id);
        return novo;
      }
      if (somaSelecionada + c.valorPrevistoCentavos > teto) {
        setAvisoEstoura(true);
        return atual;
      }
      novo.add(c.id);
      return novo;
    });
  }

  async function confirmar() {
    if (estado.fase !== "pronto" || !desembolsoId) return;
    setErro(null);
    setEstado({ fase: "salvando", fatura, compromissos });
    try {
      await alocarPagamentoDeFatura(desembolsoId, Array.from(selecionados));
      setEstado({
        fase: "salvo",
        pagas: compromissosSelecionados,
        seguem: abertas.filter((c) => !selecionados.has(c.id)),
        naoAlocado,
      });
    } catch (e) {
      setEstado({ fase: "pronto", fatura, compromissos });
      setErro(mensagemDeErro(e));
    }
  }

  return (
    <>
      <AppBar
        titulo="Alocar o pagamento"
        sub={desembolso ? `${formatarBRL(desembolso.valorCentavos)} pagos em ${formatarDataBR(desembolso.dataPagamento)}` : undefined}
      />
      <Corpo>
        {erro ? (
          <Banner cor="red" role="alert">
            {erro}
          </Banner>
        ) : null}
        <Banner cor="amb" role="status">
          <strong>Escolha quais compras este valor cobriu.</strong> Só a
          compra inteira pode ser marcada — não dá para alocar metade de uma
          compra.
        </Banner>
        <Card>
          {abertas.map((c) => {
            const marcado = selecionados.has(c.id);
            const estouraria =
              !marcado && somaSelecionada + c.valorPrevistoCentavos > teto;
            return (
              <label
                key={c.id}
                className={`mt-2 flex min-h-[44px] items-start gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0 ${
                  estouraria ? "opacity-40" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={estouraria}
                  onChange={() => alternar(c)}
                  className="mt-1 h-5 w-5 flex-none"
                />
                <span className="flex-1 text-[12.5px]">
                  <span className="font-semibold">
                    {c.favorecidoNome ?? "favorecido não informado"}
                  </span>
                  <br />
                  <span className="text-mut">
                    compra {formatarDataBR(c.dataCompra ?? "")}
                  </span>
                </span>
                <span className="mono flex-none text-[13px] font-bold">
                  {formatarBRL(c.valorPrevistoCentavos)}
                </span>
              </label>
            );
          })}
        </Card>
        <Dica>
          Selecionado: {formatarBRL(somaSelecionada)} de {formatarBRL(teto)} pagos
        </Dica>
        {avisoEstoura ? (
          <Banner cor="red" role="alert">
            <strong>Passaria de {formatarBRL(teto)} pagos.</strong> Desmarque
            outra compra antes de marcar esta.
          </Banner>
        ) : null}
        {naoAlocado > 0 ? (
          <Dica>
            {formatarBRL(naoAlocado)} ainda não alocado — fica sem destino
            fiscal até você decidir.
          </Dica>
        ) : null}
      </Corpo>
      <Rodape>
        <Botao
          variante="primary"
          onClick={confirmar}
          disabled={estado.fase === "salvando"}
        >
          {estado.fase === "salvando" ? "Salvando…" : "Confirmar alocação"}
        </Botao>
        <BotaoLink href={`/fatura/${fatura.id}`}>Voltar — decidir depois</BotaoLink>
      </Rodape>
    </>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando rotulo="Carregando" />}>
      <AlocarPagamento />
    </Suspense>
  );
}
