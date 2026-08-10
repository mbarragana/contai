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
  carregarPagamento,
  mensagemDeErro,
  moverPagamentoDeObra,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { formatarBRL } from "@/lib/money";
import type { Pagamento } from "@/lib/types";

/**
 * Correção da obra de um pagamento já salvo (critério 13). Mesma tela 16 do
 * documento: o `obra_id` errado de um pagamento erra a discriminação de Bens e
 * Direitos da matrícula tanto quanto o de uma nota.
 */
export default function CorrigirObraDoPagamento() {
  const { id } = useParams<{ id: string }>();
  const [pagamento, setPagamento] = useState<Pagamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const carregado = await carregarPagamento(id);
        if (!cancelado) setPagamento(carregado);
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e));
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
    (obraDestinoId: string) => moverPagamentoDeObra(id, obraDestinoId),
    [id],
  );

  if (!pagamento) {
    return (
      <>
        <AppBar titulo="Corrigir obra" />
        <Corpo>
          {erro ? (
            <EstadoErro mensagem={erro} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o pagamento" />
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
      sub={`Pagamento · ${pagamento.favorecidoNome ?? "favorecido não informado"}`}
      descricao={[
        { rotulo: "Valor", valor: formatarBRL(pagamento.valorCentavos) },
        {
          rotulo: "Data do pagamento",
          valor: formatarDataBR(pagamento.dataPagamento),
        },
      ]}
      obraAtualId={pagamento.obraId}
      // Revalidação de CNO é regra de NF de serviço; pagamento não referencia CNO.
      tipo={null}
      cnoReferenciado={null}
      mover={mover}
      voltarHref="/"
    />
  );
}
