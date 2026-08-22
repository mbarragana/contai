"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { ListaDeAnexos } from "@/app/_components/anexo";
import {
  AppBar,
  Banner,
  BarraAdicionar,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
} from "@/app/_components/ui";
import { HistoricoDeCorrecoes } from "@/app/_components/corrigir";
import {
  carregarAnexosDoDocumento,
  carregarCorrecoesDoDocumento,
  carregarDocumento,
  carregarObras,
  carregarPainel,
  classificarErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { formatarDocumento } from "@/lib/fiscal/identificacao";
import { CONSEQUENCIA_SEM_RETENCAO } from "@/lib/fiscal/documento";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  alocarCusto,
  VINCULO_BOLETO_NAO_GERA_CUSTO,
  VINCULO_QUARENTENA_NAO_GERA_CUSTO,
  type DocumentoAlocado,
} from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type {
  Classificacao,
  Documento,
  Revisao,
  TipoDocumento,
} from "@/lib/types";

const NOME_TIPO: Record<TipoDocumento, string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

const NOME_CLASSIFICACAO: Record<Classificacao | "indefinida", string> = {
  material: "Material",
  mao_obra: "Mão de obra",
  indefinida: "—",
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      documento: Documento;
      painel: PainelDados;
      /** Critério 16 — o rastro é EXIBIDO já na rodada 1. */
      correcoes: Revisao[];
      /**
       * CONTAI-027, critério 2 — "a lista inteira". Os anexos ADICIONAIS da
       * `documento_anexo` (0009) andam junto com o `arquivo_path`: a carta de
       * correção que chegou depois é acervo deste documento, e antes deste
       * ticket ela não aparecia em tela nenhuma.
       */
      anexos: string[];
      /** Nome de cada obra: o rastro grava id, e id não se lê em 2034. */
      obras: Map<string, string>;
    };

/**
 * O bloco que este ticket acrescenta (mock s1, s6, s7, s8) — caminho B do
 * critério 2. Aparece em TODO ramo de render, inclusive quarentena e boleto:
 * vincular é permitido nos dois (critérios 8 e 9), e é o vínculo que permite a
 * dedup da despesa. O que muda entre eles é o que a tela diz sobre o custo.
 */
function PagamentosDesteDocumento({
  documento,
  alocado,
  ano,
  ligado,
}: {
  documento: Documento;
  alocado: DocumentoAlocado | undefined;
  ano: number;
  ligado: boolean;
}) {
  const pagamentos = alocado?.pagamentos ?? [];
  const habil = alocado?.habil ?? true;
  const valor = documento.valorCentavos ?? 0;

  const acoes = (
    <>
      <div className="mt-2.5">
        <BotaoLink href={`/documento/${documento.id}/ligar`} variante="primary">
          Ligar a um pagamento
        </BotaoLink>
      </div>
      <div className="mt-2">
        <BotaoLink href={`/adicionar/pagamento?documento=${documento.id}`}>
          Registrar o pagamento desta nota
        </BotaoLink>
      </div>
    </>
  );

  if (pagamentos.length === 0) {
    return (
      <Card className="border-amb">
        <Chip cor="amb">Sem pagamento ligado</Chip>
        <div className="mt-1.5 font-semibold">Pagamentos desta nota</div>
        <Dica>Nenhum pagamento ligado a este documento.</Dica>
        {habil ? (
          <Consequencia cor="amb">
            O custo <strong>existe</strong> — o app é que ainda não consegue
            demonstrar. Sem um pagamento ligado, estes {formatarBRL(valor)} não
            entram no <strong>Custo confirmado de {ano}</strong>.
          </Consequencia>
        ) : (
          <Consequencia cor="red">
            {documento.tipo === "boleto"
              ? VINCULO_BOLETO_NAO_GERA_CUSTO
              : VINCULO_QUARENTENA_NAO_GERA_CUSTO}
          </Consequencia>
        )}
        {acoes}
      </Card>
    );
  }

  // Excedente do lado do pagamento: o que foi pago além do que esta nota
  // documenta continua como "pago sem nota" (parecer §3).
  const excedentePagamento = pagamentos.length > 0 ? valorSemNota(alocado) : 0;

  return (
    <>
      {ligado ? (
        <Banner cor="grn" role="status">
          <strong>Ligado.</strong> A nota e o pagamento agora são{" "}
          <strong>uma despesa só</strong>.
        </Banner>
      ) : null}

      <Card className={habil ? "border-grn" : "border-red"}>
        <Chip cor={habil ? "grn" : "red"}>
          {habil ? "Custo comprovado" : "Não gera custo confirmado"}
        </Chip>
        <div className="mono mt-1.5 text-[26px] font-bold tracking-tight">
          {formatarBRL(alocado?.cobertoCentavos ?? 0)}
        </div>
        {habil ? (
          <Dica>
            entra no custo de aquisição pela <strong>data do pagamento</strong>{" "}
            — regime de caixa
          </Dica>
        ) : (
          <Consequencia cor="red">
            {documento.tipo === "boleto"
              ? VINCULO_BOLETO_NAO_GERA_CUSTO
              : VINCULO_QUARENTENA_NAO_GERA_CUSTO}
          </Consequencia>
        )}
        {alocado && alocado.excedenteNotaCentavos > 0 ? (
          <>
            <Linha rotulo="Excedente da nota">
              <span className="mono font-semibold text-amb">
                {formatarBRL(alocado.excedenteNotaCentavos)} — nota ainda não
                paga
              </span>
            </Linha>
            <Consequencia cor="amb">
              Este pedaço da nota <strong>não vira custo</strong>: regime de
              caixa — sem desembolso não há dispêndio. Ele passa a contar
              quando o pagamento existir e for ligado aqui.
            </Consequencia>
          </>
        ) : null}
        {excedentePagamento > 0 ? (
          <>
            <Linha rotulo="Excedente do pagamento">
              <span className="mono font-semibold text-amb">
                {formatarBRL(excedentePagamento)} — pago sem nota
              </span>
            </Linha>
            <Consequencia cor="amb">
              Você pagou além do que esta nota documenta. Esse valor continua
              como <strong>pago sem nota</strong> até chegar uma nota que o
              cubra.
            </Consequencia>
          </>
        ) : null}
      </Card>

      <Card>
        <div className="font-semibold">Pagamentos desta nota</div>
        {pagamentos.map((p) => (
          <div key={p.id} className="mt-2 border-t border-line pt-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px]">
                {formatarDataBR(p.dataPagamento)} ·{" "}
                {p.favorecidoNome ?? "favorecido não informado"}
              </span>
              <span className="mono flex-none text-[13.5px]">
                {formatarBRL(p.valorCentavos)}
              </span>
            </div>
            <div className="mt-2">
              <BotaoLink
                href={`/documento/${documento.id}/desligar?pagamento=${p.id}`}
              >
                Desligar este pagamento
              </BotaoLink>
            </div>
          </div>
        ))}
        {acoes}
      </Card>
    </>
  );
}

/** Soma do que os pagamentos DESTA nota têm de excedente sobre ela. */
function valorSemNota(alocado: DocumentoAlocado | undefined): number {
  if (!alocado) return 0;
  const pagos = alocado.pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
  const documentado = alocado.habil ? (alocado.documento.valorCentavos ?? 0) : 0;
  return Math.max(0, pagos - documentado);
}

function DetalheDocumento() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  // `useSearchParams`, e NÃO `window.location` lido no primeiro render: em
  // navegação do lado do cliente (`router.push` do seletor) o `location` ainda
  // não tinha a query no render de montagem, e a confirmação simplesmente não
  // aparecia. É o que a fronteira de Suspense abaixo paga.
  const ligado = useSearchParams().get("ligado") === "1";

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const documento = await carregarDocumento(id);
        // O painel da obra inteira: é dele que saem os pagamentos ligados e o
        // cálculo do custo comprovado deste conjunto.
        const painel = await carregarPainel(documento.obraId);
        const [correcoes, obras, anexos] = await Promise.all([
          carregarCorrecoesDoDocumento(documento.id, documento.favorecidoId),
          carregarObras(),
          carregarAnexosDoDocumento(documento.id),
        ]);
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          documento,
          painel,
          correcoes,
          obras: new Map(obras.map((o) => [o.id, o.nome])),
          anexos,
        });
      } catch (erro) {
        if (!cancelado) {
          setEstado({ fase: "erro", erro: classificarErro(erro) });
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  if (estado.fase !== "pronto") {
    return (
      <>
        <AppBar titulo="Documento" />
        <Corpo>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando o documento" />
          ) : (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          )}
        </Corpo>
        <BarraAdicionar
          voltar={<BotaoLink href="/">Voltar ao início</BotaoLink>}
        />
      </>
    );
  }

  const d = estado.documento;
  const obra = estado.painel.obra;
  const alocacao = alocarCusto(estado.painel);
  const alocado = alocacao.porDocumento.get(d.id);
  const ano = Number(hojeIso().slice(0, 4));
  const sub = `${NOME_TIPO[d.tipo]}${d.favorecidoNome ? ` · ${d.favorecidoNome}` : ""}`;
  const valor = d.valorCentavos === null ? "—" : formatarBRL(d.valorCentavos);

  const blocoPagamentos = (
    <PagamentosDesteDocumento
      documento={d}
      alocado={alocado}
      ano={ano}
      ligado={ligado}
    />
  );

  /**
   * ⚠️ CONTAI-027, critério 2 — este detalhe não mostrava NEM o nome do
   * arquivo. Agora mostra a lista inteira: o original e os anexos que vieram
   * depois, cada um com Abrir.
   *
   * O original vem primeiro e sempre: `arquivo_path` é a nota que originou o
   * registro. Os adicionais vêm na ordem em que chegaram — é a ordem em que
   * quem abrir o dossiê em 2034 vai querer lê-los.
   */
  const blocoAnexos = (
    <Card>
      <ListaDeAnexos
        titulo="Papéis deste documento"
        itens={[d.arquivoPath, ...estado.anexos].map((path) => ({ path }))}
      />
    </Card>
  );

  /**
   * A obra deste registro, sempre visível e sempre corrigível: o erro de obra é
   * silencioso, descoberto tarde, e sem conserto pela interface voltaria a
   * exigir SQL (dor D9).
   */
  const blocoObra = (
    <Card>
      <Linha rotulo="Obra">{obra.nome}</Linha>
      <div className="mt-2">
        <BotaoLink href={`/documento/${d.id}/obra`}>
          Corrigir a obra deste registro
        </BotaoLink>
      </div>
    </Card>
  );

  /**
   * CONTAI-021 — as entradas das TRÊS AÇÕES NOMEADAS, e as duas saídas sem
   * campo. Não é um "editar documento" com N campos: os campos têm regimes de
   * consequência diferentes, e o campo proibido sentado ao lado dos editáveis
   * é o convite a inventar dado no campo que sobrou (decisão do `cto-obra`).
   */
  const blocoCorrigir = (
    <Card>
      <div className="font-semibold">Corrigir este registro</div>
      <Dica>
        Cada correção é uma ação separada, porque cada uma muda uma coisa
        diferente na sua declaração. Todas ficam registradas.
      </Dica>
      <div className="mt-2 flex flex-col gap-2">
        <BotaoLink href={`/documento/${d.id}/corrigir/valor`}>
          Corrigir o valor — hoje: {valor}
        </BotaoLink>
        <BotaoLink href={`/documento/${d.id}/corrigir/classificacao`}>
          Corrigir a classificação — hoje:{" "}
          {NOME_CLASSIFICACAO[d.classificacao ?? "indefinida"].toLowerCase()}
        </BotaoLink>
        <BotaoLink href={`/documento/${d.id}/corrigir/emitente`}>
          Corrigir o nome do emitente — vale para todos os registros dele
        </BotaoLink>
        <BotaoLink href={`/documento/${d.id}/cnpj-errado`}>
          O CNPJ/CPF do emitente está errado — e agora?
        </BotaoLink>
        <BotaoLink href={`/documento/${d.id}/outro-dado`}>
          Está errado outro dado, que não está nesta lista
        </BotaoLink>
      </div>
    </Card>
  );

  const blocoHistorico = (
    <HistoricoDeCorrecoes
      correcoes={estado.correcoes}
      obras={estado.obras}
      cnpj={
        d.favorecidoDocumento ? formatarDocumento(d.favorecidoDocumento) : null
      }
    />
  );

  // Tela 6 do mock — documento fora do CPF do dono.
  if (d.status === "quarentena") {
    return (
      <>
        <AppBar titulo="Quarentena" sub={sub} />
        <Corpo>
          <Banner cor="red" role="alert">
            <strong>Este documento não está no seu CPF.</strong>{" "}
            {d.motivoQuarentena}
          </Banner>
          <Card>
            <Linha rotulo="Valor do documento">
              <span className="mono">{valor}</span>
            </Linha>
            <Linha rotulo="Se não corrigir">
              <span className="font-semibold text-red">
                fora do custo de aquisição
              </span>
            </Linha>
          </Card>
          <Dica>
            Peça ao fornecedor a nota corrigida com você como destinatário — é a
            saída que preserva o custo. Enquanto isso o documento fica no
            acervo, mas fora do IR.
          </Dica>
          {blocoAnexos}
          {/* Critério 8: vincular quarentena é permitido — é o que evita
              contar a mesma despesa duas vezes — e não gera custo. */}
          {blocoPagamentos}
          {blocoObra}
          {blocoCorrigir}
          {blocoHistorico}
        </Corpo>
        <BarraAdicionar
          voltar={
            <BotaoLink href="/" variante="primary">
              Voltar ao início
            </BotaoLink>
          }
        />
      </>
    );
  }

  // Tela 7 do mock — NF de serviço sem retenção confirmada.
  if (d.tipo === "nf_servico" && d.retencao11 !== true) {
    return (
      <>
        <AppBar titulo="NF de serviço sem retenção" sub={sub} />
        <Corpo>
          <Card>
            <Linha rotulo="Valor">
              <span className="mono">{valor}</span>
            </Linha>
            <Linha rotulo="Retenção 11% INSS">
              <span className="font-semibold text-amb">
                {d.retencao11 === false ? "não" : "não identificada"}
              </span>
            </Linha>
            <Linha rotulo="Vale para o IR">
              <span className="font-semibold text-grn">sim ✓</span>
            </Linha>
            <Linha rotulo="Abate no INSS (SERO)">
              <span className="font-semibold text-red">não</span>
            </Linha>
          </Card>
          <Banner cor="amb" role="status">
            {CONSEQUENCIA_SEM_RETENCAO} Sem retenção, esse INSS fica para{" "}
            <strong>você</strong> pagar na regularização da obra. Confira com o
            empreiteiro se a retenção sairá nas próximas notas.
          </Banner>
          {blocoAnexos}
          {blocoPagamentos}
          {blocoObra}
          {blocoCorrigir}
          {blocoHistorico}
        </Corpo>
        <BarraAdicionar
          voltar={
            <BotaoLink href="/" variante="primary">
              Entendi — manter registro
            </BotaoLink>
          }
        />
      </>
    );
  }

  return (
    <>
      <AppBar titulo={NOME_TIPO[d.tipo]} sub={d.favorecidoNome ?? undefined} />
      <Corpo>
        <Card>
          <Linha rotulo="Valor">
            <span className="mono">{valor}</span>
          </Linha>
          {d.vencimento ? (
            <Linha rotulo="Vencimento">
              <span className="mono">{d.vencimento}</span>
            </Linha>
          ) : null}
          <Linha rotulo="Destinatário">
            <span className="font-semibold text-grn">Seu CPF ✓</span>
          </Linha>
          <Linha rotulo="Classificação">
            {/* Sem classificação gravada não se inventa uma: "—" é honesto. */}
            {NOME_CLASSIFICACAO[d.classificacao ?? "indefinida"]}
          </Linha>
        </Card>
        {d.status === "aguardando_pagamento" ? (
          <Banner cor="amb" role="status">
            Boleto não é documento hábil sozinho. O custo só se sustenta com a
            NF e a prova de pagamento.
          </Banner>
        ) : null}
        {blocoAnexos}
        {blocoPagamentos}
        {blocoObra}
        {blocoCorrigir}
        {blocoHistorico}
      </Corpo>
      <BarraAdicionar
        voltar={
          <BotaoLink href="/" variante="primary">
            Voltar ao início
          </BotaoLink>
        }
      />
    </>
  );
}

/**
 * A fronteira que `useSearchParams` exige (Next 16): sem ela o build reclama
 * de "URL data in a Client Component outside of Suspense".
 */
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando rotulo="Carregando o documento" />}>
      <DetalheDocumento />
    </Suspense>
  );
}
