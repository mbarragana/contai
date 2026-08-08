"use client";

import Link from "next/link";
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
} from "@/app/_components/ui";
import { carregarPainel, mensagemDeErro, type PainelDados } from "@/lib/data";
import { calcularResumo, type Pendencia, type ResumoObra } from "@/lib/fiscal/resumo";
import { formatarBRL } from "@/lib/money";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; dados: PainelDados; resumo: ResumoObra };

const ACAO_POR_TIPO: Partial<Record<Pendencia["tipo"], string>> = {
  quarentena: "Resolver",
  servico_sem_retencao: "Ver detalhes",
};

export default function Home() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const dados = await carregarPainel();
        const ano = new Date().getFullYear();
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          dados,
          resumo: calcularResumo({ ...dados, ano }),
        });
      } catch (erro) {
        if (cancelado) return;
        setEstado({ fase: "erro", mensagem: mensagemDeErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  const obra = estado.fase === "pronto" ? estado.dados.obra : null;
  const ano = estado.fase === "pronto" ? estado.resumo.ano : new Date().getFullYear();

  return (
    <>
      <AppBar
        titulo="contai"
        sub={
          obra
            ? `${obra.nome}${obra.cno ? ` · CNO ${obra.cno}` : ""} · ${ano}`
            : `Obra · ${ano}`
        }
      />

      <Corpo>
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando a obra" />
        ) : null}

        {estado.fase === "erro" ? (
          <EstadoErro mensagem={estado.mensagem} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {estado.fase === "pronto" ? (
          <>
            <Card>
              <Dica>Custo confirmado em {estado.resumo.ano}</Dica>
              <div className="mono text-[26px] font-bold tracking-tight">
                {formatarBRL(estado.resumo.custoConfirmadoAnoCentavos)}
              </div>
              <div className="mono mt-1 text-[14px] font-semibold">
                Acumulado do imóvel:{" "}
                {formatarBRL(estado.resumo.acumuladoImovelCentavos)}
              </div>
              <Dica>
                = situação em 31/12 na ficha Bens e Direitos (terreno + obra)
              </Dica>
              {estado.resumo.pendencias.length > 0 ? (
                <p className="mt-1.5 text-[12px] text-mut">
                  Em pendência:{" "}
                  <span className="mono font-semibold text-red">
                    {formatarBRL(estado.resumo.emPendenciaCentavos)}
                  </span>{" "}
                  — resolver abaixo
                </p>
              ) : null}
            </Card>

            {estado.resumo.pendencias.length === 0 ? (
              <Banner cor="grn" role="status">
                <strong>Nenhuma pendência.</strong> Todo documento e pagamento
                registrado está com a documentação em ordem.
              </Banner>
            ) : null}

            {estado.resumo.pendencias.map((p) => (
              <Card key={p.id}>
                <Chip cor={p.gravidade}>{p.chip}</Chip>
                <div className="mt-1.5 font-semibold">{p.titulo}</div>
                <Dica>
                  {p.detalhe} ·{" "}
                  <span className="mono">{formatarBRL(p.valorCentavos)}</span>
                </Dica>
                <Consequencia cor={p.gravidade}>{p.consequencia}</Consequencia>
                {p.href && ACAO_POR_TIPO[p.tipo] ? (
                  <div className="mt-2.5">
                    <BotaoLink href={p.href}>{ACAO_POR_TIPO[p.tipo]}</BotaoLink>
                  </div>
                ) : null}
              </Card>
            ))}
          </>
        ) : null}

        {/* Ação principal sempre ao alcance do polegar, rolando junto. */}
        <Link
          href="/adicionar"
          className="sticky bottom-0 mt-auto self-end rounded-full bg-ink px-5 py-[13px] text-[14.5px] font-semibold text-paper shadow-[0_6px_16px_rgba(0,0,0,.18)]"
        >
          + Adicionar
        </Link>
      </Corpo>
    </>
  );
}
