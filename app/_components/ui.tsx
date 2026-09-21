"use client";

/**
 * Peças visuais do mock v4 (design/mocks/CONTAI-001.html), mobile-first.
 * Alvos de toque ≥ 44px: canteiro, uma mão livre.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { urlDeEntrada } from "@/lib/auth";
import {
  SEM_RESPOSTA_NA_LEITURA,
  gravacaoFoiIncerta,
  type ErroDeTela,
} from "@/lib/data";
import {
  MS_ATE_AVISAR,
  MS_ATE_SEGUNDO_AVISO,
  TETO_DE_LEITURA_MS,
  nivelDeEspera,
  observarTentativaSemResposta,
} from "@/lib/rede";

export function AppBar({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <header className="flex-none border-b border-line px-[18px] pt-[14px] pb-[10px]">
      <h1 className="text-[16px] font-bold tracking-tight">{titulo}</h1>
      {sub ? <div className="mt-px text-[11.5px] text-mut">{sub}</div> : null}
    </header>
  );
}

export function Corpo({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-[18px] py-4">
      {children}
    </main>
  );
}

/**
 * Rodapé fixo: fica FORA do `Corpo` (que rola), no fluxo normal, e por
 * construção não cobre conteúdo nenhum.
 *
 * `env(safe-area-inset-bottom)` somado ao padding: em PWA standalone e em
 * aparelho com notch, o rodapé encostaria na barra de gestos do iOS e o alvo
 * ficaria embaixo dela.
 */
export function Rodape({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-none flex-col gap-2 border-t border-line px-[18px] pt-3 pb-[calc(18px+env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

/**
 * Barra fixa com "+ Adicionar" — critério 12 do CONTAI-018.
 *
 * Substitui o FAB `sticky bottom-0 mt-auto self-end` que existia SÓ na home.
 * O FAB morava DENTRO do `Corpo` (`overflow-y-auto` em `h-dvh`) e por isso
 * POUSAVA SOBRE O CONTEÚDO: na home cobria o acumulado da obra, e num detalhe
 * cobriria o botão de ação da tela. Esta barra usa o `Rodape`, que já é o
 * padrão de toda outra tela do app, está fora da área que rola e não pode
 * cobrir nada.
 *
 * Resolve as DUAS hipóteses do critério 12 de uma vez — "não renderiza no
 * aparelho dele" e "renderiza onde ele não olha" — sem depender de uma foto
 * da tela para escolher entre elas. E `/adicionar` passa a ser alcançável de
 * toda tela principal, não só da home: o relato ("não tem um link para
 * acessar a página /adicionar, o que é um absurdo") é sobre isso.
 */
export function BarraAdicionar({ voltar }: { voltar?: ReactNode }) {
  return (
    <Rodape>
      <div className="flex gap-2">
        {voltar ? <div className="flex-1">{voltar}</div> : null}
        <div className={voltar ? "flex-none" : "flex-1"}>
          <BotaoLink href="/adicionar">+ Adicionar</BotaoLink>
        </div>
      </div>
    </Rodape>
  );
}

export function Passo({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] tracking-[0.08em] text-mut uppercase">
      {children}
    </div>
  );
}

/**
 * `...resto` existe por um motivo específico, e não por generalidade: atributos
 * `data-*` em JSX **não são checados pelo TypeScript** (nome com hífen passa
 * sempre). Sem o spread, um `data-agendado` escrito aqui compilaria e sumiria
 * no runtime — e o E2E que procura por ele falharia sem explicação, do jeito
 * mais caro: parecendo bug da tela.
 */
export function Card({
  children,
  className = "",
  ...resto
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...resto}
      className={`rounded-[10px] border border-line bg-white px-[14px] py-3 ${className}`}
    >
      {children}
    </div>
  );
}

const CORES_CHIP = {
  red: "text-red bg-red-bg",
  amb: "text-amb bg-amb-bg",
  grn: "text-grn bg-grn-bg",
} as const;

const CORES_CHIP_VAZADO = {
  red: "text-red bg-transparent border border-red",
  amb: "text-amb bg-transparent border border-amb",
  grn: "text-grn bg-transparent border border-grn",
} as const;

export function Chip({
  cor,
  vazado = false,
  children,
}: {
  cor: keyof typeof CORES_CHIP;
  /**
   * Chip VAZADO — CONTAI-019, critério 8b: agendado aberto usa âmbar vazado e
   * o vencido usa âmbar PREENCHIDO.
   *
   * ⚠️ O preenchimento é o QUARTO canal de distinção, não o primeiro (decisão 2
   * do fechamento de 18/08): "sozinho é um canal só e falha no sol". O peso
   * está no texto do chip e em as três respostas existirem só no vencido. Aqui
   * ele é reforço.
   */
  vazado?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-full px-[9px] py-0.5 text-[11px] font-semibold ${
        vazado ? CORES_CHIP_VAZADO[cor] : CORES_CHIP[cor]
      }`}
    >
      {children}
    </span>
  );
}

export function Consequencia({
  cor,
  children,
}: {
  /**
   * `grn` entrou no CONTAI-005: a frase de fechamento do card de INSS ("estas
   * notas continuam valendo integralmente como custo de aquisição no IRPF") é
   * uma consequência **boa**, e pintá-la de âmbar ao lado do aviso âmbar logo
   * acima faria as duas lerem como o mesmo alerta.
   */
  cor: "red" | "amb" | "grn";
  children: ReactNode;
}) {
  return (
    <p
      className={`mt-1.5 rounded-lg px-2.5 py-2 text-[12.5px] ${CORES_CHIP[cor]}`}
    >
      {children}
    </p>
  );
}

export function Banner({
  cor,
  children,
  role,
}: {
  cor: "red" | "amb" | "grn";
  children: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className={`rounded-[10px] px-[14px] py-3 text-[13.5px] ${CORES_CHIP[cor]}`}
    >
      {children}
    </div>
  );
}

export function Linha({
  rotulo,
  children,
}: {
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-[9px] last:border-b-0">
      <span className="flex-none text-[12px] text-mut">{rotulo}</span>
      <span className="text-right text-[13.5px]">{children}</span>
    </div>
  );
}

export function Dica({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-mut">{children}</p>;
}

const CORES_BOTAO = {
  primary: "bg-ink text-paper border-transparent",
  ghost: "bg-transparent text-ink border-line",
} as const;

type VarianteBotao = keyof typeof CORES_BOTAO;

const BASE_BOTAO =
  "block w-full min-h-[44px] rounded-[10px] border px-[14px] py-[13px] text-center text-[14.5px] font-semibold disabled:opacity-50";

export function Botao({
  variante = "primary",
  children,
  ...props
}: {
  variante?: VarianteBotao;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${BASE_BOTAO} ${CORES_BOTAO[variante]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function BotaoLink({
  href,
  variante = "ghost",
  children,
}: {
  href: string;
  variante?: VarianteBotao;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE_BOTAO} ${CORES_BOTAO[variante]}`}>
      {children}
    </Link>
  );
}

/**
 * ⚠️ Banner de falha de GRAVAÇÃO — CONTAI-006, critério 6.
 *
 * `antes` e `depois` são o que a tela sempre disse em volta da mensagem: de um
 * lado *"Não deu para gravar."*, do outro *"Nada foi alterado — o que você
 * preencheu continua aqui."* As duas frases valem quando o servidor RECUSOU.
 * Quando ele não respondeu nada, elas viram afirmação sem base — e é
 * exatamente a afirmação que faz o Mateus tocar "Salvar" de novo e duplicar o
 * registro. No caso incerto, a mensagem fica sozinha.
 */
export function ErroDeGravacao({
  mensagem,
  antes,
  depois,
}: {
  mensagem: string;
  antes?: ReactNode;
  depois?: ReactNode;
}) {
  const incerto = gravacaoFoiIncerta(mensagem);
  return (
    <Banner cor="red" role="alert">
      {incerto ? null : antes}
      {mensagem}
      {incerto ? null : depois}
    </Banner>
  );
}

/**
 * ⚠️ Botão de "Salvar" com estado de espera — CONTAI-006, critério 6.
 *
 * Gravação é tratada À PARTE da leitura, e o que muda aos ~2 s não é só o
 * rótulo: entra o aviso de NÃO RECARREGAR. Recarregar no meio de um "Salvando"
 * é a hipótese por trás da duplicação que o uso real produziu, e o momento em
 * que ele faz isso é justamente quando a tela parece travada.
 *
 * O aviso não cabe no rótulo (375px quebraria), então vira linha auxiliar
 * abaixo do botão — decisão 5 do spec de design.
 *
 * `ocupado` é separado de `disabled` de propósito: `disabled` continua sendo o
 * que cada tela já calcula (campo faltando, escolha não feita), e `ocupado` é
 * só "há uma gravação em curso".
 */
function useEsperaLonga(ocupado: boolean): boolean {
  const [demorou, setDemorou] = useState(false);
  // Zerar no RENDER e não num efeito: é o padrão do React para estado que
  // acompanha uma prop (e o que o `react-hooks/set-state-in-effect` cobra).
  // Sem isto, a segunda tentativa de salvar já nasceria "Ainda salvando…".
  const [ocupadoVisto, setOcupadoVisto] = useState(ocupado);
  if (ocupadoVisto !== ocupado) {
    setOcupadoVisto(ocupado);
    setDemorou(false);
  }

  useEffect(() => {
    if (!ocupado) return;
    const relogio = setTimeout(() => setDemorou(true), MS_ATE_AVISAR);
    return () => clearTimeout(relogio);
  }, [ocupado]);

  return ocupado && demorou;
}

/**
 * O aviso sozinho, para os grupos em que o "Salvar" não é UM botão.
 *
 * Duas telas respondem a uma pergunta com vários botões de mesmo peso (a
 * sugestão de quitação e as resoluções de diferença do pagamento). Trocar o
 * rótulo de todos eles por "Ainda salvando…" mentiria sobre qual foi tocado —
 * ali só o aviso faz sentido, uma vez, abaixo do grupo.
 */
export function AvisoDeGravacao({ ocupado }: { ocupado: boolean }) {
  return useEsperaLonga(ocupado) ? (
    <Dica>Não feche nem recarregue a página.</Dica>
  ) : null;
}

export function BotaoSalvar({
  ocupado,
  rotuloDemora = "Ainda salvando…",
  children,
  ...props
}: {
  ocupado: boolean;
  /** Só onde "salvando" seria a palavra errada — remover uma linha, p.ex. */
  rotuloDemora?: string;
} & React.ComponentProps<typeof Botao>) {
  const esperando = useEsperaLonga(ocupado);
  return (
    <>
      <Botao {...props} disabled={props.disabled || ocupado}>
        {esperando ? rotuloDemora : children}
      </Botao>
      {esperando ? <Dica>Não feche nem recarregue a página.</Dica> : null}
    </>
  );
}

/**
 * ⚠️ Estado de carregando — e, a partir do CONTAI-006, a máquina de estados
 * inteira da espera de LEITURA.
 *
 * O achado que originou o ticket tem uma palavra no meio: *mentira*. A tela
 * dizia "Carregando a obra" durante 7,7 s quando, a partir do primeiro
 * segundo, já sabia que a primeira tentativa tinha falhado.
 *
 * Quatro níveis, e a ordem entre eles é o critério 2:
 *
 * 0. esqueleto, com o rótulo específico da tela — 0 a ~2 s;
 * 1. **a primeira tentativa falhou OU passaram 2 s, o que vier primeiro** — o
 *    esqueleto SOME (decisão 1 do spec: barra cinza ao lado do aviso sugeriria
 *    "quase pronto", que é a mesma mentira com outra cara);
 * 2. segunda tentativa sem sucesso — o texto admite que pode demorar mais, que
 *    é o caso do projeto acordando de pausa (critério 7, CONTAI-012);
 * 3. **teto atingido** — erro acionável, com saída (critério 3).
 *
 * `onTentarDeNovo` é opcional, e a ausência dele NÃO pode virar tela sem saída:
 * sem callback, o botão recarrega a rota. É a defesa contra o Pre-mortem 1 ("o
 * teto é implementado só na home"): toda tela que renderiza este componente
 * ganha teto e saída, mesmo que alguém esqueça de ligar o retry dela.
 *
 * O nível 3 não encerra a promessa que roda por baixo — se a resposta chegar
 * depois, a tela troca para o conteúdo sozinha.
 *
 * ⚠️ Limitação conhecida (aceita no Gate 2 do CONTAI-006): o relógio dos níveis
 * é o do COMPONENTE, não o de uma requisição — uma tela que faz N leituras
 * sequenciais lentas-mas-vivas (cada uma abaixo do teto) chega ao nível 3 sem
 * que nenhuma leitura tenha falhado. Não é bug fantasma; é esta escolha.
 */
export function Carregando({
  rotulo,
  onTentarDeNovo,
}: {
  rotulo: string;
  onTentarDeNovo?: () => void;
}) {
  // Só plumbing: quem decide qual texto sai é `nivelDeEspera`, em lib/rede.ts,
  // que é função pura e tem teste.
  const [decorrido, setDecorrido] = useState(0);
  const [falhas, setFalhas] = useState(0);
  const [ciclo, setCiclo] = useState(0);
  const nivel = nivelDeEspera(decorrido, falhas);

  useEffect(() => {
    const marcar = (ms: number) =>
      setTimeout(() => setDecorrido((d) => (d >= ms ? d : ms)), ms);
    const relogios = [
      marcar(MS_ATE_AVISAR),
      marcar(MS_ATE_SEGUNDO_AVISO),
      marcar(TETO_DE_LEITURA_MS),
    ];
    const parar = observarTentativaSemResposta(() => setFalhas((f) => f + 1));
    return () => {
      for (const relogio of relogios) clearTimeout(relogio);
      parar();
    };
  }, [ciclo]);

  const tentarDeNovo = useCallback(() => {
    if (!onTentarDeNovo) {
      window.location.reload();
      return;
    }
    // Zera aqui, no manipulador do toque, e não dentro do efeito: o efeito só
    // agenda relógios e assina o aviso de tentativa.
    setDecorrido(0);
    setFalhas(0);
    setCiclo((c) => c + 1);
    onTentarDeNovo();
  }, [onTentarDeNovo]);

  if (nivel >= 3) {
    return (
      <div className="flex flex-col gap-3">
        <Banner cor="red" role="alert">
          {SEM_RESPOSTA_NA_LEITURA}
        </Banner>
        <Botao variante="ghost" onClick={tentarDeNovo}>
          Tentar de novo
        </Botao>
      </div>
    );
  }

  if (nivel >= 1) {
    return (
      <div role="status" aria-label={rotulo}>
        <Dica>
          {nivel >= 2
            ? "Ainda tentando. Se o servidor estava inativo por um tempo, isso pode levar mais alguns segundos que o normal."
            : "Sem resposta do servidor — tentando de novo."}
        </Dica>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="status" aria-label={rotulo}>
      <div className="skel h-[13px] w-[70%]" />
      <div className="skel h-[13px] w-[90%]" />
      <div className="skel h-[13px] w-[55%]" />
      <div className="skel h-[13px] w-[80%]" />
    </div>
  );
}

/**
 * Estado de erro — sempre com saída, nunca tela morta.
 *
 * Tela 5 do mock CONTAI-002: "sem sessão" e "banco fora" são DOIS erros, com
 * duas saídas. Botão "Tentar de novo" em cima de falta de sessão é uma porta
 * que não abre — quem bate nela três vezes desiste de registrar a nota, e
 * custo não comprovado não existe na declaração.
 */
export function EstadoErro({
  erro,
  onTentarDeNovo,
}: {
  erro: ErroDeTela;
  onTentarDeNovo?: () => void;
}) {
  // `usePathname` e não `window.location`: seguro no render do servidor. A
  // query string do deep link é preservada pelo portão de sessão, que roda no
  // browser (app/_components/sessao.tsx).
  const caminho = usePathname();

  if (erro.tipo === "sem_sessao") {
    return (
      <Card>
        <Chip cor="amb">Sua sessão terminou</Chip>
        <Consequencia cor="amb">
          Entre de novo para ver a obra. Nada foi perdido: seus documentos e
          pagamentos continuam guardados.
        </Consequencia>
        <div className="mt-2.5">
          <BotaoLink href={urlDeEntrada(caminho)}>Entrar</BotaoLink>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Banner cor="red" role="alert">
        {erro.mensagem}
      </Banner>
      {onTentarDeNovo ? (
        <Botao variante="ghost" onClick={onTentarDeNovo}>
          Tentar de novo
        </Botao>
      ) : null}
    </div>
  );
}
