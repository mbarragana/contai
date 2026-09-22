"use client";

/**
 * A agenda inteira — o destino do "ver todos (N)" do critério 43.
 *
 * A home mostra TODOS os vencidos e no máximo 3 abertos. Esta tela não corta
 * nada: é onde o corte da home deixa de esconder.
 *
 * ⚠️ **CONTAI-045**: a tela migrou de `app/(captura)/` (casca de 430px) para o
 * shell de gestão. O `AppBar` virou `CabecalhoDaTela` (título emprestado ao
 * topbar), o `Corpo` virou `ColunaDeDetalhe` (640px) e a `BarraAdicionar` com o
 * "Voltar ao início" saiu: dentro do shell o voltar é o breadcrumb
 * (`migalhaDaRota` → "‹ Visão geral"), que **muda de lugar, não se duplica**.
 *
 * ⚠️ **A obra aberta vem do `useGestao()`** (critério 5): antes esta tela
 * repetia `carregarObras` + `escolherObraAtiva` + `carregarCompromissos` por
 * conta própria, e duas escolhas de obra ativa na mesma árvore é o Pre-mortem 3
 * do `CONTAI-040` — sidebar e conteúdo apontando para obras diferentes.
 */

import { BlocoAgendados } from "@/app/_components/agendado";
import { CabecalhoDaTela, ColunaDeDetalhe } from "@/app/_components/detalhe";
import { useGestao } from "@/app/_components/gestao";
import { Banner, Carregando, Dica, EstadoErro } from "@/app/_components/ui";
import { montarAgendaDaHome } from "@/lib/fiscal/compromisso";
import { hojeIso } from "@/lib/hoje";

export default function Agenda() {
  const { estado, tentarDeNovo } = useGestao();
  const hoje = hojeIso();

  if (estado.fase === "carregando") {
    return (
      <>
        <CabecalhoDaTela titulo="Agendados" />
        <ColunaDeDetalhe>
          <Carregando rotulo="Carregando os agendamentos" />
        </ColunaDeDetalhe>
      </>
    );
  }
  if (estado.fase === "erro") {
    return (
      <>
        <CabecalhoDaTela titulo="Agendados" />
        <ColunaDeDetalhe>
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        </ColunaDeDetalhe>
      </>
    );
  }

  // ⚠️ SEM TETO: o corte de 3 é da HOME (critério 43), e esta é a tela para
  // onde o "ver todos (N)" manda. Cortar aqui também seria esconder duas vezes.
  const agenda = montarAgendaDaHome(estado.compromissos, hoje, Infinity);

  return (
    <>
      <CabecalhoDaTela
        titulo="Agendados"
        sub={estado.painel?.obra.nome ?? undefined}
      />
      <ColunaDeDetalhe>
        {/* ⚠️ Sem obra aberta não há agenda APURADA, e "nenhum agendamento em
            aberto" seria afirmar uma apuração que não aconteceu — a mesma
            confusão que a D59 produziu na home. Mesmo texto das outras views do
            shell (`/despesas`, `/pendencias`). */}
        {estado.painel === null ? (
          <Banner cor="amb" role="status">
            <strong>Nenhuma obra aberta neste aparelho.</strong> Os agendamentos
            são de uma obra só — abra uma em <strong>Obras</strong> para vê-los.
          </Banner>
        ) : agenda.vazia ? (
          <Banner cor="grn" role="status">
            <strong>Nenhum agendamento em aberto.</strong> Tudo que estava
            marcado já foi respondido.
          </Banner>
        ) : (
          <>
            <BlocoAgendados agenda={agenda} hoje={hoje} />
            <Dica>
              Nenhum destes valores entra em soma nenhuma do app — eles não
              compõem custo de aquisição enquanto o dinheiro não sair.
            </Dica>
          </>
        )}
      </ColunaDeDetalhe>
    </>
  );
}
