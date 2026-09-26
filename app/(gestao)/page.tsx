"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { BlocoAgendados } from "@/app/_components/agendado";
import { ItemDaFila, NadaAberto } from "@/app/_components/fila-pendencias";
import { useGestao } from "@/app/_components/gestao";
import {
  TileAfericaoInss,
  TileCustoConfirmado,
  TileCustoEmRisco,
} from "@/app/_components/kpi";
import { AvisoEquiparacao } from "@/app/_components/obra";
import { LinhaDoPainel, Painel } from "@/app/_components/painel";
import {
  BotaoLink,
  Carregando,
  Chip,
  Consequencia,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import { EXPLICACAO_NOTAS_SEM_PAGAMENTO } from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL } from "@/lib/money";

/** Quantos itens cada painel mostra antes do "Ver todas (N) →". */
const NO_PAINEL = 4;

/**
 * **CONTAI-040 — a Visão geral (dashboard) do shell de gestão.**
 *
 * Substitui a home mobile como superfície de desktop. O que ela mostra é um
 * **ponto de partida**, nunca a lista inteira empilhada: os três números-chave,
 * as quatro pendências mais graves, as quatro despesas mais recentes e a
 * agenda. Quem quer o detalhe completo vai para Pendências ou Despesas.
 *
 * ⚠️ **Nada foi perdido no caminho.** As dezoito famílias de pendência já
 * moram em `/pendencias` desde o `CONTAI-042` — este painel é um **subconjunto
 * dos mesmos itens**, desenhado pelo **mesmo** `ItemDaFila`, e não um resumo com
 * texto reescrito (critério 9). O que continuava só na home — o terceiro estado
 * do parecer §5.2 (`notasSemPagamento`) e as despesas comprovadas — ganhou
 * painel próprio aqui, porque `pendencias-unificadas.ts` registra por escrito
 * que a nota hábil sem pagamento *"continua no painel da home até o CONTAI-041
 * lhe dar casa própria"*.
 *
 * ⚠️ **Os KPIs reproduzem TODAS as condicionais fiscais dos cards antigos**
 * (critério 8) — ver `app/_components/kpi.tsx`, onde cada ramificação está
 * nomeada com o parecer que a exige.
 */
export default function VisaoGeral() {
  const router = useRouter();
  const { estado, tentarDeNovo } = useGestao();

  const semObra = estado.fase === "pronto" && estado.painel === null;
  useEffect(() => {
    // Critério 6 do CONTAI-003: sem valor confiável de obra ativa — primeiro
    // uso, aparelho novo, storage limpo — o app ABRE A LISTA e não escolhe obra
    // nenhuma. Nem a primeira, nem a mais recente, nem a única.
    if (semObra) router.replace("/obras");
  }, [semObra, router]);

  if (estado.fase === "carregando" || semObra) {
    return <Carregando rotulo="Carregando a obra" />;
  }
  if (estado.fase === "erro") {
    return <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />;
  }

  const { painel, resumo, agenda, unificadas, obras, ano } = estado;
  // Estreitamento para o TypeScript: `painel === null` já saiu acima pelo
  // `semObra`, e `resumo` nasce e morre junto com ele.
  if (painel === null || resumo === null) {
    return <Carregando rotulo="Carregando a obra" />;
  }

  const obra = painel.obra;
  const hoje = hojeIso();
  /**
   * ⚠️ **`terreno_sem_registro` sai do painel, e a razão é a D46.**
   *
   * Duas exigências do ticket se cruzam nesta tela: o critério 8 manda o KPI de
   * custo confirmado reproduzir TODAS as condicionais do card antigo — e uma
   * delas é o `AvisoTerrenoSemRegistro`, que é exatamente a 18ª família da fila
   * —, e o critério 9 manda o painel mostrar as quatro mais graves. Cumprir as
   * duas ao pé da letra põe a MESMA frase fiscal duas vezes na mesma tela, que é
   * a D46 no ato: o mesmo fato com dois rostos, e o Mateus decidindo em qual
   * acreditar.
   *
   * O recorte é este, e só este: a família continua na fila inteira de
   * `/pendencias`, continua na contagem do badge e continua dita aqui — dentro
   * do número a que ela se refere, que é onde a home sempre a disse e onde o
   * parecer a quer (o "R$ 0,00 aqui" precisa apontar para um número visível).
   */
  const forasDoPainel = unificadas.itens.filter(
    (i) => i.familia !== "terreno_sem_registro",
  );
  const urgentes = forasDoPainel.slice(0, NO_PAINEL);

  return (
    <>
      {/* Aviso persistente, nunca bloqueio (CONTAI-003, critério 11). Ele traz
          a guarda por dentro e some sozinho quando não se aplica. */}
      <AvisoEquiparacao obra={obra} />

      {/* ── OS TRÊS NÚMEROS ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <TileCustoConfirmado resumo={resumo} nomeDaObra={obra.nome} ano={ano} />
        <TileCustoEmRisco risco={resumo.custoEmRiscoIr} nomeDaObra={obra.nome} />
        {/* Outra apuração, em BASE, e nunca somada à de cima (R2). Só com CNO e
            só com exposição — mesma condição da home. */}
        {obra.cno && resumo.exposicaoInssBaseCentavos > 0 ? (
          <TileAfericaoInss
            cno={obra.cno}
            baseCentavos={resumo.exposicaoInssBaseCentavos}
          />
        ) : null}
      </div>

      {/* ── OS PAINÉIS ──────────────────────────────────────────────────── */}
      <div className="mt-2 grid gap-5 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <Painel
          data-painel="pendencias-urgentes"
          titulo="Pendências mais urgentes"
          descricao="O que está faltando e quanto custa se você ignorar — não somam entre si, cada uma é uma apuração diferente."
          verTodas={
            unificadas.itens.length > urgentes.length
              ? {
                  href: "/pendencias",
                  rotulo: `Ver todas (${unificadas.abertas}) →`,
                }
              : undefined
          }
        >
          {unificadas.itens.length === 0 ? (
            <NadaAberto obra={obra} ano={ano} />
          ) : urgentes.length === 0 ? (
            // Só a família que este painel não repete está aberta. NÃO se diz
            // "nada aberto" aqui: afirmar ausência de pendência que existe é a
            // D59, e ela nasceu exatamente assim.
            <Dica>
              O que está aberto é a posição do terreno, dita no número acima. A
              fila completa fica em{" "}
              <Link href="/pendencias" className="underline">
                Pendências
              </Link>
              .
            </Dica>
          ) : (
            urgentes.map((item) => (
              <ItemDaFila key={item.id} item={item} obras={obras} hoje={hoje} />
            ))
          )}
        </Painel>

        <div className="flex flex-col gap-5">
          {resumo.despesas.length > 0 ? (
            <Painel
              data-painel="despesas-recentes"
              titulo="Despesas recentes"
              descricao="Nota + pagamento já ligados — uma despesa, não duas."
              verTodas={{
                href: "/despesas",
                rotulo: `Ver todas (${resumo.despesas.length}) →`,
              }}
            >
              {resumo.despesas.slice(0, NO_PAINEL).map((d) => (
                <LinhaDoPainel
                  key={d.id}
                  href={d.href}
                  titulo={d.titulo}
                  detalhe={d.detalhe}
                  valor={formatarBRL(d.valorCentavos)}
                />
              ))}
            </Painel>
          ) : null}

          {/* ── O TERCEIRO ESTADO (parecer §5.2) ─────────────────────────
              Painel PRÓPRIO, fora das pendências de propósito: este número não
              soma com o custo confirmado nem com o custo em risco, e por isso
              `pendencias-unificadas.ts` o deixa explicitamente de fora da fila.
              Continua aqui até o CONTAI-041 lhe dar casa própria. */}
          {resumo.notasSemPagamento.length > 0 ? (
            <Painel
              data-painel="notas-sem-pagamento"
              titulo="Notas hábeis sem pagamento vinculado"
            >
              <div>
                <div className="mono text-[19px] font-bold">
                  {formatarBRL(resumo.notasSemPagamentoCentavos)}
                </div>
                <Consequencia cor="amb">
                  {EXPLICACAO_NOTAS_SEM_PAGAMENTO}
                </Consequencia>
                <Dica>
                  Não soma com o custo confirmado nem com o que está em
                  pendência.
                </Dica>
              </div>
              {resumo.notasSemPagamento.map((n) => (
                <div key={n.id} className="border-t border-line pt-3">
                  <Chip cor="amb">Sem pagamento ligado</Chip>
                  <div className="mt-1.5 text-[13.5px] font-semibold">
                    {n.titulo}
                  </div>
                  <Dica>
                    {n.detalhe} ·{" "}
                    <span className="mono">{formatarBRL(n.valorCentavos)}</span>
                  </Dica>
                  <div className="mt-2.5">
                    <BotaoLink href={`${n.href}/ligar`} variante="primary">
                      Ligar a um pagamento
                    </BotaoLink>
                  </div>
                </div>
              ))}
            </Painel>
          ) : null}

          {/* ⚠️ BLOCO SEPARADO, LONGE DO CUSTO (critério 10 do CONTAI-019).
              Compromisso NÃO é pendência fiscal — nada saiu da conta, logo não
              há risco fiscal ainda, e não há soma nenhuma aqui, só contagem
              (critério 42). O `BlocoAgendados` traz o cabeçalho e a
              consequência por dentro, e some sozinho quando a agenda é vazia. */}
          {!agenda.vazia ? (
            <Painel titulo="Agenda — próximos compromissos">
              <BlocoAgendados agenda={agenda} hoje={hoje} />
            </Painel>
          ) : null}
        </div>
      </div>
    </>
  );
}
