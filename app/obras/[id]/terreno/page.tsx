"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  AppBar,
  Banner,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarDesembolsosTerreno,
  carregarFinanciamento,
  carregarInformes,
  carregarObra,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  AGUARDANDO_INFORME,
  anosDoFinanciamento,
  APP_NAO_INVENTA_DATA,
  custoTerrenoAteOAno,
  DESEMBOLSO_SEM_DATA,
  ESTIMATIVA_NAO_E_APURACAO,
  INSUMO_PARA_REVISAO_CRC,
  NOME_DA_NATUREZA,
  NOME_DO_DESEMBOLSO,
  PREVISTO_NAO_E_PAGO,
  SALDO_DEVEDOR_INFORMATIVO,
} from "@/lib/fiscal/terreno";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import type {
  Financiamento,
  FinanciamentoInforme,
  Obra,
  TerrenoDesembolso,
} from "@/lib/types";

/**
 * Painel do terreno (mock CONTAI-010, tela s1). Cenário: **gestão, em casa,
 * sentado** — 375px é PISO, não alvo, e a densidade é deliberada. O Teste do
 * Canteiro não se aplica a esta tela (régua corrigida no CLAUDE.md em 18/08).
 *
 * Ele responde três perguntas de uma vez: como o terreno foi adquirido, o que
 * já tem lastro documental ano a ano, e o que falta completar.
 */

type Fase =
  | { nome: "carregando" }
  | { nome: "erro"; erro: ErroDeTela }
  | {
      nome: "pronto";
      obra: Obra;
      desembolsos: TerrenoDesembolso[];
      financiamento: Financiamento | null;
      informes: FinanciamentoInforme[];
    };

export default function PainelDoTerreno() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [fase, setFase] = useState<Fase>({ nome: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  const hoje = hojeIso();
  const anoCorrente = Number(hoje.slice(0, 4));

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const obra = await carregarObra(id);
        const [desembolsos, financiamento] = await Promise.all([
          carregarDesembolsosTerreno(id),
          carregarFinanciamento(id),
        ]);
        const informes = financiamento
          ? await carregarInformes(financiamento.id)
          : [];
        if (cancelado) return;
        setFase({ nome: "pronto", obra, desembolsos, financiamento, informes });
      } catch (erro) {
        if (!cancelado) setFase({ nome: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setFase({ nome: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  if (fase.nome !== "pronto") {
    return (
      <>
        <AppBar titulo="Terreno" />
        <Corpo>
          {fase.nome === "erro" ? (
            <EstadoErro erro={fase.erro} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o terreno" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/obras/${id}`}>Dados da obra</BotaoLink>
        </Rodape>
      </>
    );
  }

  const { obra, desembolsos, financiamento, informes } = fase;

  const semData = desembolsos.filter(
    (d) => d.estado === "pago" && d.dataPagamento === null,
  );
  const previstos = desembolsos.filter((d) => d.estado === "previsto");
  const datados = desembolsos.filter(
    (d) => d.estado === "pago" && d.dataPagamento !== null,
  );

  // A situação em 31/12 deste ano, pela parte do terreno. Insumo para revisão
  // profissional (critério 19) — nunca veredito.
  const acumulado = custoTerrenoAteOAno(desembolsos, informes, anoCorrente);

  const anos = financiamento
    ? anosDoFinanciamento(financiamento.dataContrato, informes, anoCorrente)
    : [];
  // O saldo devedor mais recente informado. Informativo, e só (critério 15).
  const ultimoInforme = informes.length > 0 ? informes[informes.length - 1] : null;

  return (
    <>
      <AppBar titulo="Terreno — custo por ano" sub={obra.nome} />
      <Corpo>
        <Card>
          <Linha rotulo="Como o terreno foi adquirido">
            {obra.naturezaAquisicaoTerreno ? (
              NOME_DA_NATUREZA[obra.naturezaAquisicaoTerreno]
            ) : (
              <span className="font-semibold text-amb">ainda não informado</span>
            )}
          </Linha>
          <Linha rotulo={`Já desembolsado até 31/12/${anoCorrente}`}>
            <span className="mono font-semibold">{formatarBRL(acumulado)}</span>
          </Linha>
          <Dica>
            = situação em 31/12/{anoCorrente} na ficha Bens e Direitos, pela
            parte do terreno.
          </Dica>
          <Consequencia cor="amb">{INSUMO_PARA_REVISAO_CRC}</Consequencia>
        </Card>

        {obra.naturezaAquisicaoTerreno === null ? (
          <Card className="border-amb">
            <Chip cor="amb">Falta dizer como o terreno foi adquirido</Chip>
            <Consequencia cor="amb">
              É essa resposta que decide qual regra roda: à vista é um desembolso
              datado; financiado tem entrada, informe anual e saldo devedor;
              recebido tem data de aquisição sem desembolso nenhum. Sem ela, o
              app teria de presumir — e presumir foi o defeito que este ticket
              conserta. <strong>Não bloqueia nada</strong>.
            </Consequencia>
            <div className="mt-2.5">
              <BotaoLink href={`/obras/${obra.id}`} variante="primary">
                Responder nos dados da obra
              </BotaoLink>
            </div>
          </Card>
        ) : null}

        {/* ── O contrato ───────────────────────────────────────────────── */}
        {financiamento ? (
          <Card>
            <Linha rotulo="Instituição credora">
              {financiamento.instituicao}
            </Linha>
            <Linha rotulo="Data do contrato">
              <span className="mono">
                {formatarDataBR(financiamento.dataContrato)}
              </span>
            </Linha>
            <Linha rotulo="Preço contratado">
              <span className="mono">
                {formatarBRL(financiamento.precoContratadoCentavos)}
              </span>
            </Linha>
            {financiamento.numeroParcelas ? (
              <Linha rotulo="Parcelas">{financiamento.numeroParcelas}</Linha>
            ) : null}
            {ultimoInforme ? (
              <Linha rotulo={`Saldo devedor em 31/12/${ultimoInforme.anoBase}`}>
                <span className="mono">
                  {formatarBRL(ultimoInforme.saldoDevedorCentavos)}
                </span>
              </Linha>
            ) : null}
            <Consequencia cor="amb">{SALDO_DEVEDOR_INFORMATIVO}</Consequencia>
          </Card>
        ) : obra.naturezaAquisicaoTerreno === "financiado" ? (
          <Card className="border-amb">
            <Chip cor="amb">Contrato do financiamento não cadastrado</Chip>
            <Dica>
              Sem o contrato não há onde registrar o informe anual, e o custo do
              financiamento fica inteiro fora do sistema.
            </Dica>
            <div className="mt-2.5">
              <BotaoLink
                href={`/obras/${obra.id}/terreno/financiamento`}
                variante="primary"
              >
                Cadastrar o contrato
              </BotaoLink>
            </div>
          </Card>
        ) : null}

        {/* ── Ano a ano ────────────────────────────────────────────────── */}
        {financiamento ? (
          <>
            <Passo>Ano a ano — o que já tem lastro documental</Passo>
            {anos.map((a) => (
              <Card
                key={a.ano}
                className={
                  a.situacao === "registrado"
                    ? "border-grn"
                    : a.situacao === "falta_lancar"
                      ? "border-amb"
                      : ""
                }
                data-ano={a.ano}
                data-situacao={a.situacao}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{a.ano}</span>
                  {a.situacao === "registrado" ? (
                    <Chip cor="grn">informe registrado</Chip>
                  ) : a.situacao === "falta_lancar" ? (
                    <Chip cor="amb">falta lançar</Chip>
                  ) : (
                    <Chip cor="amb" vazado>
                      aguardando informe
                    </Chip>
                  )}
                </div>

                {a.situacao === "registrado" ? (
                  <Linha rotulo={`Entrou no custo de ${a.ano}`}>
                    <span className="mono font-semibold text-grn">
                      {formatarBRL(a.custoCentavos)}
                    </span>
                  </Linha>
                ) : null}

                {a.situacao === "falta_lancar" ? (
                  <>
                    <Consequencia cor="amb">
                      Sem este lançamento, o custo de aquisição de {a.ano} não
                      existe no sistema. Custo pago e não discriminado na
                      declaração não existe na hora da venda. O extrato já foi
                      publicado pelo banco — é download, não pedido.
                    </Consequencia>
                    <div className="mt-2.5">
                      <BotaoLink
                        href={`/obras/${obra.id}/terreno/informe/${a.ano}`}
                        variante="primary"
                      >
                        Registrar informe de {a.ano}
                      </BotaoLink>
                    </div>
                  </>
                ) : null}

                {a.situacao === "aguardando_informe" ? (
                  <>
                    <Consequencia cor="amb">{AGUARDANDO_INFORME}</Consequencia>
                    {a.estimativaCentavos !== null ? (
                      <>
                        {/* ⚠️ Cinza, rotulada, e FORA de toda soma. */}
                        <Linha rotulo="Ordem de grandeza do que falta">
                          <span className="mono text-mut">
                            ≈ {formatarBRL(a.estimativaCentavos)}
                          </span>
                        </Linha>
                        <Dica>{ESTIMATIVA_NAO_E_APURACAO}</Dica>
                      </>
                    ) : null}
                  </>
                ) : null}
              </Card>
            ))}
          </>
        ) : null}

        {/* ── Desembolsos fora do banco ────────────────────────────────── */}
        <Passo>O que saiu do bolso fora do banco — cada um no seu ano</Passo>

        {desembolsos.length === 0 ? (
          <Card>
            <Dica>
              Nenhum desembolso do terreno registrado ainda. Pagamento do
              terreno, entrada, ITBI e escritura/registro entram aqui,{" "}
              <strong>cada um com a sua data</strong>.
            </Dica>
          </Card>
        ) : null}

        {datados.map((d) => (
          <Card key={d.id} data-desembolso={d.tipo}>
            <Linha rotulo={NOME_DO_DESEMBOLSO[d.tipo]}>
              <span className="mono font-semibold">
                {formatarBRL(d.valorCentavos)}
              </span>
            </Linha>
            <Linha rotulo="Pago em">
              <span className="mono">{formatarDataBR(d.dataPagamento!)}</span>
            </Linha>
            {d.origemRecurso ? (
              <Linha rotulo="Origem do recurso">
                {d.origemRecurso === "fgts" ? "FGTS" : "Recurso próprio"}
              </Linha>
            ) : null}
          </Card>
        ))}

        {semData.length > 0 ? (
          <Card className="border-amb" data-pendencia="terreno-sem-data">
            <Chip cor="amb">Falta a data</Chip>
            {semData.map((d) => (
              <Linha key={d.id} rotulo={NOME_DO_DESEMBOLSO[d.tipo]}>
                <span className="mono">{formatarBRL(d.valorCentavos)}</span>
              </Linha>
            ))}
            <Consequencia cor="amb">
              {DESEMBOLSO_SEM_DATA}. <strong>Não bloqueia o app</strong> — fica
              como pendência até você preencher.
            </Consequencia>
            <Dica>{APP_NAO_INVENTA_DATA}</Dica>
            <div className="mt-2.5">
              <BotaoLink
                href={`/obras/${obra.id}/terreno/desembolsos`}
                variante="primary"
              >
                Completar as datas
              </BotaoLink>
            </div>
          </Card>
        ) : null}

        {previstos.length > 0 ? (
          <Card>
            <Chip cor="amb" vazado>
              Previsto — ainda não pago
            </Chip>
            {previstos.map((d) => (
              <Linha key={d.id} rotulo={NOME_DO_DESEMBOLSO[d.tipo]}>
                <span className="mono text-mut">
                  {formatarBRL(d.valorCentavos)}
                </span>
              </Linha>
            ))}
            <Dica>{PREVISTO_NAO_E_PAGO}</Dica>
          </Card>
        ) : null}

        <Banner cor="amb" role="status">
          Estes não caem necessariamente no ano da compra:{" "}
          <strong>é a data de cada um que decide o ano dele</strong>. ITBI
          recolhido em fevereiro do ano seguinte é custo do ano seguinte, não do
          ano da escritura.
        </Banner>
      </Corpo>

      <Rodape>
        <BotaoLink
          href={`/obras/${obra.id}/terreno/desembolsos`}
          variante="primary"
        >
          Registrar desembolso do terreno
        </BotaoLink>
        {financiamento ? (
          <BotaoLink href={`/obras/${obra.id}/terreno/informe/${anoCorrente - 1}`}>
            Registrar informe anual
          </BotaoLink>
        ) : (
          <BotaoLink href={`/obras/${obra.id}/terreno/financiamento`}>
            Cadastrar contrato de financiamento
          </BotaoLink>
        )}
        <BotaoLink href={`/obras/${obra.id}`}>Dados da obra</BotaoLink>
      </Rodape>
    </>
  );
}
