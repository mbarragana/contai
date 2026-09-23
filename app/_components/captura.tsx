"use client";

import type { ReactNode } from "react";

/**
 * **CONTAI-047 — as peças de TELA LARGA da captura (`app/(captura)/`).**
 *
 * Fonte do desenho: `design/mocks/captura-no-desktop-v1.md` + `.html`.
 *
 * ⚠️ **Tudo aqui é MOLDURA, nunca conteúdo.** Nenhum componente deste arquivo
 * decide campo, validação, texto fiscal ou ordem de pergunta — o ticket é
 * reflow de layout, mesma disciplina dos `CONTAI-043`-`046`. Quem for
 * acrescentar aqui uma pergunta, um default ou um banner de consequência está
 * no arquivo errado: consequência nasce inline, no card da pergunta que a gera
 * (Decisão 4 do mock, Pre-mortem 0 do ticket).
 *
 * ⚠️ **Um componente, duas larguras** — nunca um JSX por dispositivo. Abaixo de
 * `larga` (880px) tudo isto colapsa para a coluna única de 430px de sempre:
 * é a lição do `CONTAI-039`, e é o que mantém o piso de 375px intocado
 * (critério 10 do ticket, o "Teste do Canteiro" que NÃO perde peso aqui).
 */

/**
 * A largura da coluna do formulário, para as telas que **não** têm rail.
 *
 * ⚠️ **592, e não 556, e a diferença é o achado do Gate 2 do CONTAI-047.**
 * `Corpo` e `Rodape` carregam `px-[18px]` e o box do projeto é `border-box`:
 * um teto de 556 na CAIXA deixava 520px de conteúdo, enquanto a coluna
 * esquerda da `GradeDaCaptura` — que é um div SEM padding próprio, dentro do
 * `Corpo` — entregava 556. Duas larguras de formulário no mesmo app, a 36px de
 * distância, nascidas do mesmo nome de constante.
 *
 * 592 = 556 de conteúdo + as duas goteiras de 18px. Agora `/adicionar/
 * pagamento` e a coluna do formulário de `/adicionar/documento` medem a MESMA
 * linha de texto — que é o que `COLUNA_DO_FORMULARIO_CONTEUDO_PX` prova no
 * `e2e/shell-desktop.spec.ts`.
 *
 * Vai no `Corpo` **e** no `Rodape`: capar só o corpo deixaria o "Salvar" com
 * 900px embaixo de um campo de 556.
 */
export const COLUNA_DO_FORMULARIO = "larga:max-w-[592px]";

/**
 * ⚠️ **Stepper DECORATIVO — Decisão 2 do mock, e "decorativo" é o contrato.**
 *
 * Não é clicável, não navega, não é anunciado por leitor de tela
 * (`aria-hidden`), e **não substitui nem apaga** o "Passo X de Y" que as telas
 * já dizem: ele só aparece a partir de `larga`, onde sobra moldura para ele.
 * Nenhum texto de tela mudou — critério 3 ("zero mudança de texto ou número de
 * passo") continua valendo byte a byte no piso de 375px.
 *
 * ⚠️ A incoerência pré-existente entre "Passo 2 de 3" (AppBar) e "Passo 3 de 3"
 * (Rodapé) **não é consertada aqui**: o `po` mandou para a **D68** em
 * 2026-09-22. Quem vier consertá-la mexe nas telas, não neste componente.
 *
 * O formulário continua sendo **1 página com revelação progressiva** — fatiar
 * em wizard exigiria redesenhar a máquina de estados (`Fase`), que é o oposto
 * de reflow de layout.
 */
const PASSOS_DA_CAPTURA = [
  "Escolher tipo",
  "Preencher e anexar",
  "Confirmado",
] as const;

export function PassosDaCaptura({ atual }: { atual: 1 | 2 | 3 }) {
  return (
    <div
      data-stepper="captura"
      aria-hidden="true"
      className="hidden flex-none items-center border-b border-line bg-white px-[22px] py-3 larga:flex"
    >
      {PASSOS_DA_CAPTURA.map((rotulo, i) => {
        const numero = i + 1;
        const feito = numero < atual;
        const ativo = numero === atual;
        return (
          <div
            key={rotulo}
            className={`flex flex-1 items-center gap-2 text-[11.5px] ${
              ativo ? "font-bold text-ink" : "text-mut"
            }`}
          >
            <span
              className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[10.5px] ${
                feito
                  ? "border-grn bg-grn text-white"
                  : ativo
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white"
              }`}
            >
              {numero}
            </span>
            {rotulo}
            {numero < PASSOS_DA_CAPTURA.length ? (
              <span className="mx-1.5 h-px flex-1 bg-line" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A grade `formulário + rail` do mock (`.captura-grid`) — hoje só
 * `adicionar/documento`.
 *
 * ⚠️ **A ORDEM NO PISO É A DE HOJE, e é por isso que o rail vem primeiro no
 * DOM**: abaixo de `larga` a grade colapsa para uma coluna e o rail sobe para
 * cima do formulário (Decisão 5 do mock), reproduzindo o que o celular já
 * mostra — o anexo é o primeiro campo da tela desde sempre. Em `larga` o
 * `col-start`/`row-start` joga o rail para a DIREITA sem mexer no DOM: ordem de
 * leitura e ordem de tabulação continuam as mesmas nas duas larguras.
 *
 * `sticky` só em `larga`: no piso o rail é conteúdo que rola junto, como hoje.
 *
 * ⚠️ A coluna esquerda tem 556px porque este div **não tem padding próprio** —
 * ele já vive dentro do `px-[18px]` do `Corpo`. É o mesmo conteúdo útil de
 * `COLUNA_DO_FORMULARIO` (592 de caixa − 36 de goteira); mudar um dos dois sem
 * o outro devolve as duas larguras divergentes que o Gate 2 pegou.
 *
 * ⚠️ O rail **nunca** é onde uma pendência aparece pela primeira vez. Ele
 * espelha o que já foi afirmado; quarentena, gate de retenção, CNO de outra
 * obra e vínculo continuam inline, no card da pergunta (Decisão 4 do mock).
 */
export function GradeDaCaptura({
  rail,
  children,
}: {
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 larga:grid larga:grid-cols-[minmax(0,556px)_320px] larga:items-start larga:gap-x-7">
      <div
        data-captura="rail"
        className="flex min-w-0 flex-col gap-3 larga:col-start-2 larga:row-start-1 larga:sticky larga:top-0"
      >
        {rail}
      </div>
      <div
        data-captura="formulario"
        className="flex min-w-0 flex-col gap-3 larga:col-start-1 larga:row-start-1"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Dois campos **escalares curtos** lado a lado a partir de `larga` — critério 2
 * do ticket: datas, valor, número da nota, série, meio de pagamento.
 *
 * ⚠️ **Bloco de pergunta fiscal NÃO entra aqui.** A `Escolha` e o texto de
 * consequência que a acompanha (quarentena, gate de retenção, CNO impresso,
 * "pago sem nota") continuam em coluna única — é o Pre-mortem 1 do ticket, e é
 * o mesmo erro que o Gate 2 do `CONTAI-039` já achou uma vez: texto de
 * consequência perde legibilidade ao dividir a largura. Se o que você quer pôr
 * aqui dentro tem um `Banner`, uma `Consequencia` ou uma `Escolha` fiscal
 * junto, a resposta é não.
 */
export function CamposCurtos({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5 larga:grid larga:grid-cols-2 larga:items-start larga:gap-x-4">
      {children}
    </div>
  );
}

/**
 * Uma linha do resumo do rail — espelho do já afirmado, nunca inferência.
 *
 * `valor === null` é o estado normal do começo do preenchimento, e ele se
 * mostra: *"ainda não respondido"*, em itálico e em cinza. O que o resumo não
 * faz, em hipótese nenhuma, é **completar** — campo vazio pergunta, campo
 * preenchido afirma, e um resumo que chuta afirma pelo Mateus.
 */
export function LinhaDoResumo({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2.5 border-b border-dashed border-line py-1.5 text-[12.5px] last:border-b-0">
      <span className="flex-none text-mut">{rotulo}</span>
      {valor === null ? (
        <span className="text-right text-mut italic">ainda não respondido</span>
      ) : (
        <span className="min-w-0 text-right font-semibold break-words">
          {valor}
        </span>
      )}
    </div>
  );
}
