"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CorrigirObra } from "@/app/_components/corrigir-obra";
import {
  AppBar,
  BotaoLink,
  Carregando,
  Corpo,
  EstadoErro,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarDocumento,
  classificarErro,
  type ErroDeTela,
  moverDocumentoDeObra,
} from "@/lib/data";
import { formatarBRL } from "@/lib/money";
import type { Documento } from "@/lib/types";

const NOME_TIPO = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
} as const;

/** Correção da obra de um documento já salvo (mock CONTAI-003, tela 16). */
export default function CorrigirObraDoDocumento() {
  const { id } = useParams<{ id: string }>();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [erro, setErro] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const carregado = await carregarDocumento(id);
        if (!cancelado) setDocumento(carregado);
      } catch (e) {
        if (!cancelado) setErro(classificarErro(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setErro(null);
    setTentativa((t) => t + 1);
  }, []);

  const mover = useCallback(
    (obraDestinoId: string) => moverDocumentoDeObra(id, obraDestinoId),
    [id],
  );

  if (!documento) {
    return (
      <>
        <AppBar titulo="Corrigir obra" />
        <Corpo>
          {erro ? (
            <EstadoErro erro={erro} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o documento" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

  return (
    <CorrigirObra
      titulo="Corrigir obra"
      sub={`${NOME_TIPO[documento.tipo]}${
        documento.favorecidoNome ? ` · ${documento.favorecidoNome}` : ""
      }`}
      descricao={[
        { rotulo: "Documento", valor: NOME_TIPO[documento.tipo] },
        {
          rotulo: "Valor",
          valor:
            documento.valorCentavos === null
              ? "—"
              : formatarBRL(documento.valorCentavos),
        },
      ]}
      obraAtualId={documento.obraId}
      tipo={documento.tipo}
      // O CNO impresso na nota ainda não é capturado pelo produto: o campo
      // nasce no CONTAI-007 (critério 2). Até lá a revalidação avisa em vez de
      // barrar — barrar por desconhecimento fecharia a única saída do erro.
      cnoReferenciado={null}
      mover={mover}
      voltarHref={`/documento/${documento.id}`}
    />
  );
}
