"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSessao } from "@/app/_components/sessao";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarPagamento,
  carregarPainel,
  classificarErro,
  criarVinculos,
  mensagemDeErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import {
  alocarCusto,
  documentosCandidatos,
  ehDocumentoHabil,
  preverConjunto,
  VINCULO_BOLETO_NAO_GERA_CUSTO,
  VINCULO_QUARENTENA_NAO_GERA_CUSTO,
  type Candidato,
} from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";
import type { Documento, Pagamento } from "@/lib/types";

const NOME_TIPO: Record<Documento["tipo"], string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      pagamento: Pagamento;
      painel: PainelDados;
      candidatos: Candidato<Documento>[];
      jaLigados: Documento[];
      faltaCobrirCentavos: number;
    };

/**
 * O seletor no sentido inverso (critério 3): a partir do PIX, escolher a nota.
 *
 * Mesmas duas regras do seletor do documento, e pelo mesmo motivo (parecer
 * §5.5): nada vem marcado, e não existe ação em lote. Aqui o documento em
 * quarentena e o boleto CONTINUAM na lista — vincular os dois é permitido
 * (critérios 8 e 9) e é o que evita contar a mesma despesa duas vezes —, e a
 * tela diz na hora que eles não geram custo confirmado.
 */
export default function LigarDocumentos() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const pagamento = await carregarPagamento(id);
        const painel = await carregarPainel(pagamento.obraId);
        if (cancelado) return;
        const alocacao = alocarCusto(painel);
        setEstado({
          fase: "pronto",
          pagamento,
          painel,
          candidatos: documentosCandidatos(pagamento, painel.documentos, alocacao),
          jaLigados: painel.documentos.filter((d) =>
            pagamento.documentoIds.includes(d.id),
          ),
          faltaCobrirCentavos:
            alocacao.porPagamento.get(pagamento.id)?.semNotaCentavos ??
            pagamento.valorCentavos,
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setErroSalvar(null);
    setTentativa((t) => t + 1);
  }, []);

  const alternar = useCallback((documentoId: string) => {
    setMarcados((atual) =>
      atual.includes(documentoId)
        ? atual.filter((x) => x !== documentoId)
        : [...atual, documentoId],
    );
  }, []);

  const pronto = estado.fase === "pronto" ? estado : null;
  const erroCarregar = estado.fase === "erro" ? estado.erro : null;

  const marcadosDeVerdade = useMemo(
    () => (pronto?.candidatos ?? []).filter((c) => marcados.includes(c.item.id)),
    [pronto, marcados],
  );

  const previsao = pronto
    ? preverConjunto(
        [pronto.pagamento],
        [...pronto.jaLigados, ...marcadosDeVerdade.map((c) => c.item)],
      )
    : null;

  // Critérios 8 e 9: o aviso é do TIPO que está marcado, não um texto só.
  const marcouQuarentena = marcadosDeVerdade.some(
    (c) => c.item.status === "quarentena",
  );
  const marcouBoleto = marcadosDeVerdade.some((c) => c.item.tipo === "boleto");

  async function ligar() {
    if (!pronto || marcadosDeVerdade.length === 0) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      await criarVinculos(
        marcadosDeVerdade.map((c) => ({
          pagamentoId: pronto.pagamento.id,
          documentoId: c.item.id,
          obraDoPagamentoId: pronto.pagamento.obraId,
          obraDoDocumentoId: c.item.obraId,
          documentoHabil: ehDocumentoHabil(c.item),
        })),
      );
      router.push(`/pagamento/${pronto.pagamento.id}`);
    } catch (erro) {
      setSalvando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErro(erro));
    }
  }

  if (!pronto) {
    return (
      <>
        <AppBar titulo="Ligar este pagamento a uma nota" />
        <Corpo>
          {erroCarregar ? (
            <>
              <Banner cor="red" role="alert">
                <strong>Não deu para carregar os documentos.</strong>{" "}
                <strong>Nada foi ligado</strong> — o pagamento continua como
                estava.
              </Banner>
              <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
            </>
          ) : (
            <>
              <Dica>Procurando notas desta obra…</Dica>
              <Carregando rotulo="Carregando os candidatos" />
            </>
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/pagamento/${id}`}>Voltar ao pagamento</BotaoLink>
        </Rodape>
      </>
    );
  }

  const p = pronto.pagamento;

  return (
    <>
      <AppBar
        titulo="Ligar este pagamento a uma nota"
        sub={`${formatarBRL(p.valorCentavos)} · ${p.favorecidoNome ?? "sem favorecido"} · ${pronto.painel.obra.nome}`}
      />
      <Corpo>
        {erroSalvar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para ligar.</strong> {erroSalvar}{" "}
            <strong>Nada foi ligado</strong> — o pagamento continua como estava.
          </Banner>
        ) : null}

        <Card className="sticky top-0 z-10 bg-soft">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11.5px] text-mut">
              Falta cobrir deste pagamento
            </span>
            <span className="mono text-[22px] font-bold tracking-tight">
              {formatarBRL(
                Math.max(
                  0,
                  p.valorCentavos - (previsao?.custoComprovadoCentavos ?? 0),
                ),
              )}
            </span>
          </div>
          <Dica>
            {marcadosDeVerdade.length === 0
              ? "Nada marcado ainda — o pagamento continua sem nota."
              : `Com o que está marcado, ${formatarBRL(previsao?.custoComprovadoCentavos ?? 0)} deste pagamento passam a ser custo comprovado.`}
          </Dica>
        </Card>

        {marcouQuarentena ? (
          <Banner cor="red" role="status">
            {VINCULO_QUARENTENA_NAO_GERA_CUSTO}
          </Banner>
        ) : null}
        {marcouBoleto ? (
          <Banner cor="red" role="status">
            {VINCULO_BOLETO_NAO_GERA_CUSTO}
          </Banner>
        ) : null}

        <Card>
          <div className="text-[12.5px]">
            <strong>Sugestão é ordenação, não vínculo.</strong> Nada vem
            marcado, e nenhum vínculo nasce sem você tocar. Só aparecem
            documentos da obra <strong>{pronto.painel.obra.nome}</strong>.
          </div>
        </Card>

        {pronto.candidatos.length === 0 ? (
          <Card>
            <div className="text-center text-[34px] leading-none">📄</div>
            <div className="mt-2 text-center font-semibold">
              Nenhum documento para ligar
            </div>
            <Dica>
              Não há, nesta obra, documento registrado que ainda precise deste
              pagamento. Se a nota já chegou, ela ainda não foi registrada.
            </Dica>
            <div className="mt-2.5">
              <BotaoLink href="/adicionar/documento">
                Registrar o documento agora
              </BotaoLink>
            </div>
          </Card>
        ) : (
          <>
            <Passo>Documentos desta obra</Passo>
            {pronto.candidatos.map((c) => {
              const marcado = marcados.includes(c.item.id);
              const habil = ehDocumentoHabil(c.item);
              return (
                <label
                  key={c.item.id}
                  className={`flex min-h-[44px] cursor-pointer gap-3 rounded-[10px] border px-3 py-2.5 ${
                    marcado ? "border-ink bg-soft" : "border-line bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(c.item.id)}
                    className="mt-1 h-5 w-5 flex-none"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-semibold break-words">
                        {c.item.favorecidoNome ?? "Emitente não informado"}
                      </span>
                      <span className="mono flex-none text-[15px] font-bold">
                        {formatarBRL(c.item.valorCentavos ?? 0)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-mut">
                      {NOME_TIPO[c.item.tipo]}
                      {habil ? "" : " · não gera custo confirmado"}
                    </span>
                    {c.sugestao ? (
                      <span className="mt-1 block text-[11.5px] font-semibold text-mut">
                        {c.sugestao}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </>
        )}
      </Corpo>

      <Rodape>
        <Dica>
          Custo confirmado se ligar agora:{" "}
          <span className="mono font-semibold">
            {formatarBRL(previsao?.custoComprovadoCentavos ?? 0)}
          </span>
        </Dica>
        <Botao
          variante="primary"
          onClick={ligar}
          disabled={marcadosDeVerdade.length === 0 || salvando}
        >
          {salvando
            ? "Ligando…"
            : marcadosDeVerdade.length === 0
              ? "Marque ao menos um documento"
              : `Ligar ${marcadosDeVerdade.length} ${marcadosDeVerdade.length === 1 ? "documento" : "documentos"}`}
        </Botao>
        <BotaoLink href={`/pagamento/${p.id}`}>Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
