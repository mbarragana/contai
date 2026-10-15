"use client";

import { GuardaDePapel } from "@/app/_components/papel";

/**
 * **CONTAI-093, critério 12 — a casca da área do colaborador, e o que ela NÃO
 * tem.**
 *
 * Terceiro route group do app, ao lado de `(gestao)` e `(captura)`. A escolha
 * da casca por pasta é a doutrina do `CONTAI-040`, e aqui ela carrega mais peso
 * do que largura: **não existe `ShellDeGestao` neste grupo**, logo não existe
 * sidebar, não existe faixa de navegação, não existe badge de pendências e não
 * existe link para Visão geral, `/despesas`, `/pendencias` ou relatório anual.
 *
 * ⚠️ **É ausência ESTRUTURAL, não botão escondido** (critério 12). A diferença
 * importa: um filtro de permissão escondendo itens de menu deixa o caminho
 * existindo — basta uma regressão num `if` para o colaborador reencontrar a
 * Home do dono. Aqui o componente que desenha esses caminhos não é importado
 * por arquivo nenhum desta pasta, e `lib/papel.test.ts` (critério 12) deixa a
 * suíte vermelha com o nome do arquivo que trouxer um de volta.
 *
 * ⚠️ A guarda inversa da de `(gestao)`: dono que cair aqui volta para `/`. O
 * caso existe por URL direta e por link velho — e, pela regra de
 * `papelDaSessao`, também para quem possui obra própria E colabora em obra de
 * terceiros (consequência aceita, Out of Scope do ticket).
 *
 * ── Largura ──────────────────────────────────────────────────────────────
 * 430px com teto de 940px a partir de `larga`, o mesmo par de `(captura)`
 * (`CONTAI-047`) e não o shell de 1244px: são duas telas de orientação, com um
 * cartão por obra e uma ação em cada — nada aqui preenche um dashboard. O
 * cenário do ticket diz que estas telas não são gestão nem captura; o piso de
 * 375px continua legível por default sadio de produto, não por doutrina.
 */
export default function ColaboradorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuardaDePapel esperado="colaborador">
      <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden larga:max-w-[940px]">
        {children}
      </div>
    </GuardaDePapel>
  );
}
