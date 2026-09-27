"use client";

/**
 * FATURA — DETALHE (CONTAI-022, mock s3).
 *
 * ⚠️ A fatura **não é documento hábil e não tem favorecido próprio** — o
 * custo se atribui por compra, cada uma com seu favorecido, sua nota e sua
 * classificação (parecer, ADENDO §B).
 *
 * ⚠️ **CONTAI-067 — esta tela é o lugar CANÔNICO do extrato da fatura**, e o único
 * ponto do app onde ele pode ser anexado DEPOIS. Dois caminhos passam só por aqui:
 * a fatura que foi confirmada sem o extrato (ele chegou depois) e o **rotativo**,
 * que nunca passa por `/confirmar`. `/fatura/[id]/parcial` não ganha campo de
 * extrato de propósito (critério 6): a administradora emite um extrato por CICLO,
 * não por desembolso, e pedi-lo a cada parcial seria entrada dupla do mesmo
 * documento.
 *
 * Cenário: gestão — conciliação de fatura, sentado, com calma.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ListaDeAnexos } from "@/app/_components/anexo";
import { CampoArquivo } from "@/app/_components/campos";
import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
} from "@/app/_components/detalhe";
import {
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import {
  anexarExtratoFatura,
  carregarCompromissos,
  carregarFatura,
  classificarErro,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import {
  CHIP_FATURA_SEM_EXTRATO,
  COR_FATURA_SEM_EXTRATO,
  compromissosAbertosDaFatura,
  EXTRATO_DA_FATURA_AJUDA,
  EXTRATO_DA_FATURA_ROTULO,
  FATURA_SEM_EXTRATO_EFEITO,
  FATURA_SEM_EXTRATO_NAO_VETA,
} from "@/lib/fiscal/fatura";
import { bordaDaCor } from "@/lib/fiscal/gravidade";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { ROTULO_DO_PAPEL } from "@/lib/fiscal/terreno";
import { formatarBRL } from "@/lib/money";
import type { Compromisso, Fatura } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; fatura: Fatura; compromissos: Compromisso[] };

export default function DetalheFatura() {
  const { id } = useParams<{ id: string }>();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  /** CONTAI-067 — o extrato escolhido, e o estado do ato de anexar. */
  const [extrato, setExtrato] = useState<File | null>(null);
  const [anexo, setAnexo] = useState<"pronto" | "anexando" | "erro" | "anexado">(
    "pronto",
  );

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const fatura = await carregarFatura(id);
        const todos = await carregarCompromissos(fatura.obraId);
        if (cancelado) return;
        const idsDaFatura = new Set(fatura.compromissoIds);
        setEstado({
          fase: "pronto",
          fatura,
          compromissos: todos.filter((c) => idsDaFatura.has(c.id)),
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (estado.fase !== "pronto") {
    return (
      <>
        <CabecalhoDaTela titulo="Fatura" />
        <ColunaDeDetalhe>
          {estado.fase === "carregando" ? (
            <Carregando rotulo="Carregando as compras desta fatura" />
          ) : (
            <EstadoErro erro={estado.erro} />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const { fatura, compromissos } = estado;
  const abertas = compromissosAbertosDaFatura(fatura, compromissos);
  const totalPrevistoAbertas = abertas.reduce(
    (s, c) => s + c.valorPrevistoCentavos,
    0,
  );

  /**
   * ⚠️ **Grava no clique em "Anexar extrato", nunca ao escolher o arquivo** —
   * disciplina do projeto: quem afirma o registro é uma ação explícita, e a
   * seleção de um arquivo por si não afirma nada.
   *
   * ⚠️ **Sem `router.push`** no sucesso: o card vira o estado resolvido e o
   * Mateus decide quando sair, mesma disciplina do CONTAI-061.
   */
  async function anexar() {
    if (extrato === null || anexo === "anexando") return;
    setAnexo("anexando");
    try {
      const path = await subirParaAcervo(extrato, "extrato");
      await anexarExtratoFatura(fatura.id, path);
      // O estado gravado é o que a tela passa a mostrar — sem recarregar a
      // fatura inteira por um campo que acabamos de escrever.
      setEstado({ fase: "pronto", fatura: { ...fatura, extratoPath: path }, compromissos });
      setExtrato(null);
      setAnexo("anexado");
    } catch {
      setAnexo("erro");
    }
  }

  return (
    <>
      <CabecalhoDaTela
        titulo={`Fatura · vence ${formatarDataBR(fatura.dataVencimento)}`}
        sub={`${compromissos.length} ${compromissos.length === 1 ? "compra" : "compras"} · ${
          abertas.length > 0 ? "ainda aberta" : "sem compras em aberto"
        }`}
      />
      <ColunaDeDetalhe>
        <Banner cor="amb" role="status">
          A fatura <strong>não é documento hábil</strong> e não tem
          favorecido próprio — o custo se atribui por compra, cada uma com
          seu favorecido, sua nota e sua classificação.
        </Banner>

        <Card>
          <div className="text-[11px] uppercase tracking-wide text-mut">
            Compras vinculadas
          </div>
          {compromissos.map((c) => (
            <div
              key={c.id}
              className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
            >
              <span className="text-[13px]">
                <strong>{c.favorecidoNome ?? "favorecido não informado"}</strong>
                <br />
                <span className="text-mut">
                  compra {formatarDataBR(c.dataCompra ?? c.dataPrevista ?? "")}
                  {c.situacao !== "aberto" ? ` · ${c.situacao}` : ""}
                </span>
              </span>
              <span className="mono">{formatarBRL(c.valorPrevistoCentavos)}</span>
            </div>
          ))}
          {abertas.length > 0 ? (
            <div className="mt-2.5 flex justify-between border-t border-line pt-2 font-semibold">
              <span className="text-[12px] text-mut">Total previsto (em aberto)</span>
              <span className="mono">{formatarBRL(totalPrevistoAbertas)}</span>
            </div>
          ) : null}
        </Card>

        {fatura.desembolsos.length > 0 ? (
          <Card>
            <div className="text-[11px] uppercase tracking-wide text-mut">
              Valores já pagos a esta fatura
            </div>
            {fatura.desembolsos.map((d) => (
              <div
                key={d.id}
                className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2 first:mt-0 first:border-t-0 first:pt-0"
              >
                <span className="text-[13px] text-mut">
                  pago em {formatarDataBR(d.dataPagamento)}
                </span>
                <span className="mono">{formatarBRL(d.valorCentavos)}</span>
              </div>
            ))}
          </Card>
        ) : null}

        {/*
          ── CONTAI-067 · O EXTRATO DA FATURA ──────────────────────────────────

          Posição: depois do que já foi pago, antes das ações. A ordem de leitura é
          "o que foi comprado → o que já foi pago → o que sustenta esse pagamento
          documentalmente → o que fazer a seguir".

          ⚠️ **Ausente, não vazio**, quando não há desembolso nenhum: sem pagamento
          não há o que documentar ainda, e cobrar o extrato de uma fatura que
          ninguém pagou seria alarme sem consequência. Mesma condição do Card
          "Valores já pagos" logo acima, e é a mesma primeira perna da regra pura
          `faltaOExtrato`.
        */}
        {fatura.desembolsos.length > 0 ? (
          fatura.extratoPath !== null ? (
            <Card>
              {anexo === "anexado" ? (
                <Banner cor="grn" role="status">
                  <strong>Extrato anexado.</strong>
                </Banner>
              ) : null}
              <ListaDeAnexos
                titulo="Extrato da fatura"
                itens={[
                  { path: fatura.extratoPath, papel: ROTULO_DO_PAPEL.extrato },
                ]}
              />
            </Card>
          ) : (
            <Card
              className={bordaDaCor(COR_FATURA_SEM_EXTRATO)}
              data-bloco="extrato-da-fatura"
            >
              <Chip cor={COR_FATURA_SEM_EXTRATO}>{CHIP_FATURA_SEM_EXTRATO}</Chip>
              {/* Parágrafo 1 — a consequência, no vocabulário do parecer. */}
              <Consequencia cor={COR_FATURA_SEM_EXTRATO}>
                {FATURA_SEM_EXTRATO_EFEITO}
              </Consequencia>
              {/* Parágrafo 2 — o escopo do NÃO-veto. Existe para o vermelho não
                  ser lido como "trava tudo", que é o que o card vizinho de
                  "Nota sem arquivo" de fato faz e este não (Gate Fiscal item 4). */}
              <Dica>{FATURA_SEM_EXTRATO_NAO_VETA}</Dica>
              {anexo === "erro" ? (
                <div className="mt-2">
                  <Banner cor="red" role="alert">
                    Não deu para anexar o extrato. Nada foi alterado — a fatura
                    continua sem extrato.
                  </Banner>
                </div>
              ) : null}
              <div className="mt-2">
                <CampoArquivo
                  rotulo={EXTRATO_DA_FATURA_ROTULO}
                  ajuda={EXTRATO_DA_FATURA_AJUDA}
                  accept=".pdf,image/*"
                  arquivo={extrato}
                  onChange={setExtrato}
                />
              </div>
              <div className="mt-2.5">
                {/* Secundário: a ação primária desta tela continua sendo
                    confirmar/registrar o pagamento quando há compras abertas. */}
                <BotaoSalvar
                  ocupado={anexo === "anexando"}
                  onClick={anexar}
                  disabled={extrato === null || anexo === "anexando"}
                >
                  {anexo === "anexando" ? "Anexando…" : "Anexar extrato"}
                </BotaoSalvar>
              </div>
            </Card>
          )
        ) : null}

        {abertas.length === 0 ? (
          <Dica>
            Nenhuma compra em aberto nesta fatura — nada mais a confirmar
            aqui.
          </Dica>
        ) : null}

        {/* Decisão 4 do spec de design: leitura com ações por card, sem
            rodapé fixo — a ação certa ao lado do fato certo, mesmo padrão de
            `blocoPagamentos`/`blocoCorrigir` em `/documento/[id]`. O "Voltar
            ao início" da `Rodape` de 430px não sobrevive: quem navega agora é
            a sidebar e o breadcrumb do topbar. */}
        <Card>
          <div className="flex flex-col gap-2">
            {abertas.length > 0 ? (
              <>
                <BotaoLink
                  href={`/fatura/${fatura.id}/confirmar`}
                  variante="primary"
                >
                  Confirmar fatura paga (integral)
                </BotaoLink>
                <BotaoLink href={`/fatura/${fatura.id}/parcial`}>
                  Registrar pagamento parcial (rotativo)
                </BotaoLink>
              </>
            ) : null}
            <BotaoLink href="/adicionar/compra-cartao">
              Registrar outra compra
            </BotaoLink>
          </div>
        </Card>
      </ColunaDeDetalhe>
    </>
  );
}
