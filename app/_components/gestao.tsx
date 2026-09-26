"use client";

/**
 * **CONTAI-040 — o contexto do shell de gestão, e o único ponto de leitura da
 * obra aberta em toda a árvore de `app/(gestao)/`.**
 *
 * Pre-mortem 3 do ticket: *"Sidebar 'Obra aberta' divergindo do contexto usado
 * pelos painéis"*. A guarda é esta — `escolherObraAtiva(obras,
 * lerObraPreferida())` é chamado **uma vez**, aqui, e a sidebar, os KPIs, os
 * painéis e o badge leem todos o mesmo resultado. Nenhuma tela do grupo repete
 * a escolha por conta própria.
 *
 * ⚠️ **O `ano` também é um só.** Gate Fiscal do `CONTAI-042` (§5): três famílias
 * (`terrenoSemRegistro`, `financiamentoFaltaLancar`,
 * `financiamentoAguardandoInforme`) têm a condição de abertura ligada ao ano.
 * Dois anos diferentes dentro do shell fariam o badge contar uma coisa e a fila
 * listar outra — a divergência de definição de "pendência aberta" que o
 * sequenciamento 042 → 040 existe para evitar.
 *
 * ⚠️ **CONTAI-060 — o ano passou a ser ESCOLHÍVEL, e continua sendo um só.** O
 * seletor do shell escreve `ano` aqui, e Visão geral, Despesas e Pendências leem
 * deste mesmo campo: é isso que impede "trocar num lugar e o outro ficar para
 * trás" (Pre-mortem 2 do ticket). Duas invariantes o cercam:
 *
 * - **não persiste** (nem `localStorage`, nem URL): montou, é o ano corrente
 *   real. É o que faz "todos os anos" (`null`) ser sempre uma escolha explícita
 *   e nunca um default herdado de uma sessão antiga (critério 3);
 * - **trocar o ano não refaz fetch** (critério 4): o efeito de carga não depende
 *   dele, e `resumo`/`unificadas`/`anos` saem de um `useMemo` sobre os dados já
 *   carregados. O revalidate por `pathname` do `CONTAI-058` fica intacto e não é
 *   disparado por um clique no seletor.
 *
 * ⚠️ **"Ano em tela" ≠ "hoje", e a separação é deliberada** (auditoria exigida
 * pelo Pre-mortem 3 do `CONTAI-060`). `unificarPendencias` recebe **sempre o ano
 * real**, nunca o escolhido: o `anoCorrente` dela decide, via
 * `sinalDoEmitenteErrado`/`anosAfetados`, se o delta caiu em ano **já
 * declarado** (`ano < anoCorrente`) — e um filtro de leitura não pode fechar nem
 * abrir pendência de retificadora. Já `calcularResumo` recebe o ano **em tela**:
 * todo número dele é "o ano que estou lendo". Sob "todos os anos" ele recebe o
 * ano real, porque a função precisa de um número concreto, e quem muda é só qual
 * campo o KPI mostra (`acumuladoImovelCentavos`).
 *
 * ⚠️ **Nenhum cálculo fiscal nasce aqui.** Este módulo carrega e repassa:
 * `calcularResumo` e `unificarPendencias` continuam donos do que significa cada
 * número, e os textos continuam nas constantes de sempre.
 */

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  carregarCompromissos,
  carregarObras,
  carregarPainel,
  carregarPainelDePendencias,
  classificarErro,
  type ErroDeTela,
  type PainelDados,
} from "@/lib/data";
import { montarAgendaDaHome, type AgendaHome } from "@/lib/fiscal/compromisso";
import { anosDaObra, escolherObraAtiva } from "@/lib/fiscal/obra";
import {
  unificarPendencias,
  type PendenciasUnificadas,
} from "@/lib/fiscal/pendencias-unificadas";
import { calcularResumo, type ResumoObra } from "@/lib/fiscal/resumo";
import { hojeIso } from "@/lib/hoje";
import { lerObraPreferida, observarObraPreferida } from "@/lib/obra-ativa";
import type { Compromisso } from "@/lib/types";

export type EstadoDaGestao =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      /**
       * `null` quando o aparelho não aponta para obra nenhuma (primeiro uso,
       * storage limpo, mais de uma obra e nenhuma escolhida). A sidebar **diz**
       * isso; nenhuma tela escolhe uma por conta própria (CONTAI-003, crit. 6).
       */
      painel: PainelDados | null;
      /** `null` junto com o painel — `calcularResumo` é de uma obra só. */
      resumo: ResumoObra | null;
      /**
       * ⚠️ Campo SEPARADO do painel, e pela mesma razão de sempre: compromisso
       * não entra em `calcularResumo` por caminho nenhum (CONTAI-019, crit. 3).
       *
       * Aqui ele vem com o corte de 3 abertos que é da **home** (critério 43 do
       * CONTAI-019).
       */
      agenda: AgendaHome;
      /**
       * Os compromissos da obra aberta, **sem corte nenhum** — é deles que
       * `/compromisso` monta a agenda inteira (o destino do "ver todos (N)",
       * onde o corte da home deixa de valer).
       *
       * ⚠️ **CONTAI-045, critério 5**: a lista lê daqui em vez de repetir
       * `carregarObras` + `escolherObraAtiva` + `carregarCompromissos` por conta
       * própria. Segunda leitura da obra ativa é a porta do Pre-mortem 3 do
       * `CONTAI-040` — sidebar e conteúdo apontando para obras diferentes.
       */
      compromissos: Compromisso[];
      /**
       * As dezoito famílias, já ordenadas e contadas (`CONTAI-042`). É daqui
       * que sai o badge da sidebar — sem contagem provisória e sem uma segunda
       * definição de "pendência aberta".
       */
      unificadas: PendenciasUnificadas;
      /** Nome por id: a pendência de outra obra aparece NOMEADA. */
      obras: Map<string, string>;
      /**
       * O ano-calendário em exibição, escolhido no seletor do shell.
       * **`null` = "todos os anos"**, a opção explícita do critério 3 — nunca o
       * estado inicial, e nunca indistinguível de um ano.
       */
      ano: number | null;
      /**
       * Os anos que o seletor oferece, do mais recente para o mais antigo. Vem
       * de `anosDaObra`, e nunca é vazia (o ano corrente entra sempre).
       */
      anos: number[];
    };

interface ContextoDeGestao {
  estado: EstadoDaGestao;
  tentarDeNovo: () => void;
  /**
   * Troca o ano em exibição — `null` para "todos os anos". **Não refaz fetch**
   * (critério 4) e não persiste nada (Out of Scope do ticket).
   */
  escolherAno: (ano: number | null) => void;
}

const Contexto = createContext<ContextoDeGestao>({
  estado: { fase: "carregando" },
  tentarDeNovo: () => {},
  escolherAno: () => {},
});

export function useGestao(): ContextoDeGestao {
  return useContext(Contexto);
}

/**
 * Os dados CARREGADOS, sem nada derivado do ano.
 *
 * ⚠️ A separação entre esta carga e o `EstadoDaGestao` que sai do `useMemo`
 * abaixo é o critério 4 em forma de tipo: o que depende de rede está aqui, o que
 * depende do ano escolhido é derivado. Quem puser um campo derivado do ano nesta
 * `Carga` faz a troca de ano voltar a exigir fetch.
 */
type Carga =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | {
      fase: "pronto";
      painel: PainelDados | null;
      compromissos: Compromisso[];
      /** O painel das persistentes, de TODAS as obras. */
      pendencias: Awaited<ReturnType<typeof carregarPainelDePendencias>>;
      obras: Map<string, string>;
    };

export function ProvedorDeGestao({ children }: { children: ReactNode }) {
  const [carga, setCarga] = useState<Carga>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  /**
   * **O ano em exibição** — `null` é "todos os anos".
   *
   * ⚠️ **Nasce sempre no ano corrente real**, e é por isso que ele é calculado
   * aqui e não lido de storage nenhum: "todos os anos" tem de custar um clique
   * consciente a cada sessão (critério 3 + Out of Scope). Não há `useEffect` que
   * o sobrescreva: quem o muda é só o seletor do shell.
   */
  const [ano, setAno] = useState<number | null>(() =>
    Number(hojeIso().slice(0, 4)),
  );
  /**
   * ⚠️ **CONTAI-058 — a rota é dependência do carregamento, e é isso que
   * conserta o dado velho.**
   *
   * Este layout não é remontado ao navegar dentro de `app/(gestao)/`: sem o
   * `pathname` aqui, o efeito rodava **uma vez** e o contexto ficava com o
   * número de antes até um F5. Foi o relato de 2026-09-26 (US-B): mudar
   * `quem_recolhe` de "a empresa" para "eu" corrigia o valor na tela da nota e
   * deixava o KPI da Visão geral contando o antigo. Cada rota de mutação tinha
   * o seu `tentarDeNovo` local, que só atualizava a própria tela.
   *
   * Por que **revalidar por rota** e não "invalidar o contexto" em cada
   * gravação: são 33 rotas e ~35 funções de escrita: a correção por lembrança
   * volta a falhar na próxima rota que alguém escrever (Pre-mortem 1 do
   * ticket). Aqui é estrutural — a rota mudou, o shell relê.
   *
   * ⚠️ **Sem `router.refresh()`**: ele refaz payload de RSC e PRESERVA estado de
   * client component, então o `useState` acima continuaria com o dado velho.
   */
  const pathname = usePathname();

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const [obras, painelPendencias] = await Promise.all([
          carregarObras(),
          carregarPainelDePendencias(),
        ]);
        if (cancelado) return;
        // Critério 6 do CONTAI-003: sem valor confiável de obra ativa o app
        // NÃO escolhe nenhuma — nem a primeira, nem a mais recente, nem a
        // única. Quem manda para `/obras` é a Visão geral; aqui o shell só
        // registra a ausência, porque `/obras` também mora dentro dele e
        // redirecionar daqui seria um laço.
        const ativa = escolherObraAtiva(obras, lerObraPreferida());
        const painel = ativa ? await carregarPainel(ativa.id) : null;
        const compromissos = ativa ? await carregarCompromissos(ativa.id) : [];
        if (cancelado) return;

        setCarga({
          fase: "pronto",
          painel,
          compromissos,
          pendencias: painelPendencias,
          obras: new Map(obras.map((o) => [o.id, o.nome])),
        });
      } catch (erro) {
        if (!cancelado) setCarga({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
    /**
     * ⚠️ **`pathname` entra, e `setEstado({ fase: "carregando" })` NÃO entra
     * aqui** (critério 4 do CONTAI-058): stale-while-revalidate. Quem zera para
     * loading é só o `tentarDeNovo` abaixo — o botão do estado de erro, onde o
     * Mateus PEDIU a recarga. Numa revalidação por navegação, apagar sidebar,
     * badge e KPIs a cada toque no menu trocaria um bug de dado velho por um
     * shell piscando em toda navegação.
     *
     * O `cancelado` do cleanup é o que faz a navegação em voo ser
     * **substituída** e não enfileirada: resposta superada não escreve estado
     * (critério 7).
     *
     * Falha na revalidação continua caindo no `catch` como `fase: "erro"` —
     * número velho mantido em silêncio seria o mesmo bug com outro nome
     * (critério 5).
     */
  }, [tentativa, pathname]);

  /**
   * **Onde o ano vira número em tela** (CONTAI-060, critério 4).
   *
   * Recalcular `calcularResumo` e `unificarPendencias` é aritmética sobre dados
   * já em memória — não há rede aqui, e é isso que faz o clique no seletor
   * atualizar KPI, badge, fila e tabela **na mesma renderização**.
   */
  const estado = useMemo<EstadoDaGestao>(() => {
    if (carga.fase !== "pronto") return carga;
    const hoje = hojeIso();
    /** "Hoje", que o seletor NÃO move — ver o cabeçalho do arquivo. */
    const anoReal = Number(hoje.slice(0, 4));
    /**
     * Sob "todos os anos" o cálculo recebe o ano real: `calcularResumo` precisa
     * de um número concreto (o acumulado é "até 31/12 de"), e nada novo é
     * somado — quem muda é o campo que o KPI rotula (spec do designer, item 2).
     */
    const anoDeCalculo = ano ?? anoReal;
    const painel = carga.painel;
    const resumo = painel
      ? // ⚠️ **Os dois anos, separados** (Gate 2 do CONTAI-060): `ano` é o
        // recorte de leitura; `anoCorrente` é o calendário, e é dele que sai a
        // fronteira "ano fechado × ano corrente" do informe do financiamento.
        // Passar o ano em tela nos dois rebaixaria `falta_lancar` (vermelha) a
        // `aguardando_informe` (âmbar) a partir de 01/01/2027.
        calcularResumo({ ...painel, ano: anoDeCalculo, anoCorrente: anoReal })
      : null;

    return {
      fase: "pronto",
      painel,
      resumo,
      agenda: montarAgendaDaHome(carga.compromissos, hoje),
      compromissos: carga.compromissos,
      unificadas: unificarPendencias({
        resumo,
        obra: painel?.obra ?? null,
        painel: carga.pendencias,
        // ⚠️ **`anoReal`, nunca `ano`**: é a fronteira "já declarado × ainda
        // corrigível sozinho" (`anosAfetados`, §5.3 do parecer de revisão), e
        // ela é do calendário, não da tela.
        anoCorrente: anoReal,
      }),
      obras: carga.obras,
      ano,
      anos: anosDaObra({ pagamentos: painel?.pagamentos ?? [] }, anoReal),
    };
  }, [carga, ano]);

  const tentarDeNovo = useCallback(() => {
    setCarga({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  /**
   * ⚠️ **Critério 2 — trocar de obra troca o contexto inteiro.** O layout de um
   * route group não é remontado ao navegar de `/obras` para `/`: sem esta
   * assinatura, escolher outra obra deixaria sidebar, badge e KPIs na obra
   * anterior. Número fiscal atribuído à obra errada é o defeito mais caro do
   * produto, e ele não avisa — só parece certo.
   */
  useEffect(() => observarObraPreferida(tentarDeNovo), [tentarDeNovo]);

  const escolherAno = useCallback((escolhido: number | null) => {
    setAno(escolhido);
  }, []);

  const contexto = useMemo(
    () => ({ estado, tentarDeNovo, escolherAno }),
    [estado, tentarDeNovo, escolherAno],
  );

  return <Contexto.Provider value={contexto}>{children}</Contexto.Provider>;
}
