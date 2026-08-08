"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  AppBar,
  Banner,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Rodape,
} from "@/app/_components/ui";
import { carregarDocumento, mensagemDeErro } from "@/lib/data";
import { CONSEQUENCIA_SEM_RETENCAO } from "@/lib/fiscal/documento";
import { formatarBRL } from "@/lib/money";
import type { Documento, TipoDocumento } from "@/lib/types";

const NOME_TIPO: Record<TipoDocumento, string> = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; documento: Documento };

export default function DetalheDocumento() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const documento = await carregarDocumento(id);
        if (!cancelado) setEstado({ fase: "pronto", documento });
      } catch (erro) {
        if (!cancelado) {
          setEstado({ fase: "erro", mensagem: mensagemDeErro(erro) });
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
            <EstadoErro mensagem={estado.mensagem} onTentarDeNovo={tentarDeNovo} />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

  const d = estado.documento;
  const sub = `${NOME_TIPO[d.tipo]}${d.favorecidoNome ? ` · ${d.favorecidoNome}` : ""}`;
  const valor = d.valorCentavos === null ? "—" : formatarBRL(d.valorCentavos);

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
        </Corpo>
        <Rodape>
          <BotaoLink href="/" variante="primary">
            Voltar ao início
          </BotaoLink>
        </Rodape>
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
        </Corpo>
        <Rodape>
          <BotaoLink href="/" variante="primary">
            Entendi — manter registro
          </BotaoLink>
        </Rodape>
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
            {d.classificacao === "material" ? "Material" : "Mão de obra"}
          </Linha>
        </Card>
        {d.status === "aguardando_pagamento" ? (
          <Banner cor="amb" role="status">
            Boleto não é documento hábil sozinho. O custo só se sustenta com a
            NF e a prova de pagamento.
          </Banner>
        ) : null}
      </Corpo>
      <Rodape>
        <BotaoLink href="/" variante="primary">
          Voltar ao início
        </BotaoLink>
      </Rodape>
    </>
  );
}
