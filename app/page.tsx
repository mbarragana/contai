"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  AfirmacaoObra,
  AvisoEquiparacao,
  PendenciaCno,
} from "@/app/_components/obra";
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
} from "@/app/_components/ui";
import {
  carregarObras,
  carregarPainel,
  classificarErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { escolherObraAtiva } from "@/lib/fiscal/obra";
import { calcularResumo, type Pendencia, type ResumoObra } from "@/lib/fiscal/resumo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";
import { lerObraPreferida } from "@/lib/obra-ativa";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; dados: PainelDados; resumo: ResumoObra };

const ACAO_POR_TIPO: Partial<Record<Pendencia["tipo"], string>> = {
  quarentena: "Resolver",
  servico_sem_retencao: "Ver detalhes",
};

export default function Home() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const obras = await carregarObras();
        // Critério 6: sem valor confiável de obra ativa — primeiro uso, celular
        // novo, storage limpo, outro dispositivo — o app ABRE A LISTA e não
        // escolhe obra nenhuma. Nem a primeira, nem a mais recente, nem a
        // única: escolher em silêncio é o bug que este ticket veio matar.
        const ativa = escolherObraAtiva(obras, lerObraPreferida());
        if (cancelado) return;
        if (!ativa) {
          router.replace("/obras");
          return;
        }

        const dados = await carregarPainel(ativa.id);
        const ano = Number(hojeIso().slice(0, 4));
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          dados,
          resumo: calcularResumo({ ...dados, ano }),
        });
      } catch (erro) {
        if (cancelado) return;
        setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa, router]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  const trocarObra = useCallback(() => router.push("/obras"), [router]);

  const obra = estado.fase === "pronto" ? estado.dados.obra : null;
  const ano = estado.fase === "pronto" ? estado.resumo.ano : new Date().getFullYear();
  const hoje = hojeIso();

  return (
    <>
      <AppBar
        titulo="contai"
        sub={
          obra
            ? `${obra.nome}${obra.cno ? ` · CNO ${obra.cno}` : " · sem CNO"} · ${ano}`
            : `Obra · ${ano}`
        }
      />

      <Corpo>
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando a obra" />
        ) : null}

        {estado.fase === "erro" ? (
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {estado.fase === "pronto" && obra ? (
          <>
            {/* Critério 7: a obra é afirmada, não subentendida. */}
            <AfirmacaoObra
              rotulo="Obra aberta"
              nome={obra.nome}
              onTrocar={trocarObra}
            />

            <Card>
              {/* Critério 9: todo número carrega o nome da obra. */}
              <Dica>
                Custo confirmado em {estado.resumo.ano} · {obra.nome}
              </Dica>
              <div className="mono text-[26px] font-bold tracking-tight">
                {formatarBRL(estado.resumo.custoConfirmadoAnoCentavos)}
              </div>
              <div className="mono mt-1 text-[14px] font-semibold">
                Acumulado desta obra:{" "}
                {formatarBRL(estado.resumo.acumuladoImovelCentavos)}
              </div>
              <Dica>
                = situação em 31/12 na ficha Bens e Direitos (terreno + obra)
              </Dica>
              <Dica>
                Nada é somado com as outras obras — cada matrícula é um item da
                declaração.
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

            <AvisoEquiparacao obra={obra} />

            {/* A pendência de CNO fica aberta na obra até o CNO existir. */}
            {obra.cno ? null : (
              <PendenciaCno
                obra={obra}
                hoje={hoje}
                acao={
                  <BotaoLink href={`/obras/${obra.id}`}>
                    Já registrei — informar o CNO
                  </BotaoLink>
                }
              />
            )}

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

            <Dica>
              <Link href={`/obras/${obra.id}`} className="underline">
                Dados da obra
              </Link>{" "}
              — matrícula, CNO, custo do terreno.
            </Dica>

            {/* Único caminho até a saída (critério 6 do CONTAI-002): logout
                que não se encontra é logout que não existe. */}
            <Dica>
              <Link href="/conta" className="underline">
                Sua conta
              </Link>{" "}
              — e-mail da sessão e sair deste aparelho.
            </Dica>
          </>
        ) : null}
      </Corpo>

      {/* Critério 12: o alvo sai do FAB flutuante e vai para a barra fixa —
          o FAB pousava sobre o acumulado quando a lista de pendências crescia. */}
      <BarraAdicionar />
    </>
  );
}
