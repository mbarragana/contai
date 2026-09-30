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
 * "Voltar ao início" saiu: dentro do shell o voltar é o breadcrumb, que **muda
 * de lugar, não se duplica**.
 *
 * ⚠️ **CONTAI-076: o `CabecalhoDaTela` saiu também, e com ele o breadcrumb.**
 * `/compromisso` virou **Agenda**, view de primeira classe em
 * `VIEWS_DE_GESTAO`, e nessa família o título vem da ROTA (`tituloDaView`), não
 * da tela — mesmo padrão de `/obras`, `/despesas` e `/pendencias`. Publicar um
 * `CabecalhoDaTela` aqui daria um segundo nome à mesma view (era "Agendados") e
 * faria o shell tratar a Agenda como tela de detalhe, trocando o subtítulo da
 * view pelo da tela. O subtítulo (nome da obra, **sem ano**) passa a vir de
 * `subtituloDaView`, e vale nos três estados — o título não depende do dado
 * carregado.
 *
 * ⚠️ **A obra aberta vem do `useGestao()`** (critério 5): antes esta tela
 * repetia `carregarObras` + `escolherObraAtiva` + `carregarCompromissos` por
 * conta própria, e duas escolhas de obra ativa na mesma árvore é o Pre-mortem 3
 * do `CONTAI-040` — sidebar e conteúdo apontando para obras diferentes.
 *
 * ⚠️ **CONTAI-082 — filtro de urgência e busca por favorecido.** A obra já tem
 * um fornecedor com 7 parcelas agendadas ao mesmo tempo, e achar uma delas
 * exigia escanear a lista inteira. Três coisas que a implementação NÃO faz, e
 * cada uma é um critério:
 * 1. **não toca `montarAgendaDaHome`** (critério 6): o recorte acontece no
 *    `Compromisso[]` de ENTRADA, então vencidos continuam todos no topo, sem
 *    teto, e os abertos por data crescente — sobre o conjunto já filtrado;
 * 2. **não persiste o filtro** (critério 12): `useState` local, sem storage e
 *    sem query string. Filtro esquecido de outra visita esconderia um vencido
 *    sem o Mateus ter acabado de escolher isso;
 * 3. **não mexe na home** (critério 16): `MAX_ABERTOS_NA_HOME` e o corte de 3
 *    seguem exclusivos de lá, e a barra vive só nesta rota.
 */

import { useMemo, useState } from "react";

import { BlocoAgendados } from "@/app/_components/agendado";
import { ColunaDeDetalhe } from "@/app/_components/detalhe";
import { useGestao } from "@/app/_components/gestao";
import {
  Banner,
  Botao,
  CAMPO,
  Carregando,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import { montarAgendaDaHome } from "@/lib/fiscal/compromisso";
import {
  FILTROS_DA_AGENDA_PADRAO,
  filtrarAgenda,
  type FiltroUrgencia,
  type FiltrosDaAgenda,
} from "@/lib/gestao/filtro-agenda";
import { hojeIso } from "@/lib/hoje";

/**
 * As opções do dropdown, em **severidade decrescente** (decisão do `po`), não
 * na ordem interna de `UrgenciaDoAgendamento`.
 *
 * ⚠️ **Rótulo fixo, nunca `chipDoAgendado().texto`** (critério 3): o texto do
 * chip muda por dia e por contagem ("Venceu em 22/09 · 8 dias sem resposta") e
 * não serve de nome de opção. "Agendados" é o rótulo do `comum` — o chip diz
 * "Agendado", no singular, porque fala de um item só.
 */
const URGENCIAS: readonly { valor: FiltroUrgencia; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "vencido", rotulo: "Vencidos" },
  { valor: "vence_hoje", rotulo: "Vence hoje" },
  { valor: "vence_amanha", rotulo: "Vence amanhã" },
  { valor: "comum", rotulo: "Agendados" },
];

export default function Agenda() {
  const { estado, tentarDeNovo } = useGestao();
  const [filtros, setFiltros] = useState<FiltrosDaAgenda>(FILTROS_DA_AGENDA_PADRAO);
  /**
   * ⚠️ **UM "hoje" para a tela inteira** (critério 7): ele vai para as duas
   * chamadas de `montarAgendaDaHome` e para `filtrarAgenda`. Uma segunda
   * derivação faria o filtro e o agrupamento discordarem sobre o que venceu.
   */
  const hoje = hojeIso();
  /** Mesmo padrão de `/despesas`: a lista estável que os `useMemo` observam. */
  const pronto = estado.fase === "pronto" ? estado : null;
  const compromissos = useMemo(() => pronto?.compromissos ?? [], [pronto]);

  // ⚠️ SEM TETO nas duas: o corte de 3 é da HOME (critério 43), e esta é a tela
  // para onde o "ver todos (N)" manda. Cortar aqui seria esconder duas vezes.
  //
  // `completa` existe para uma pergunta só: a Agenda está **genuinamente**
  // vazia? Sem ela, um filtro que zera a lista publicaria o banner verde
  // "Nenhum agendamento em aberto" — afirmação de FATO sobre a obra, feita em
  // cima de um recorte de tela (critério 9).
  const completa = useMemo(
    () => montarAgendaDaHome(compromissos, hoje, Infinity),
    [compromissos, hoje],
  );
  const agenda = useMemo(
    () =>
      montarAgendaDaHome(
        filtrarAgenda(compromissos, filtros, hoje),
        hoje,
        Infinity,
      ),
    [compromissos, filtros, hoje],
  );

  if (estado.fase === "carregando") {
    return (
      <ColunaDeDetalhe>
        <Carregando rotulo="Carregando os agendamentos" />
      </ColunaDeDetalhe>
    );
  }
  if (estado.fase === "erro") {
    return (
      <ColunaDeDetalhe>
        <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
      </ColunaDeDetalhe>
    );
  }

  /** O M do "N de M": vencidos (sem teto) + abertos, sem filtro nenhum. */
  const total = completa.vencidos.length + completa.abertosTotal;
  /** O N: a mesma soma depois do filtro. */
  const visiveis = agenda.vencidos.length + agenda.abertosTotal;

  return (
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
      ) : completa.vazia ? (
        /* ⚠️ Critério 10: o banner verde é o da agenda **genuinamente** vazia, e
           não mudou uma vírgula. Sem barra de filtro acima dele — não se oferece
           controle de filtro quando não há o que filtrar (mesma regra do
           `semRegistro` em `/despesas`). */
        <Banner cor="grn" role="status">
          <strong>Nenhum agendamento em aberto.</strong> Tudo que estava marcado
          já foi respondido.
        </Banner>
      ) : (
        <>
          <BarraDeFiltros
            filtros={filtros}
            onMudar={setFiltros}
            total={total}
            visiveis={visiveis}
          />

          {agenda.vazia ? (
            /* ⚠️ **Outro fato, outro banner** (critério 9): este afirma que
               EXISTE agendamento em aberto e que o filtro é que o esconde.
               Reaproveitar o verde diria o contrário do que é verdade. */
            <Banner cor="amb" role="status">
              <strong>Nenhum agendamento com estes filtros.</strong> Há {total}{" "}
              {total === 1 ? "agendamento" : "agendamentos"} em aberto — o filtro
              é que está escondendo.
              <div className="mt-2.5">
                <Botao
                  variante="ghost"
                  onClick={() => setFiltros(FILTROS_DA_AGENDA_PADRAO)}
                >
                  Mostrar todos
                </Botao>
              </div>
            </Banner>
          ) : (
            /* ⚠️ Critério 11: o `Passo` ("2 ainda não pagos, 2 já venceram")
               descreve o subconjunto VISÍVEL, e continua assim — quem dá o
               universo total é o "N de M" da barra, acima. Duplicar o total aqui
               misturaria as duas contagens no mesmo rótulo. */
            <BlocoAgendados agenda={agenda} hoje={hoje} />
          )}

          <Dica>
            Nenhum destes valores entra em soma nenhuma do app — eles não compõem
            custo de aquisição enquanto o dinheiro não sair.
          </Dica>
        </>
      )}
    </ColunaDeDetalhe>
  );
}

/**
 * A barra da Agenda — componente **próprio**, não a `BarraDeFiltros` de
 * `/despesas` generalizada (critério 15). Os conjuntos de opção não se parecem
 * (urgência do agendamento aqui; situação + tipo de documento lá), e o que as
 * duas telas compartilham é uma constante de tamanho de campo, `CAMPO`.
 */
function BarraDeFiltros({
  filtros,
  onMudar,
  total,
  visiveis,
}: {
  filtros: FiltrosDaAgenda;
  onMudar: (f: FiltrosDaAgenda) => void;
  total: number;
  visiveis: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5" data-filtros="agenda">
      <select
        aria-label="Urgência"
        className={`${CAMPO} min-w-[150px]`}
        value={filtros.filtroUrgencia}
        onChange={(e) =>
          onMudar({
            ...filtros,
            filtroUrgencia: e.target.value as FiltroUrgencia,
          })
        }
      >
        {URGENCIAS.map((u) => (
          <option key={u.valor} value={u.valor}>
            {u.rotulo}
          </option>
        ))}
      </select>

      <input
        type="text"
        aria-label="Buscar favorecido"
        placeholder="Buscar favorecido…"
        className={`${CAMPO} w-[200px]`}
        value={filtros.buscaFavorecido}
        onChange={(e) => onMudar({ ...filtros, buscaFavorecido: e.target.value })}
      />

      {/* ⚠️ Conta AGENDAMENTOS, nunca reais: nenhum valor previsto entra em
          soma nenhuma do app (critério 42 do CONTAI-019). */}
      <span data-contagem="agenda" className="text-[12px] text-mut lg:ml-auto">
        {visiveis === total
          ? `${total} ${total === 1 ? "agendamento" : "agendamentos"}`
          : `${visiveis} de ${total} agendamentos`}
      </span>
    </div>
  );
}
