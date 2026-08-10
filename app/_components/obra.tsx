"use client";

import type { ReactNode } from "react";

import {
  AppBar,
  Banner,
  Botao,
  Card,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  Rodape,
} from "@/app/_components/ui";
import {
  AVISO_EQUIPARACAO,
  CNO_NAO_MUDA_IRPF,
  CONSEQUENCIA_SEM_CNO_AVERBACAO,
  CONSEQUENCIA_SEM_CNO_NOTAS,
  exigeAvisoEquiparacao,
  formatarDataBR,
  fraseDoPrazoCno,
  prazoCno,
  proximoPassoCno,
  temPrazoCorrendo,
  TITULO_PENDENCIA_CNO,
} from "@/lib/fiscal/obra";
import type { Obra } from "@/lib/types";

/**
 * Peças de tela do CONTAI-003 (design/mocks/CONTAI-003.html).
 *
 * Os textos com consequência fiscal vêm de lib/fiscal/obra.ts, que os copia do
 * parecer do contador — nenhuma frase fiscal nasce aqui.
 */

/**
 * Afirmação com escape (telas 1 e 11): uma frase que se lê, não um `select`
 * que se opera. Seletor convida a trocar sem querer, e documento na obra
 * errada é descoberto tarde demais para consertar de graça.
 */
export function AfirmacaoObra({
  rotulo,
  nome,
  onTrocar,
}: {
  rotulo: string;
  nome: string;
  /** Ausente quando só há uma obra: a afirmação fica, o escape some (crit. 7). */
  onTrocar?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 rounded-lg border border-line border-l-[3px] border-l-ink bg-soft px-3 py-2.5">
      <div>
        <Dica>{rotulo}</Dica>
        <div className="text-[13.5px] font-semibold">{nome}</div>
      </div>
      {onTrocar ? (
        <button
          type="button"
          onClick={onTrocar}
          className="min-h-[44px] flex-none px-1 text-[12.5px] text-mut underline"
        >
          Trocar obra
        </button>
      ) : null}
    </div>
  );
}

/** Escolha explícita de obra (telas 2 e 12), sem nenhum valor em dinheiro. */
export function ListaDeEscolha({
  obras,
  hoje,
  onEscolher,
  pendenciasPorObra,
}: {
  obras: Obra[];
  hoje: string;
  onEscolher: (obra: Obra) => void;
  /** Contagem por obra — número, nunca dinheiro (critério 14). */
  pendenciasPorObra?: Map<string, number>;
}) {
  return (
    <>
      {obras.map((obra) => {
        const pendencias = pendenciasPorObra?.get(obra.id);
        return (
          <button
            key={obra.id}
            type="button"
            onClick={() => onEscolher(obra)}
            className="rounded-[10px] border border-line bg-white px-[14px] py-3 text-left"
          >
            <div className="font-semibold">{obra.nome}</div>
            {obra.cno ? (
              <p className="mono text-[12px] text-mut">CNO {obra.cno}</p>
            ) : (
              <p className="text-[12px] font-semibold text-red">
                {rotuloSemCno(obra, hoje)}
              </p>
            )}
            {pendencias !== undefined ? (
              <div className="mt-2">
                <Chip cor={pendencias > 0 ? "red" : "grn"}>
                  {pendencias === 0
                    ? "sem pendências"
                    : `${pendencias} ${pendencias === 1 ? "pendência" : "pendências"}`}
                </Chip>
              </div>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

/**
 * Tela 12 — troca de obra SEM SAIR DO FLUXO: o formulário continua montado
 * atrás desta tela, então o Mateus volta para o mesmo registro com a obra
 * trocada. O que for salvo usa a obra que ficou na tela, não a preferência
 * guardada no aparelho.
 */
export function TelaTrocarObra({
  obras,
  hoje,
  onEscolher,
  onCancelar,
}: {
  obras: Obra[];
  hoje: string;
  onEscolher: (obra: Obra) => void;
  onCancelar: () => void;
}) {
  return (
    <>
      <AppBar titulo="Trocar obra" sub="Este registro vai para a obra escolhida" />
      <Corpo>
        <ListaDeEscolha obras={obras} hoje={hoje} onEscolher={onEscolher} />
        <Dica>
          Escape sem sair do formulário: você volta para o mesmo registro, com a
          obra trocada. O que for salvo usa a obra que estava na tela — não a
          preferência guardada no aparelho.
        </Dica>
      </Corpo>
      <Rodape>
        <Botao variante="ghost" onClick={onCancelar}>
          Cancelar
        </Botao>
      </Rodape>
    </>
  );
}

/** Rótulo curto da obra sem CNO — nunca "opcional", sempre obrigação. */
export function rotuloSemCno(obra: Obra, hoje: string): string {
  if (!temPrazoCorrendo(obra.dataInicioObra, hoje)) {
    return "sem CNO — obrigação em aberto";
  }
  const prazo = prazoCno(obra.dataInicioObra, hoje);
  if (prazo.situacao === "em_atraso") {
    return `sem CNO — obrigação em atraso (${prazo.dias} dias)`;
  }
  if (prazo.situacao === "vence_hoje") return "sem CNO — o prazo vence hoje";
  return `sem CNO — faltam ${prazo.dias} dias do prazo`;
}

/**
 * Pendência de CNO (telas 7, 10 e o cabeçalho da obra). Redação copiada de
 * docs/pareceres/2026-08-09-obra-sem-cno.md e do adendo de 2026-08-10 — não
 * reescrever aqui.
 *
 * O bloco de consequências é idêntico nos três estados do prazo e sempre
 * visível: o dano à aferição não começa no dia 31, começa na primeira nota.
 */
export function PendenciaCno({
  obra,
  hoje,
  acao,
}: {
  obra: Obra;
  hoje: string;
  acao?: ReactNode;
}) {
  const noPrazo =
    temPrazoCorrendo(obra.dataInicioObra, hoje) &&
    prazoCno(obra.dataInicioObra, hoje).situacao === "no_prazo";

  return (
    <Card className="border-red">
      <Chip cor="red">
        {noPrazo ? `${TITULO_PENDENCIA_CNO} — prazo em curso` : TITULO_PENDENCIA_CNO}
      </Chip>
      <p className="mt-2.5 text-[13.5px]">
        {fraseDoPrazoCno(obra.dataInicioObra, hoje)}
      </p>
      <Consequencia cor="red">
        Enquanto não houver CNO:
        <br />• {CONSEQUENCIA_SEM_CNO_NOTAS}
        <br />• {CONSEQUENCIA_SEM_CNO_AVERBACAO}
      </Consequencia>
      <Consequencia cor="amb">
        <strong>O que não muda:</strong> {CNO_NAO_MUDA_IRPF}
      </Consequencia>
      <p className="mt-2.5 text-[13px]">
        <strong>Próximo passo:</strong> {proximoPassoCno(obra.dataInicioObra)}
      </p>
      {acao ? <div className="mt-2.5">{acao}</div> : null}
    </Card>
  );
}

/** Critério 11 — aviso persistente, nunca bloqueio. */
export function AvisoEquiparacao({ obra }: { obra: Obra }) {
  if (!exigeAvisoEquiparacao(obra)) return null;
  return (
    <Banner cor="amb" role="status">
      <strong>Confira com o seu contador:</strong> {AVISO_EQUIPARACAO}
    </Banner>
  );
}

/** Janela entre o início da obra e o registro do CNO (tela 6). */
export function JanelaSemCno({ dias, inicio }: { dias: number; inicio: string }) {
  if (dias <= 0) return null;
  return (
    <Banner cor="amb" role="status">
      <strong>
        {dias} {dias === 1 ? "dia" : "dias"} entre o início ({formatarDataBR(inicio)}) e
        o registro.
      </strong>{" "}
      As notas de serviço emitidas nesse intervalo não abatem a aferição enquanto
      não forem retificadas.
    </Banner>
  );
}
