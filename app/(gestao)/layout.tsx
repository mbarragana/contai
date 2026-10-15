"use client";

import { ProvedorDeGestao } from "@/app/_components/gestao";
import { GuardaDePapel } from "@/app/_components/papel";
import { ShellDeGestao } from "@/app/_components/shell";

/**
 * **CONTAI-040 — a casca do grupo de gestão.**
 *
 * A separação mobile × desktop do produto é **estrutural, por rota**, e é aqui
 * que ela acontece: tudo sob `app/(gestao)/` — Visão geral, Despesas,
 * Pendências e Obras — abre dentro do shell; tudo sob `app/(captura)/` continua
 * nos 430px de sempre, sem sidebar nenhuma. A alternativa rejeitada
 * explicitamente pelo `cto-obra` no Gate 0 era duplicar a árvore de componentes
 * por `lg:`/media query dentro de uma página só — foi o que o `CONTAI-039`
 * tentou e o Mateus rejeitou.
 *
 * O provedor fica FORA do shell no aninhamento porque a sidebar também é
 * consumidora dele: obra aberta e badge de pendências saem do mesmo carregamento
 * que alimenta os painéis (Pre-mortem 3 do ticket).
 *
 * ⚠️ **CONTAI-093, critério 16 — a guarda de papel envolve o grupo inteiro.**
 * Gestão é do DONO: um colaborador que chegue aqui por URL direta é levado para
 * `/colaborador`.
 *
 * ⚠️ **Ela NÃO é um portão: o provedor carrega normalmente enquanto ela
 * decide** (ver o cabeçalho de `GuardaDePapel`). Quem protege o acervo é a RLS
 * do Postgres — para o colaborador, essa carga volta vazia —, e é por isso que
 * valeu mais não somar uma leitura bloqueante na frente de toda tela de gestão
 * do Mateus, que é o uso diário do app, do que encurtar um instante de shell
 * vazio num caso raro. O aninhamento por fora do provedor é organização de
 * responsabilidade (papel decide shell; provedor carrega conteúdo), não uma
 * economia de carregamento — afirmar o contrário seria descrever um portão
 * síncrono que este código deliberadamente não é.
 */
export default function GestaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuardaDePapel esperado="dono">
      <ProvedorDeGestao>
        <ShellDeGestao>{children}</ShellDeGestao>
      </ProvedorDeGestao>
    </GuardaDePapel>
  );
}
