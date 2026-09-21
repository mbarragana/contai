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
import {
  carregarPainel,
  classificarErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import {
  COBRANCA_SEM_CNO_INSTRUCAO,
  COBRANCA_SEM_CNO_LIMITE,
  fimDaJanelaSemCno,
  formatarDataBR,
  notasEmitidasSemCno,
  type NotaSemCno,
} from "@/lib/fiscal/obra";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";

/**
 * **Tela 14 do mock do CONTAI-003** — a lista de cobrança, CONTAI-007,
 * critério 8. Desenhada e aprovada pelo Mateus em 2026-08-10; ficou fora do
 * CONTAI-003 porque depende de `numero` e `data_emissao` (CONTAI-004) e de
 * `cno_referenciado` (este ticket).
 *
 * ⚠️ **É o único item deste lote que RECUPERA valor em vez de só registrar
 * perda** — e vale só enquanto houver parcela a liberar. Daí o texto do limite
 * no rodapé da lista: o app gera a lista, a cobrança é dele, e a força para
 * fazê-la acaba no último pagamento.
 *
 * O app não envia mensagem, não guarda conversa e não acompanha status. Isso
 * não é corte de escopo por preguiça: é a mesma linha das outras saídas do
 * produto — ele gera o que se leva para fora, como gera a discriminação anual.
 */

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; painel: PainelDados; notas: NotaSemCno[] };

export default function NotasSemCno() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const painel = await carregarPainel(id);
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          painel,
          notas: notasEmitidasSemCno({
            obra: painel.obra,
            documentos: painel.documentos,
            hoje: hojeIso(),
          }),
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
    setTentativa((t) => t + 1);
  }, []);

  const rodape = (
    <Rodape>
      <BotaoLink href={`/obras/${id}`}>Voltar aos dados da obra</BotaoLink>
    </Rodape>
  );

  // ── Carregando / erro ──────────────────────────────────────────────────
  if (estado.fase !== "pronto") {
    return (
      <>
        <AppBar titulo="Notas sem CNO" />
        <Corpo>
          {estado.fase === "erro" ? (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando as notas desta obra" />
          )}
        </Corpo>
        {rodape}
      </>
    );
  }

  const { obra } = estado.painel;
  const inicio = formatarDataBR(obra.dataInicioObra);
  const fim = formatarDataBR(fimDaJanelaSemCno(obra, hojeIso()));

  return (
    <>
      <AppBar
        titulo="Notas sem CNO"
        sub={`${obra.nome} · para cobrar da empreiteira`}
      />
      <Corpo>
        <Banner cor="amb" role="status">
          {COBRANCA_SEM_CNO_INSTRUCAO}
        </Banner>

        <Dica>
          {/* A janela é o fato que define a lista — e ela é aberta enquanto o
              CNO não sai. Dizer os dois extremos evita a leitura de que a
              lista é "todas as notas da obra". */}
          Janela: de <strong>{inicio}</strong> (início da obra) a{" "}
          <strong>{fim}</strong>{" "}
          {obra.cnoRegistradoEm
            ? "(registro do CNO)"
            : "— e ela continua aberta, porque esta obra ainda não tem CNO"}
          .
        </Dica>

        {/* ── VAZIO: é resultado, não falha ────────────────────────────── */}
        {estado.notas.length === 0 ? (
          <Card>
            <div className="font-semibold">Nenhuma nota a cobrar</div>
            <Dica>
              Nenhuma NF de serviço desta obra foi emitida dentro da janela sem
              CNO. Nota sem data de emissão registrada não entra aqui — sem a
              data não há como afirmar que ela caiu na janela.
            </Dica>
          </Card>
        ) : (
          <Card>
            {estado.notas.map((n) => (
              <Linha
                key={n.id}
                rotulo={`NF ${n.numero ?? "s/nº"} · ${formatarDataBR(n.dataEmissao)}`}
              >
                <span className="mono">
                  {n.valorCentavos === null ? "—" : formatarBRL(n.valorCentavos)}
                </span>
                <div className="text-[11.5px] text-mut">
                  {n.prestador ?? "prestador não informado"}
                </div>
              </Linha>
            ))}
          </Card>
        )}

        <Dica>{COBRANCA_SEM_CNO_LIMITE}</Dica>
      </Corpo>
      {rodape}
    </>
  );
}
