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
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarDocumento,
  carregarPainel,
  classificarErro,
  criarVinculos,
  mensagemDeErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  alocarCusto,
  ehDocumentoHabil,
  pagamentosCandidatos,
  preverVinculo,
  VINCULO_BOLETO_NAO_GERA_CUSTO,
  VINCULO_QUARENTENA_NAO_GERA_CUSTO,
  type Candidato,
} from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";
import type { Documento, Pagamento } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      documento: Documento;
      painel: PainelDados;
      candidatos: Candidato<Pagamento>[];
      /** Pagamentos já ligados: entram na conta do saldo, não na lista. */
      jaLigados: Pagamento[];
      faltaInicialCentavos: number;
    };

/**
 * O seletor de pagamentos candidatos (mock s2, s3, s3c, s3d, s3e) — a peça
 * mais difícil do produto até aqui, e a que o Gate 0 protegeu.
 *
 * Duas regras que a tela não pode quebrar, as duas do parecer §5.5:
 * - **nada vem marcado**, e nenhum vínculo nasce sem toque explícito;
 * - **não existe "ligar todos"**: cada candidato é conferido item a item.
 * "Sugestão" aqui é ORDENAÇÃO E RÓTULO. Vínculo inferido errado inflaciona
 * custo em silêncio e ainda mata o alerta — os dois erros de uma vez.
 */
export default function LigarPagamentos() {
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
        const documento = await carregarDocumento(id);
        const painel = await carregarPainel(documento.obraId);
        if (cancelado) return;

        const alocacao = alocarCusto(painel);
        const alocado = alocacao.porDocumento.get(documento.id);
        const jaLigados = alocado?.pagamentos ?? [];
        const habil = ehDocumentoHabil(documento);
        const pagos = jaLigados.reduce((s, p) => s + p.valorCentavos, 0);

        setEstado({
          fase: "pronto",
          documento,
          painel,
          // Só pagamentos DESTA obra e ainda não cobertos por inteiro; a
          // filtragem e a ordenação são do módulo puro.
          candidatos: pagamentosCandidatos(documento, painel.pagamentos, alocacao),
          jaLigados,
          faltaInicialCentavos: habil
            ? (alocado?.excedenteNotaCentavos ?? documento.valorCentavos ?? 0)
            : Math.max(0, (documento.valorCentavos ?? 0) - pagos),
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

  const alternar = useCallback((pagamentoId: string) => {
    setMarcados((atual) =>
      atual.includes(pagamentoId)
        ? atual.filter((x) => x !== pagamentoId)
        : [...atual, pagamentoId],
    );
  }, []);

  const pronto = estado.fase === "pronto" ? estado : null;
  const erroCarregar = estado.fase === "erro" ? estado.erro : null;

  const marcadosDeVerdade = useMemo(
    () => (pronto?.candidatos ?? []).filter((c) => marcados.includes(c.item.id)),
    [pronto, marcados],
  );

  const somaMarcados = marcadosDeVerdade.reduce(
    (s, c) => s + c.item.valorCentavos,
    0,
  );

  // O efeito no custo ANTES do toque (Gate 0, estado 2): o que a nota passará
  // a comprovar se estes pagamentos forem ligados agora.
  const previsao = pronto
    ? preverVinculo(pronto.documento, [
        ...pronto.jaLigados,
        ...marcadosDeVerdade.map((c) => c.item),
      ])
    : null;

  const restante = pronto
    ? Math.max(0, pronto.faltaInicialCentavos - somaMarcados)
    : 0;
  const excedente = pronto
    ? Math.max(0, somaMarcados - pronto.faltaInicialCentavos)
    : 0;

  async function ligar() {
    if (!pronto || marcadosDeVerdade.length === 0) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      // UMA chamada, um `insert` com array: ou entram todas as linhas, ou
      // nenhuma. É o que sustenta a frase do estado de erro.
      await criarVinculos(
        marcadosDeVerdade.map((c) => ({
          pagamentoId: c.item.id,
          documentoId: pronto.documento.id,
          obraDoPagamentoId: c.item.obraId,
          obraDoDocumentoId: pronto.documento.obraId,
          documentoHabil: ehDocumentoHabil(pronto.documento),
        })),
      );
      router.push(`/documento/${pronto.documento.id}?ligado=1`);
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
        <AppBar titulo="Ligar pagamentos a esta nota" />
        <Corpo>
          {erroCarregar ? (
            <>
              {/* Mock s3e: o erro diz que NADA foi ligado. */}
              <Banner cor="red" role="alert">
                <strong>Não deu para carregar os pagamentos.</strong>{" "}
                <strong>Nada foi ligado</strong> — a nota continua como estava.
              </Banner>
              <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
            </>
          ) : (
            <>
              <Dica>Procurando pagamentos sem nota nesta obra…</Dica>
              <Carregando rotulo="Carregando os candidatos" />
            </>
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/documento/${id}`}>Voltar ao documento</BotaoLink>
        </Rodape>
      </>
    );
  }

  const d = pronto.documento;
  const habil = ehDocumentoHabil(d);

  return (
    <>
      <AppBar
        titulo="Ligar pagamentos a esta nota"
        sub={`${formatarBRL(d.valorCentavos ?? 0)} · ${d.favorecidoNome ?? "sem favorecido"} · ${pronto.painel.obra.nome}`}
      />
      <Corpo>
        {erroSalvar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para ligar.</strong> {erroSalvar}{" "}
            <strong>Nada foi ligado</strong> — a nota continua como estava.
          </Banner>
        ) : null}

        {/* Saldo restante da nota, atualizando a cada marcação. */}
        <Card className="sticky top-0 z-10 bg-soft">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11.5px] text-mut">
              Falta ligar desta nota
            </span>
            <span className="mono text-[22px] font-bold tracking-tight">
              {formatarBRL(restante)}
            </span>
          </div>
          <Dica>
            {marcadosDeVerdade.length === 0
              ? "Nada marcado ainda — a nota continua sem cobertura."
              : excedente > 0
                ? `Nota coberta. Excedente do pagamento: ${formatarBRL(excedente)} — continua como pago sem nota.`
                : restante === 0
                  ? "Nota coberta por inteiro."
                  : `Marcado ${formatarBRL(somaMarcados)} de ${formatarBRL(pronto.faltaInicialCentavos)} — o restante da nota não vira custo enquanto não for pago.`}
          </Dica>
        </Card>

        {habil ? null : (
          <Banner cor="red" role="status">
            {d.tipo === "boleto"
              ? VINCULO_BOLETO_NAO_GERA_CUSTO
              : VINCULO_QUARENTENA_NAO_GERA_CUSTO}
          </Banner>
        )}

        <Card>
          <div className="text-[12.5px]">
            <strong>Sugestão é ordenação, não vínculo.</strong> Nada vem
            marcado, e nenhum vínculo nasce sem você tocar. Só aparecem
            pagamentos da obra <strong>{pronto.painel.obra.nome}</strong>.
          </div>
        </Card>

        {pronto.candidatos.length === 0 ? (
          <>
            <Card>
              <div className="text-center text-[34px] leading-none">💸</div>
              <div className="mt-2 text-center font-semibold">
                Nenhum pagamento para ligar
              </div>
              <Dica>
                Não há, nesta obra, pagamento registrado sem nota. Se você já
                pagou esta nota, o pagamento ainda não foi registrado.
              </Dica>
            </Card>
            {habil ? (
              <Consequencia cor="amb">
                Enquanto não houver pagamento ligado, os{" "}
                {formatarBRL(d.valorCentavos ?? 0)} desta nota ficam fora do{" "}
                <strong>Custo confirmado</strong> — é gasto real que o app não
                consegue demonstrar.
              </Consequencia>
            ) : null}
          </>
        ) : (
          <>
            <Passo>Pagamentos desta obra</Passo>
            {pronto.candidatos.map((c) => {
              const marcado = marcados.includes(c.item.id);
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
                        {c.item.favorecidoNome ?? "Favorecido não informado"}
                      </span>
                      <span className="mono flex-none text-[15px] font-bold">
                        {formatarBRL(c.item.valorCentavos)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-mut">
                      {c.item.meio.toUpperCase()} · pago em{" "}
                      {formatarDataBR(c.item.dataPagamento)}
                      {c.item.comprovantePath ? " · comprovante ✓" : ""}
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

        <Dica>Não achou o pagamento? Ele pode ainda não estar registrado.</Dica>
        <BotaoLink href={`/adicionar/pagamento?documento=${d.id}`}>
          Registrar o pagamento agora
        </BotaoLink>
      </Corpo>

      <Rodape>
        <Dica>
          Custo confirmado se ligar agora:{" "}
          <span className="mono font-semibold">
            {formatarBRL(previsao?.custoComprovadoCentavos ?? 0)}
          </span>
          {previsao && previsao.excedentePagamentoCentavos > 0 ? (
            <>
              {" "}
              · excedente{" "}
              <span className="mono">
                {formatarBRL(previsao.excedentePagamentoCentavos)}
              </span>{" "}
              como pago sem nota
            </>
          ) : null}
        </Dica>
        <Botao
          variante="primary"
          onClick={ligar}
          disabled={marcadosDeVerdade.length === 0 || salvando}
        >
          {salvando
            ? "Ligando…"
            : marcadosDeVerdade.length === 0
              ? "Marque ao menos um pagamento"
              : `Ligar ${marcadosDeVerdade.length} ${marcadosDeVerdade.length === 1 ? "pagamento" : "pagamentos"} — ${formatarBRL(somaMarcados)}`}
        </Botao>
        <BotaoLink href={`/documento/${d.id}`}>Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
