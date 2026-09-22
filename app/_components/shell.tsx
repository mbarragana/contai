"use client";

/**
 * **CONTAI-040 — o shell de gestão: sidebar permanente + barra superior.**
 *
 * Fonte do desenho: `design/mocks/desktop-shell-v1.md` (seção "Shell de
 * navegação") e `design/mocks/desktop-shell-v1.html`.
 *
 * ⚠️ **UM componente de shell, não dois** (Pre-mortem 4 do ticket). A separação
 * mobile × desktop do produto é por ROTA (`app/(gestao)/` × `app/(captura)/`);
 * aqui dentro a responsividade é CSS de um componente só — a mesma lista de
 * navegação sai como coluna escura de 264px em `lg` e como **faixa superior**
 * abaixo disso. Nenhum componente decide "sou mobile ou desktop" e bifurca o
 * JSX: isso foi o CONTAI-039, que o Mateus rejeitou.
 *
 * ⚠️ **A faixa estreita não é concessão de estilo, é a porta do canteiro**
 * (critério 6, achado do `cto-obra` no Gate 0). *"Pode quebrar o mobile"*
 * autoriza densidade e layout feios no celular — **não** autoriza o canteiro a
 * perder a entrada de `/adicionar`. Por isso o botão da faixa leva **direto**
 * para `/adicionar` (um toque, e é lá que moram as três portas), enquanto no
 * desktop ele abre o menu de três opções que substitui aquela tela.
 *
 * ⚠️ **A sidebar é idêntica em toda tela do grupo**: nenhum item de navegação
 * nasce ou morre a partir do conteúdo carregado (spec de design). O que muda
 * com o dado é o badge (contagem) e o bloco "Obra aberta" — nunca a lista.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  ProvedorDeCabecalho,
  useCabecalhoDaTela,
} from "@/app/_components/detalhe";
import { useGestao } from "@/app/_components/gestao";
import { useSessao } from "@/app/_components/sessao";
import {
  OPCOES_DE_REGISTRO,
  VIEWS_DE_GESTAO,
  ehViewAtiva,
  migalhaDaRota,
  subtituloDaView,
  tituloDaView,
} from "@/lib/gestao/navegacao";

/**
 * O provedor de cabeçalho fica FORA da moldura pela mesma razão que o
 * `ProvedorDeGestao` fica fora do shell: quem consome o título é o topbar, que
 * é irmão do conteúdo — não descendente dele (CONTAI-043).
 */
export function ShellDeGestao({ children }: { children: React.ReactNode }) {
  return (
    <ProvedorDeCabecalho>
      <MolduraDeGestao>{children}</MolduraDeGestao>
    </ProvedorDeCabecalho>
  );
}

function MolduraDeGestao({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { estado } = useGestao();
  const { email, sairDaConta } = useSessao();

  const pronto = estado.fase === "pronto" ? estado : null;
  const obra = pronto?.painel?.obra ?? null;
  const abertas = pronto?.unificadas.abertas ?? null;
  const ano = pronto?.ano ?? null;

  /**
   * ⚠️ **A tela de detalhe vence a rota, e as duas partes vêm juntas.** Quando
   * uma tela publica o próprio cabeçalho (`CabecalhoDaTela`), o subtítulo é o
   * dela — nunca o `nome da obra · ano` da view. Misturar os dois poria o nome
   * da obra ABERTA embaixo do título de um documento que pode ser de OUTRA
   * obra (Pre-mortem 1 do CONTAI-043): a tela de detalhe lê a obra do próprio
   * documento, e o shell não a reescreve.
   */
  const daTela = useCabecalhoDaTela();
  const titulo = daTela?.titulo ?? tituloDaView(pathname);
  const subtitulo = daTela
    ? (daTela.sub ?? null)
    : subtituloDaView(pathname, {
        nomeDaObra: obra?.nome ?? null,
        ano,
        abertas,
      });
  const migalha = migalhaDaRota(pathname);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden lg:flex-row">
      {/* ── SIDEBAR (lg+) ──────────────────────────────────────────────── */}
      <aside
        data-shell="sidebar"
        className="hidden w-[264px] flex-none flex-col border-r border-side-line bg-side-bg text-side-text lg:flex"
      >
        <div className="px-[22px] pt-5 pb-4 text-[17px] font-bold tracking-tight text-white">
          contai
        </div>

        <BlocoObraAberta />

        <nav aria-label="Navegação principal" className="flex flex-col gap-0.5 px-2.5 py-1">
          {VIEWS_DE_GESTAO.map((v) => {
            const ativa = ehViewAtiva(pathname, v.href);
            return (
              <Link
                key={v.href}
                href={v.href}
                aria-current={ativa ? "page" : undefined}
                className={`flex min-h-[38px] items-center justify-between gap-2 rounded-lg border px-3 py-[9px] text-[13.5px] ${
                  ativa
                    ? "border-side-line bg-side-active text-white"
                    : "border-transparent hover:bg-side-active"
                }`}
              >
                {v.rotulo}
                {v.href === "/pendencias" ? <Badge abertas={abertas} /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mx-4 my-3.5 h-px bg-side-line" />

        <nav aria-label="Navegação secundária" className="flex flex-col gap-0.5 px-2.5">
          <LinkSecundario href={obra ? `/obras/${obra.id}` : null}>
            Dados da obra — matrícula e CNO
          </LinkSecundario>
          <LinkSecundario href={obra ? `/obras/${obra.id}/terreno` : null}>
            Terreno — desembolsos e informes
          </LinkSecundario>
          <LinkSecundario href="/conta">Sua conta</LinkSecundario>
          {/* Único caminho até a saída (critério 6 do CONTAI-002): logout que
              não se encontra é logout que não existe. Botão e não link: sair é
              um ato, e `/conta` continua sendo onde a consequência de sair
              está escrita por extenso. */}
          <button
            type="button"
            onClick={() => void sairDaConta()}
            className="rounded-lg px-3 py-[7px] text-left text-[12.5px] text-side-mut hover:bg-side-active hover:text-side-text"
          >
            Sair
          </button>
        </nav>

        <div className="mt-auto px-[22px] pt-3.5 pb-[18px] text-[11px] text-side-mut">
          {email ?? "sessão ativa"}
        </div>
      </aside>

      {/* ── FAIXA MÍNIMA (abaixo de lg) — critério 6 ───────────────────── */}
      <nav
        data-shell="faixa"
        aria-label="Navegação principal"
        className="flex flex-none items-center gap-1 border-b border-side-line bg-side-bg px-2 py-1.5 lg:hidden"
      >
        {/* ⚠️ Só as VIEWS rolam. O `overflow-x-auto` vive aqui dentro, e não
            na faixa inteira, porque quando os dois dividiam o mesmo contêiner
            rolável o "+ Novo registro" (empurrado por `ml-auto`) nascia fora
            da área visível — `scrollLeft: 0` — assim que o conteúdo passava
            de 375px. Bastava o badge de pendências com 2 dígitos ou uma fonte
            de fallback mais larga (Linux/CI) para a porta do canteiro exigir
            rolagem horizontal para existir. */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {VIEWS_DE_GESTAO.map((v) => {
            const ativa = ehViewAtiva(pathname, v.href);
            return (
              <Link
                key={v.href}
                href={v.href}
                aria-current={ativa ? "page" : undefined}
                className={`flex min-h-[44px] flex-none items-center gap-1.5 rounded-lg px-2.5 text-[13px] whitespace-nowrap ${
                  ativa ? "bg-side-active text-white" : "text-side-text"
                }`}
              >
                {v.rotulo}
                {v.href === "/pendencias" ? <Badge abertas={abertas} /> : null}
              </Link>
            );
          })}
        </div>
        {/* A porta do canteiro, em UM toque e em qualquer largura: irmão do
            rolável, nunca filho dele. */}
        <Link
          href="/adicionar"
          className="flex min-h-[44px] flex-none items-center rounded-lg bg-paper px-3 text-[13px] font-semibold whitespace-nowrap text-ink"
        >
          + Novo registro
        </Link>
      </nav>

      {/* ── CONTEÚDO ───────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-none items-center justify-between gap-4 border-b border-line px-[18px] py-3 lg:px-9 lg:py-[18px]">
          <div className="min-w-0">
            {/* O "‹ Despesas" do mock: a saída da tela de detalhe, sempre para
                uma rota real. Some nas views de primeira classe, que já são o
                topo da navegação. */}
            {migalha ? (
              <Link
                data-crumb="voltar"
                href={migalha.href}
                className="mb-[5px] inline-block text-[12px] text-mut hover:text-ink hover:underline"
              >
                ‹ {migalha.rotulo}
              </Link>
            ) : null}
            <h1 className="text-[16px] tracking-tight lg:text-[19px]">
              {titulo}
            </h1>
            {subtitulo ? (
              <div className="mt-0.5 text-[11.5px] text-mut lg:text-[12px]">
                {subtitulo}
              </div>
            ) : null}
          </div>
          {/* ⚠️ Só em `lg`: abaixo disso a faixa acima já leva a `/adicionar`,
              e dois "+ Novo registro" na mesma tela seriam dois alvos para a
              mesma coisa. */}
          <div className="hidden flex-none lg:block">
            <MenuNovoRegistro />
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-[18px] py-4 lg:px-9 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * O badge de pendências abertas — **vermelhas + âmbares**, nunca os avisos
 * (`PendenciasUnificadas.abertas`, `CONTAI-042`): badge é cobrança, e o aviso
 * informativo não cobra nada.
 *
 * Some enquanto a carga não terminou e no zero: número que ainda não foi
 * apurado não pode aparecer como se fosse apuração.
 */
function Badge({ abertas }: { abertas: number | null }) {
  if (abertas === null || abertas === 0) return null;
  return (
    <span
      data-badge="pendencias"
      className="min-w-[18px] flex-none rounded-full bg-red px-[7px] py-px text-center text-[10.5px] font-bold text-white"
    >
      {abertas}
    </span>
  );
}

function LinkSecundario({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  const classe = "rounded-lg px-3 py-[7px] text-[12.5px]";
  // Sem obra aberta não existe `/obras/[id]` para apontar. O item continua na
  // lista (a sidebar é idêntica em toda tela) — o que ele não faz é fingir um
  // destino: link que não abre é pior que item apagado.
  if (href === null) {
    return (
      <span className={`${classe} text-side-mut opacity-50`}>
        {children} — abra uma obra
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${classe} text-side-mut hover:bg-side-active hover:text-side-text`}
    >
      {children}
    </Link>
  );
}

/**
 * O bloco "Obra aberta" da sidebar — nome, CNO, ano e o escape para trocar.
 *
 * ⚠️ Mesmo mecanismo de troca de obra de sempre: a escolha explícita mora em
 * `/obras` (`gravarObraPreferida`), e não há `select` nenhum aqui — seletor
 * convida a trocar sem querer, e documento na obra errada é descoberto tarde
 * demais para consertar de graça (CONTAI-003).
 */
function BlocoObraAberta() {
  const { estado } = useGestao();
  const pronto = estado.fase === "pronto" ? estado : null;
  const obra = pronto?.painel?.obra ?? null;

  return (
    <div
      data-shell="obra-aberta"
      className="mx-3.5 mb-3.5 rounded-[10px] border border-side-line bg-side-active p-3"
    >
      <div className="text-[10.5px] tracking-[0.06em] text-side-mut uppercase">
        Obra aberta
      </div>
      {obra ? (
        <>
          <div className="mt-0.5 text-[13.5px] font-semibold text-white">
            {obra.nome}
          </div>
          <div className="mono mt-0.5 text-[11.5px] text-side-mut">
            {obra.cno ? `CNO ${obra.cno}` : "sem CNO"}
            {pronto ? ` · ano ${pronto.ano}` : ""}
          </div>
          <Link
            href="/obras"
            className="mt-2 block rounded-[7px] border border-side-line px-2 py-[5px] text-center text-[11.5px] text-side-text hover:bg-side-line"
          >
            Trocar obra
          </Link>
        </>
      ) : (
        <>
          <div className="mt-0.5 text-[13.5px] font-semibold text-white">
            {estado.fase === "pronto" ? "Nenhuma obra aberta" : "Carregando…"}
          </div>
          <Link
            href="/obras"
            className="mt-2 block rounded-[7px] border border-side-line px-2 py-[5px] text-center text-[11.5px] text-side-text hover:bg-side-line"
          >
            Escolher obra
          </Link>
        </>
      )}
    </div>
  );
}

/**
 * "+ Novo registro" — o ponto de entrada de registro no desktop (critério 5).
 *
 * Substitui a `BarraAdicionar` fixa do rodapé, que é peça do fluxo de 430px.
 * As três opções são as mesmas de `/adicionar`, com os mesmos rótulos e as
 * mesmas descrições; a tela de captura em si não muda.
 */
function MenuNovoRegistro() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", escape);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        aria-haspopup="menu"
        onClick={() => setAberto((a) => !a)}
        className="min-h-[38px] rounded-[9px] bg-ink px-[15px] py-[9px] text-[13.5px] font-semibold text-paper"
      >
        + Novo registro
      </button>
      {aberto ? (
        <div
          role="menu"
          className="absolute top-[calc(100%+6px)] right-0 z-20 w-[300px] rounded-[10px] border border-line bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,.14)]"
        >
          {OPCOES_DE_REGISTRO.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              role="menuitem"
              onClick={() => setAberto(false)}
              className="block rounded-lg px-2.5 py-[9px] text-[13px] hover:bg-soft"
            >
              <span className="font-semibold">{o.rotulo}</span>
              <span className="mt-px block text-[11.5px] font-normal text-mut">
                {o.descricao}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
