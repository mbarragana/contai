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
 * ⚠️ **Nenhum cálculo fiscal nasce aqui.** Este módulo carrega e repassa:
 * `calcularResumo` e `unificarPendencias` continuam donos do que significa cada
 * número, e os textos continuam nas constantes de sempre.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import { escolherObraAtiva } from "@/lib/fiscal/obra";
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
      ano: number;
    };

interface ContextoDeGestao {
  estado: EstadoDaGestao;
  tentarDeNovo: () => void;
}

const Contexto = createContext<ContextoDeGestao>({
  estado: { fase: "carregando" },
  tentarDeNovo: () => {},
});

export function useGestao(): ContextoDeGestao {
  return useContext(Contexto);
}

export function ProvedorDeGestao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDaGestao>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

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

        const ano = Number(hojeIso().slice(0, 4));
        const resumo = painel ? calcularResumo({ ...painel, ano }) : null;

        setEstado({
          fase: "pronto",
          painel,
          resumo,
          agenda: montarAgendaDaHome(compromissos, hojeIso()),
          compromissos,
          unificadas: unificarPendencias({
            resumo,
            obra: painel?.obra ?? null,
            painel: painelPendencias,
            anoCorrente: ano,
          }),
          obras: new Map(obras.map((o) => [o.id, o.nome])),
          ano,
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
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

  return (
    <Contexto.Provider value={{ estado, tentarDeNovo }}>
      {children}
    </Contexto.Provider>
  );
}
