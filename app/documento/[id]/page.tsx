"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
import {
  carregarDocumento,
  carregarPainel,
  classificarErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
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
import type { Classificacao, Documento, TipoDocumento } from "@/lib/types";

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
  | { fase: "pronto"; documento: Documento; painel: PainelDados };

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

export default function DetalheDocumento() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  // Mesma leitura de `app/entrar/page.tsx`: o app é todo client-side e
  // `useSearchParams` obrigaria uma fronteira de Suspense só para ler um
  // parâmetro de confirmação.
  const [ligado] = useState(() =>
    typeof window === "undefined"
      ? false
      : new URLSearchParams(window.location.search).get("ligado") === "1",
  );

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const documento = await carregarDocumento(id);
        // O painel da obra inteira: é dele que saem os pagamentos ligados e o
        // cálculo do custo comprovado deste conjunto.
        const painel = await carregarPainel(documento.obraId);
        if (cancelado) return;
        setEstado({ fase: "pronto", documento, painel });
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
          {/* Critério 8: vincular quarentena é permitido — é o que evita
              contar a mesma despesa duas vezes — e não gera custo. */}
          {blocoPagamentos}
          {blocoObra}
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
          {blocoPagamentos}
          {blocoObra}
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
        {blocoPagamentos}
        {blocoObra}
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
