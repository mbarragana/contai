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
  alocarSimulando,
  CANDIDATO_OCULTO_PAGAMENTO,
  custoComprovadoAteOAno,
  custoComprovadoDoAno,
  DOCUMENTO_SEM_VALOR,
  ehDocumentoHabil,
  pagamentosCandidatos,
  pagamentosOcultosPorCobertura,
  VINCULO_BOLETO_NAO_GERA_CUSTO,
  VINCULO_QUARENTENA_NAO_GERA_CUSTO,
  type Candidato,
} from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
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
      /** C4: quantos sumiram da lista por já estarem cobertos por inteiro. */
      ocultosPorCobertura: number;
      ano: number;
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

        setEstado({
          fase: "pronto",
          documento,
          painel,
          // Só pagamentos DESTA obra e ainda não cobertos por inteiro; a
          // filtragem e a ordenação são do módulo puro.
          candidatos: pagamentosCandidatos(documento, painel.pagamentos, alocacao),
          jaLigados: alocado?.pagamentos ?? [],
          ocultosPorCobertura: pagamentosOcultosPorCobertura(
            documento,
            painel.pagamentos,
            alocacao,
          ).length,
          ano: Number(hojeIso().slice(0, 4)),
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

  /**
   * O efeito no custo ANTES do toque (critério 15, Gate 0 estado 2).
   *
   * É a MESMA `alocarCusto` que produz o número da home, rodada DUAS VEZES
   * sobre o painel real — com e sem os vínculos marcados. A previsão isolada
   * que existia aqui simulava o documento e os pagamentos marcados fora do
   * grafo, com os valores integrais, e por isso anunciava custo MAIOR que o
   * real quando o candidato já estava parcialmente coberto por outro vínculo
   * (pagamento de R$ 3.000 já ligado a uma NF de R$ 1.000 anunciava R$ 3.000
   * de acréscimo, quando o real é R$ 2.000). Superestimar custo é a direção
   * perigosa do parecer §4.
   */
  const efeito = useMemo(() => {
    if (!pronto) return null;
    const antes = alocarCusto(pronto.painel);
    const depois = alocarSimulando(pronto.painel, {
      adicionar: marcadosDeVerdade.map((c) => ({
        pagamentoId: c.item.id,
        documentoId: pronto.documento.id,
      })),
    });

    const valor = pronto.documento.valorCentavos ?? 0;
    const habil = ehDocumentoHabil(pronto.documento);
    // Documento não hábil não tem "excedente" na alocação (contribui zero),
    // então o saldo dele é aritmética simples sobre os pagamentos ligados.
    const pagosDepois =
      pronto.jaLigados.reduce((t, x) => t + x.valorCentavos, 0) + somaMarcados;

    const acumuladoAntes = custoComprovadoAteOAno(antes, pronto.ano);
    const acumuladoDepois = custoComprovadoAteOAno(depois, pronto.ano);

    return {
      anoAntes: custoComprovadoDoAno(antes, pronto.ano),
      anoDepois: custoComprovadoDoAno(depois, pronto.ano),
      acumuladoAntes,
      acumuladoDepois,
      /**
       * O número do rodapé do mock ("custo confirmado se ligar agora"): o
       * ACRÉSCIMO real, e não o valor cheio do conjunto. Sai do acumulado
       * porque pagamento de ano anterior também confirma custo, só que em
       * outro ano — e data futura não existe (a validação do registro recusa).
       */
      acrescimo: acumuladoDepois - acumuladoAntes,
      faltaDepois: habil
        ? (depois.porDocumento.get(pronto.documento.id)?.excedenteNotaCentavos ??
          valor)
        : Math.max(0, valor - pagosDepois),
      // Quanto DESTES pagamentos continua sem nota depois de ligar — pela
      // alocação real, não pela subtração ingênua.
      excedenteMarcados: marcadosDeVerdade.reduce(
        (t, c) => t + (depois.porPagamento.get(c.item.id)?.semNotaCentavos ?? 0),
        0,
      ),
    };
  }, [pronto, marcadosDeVerdade, somaMarcados]);

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
              {formatarBRL(efeito?.faltaDepois ?? 0)}
            </span>
          </div>
          <Dica>
            {marcadosDeVerdade.length === 0
              ? "Nada marcado ainda — a nota continua sem cobertura."
              : efeito && efeito.faltaDepois === 0
                ? efeito.excedenteMarcados > 0
                  ? `Nota coberta por inteiro. Excedente ${formatarBRL(efeito.excedenteMarcados)} destes pagamentos continua como pago sem nota.`
                  : "Nota coberta por inteiro."
                : `Marcado ${formatarBRL(somaMarcados)} — ainda faltam ${formatarBRL(efeito?.faltaDepois ?? 0)} desta nota, que não viram custo enquanto não forem pagos.`}
          </Dica>
        </Card>

        {/* C5: nota hábil sem valor informado comprova ZERO, e em silêncio ela
            empurraria o pagamento inteiro para "pago sem nota". */}
        {habil && d.valorCentavos === null ? (
          <Banner cor="red" role="alert">
            {DOCUMENTO_SEM_VALOR}
          </Banner>
        ) : null}

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

        {pronto.ocultosPorCobertura > 0 ? (
          <Dica>{CANDIDATO_OCULTO_PAGAMENTO}</Dica>
        ) : null}

        <Dica>Não achou o pagamento? Ele pode ainda não estar registrado.</Dica>
        <BotaoLink href={`/adicionar/pagamento?documento=${d.id}`}>
          Registrar o pagamento agora
        </BotaoLink>
      </Corpo>

      <Rodape>
        {/* Critério 15: o efeito no custo dito ANTES do toque. O rótulo é o do
            mock aprovado (rodapé fixo do seletor, s2/s3c); o NÚMERO passou a
            ser o acréscimo REAL sobre o grafo inteiro — antes ele era o valor
            cheio do conjunto simulado, que superestimava o custo.
            O "antes → depois" completa o rótulo do mock em vez de substituí-lo,
            e vem nos DOIS números: ligar pagamento de ano anterior não mexe no
            ano corrente, mas mexe no acumulado da ficha Bens e Direitos. */}
        <Dica>
          Custo confirmado se ligar agora:{" "}
          <span className={`mono font-semibold ${habil ? "" : "text-red"}`}>
            {formatarBRL(efeito?.acrescimo ?? 0)}
          </span>
          {habil ? null : " — a nota não é hábil"}
          <br />
          {pronto.ano}:{" "}
          <span className="mono">
            {formatarBRL(efeito?.anoAntes ?? 0)} →{" "}
            {formatarBRL(efeito?.anoDepois ?? 0)}
          </span>
          {" · "}acumulado:{" "}
          <span className="mono">
            {formatarBRL(efeito?.acumuladoAntes ?? 0)} →{" "}
            {formatarBRL(efeito?.acumuladoDepois ?? 0)}
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
              ? "Marque ao menos um pagamento"
              : `Ligar ${marcadosDeVerdade.length} ${marcadosDeVerdade.length === 1 ? "pagamento" : "pagamentos"} — ${formatarBRL(somaMarcados)}`}
        </Botao>
        <BotaoLink href={`/documento/${d.id}`}>Cancelar</BotaoLink>
      </Rodape>
    </>
  );
}
