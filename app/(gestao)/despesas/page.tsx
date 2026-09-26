"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useGestao } from "@/app/_components/gestao";
import {
  Banner,
  Botao,
  Carregando,
  Chip,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import {
  FILTROS_PADRAO,
  filtrarLinhas,
  filtrarPorAno,
  linhasDeDespesa,
  ordenarLinhas,
  ORDEM_PADRAO,
  pendenciasForaDaTabela,
  proximaOrdem,
  rotuloDoMeio,
  SEM_DADO,
  type ColunaOrdenavel,
  type CorDaSituacao,
  type FiltroSituacao,
  type FiltroTipo,
  type LinhaDeDespesa,
  type Ordem,
  type SituacaoDaLinha,
} from "@/lib/fiscal/despesas";
import { rotuloDoAno } from "@/lib/gestao/ano";
import { formatarBRL } from "@/lib/money";

/**
 * **CONTAI-041 — Despesas, a tabela de verdade.**
 *
 * Fonte do desenho: `design/mocks/desktop-shell-v1.md`, seção *"Despesas —
 * tabela de verdade"*. Substitui o stub que o `CONTAI-040` deixou aqui para o
 * item da sidebar não ser link morto.
 *
 * ⚠️ **Uma linha por `Pagamento`/`Documento`, comprovado ou pendente, na MESMA
 * tabela** — é a resposta literal ao pedido do Mateus e o ponto da Meta 1
 * nesta tela: não existe filtro padrão que esconda pendência. Toda a montagem
 * mora em `lib/fiscal/despesas.ts`, função pura e testada; aqui não há `.map()`
 * decidindo situação nenhuma, e nenhum número é calculado (Pre-mortem 1).
 *
 * ⚠️ **O padrão de Situação é "Todas", nunca "Só comprovadas"** (Pre-mortem 2).
 * Quem trocar `FILTROS_PADRAO` está escondendo pendência na primeira visita.
 *
 * ⚠️ **A consequência fiscal aparece INTEIRA na célula, nunca atrás de um
 * clique e nunca truncada** (critério 6). A linha cresce em altura para caber —
 * é exatamente para isso que a tela larga serve. Nenhum texto é redigido aqui:
 * cada frase viaja dentro da `Pendencia` que já a leu da constante de origem.
 *
 * ⚠️ **Nenhuma SOMA em tela.** O rodapé conta LANÇAMENTOS, não reais — a lição
 * do `emPendenciaCentavos` morto no `CONTAI-005`: custo comprovado, exposição
 * de IR e base de INSS são moedas diferentes, e um total geral não corresponde
 * a linha nenhuma de declaração nenhuma. Os números que somam continuam nos
 * KPIs da Visão geral.
 *
 * ⚠️ **375px continua sendo o piso** (`CLAUDE.md`): abaixo de `lg` a MESMA
 * marcação vira linhas empilhadas por CSS — sem bifurcar JSX, que foi o defeito
 * do `CONTAI-039` — e os dois cabeçalhos ordenáveis continuam alcançáveis.
 */
export default function Despesas() {
  const { estado, tentarDeNovo } = useGestao();
  const [filtros, setFiltros] = useState(FILTROS_PADRAO);
  const [ordem, setOrdem] = useState<Ordem>(ORDEM_PADRAO);

  const pronto = estado.fase === "pronto" ? estado : null;
  const painel = pronto?.painel ?? null;
  const resumo = pronto?.resumo ?? null;
  /**
   * **O ano vem do shell, não desta tela** (CONTAI-060, critério 1): abrir
   * `/despesas` mostra o mesmo ano que a Visão geral está mostrando, porque é o
   * mesmo estado. `null` = todos os anos.
   */
  const ano = pronto?.ano ?? null;

  const linhas = useMemo(
    () =>
      painel === null || resumo === null
        ? []
        : linhasDeDespesa({
            documentos: painel.documentos,
            pagamentos: painel.pagamentos,
            resumo,
          }),
    [painel, resumo],
  );

  /**
   * ⚠️ **O universo do ano em exibição — e é ELE o "M" do "N de M"** (achado do
   * designer, item 3 do spec). Contar "N de M" com M sendo o total de todos os
   * anos compararia janelas diferentes, que é literalmente o erro de leitura que
   * originou este ticket.
   *
   * A linha sem `dataPagamento` está sempre aqui dentro, em qualquer ano —
   * `filtrarPorAno` é quem garante, com o parecer citado.
   */
  const linhasDoAno = useMemo(() => filtrarPorAno(linhas, ano), [linhas, ano]);

  const visiveis = useMemo(
    () => ordenarLinhas(filtrarLinhas(linhas, filtros, ano), ordem),
    [linhas, filtros, ano, ordem],
  );

  /**
   * Pendência que a projeção não conseguiu atribuir a linha nenhuma. Vazio em
   * toda obra saudável — e quando não está, a tela **diz**, em vez de a
   * pendência sumir em silêncio (mesma doutrina de `vinculosCruzandoObras`).
   */
  const foraDaTabela = useMemo(
    () => (resumo === null ? [] : pendenciasForaDaTabela(linhas, resumo.pendencias)),
    [linhas, resumo],
  );

  if (estado.fase === "carregando") {
    return <Carregando rotulo="Carregando as despesas" />;
  }
  if (estado.fase === "erro") {
    return <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />;
  }
  if (painel === null || resumo === null) {
    return (
      <Banner cor="amb" role="status">
        <strong>Nenhuma obra aberta neste aparelho.</strong> As despesas são de
        uma obra só — abra uma em <strong>Obras</strong> para vê-las.
      </Banner>
    );
  }

  // Com registro na obra, lista vazia só pode ser filtro — e a tela diz isso
  // em vez de deixar parecer que a obra está vazia.
  const semRegistro = linhas.length === 0;

  return (
    <div className="flex flex-col gap-4" data-view="despesas">
      {foraDaTabela.length > 0 ? (
        <Banner cor="red" role="alert">
          <strong>
            {foraDaTabela.length === 1
              ? "1 pendência desta obra não achou linha nesta tabela"
              : `${foraDaTabela.length} pendências desta obra não acharam linha nesta tabela`}
            .
          </strong>{" "}
          Elas continuam inteiras em{" "}
          <Link href="/pendencias" className="underline">
            Pendências
          </Link>{" "}
          — nada foi perdido, mas não use esta lista como se fosse completa até
          isso ser corrigido.
        </Banner>
      ) : null}

      {semRegistro ? (
        <Dica>
          Nenhum lançamento em {painel.obra.nome} ainda. Toda nota e todo
          pagamento registrados aparecem aqui — comprovados ou não.
        </Dica>
      ) : (
        <>
          <BarraDeFiltros
            filtros={filtros}
            onMudar={setFiltros}
            ano={ano}
            total={linhasDoAno.length}
            visiveis={visiveis.length}
          />

          {/* ⚠️ **Ano vazio e filtro vazio são DOIS estados, e a diferença é a
              saída.** Trocar Situação/Tipo/Busca não traz de volta lançamento de
              outro ano, então oferecer "Mostrar todos" aqui seria um botão que
              não resolve o que a frase diz (spec do designer, item 3). Quem
              resolve é o seletor de ano, no topo da tela — e a tela DIZ quantos
              lançamentos existem nos outros anos, para o vazio nunca ser lido
              como obra vazia. */}
          {linhasDoAno.length === 0 ? (
            <Banner cor="amb" role="status">
              <strong>Nenhum lançamento em {rotuloDoAno(ano)}.</strong> A obra
              tem {linhas.length}{" "}
              {linhas.length === 1 ? "lançamento" : "lançamentos"} em outro(s)
              ano(s) — troque o ano no topo da tela.
            </Banner>
          ) : visiveis.length === 0 ? (
            <Banner cor="amb" role="status">
              <strong>Nenhum lançamento com estes filtros.</strong> A obra tem{" "}
              {linhasDoAno.length}{" "}
              {linhasDoAno.length === 1 ? "lançamento" : "lançamentos"} em{" "}
              {rotuloDoAno(ano)} — o filtro é que está escondendo.
              <div className="mt-2.5">
                <Botao
                  variante="ghost"
                  onClick={() => setFiltros(FILTROS_PADRAO)}
                >
                  Mostrar todos
                </Botao>
              </div>
            </Banner>
          ) : (
            <Tabela
              linhas={visiveis}
              ordem={ordem}
              onOrdenar={(coluna) => setOrdem(proximaOrdem(ordem, coluna))}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Filtros ──────────────────────────────────────────────────────────────

const SITUACOES: readonly { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas as situações" },
  { valor: "comprovadas", rotulo: "Só comprovadas" },
  { valor: "pendencia", rotulo: "Só com pendência" },
];

const TIPOS: readonly { valor: FiltroTipo; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos os documentos" },
  { valor: "nf_material", rotulo: "NF de material" },
  { valor: "nf_servico", rotulo: "NF de serviço" },
  { valor: "boleto", rotulo: "Boleto" },
  { valor: "sem_documento", rotulo: "Sem documento" },
];

/** Campo de 16px: abaixo disso o Safari do iPhone dá zoom a cada foco. */
const CAMPO =
  "min-h-[44px] rounded-[9px] border border-line bg-white px-2.5 text-[16px] lg:min-h-[36px] lg:text-[13px]";

function BarraDeFiltros({
  filtros,
  onMudar,
  ano,
  total,
  visiveis,
}: {
  filtros: typeof FILTROS_PADRAO;
  onMudar: (f: typeof FILTROS_PADRAO) => void;
  /** O ano em exibição, só para NOMEAR a contagem — o seletor mora no shell. */
  ano: number | null;
  /**
   * ⚠️ **O total do ANO EM EXIBIÇÃO, nunca o da obra inteira** (CONTAI-060). Ver
   * `linhasDoAno` acima: "N de M" com M de outra janela é a comparação errada
   * que originou o ticket.
   */
  total: number;
  visiveis: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5" data-filtros="despesas">
      <select
        aria-label="Situação"
        className={CAMPO}
        value={filtros.situacao}
        onChange={(e) =>
          onMudar({ ...filtros, situacao: e.target.value as FiltroSituacao })
        }
      >
        {SITUACOES.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.rotulo}
          </option>
        ))}
      </select>

      <select
        aria-label="Tipo de documento"
        className={CAMPO}
        value={filtros.tipo}
        onChange={(e) =>
          onMudar({ ...filtros, tipo: e.target.value as FiltroTipo })
        }
      >
        {TIPOS.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.rotulo}
          </option>
        ))}
      </select>

      <input
        type="text"
        aria-label="Buscar favorecido"
        placeholder="Buscar favorecido…"
        className={`${CAMPO} w-[200px]`}
        value={filtros.busca}
        onChange={(e) => onMudar({ ...filtros, busca: e.target.value })}
      />

      {/* ⚠️ Conta LANÇAMENTOS, nunca reais — ver o cabeçalho do arquivo. */}
      <span
        data-contagem="despesas"
        className="text-[12px] text-mut lg:ml-auto"
      >
        {/* O escopo do ano viaja NA contagem: "5 lançamentos" sem dizer de
            quando foi o que deixou de bater com o KPI "Custo confirmado em
            2026" da Visão geral. */}
        {visiveis === total
          ? `${total} ${total === 1 ? "lançamento" : "lançamentos"} em ${rotuloDoAno(ano)}`
          : `${visiveis} de ${total} lançamentos em ${rotuloDoAno(ano)}`}
      </span>
    </div>
  );
}

// ── A tabela ─────────────────────────────────────────────────────────────

const COLUNAS_FIXAS = "hidden lg:table-cell";

function Tabela({
  linhas,
  ordem,
  onOrdenar,
}: {
  linhas: readonly LinhaDeDespesa[];
  ordem: Ordem;
  onOrdenar: (coluna: ColunaOrdenavel) => void;
}) {
  return (
    <table
      data-tabela="despesas"
      className="w-full border-collapse overflow-hidden rounded-[12px] border border-line bg-white text-left"
    >
      {/* Abaixo de `lg` o cabeçalho vira uma barra com os DOIS ordenáveis: a
          ordenação por clique no cabeçalho (critério 9) não pode existir só na
          tela larga. */}
      <thead className="block lg:table-header-group">
        <tr className="flex gap-2 border-b-2 border-line bg-soft px-3 py-2 lg:table-row lg:px-0 lg:py-0">
          <Cabecalho
            coluna="data"
            ordem={ordem}
            onOrdenar={onOrdenar}
            rotulo="Data pagamento"
          />
          <ThFixo>Favorecido</ThFixo>
          <ThFixo>Documento</ThFixo>
          <ThFixo>Meio</ThFixo>
          <Cabecalho
            coluna="valor"
            ordem={ordem}
            onOrdenar={onOrdenar}
            rotulo="Valor lançado"
          />
          {/* ⚠️ **Não sortável neste ticket** (CONTAI-057, critério 8): a
              ordenação por valor continua sendo pelo VALOR LANÇADO, sem
              mudança — por isso `ThFixo`, e não `Cabecalho`. */}
          <ThFixo direita>Custo confirmado</ThFixo>
          <ThFixo>Situação</ThFixo>
          <ThFixo>
            <span className="sr-only">Ação</span>
          </ThFixo>
        </tr>
      </thead>
      <tbody className="block lg:table-row-group">
        {linhas.map((l) => (
          <Linha key={l.id} linha={l} />
        ))}
      </tbody>
    </table>
  );
}

const TH =
  "px-3.5 py-[11px] text-[11px] font-semibold tracking-[0.05em] text-mut uppercase align-bottom";

/** `direita`: coluna de número, alinhada como `Cabecalho` já alinha "valor". */
function ThFixo({
  children,
  direita = false,
}: {
  children: React.ReactNode;
  direita?: boolean;
}) {
  return (
    <th
      className={`${COLUNAS_FIXAS} ${TH} ${direita ? "lg:text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Cabecalho({
  coluna,
  rotulo,
  ordem,
  onOrdenar,
}: {
  coluna: ColunaOrdenavel;
  rotulo: string;
  ordem: Ordem;
  onOrdenar: (coluna: ColunaOrdenavel) => void;
}) {
  const ativa = ordem.coluna === coluna;
  return (
    <th
      scope="col"
      aria-sort={
        ativa ? (ordem.direcao === "asc" ? "ascending" : "descending") : "none"
      }
      className={`block ${TH} lg:table-cell ${coluna === "valor" ? "lg:text-right" : ""}`}
    >
      <button
        type="button"
        data-ordenar={coluna}
        onClick={() => onOrdenar(coluna)}
        className="text-[11px] font-semibold tracking-[0.05em] uppercase hover:text-ink"
      >
        {rotulo}
        <span aria-hidden className="ml-1 text-[9px] opacity-60">
          {ativa ? (ordem.direcao === "asc" ? "▴" : "▾") : ""}
        </span>
      </button>
    </th>
  );
}

const TD = "block px-3.5 text-[13px] lg:table-cell lg:py-3 lg:align-top";

/** O rótulo que só existe na pilha de 375px — no desktop quem rotula é o `th`. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1.5 text-[11px] text-mut lg:hidden">{children}</span>
  );
}

function Linha({ linha }: { linha: LinhaDeDespesa }) {
  return (
    <tr
      data-linha={linha.id}
      className="block border-b border-line py-2.5 last:border-b-0 lg:table-row"
    >
      <td className={`${TD} pt-1 lg:pt-3`}>
        <Rotulo>Data pagamento</Rotulo>
        <span className="mono">
          {linha.dataPagamento === null ? SEM_DADO : dataBR(linha.dataPagamento)}
        </span>
        {/* ⚠️ Emissão e vencimento NUNCA ocupam a coluna do regime de caixa:
            quem decide o ano do custo é a data do pagamento. Quando ela não
            existe, a outra data aparece com o nome dela. */}
        {linha.outraData ? (
          <div className="text-[11px] text-mut">
            {linha.outraData.rotulo} {dataBR(linha.outraData.iso)}
          </div>
        ) : null}
      </td>

      <td className={TD}>
        <Rotulo>Favorecido</Rotulo>
        <span className="font-semibold">
          {linha.favorecidoNome ?? "Favorecido não informado"}
        </span>
        {linha.favorecidoTipo ? (
          <span className="ml-1.5 text-[11px] text-mut uppercase lg:ml-0 lg:block">
            {linha.favorecidoTipo}
          </span>
        ) : null}
      </td>

      <td className={TD}>
        <Rotulo>Documento</Rotulo>
        {linha.documentos.length === 0 ? (
          <span className="text-mut">
            {SEM_DADO} {linha.semDocumento}
          </span>
        ) : (
          linha.documentos.map((d) => (
            <div key={d.id}>
              <Link href={d.href} className="hover:underline">
                {d.rotulo}
              </Link>
            </div>
          ))
        )}
      </td>

      <td className={TD}>
        <Rotulo>Meio</Rotulo>
        {rotuloDoMeio(linha.meio)}
      </td>

      {/* ⚠️ **O número SECUNDÁRIO da linha desde o CONTAI-057.** Ele perdeu o
          `font-semibold` para a coluna ao lado: o que interessa na revisão é o
          custo comprovado, e o valor lançado é a parcela que saiu da conta. */}
      <td className={`${TD} lg:text-right`}>
        <Rotulo>Valor lançado</Rotulo>
        {/* ⚠️ Nota sem valor lançado mostra `—`, nunca "R$ 0,00": zero
            afirmado onde não há dado é a afirmação que o produto proíbe — e é
            o mesmo `—` que `/documento/[id]` já mostra para esta nota. */}
        <span className="mono whitespace-nowrap">
          {linha.valorCentavos === null
            ? SEM_DADO
            : formatarBRL(linha.valorCentavos)}
        </span>
      </td>

      {/* **CONTAI-057** — o custo de aquisição comprovado da linha, inteiro.
          Maior que o valor lançado exatamente quando houve retenção quitando
          uma fatia da nota, e a diferença é explicada ao lado, na célula
          `Situação`, pelo chip `Quitado por retenção` (parecer
          `2026-09-18-retencao-variavel-servico-pj.md`, ADENDO 2/3, via
          CONTAI-056) — aqui nenhum texto é redigido e nada é somado: o campo
          já vem derivado de `lib/fiscal/despesas.ts`. */}
      <td className={`${TD} lg:text-right`}>
        <Rotulo>Custo confirmado</Rotulo>
        <span
          data-custo-comprovado={linha.custoComprovadoCentavos}
          className="mono font-semibold whitespace-nowrap"
        >
          {/* Zero mostra `—`, nunca "R$ 0,00": a RAZÃO já está na célula
              `Situação` ao lado, e duplicar a explicação aqui seria ruído. */}
          {linha.custoComprovadoCentavos === 0
            ? SEM_DADO
            : formatarBRL(linha.custoComprovadoCentavos)}
        </span>
      </td>

      {/* A célula central da Meta 1: chip + consequência INTEIRA, sempre. */}
      <td className={`${TD} lg:w-[360px]`}>
        <div className="mt-1.5 flex flex-col gap-1.5 lg:mt-0">
          {linha.situacoes.map((s) => (
            <Situacao key={s.id} situacao={s} />
          ))}
        </div>
      </td>

      <td className={`${TD} mt-2 lg:mt-0 lg:text-right lg:whitespace-nowrap`}>
        <Link
          href={linha.href}
          className="text-[12.5px] font-semibold hover:underline"
        >
          Abrir →
        </Link>
      </td>
    </tr>
  );
}

/**
 * Uma anotação da célula `Situação`.
 *
 * ⚠️ **O neutro não é uma cor de gravidade nova.** Ele é o TERCEIRO ESTADO do
 * parecer §5.2 (nota hábil ainda sem pagamento), que `pendencias-unificadas.ts`
 * mantém fora da fila justamente porque não é pendência: nada saiu, não há o
 * que cobrar. Pintá-lo de âmbar ao lado das pendências âmbares o faria ler como
 * cobrança — e o critério 3 do ticket pede explicitamente um chip **não
 * fiscal-negativo** aqui. As outras três cores continuam vindo da `Gravidade`,
 * derivada da régua, como em toda superfície do app.
 */
function Situacao({ situacao }: { situacao: SituacaoDaLinha }) {
  return (
    <div>
      {situacao.cor === "neutra" ? (
        <span className="inline-block rounded-full bg-soft px-[9px] py-0.5 text-[11px] font-semibold text-mut">
          {situacao.chip}
        </span>
      ) : (
        <Chip cor={situacao.cor}>{situacao.chip}</Chip>
      )}
      {situacao.valorCentavos !== null ? (
        <span className="mono ml-1.5 text-[11.5px] text-mut">
          {formatarBRL(situacao.valorCentavos)}
        </span>
      ) : null}
      {situacao.consequencia ? (
        <Texto cor={situacao.cor}>{situacao.consequencia}</Texto>
      ) : null}
      {situacao.nota ? <Texto cor={situacao.cor}>{situacao.nota}</Texto> : null}
    </div>
  );
}

const FUNDO_DO_TEXTO: Record<CorDaSituacao, string> = {
  red: "text-red bg-red-bg",
  amb: "text-amb bg-amb-bg",
  grn: "text-grn bg-grn-bg",
  neutra: "text-mut bg-soft",
};

/**
 * A consequência, INTEIRA e sempre visível. Sem `line-clamp`, sem `truncate`,
 * sem `title=` — a linha da tabela cresce em altura para caber (critério 6).
 */
function Texto({
  cor,
  children,
}: {
  cor: CorDaSituacao;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`mt-1.5 rounded-lg px-2.5 py-2 text-[12.5px] leading-[1.45] ${FUNDO_DO_TEXTO[cor]}`}
    >
      {children}
    </p>
  );
}

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
