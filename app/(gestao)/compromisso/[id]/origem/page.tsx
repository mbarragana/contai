"use client";

/**
 * **CONTAI-083 — DESFAZER A NOTA DE ORIGEM HERDADA** de um agendamento aberto.
 *
 * Fonte normativa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
 * ADENDO 9 (§M.0-M.8). Nada de texto fiscal aqui é redigido nesta tela.
 *
 * ⚠️ **O que esta tela existe para parar** (§M.0): `documento_origem_id` herdado
 * na criação faz o compromisso resolver **N=1** na confirmação e **converter
 * automaticamente, sem clique** (ADENDO 7 §K.2). Três agendamentos com a MESMA
 * origem convertem três vezes para a mesma nota, enquanto as outras notas
 * hábeis do favorecido ficam indefinidamente em "Notas hábeis sem pagamento
 * vinculado".
 *
 * ⚠️ **SEM CAMPO DE MOTIVO, ao contrário de `/cancelar`** (§M.4): duas colunas
 * de auditoria bastam — `origem_desfeita_id` e `origem_desfeita_em`. Não há
 * input algum nesta tela, então não há default de campo fiscal a declarar.
 *
 * ⚠️ **NÃO cria pré-vínculo no mesmo ato** (§M.2, `[Certain]`): a união do
 * critério 10 do CONTAI-080 continuaria em N=1 com a mesma nota errada — *"é o
 * mesmo bug, uma coluna ao lado"*. Se a nota ainda for candidata, ele declara
 * isso de novo, como ato novo, em `/compromisso/[id]/pre-vincular`.
 *
 * ⚠️ **Recusa TOTAL para agendamento não-`aberto`** (§M.5): banner âmbar e nem
 * uma tentativa de gravar. A guarda é `podeDesfazerOrigem`, a MESMA que
 * `desfazerOrigemDoCompromisso` reconfere.
 */

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import { useSessao } from "@/app/_components/sessao";
import {
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Dica,
  EstadoErro,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  carregarCompromisso,
  carregarPainel,
  classificarErro,
  desfazerOrigemDoCompromisso,
  mensagemDeErroDeGravacao,
  type ErroDeTela,
} from "@/lib/data";
import { podeDesfazerOrigem } from "@/lib/fiscal/compromisso";
import { ROTULO_DO_TIPO } from "@/lib/fiscal/documento";
import { formatarBRL } from "@/lib/money";
import type { Compromisso, Documento } from "@/lib/types";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      compromisso: Compromisso;
      /**
       * A nota de origem resolvida contra `painel.documentos` — a mesma
       * resolução que `/pre-vincular` já faz. `null` só em cenário que o
       * produto não produz (acervo é append-only, CONTAI-009); quando acontece,
       * a tela diz isso em vez de esconder a ação: quem decide a permissão é o
       * ID gravado, não a resolução.
       */
      origem: Documento | null;
    };

export default function DesfazerOrigemDoAgendamento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pedirReautenticacao } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const compromisso = await carregarCompromisso(id);
        const painel = await carregarPainel(compromisso.obraId);
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          compromisso,
          origem:
            compromisso.documentoOrigemId === null
              ? null
              : (painel.documentos.find(
                  (d) => d.id === compromisso.documentoOrigemId,
                ) ?? null),
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
    setErroSalvar(null);
    setTentativa((t) => t + 1);
  }, []);

  const pronto = estado.fase === "pronto" ? estado : null;

  async function salvar() {
    if (!pronto) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      await desfazerOrigemDoCompromisso(pronto.compromisso);
      // Sem tela de sucesso própria (mesma decisão de `/pre-vincular` e
      // `/cancelar`): o "sucesso" visível é o chip de pré-vínculo desaparecendo
      // e a linha de auditoria aparecendo no detalhe.
      router.push(`/compromisso/${pronto.compromisso.id}`);
    } catch (erro) {
      setSalvando(false);
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErroDeGravacao(erro, "no agendamento"));
    }
  }

  if (!pronto) {
    return (
      <>
        <CabecalhoDaTela titulo="Desfazer a nota de origem" />
        <ColunaDeDetalhe>
          {estado.fase === "erro" ? (
            <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando o agendamento" />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const c = pronto.compromisso;
  /**
   * ⚠️ **A MESMA guarda da gravação** (critério 10): os dois motivos
   * (`ORIGEM_SO_EM_ABERTO` do §M.5, `ORIGEM_NAO_HA`) vêm de
   * `lib/fiscal/compromisso.ts`, e não de uma segunda redação aqui.
   *
   * Âmbar, nunca vermelho: nada de fiscal aconteceu nem deixou de acontecer, e o
   * agendamento fica exatamente como estava.
   */
  const permissao = podeDesfazerOrigem(c);

  if (!permissao.ok) {
    return (
      <>
        <CabecalhoDaTela
          titulo="Desfazer a nota de origem"
          sub={c.favorecidoNome ?? undefined}
        />
        <ColunaDeDetalhe>
          <Banner cor="amb" role="status">
            {permissao.motivo}
          </Banner>
          <BotaoLink href={`/compromisso/${c.id}`} variante="primary">
            Voltar ao agendamento
          </BotaoLink>
        </ColunaDeDetalhe>
      </>
    );
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Desfazer a nota de origem"
        sub={c.favorecidoNome ?? undefined}
      />
      <ColunaDeDetalhe>
        {/* O rastro ANTES do clique — §M.4 ("nunca apagar, sempre marcar") e
            §M.2 (a nova declaração é ato novo, nunca algo que volta sozinho). */}
        <Banner cor="amb" role="status">
          <strong>
            O vínculo antigo fica registrado, com a data — nada é apagado.
          </strong>{" "}
          Se depois você ainda achar que esta nota é candidata a este
          agendamento, você declara isso de novo em &quot;Ligar notas a este
          agendamento&quot; — como um ato novo, não como algo que volta sozinho.
        </Banner>

        {erroSalvar ? (
          <Banner cor="red" role="alert">
            <strong>Não deu para desfazer.</strong> {erroSalvar}{" "}
            <strong>Nada mudou</strong> — a nota de origem continua ligada a este
            agendamento.
          </Banner>
        ) : null}

        {/* O MESMO visual do card de origem de `/pre-vincular` — menos o cadeado
            e a frase "não pode ser removida aqui": aqui ela PODE ser desfeita, e
            manter o cadeado contradiria a ação disponível (mock §1.2). */}
        <Card className="bg-soft">
          <Passo>Nota de origem — herdada</Passo>
          {pronto.origem ? (
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold break-words">
                {ROTULO_DO_TIPO[pronto.origem.tipo]}
                {pronto.origem.numero ? ` nº ${pronto.origem.numero}` : ""} ·{" "}
                {pronto.origem.favorecidoNome ?? "emitente não informado"}
              </span>
              <span className="mono flex-none text-[15px] font-bold">
                {pronto.origem.valorCentavos === null
                  ? "—"
                  : formatarBRL(pronto.origem.valorCentavos)}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-[14px] font-semibold">
              Nota não encontrada nesta obra.
            </div>
          )}
          <Dica>Vinculada na criação deste agendamento.</Dica>
        </Card>

        {/* ⚠️ **A consequência ANTES do clique**, e cada linha sai do ADENDO 9:
            a primeira compila §M.3 (N cai para 0 — o efeito que a ação existe
            para produzir), e as três seguintes compilam §M.1 (nunca foi custo,
            nunca abateu INSS) e §M.6 (a nota continua na lista que a revisão
            pré-declaração expõe). */}
        <Card>
          <Passo>O que isso muda</Passo>
          <Linha rotulo="Este agendamento">
            deixa de ligar sozinho a esta nota na confirmação
          </Linha>
          <Linha rotulo="Custo de aquisição">inalterado</Linha>
          <Linha rotulo="Base de aferição INSS">inalterada</Linha>
          <Linha rotulo="Esta nota">
            continua em &quot;Notas hábeis sem pagamento vinculado&quot;
          </Linha>
        </Card>
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        <BotaoSalvar
          ocupado={salvando}
          variante="primary"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? "Desfazendo…" : "Desfazer a origem"}
        </BotaoSalvar>
        <BotaoLink href={`/compromisso/${c.id}`}>Voltar sem salvar</BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
