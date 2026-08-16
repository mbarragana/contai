"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { FluxoEntrar } from "@/app/_components/entrar";
import { AppBar, Banner, Carregando, Corpo } from "@/app/_components/ui";
import { ROTA_ENTRAR, urlDeEntrada } from "@/lib/auth";
import { assinarMudancaDeSessao, sair, sessaoAtual } from "@/lib/sessao";

/**
 * O portão de sessão (CONTAI-002, critérios 4 e 5) — e o que fazer quando ela
 * cai no meio do caminho.
 *
 * O que guarda os dados é a RLS do Postgres (`user_id = auth.uid()` em toda
 * tabela): sem sessão, o servidor não devolve linha nenhuma, e isso vale
 * mesmo que este componente seja contornado. O portão aqui é UX — ele existe
 * para a rota pedida não virar uma tela de erro, e para a rota pedida ser
 * RETOMADA depois do login (o deep link do lembrete da agenda não pode cair
 * na home).
 *
 * Duas situações, dois comportamentos, e a diferença é fiscal:
 *
 * 1. Chegou sem sessão → vai para /entrar levando o caminho pedido. Não há o
 *    que perder: nada foi digitado ainda.
 * 2. A sessão caiu com a tela JÁ montada → sobreposto de reautenticação, SEM
 *    navegar. Navegar desmontaria o formulário de documento/pagamento e o que
 *    foi digitado sumiria — e documento que não se registra no canteiro tende
 *    a não ser registrado nunca (IN SRF 84/2001 art. 17: custo não comprovado
 *    não existe). É a tela 6 do mock.
 */

type Estado =
  | { fase: "verificando" }
  | { fase: "dentro"; email: string | null }
  | { fase: "fora" }
  | { fase: "reautenticar" };

interface ContextoSessao {
  /** E-mail do dono da sessão, para a tela de conta. */
  email: string | null;
  /** Saída deliberada: apaga a sessão e vai para o login (critério 6). */
  sairDaConta: () => Promise<void>;
  /**
   * Pede o sobreposto de reautenticação SEM sair da tela — para quem descobriu
   * a sessão morta ao tentar salvar um formulário já preenchido.
   */
  pedirReautenticacao: () => void;
}

const Contexto = createContext<ContextoSessao>({
  email: null,
  sairDaConta: async () => {},
  pedirReautenticacao: () => {},
});

export function useSessao(): ContextoSessao {
  return useContext(Contexto);
}

/** Caminho + query da rota atual. Só roda no browser. */
function caminhoAtual(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function PortaoSessao({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<Estado>({ fase: "verificando" });
  // Ref e não estado: o assinante do SDK é criado uma vez e precisa ler a fase
  // do momento em que o evento chega, não a do render em que ele foi criado.
  const faseRef = useRef<Estado["fase"]>("verificando");
  const saidaVoluntariaRef = useRef(false);

  function aplicar(novo: Estado) {
    faseRef.current = novo.fase;
    setEstado(novo);
  }

  useEffect(() => {
    let cancelado = false;

    void (async () => {
      try {
        const sessao = await sessaoAtual();
        if (cancelado) return;
        aplicar(
          sessao
            ? { fase: "dentro", email: sessao.user.email ?? null }
            : { fase: "fora" },
        );
      } catch {
        // getSession só falha se o storage estiver inacessível; tratar como
        // "sem sessão" leva ao login, que é a saída certa.
        if (!cancelado) aplicar({ fase: "fora" });
      }
    })();

    const assinatura = assinarMudancaDeSessao((sessao) => {
      if (cancelado) return;
      if (sessao) {
        aplicar({ fase: "dentro", email: sessao.user.email ?? null });
        return;
      }
      // Perdeu a sessão com a tela montada e sem ter pedido para sair: é o
      // caso do formulário no meio (tela 6) — sobreposto, nunca navegação.
      if (faseRef.current === "dentro" && !saidaVoluntariaRef.current) {
        aplicar({ fase: "reautenticar" });
        return;
      }
      aplicar({ fase: "fora" });
    });

    return () => {
      cancelado = true;
      assinatura.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (estado.fase !== "fora") return;
    if (pathname === ROTA_ENTRAR) return;

    let cancelado = false;
    void (async () => {
      // Recheca antes de mandar embora: entre o evento e este efeito o login
      // pode ter acabado de acontecer, e voltar para /entrar seria um laço.
      const sessao = await sessaoAtual().catch(() => null);
      if (cancelado) return;
      if (sessao) {
        aplicar({ fase: "dentro", email: sessao.user.email ?? null });
        return;
      }
      if (saidaVoluntariaRef.current) {
        saidaVoluntariaRef.current = false;
        router.replace(ROTA_ENTRAR);
        return;
      }
      // Critério 4: o caminho pedido (com a query) volta no `destino`.
      router.replace(urlDeEntrada(caminhoAtual()));
    })();

    return () => {
      cancelado = true;
    };
  }, [estado.fase, pathname, router]);

  const sairDaConta = useCallback(async () => {
    saidaVoluntariaRef.current = true;
    try {
      await sair();
    } finally {
      aplicar({ fase: "fora" });
    }
  }, []);

  /**
   * Nem toda morte de sessão vem com evento: cookie expirado ou apagado pelo
   * ITP some em silêncio, e quem descobre é a primeira gravação. Quando isso
   * acontece no "Salvar", o formulário chama aqui — sobreposto, sem navegar,
   * com tudo que foi digitado ainda montado atrás.
   */
  const pedirReautenticacao = useCallback(() => {
    if (faseRef.current === "reautenticar") return;
    aplicar({ fase: "reautenticar" });
  }, []);

  // A tela de login é a única rota que dispensa sessão — e precisa ficar
  // acessível justamente quando não há nenhuma.
  if (pathname === ROTA_ENTRAR) {
    return (
      <Contexto.Provider
        value={{ email: null, sairDaConta, pedirReautenticacao }}
      >
        {children}
      </Contexto.Provider>
    );
  }

  if (estado.fase === "verificando" || estado.fase === "fora") {
    return (
      <>
        <AppBar titulo="contai" sub="Verificando sua sessão" />
        <Corpo>
          <Carregando rotulo="Verificando a sessão" />
        </Corpo>
      </>
    );
  }

  return (
    <Contexto.Provider
      value={{
        email: estado.fase === "dentro" ? estado.email : null,
        sairDaConta,
        pedirReautenticacao,
      }}
    >
      {children}
      {estado.fase === "reautenticar" ? <SobrepostoReautenticar /> : null}
    </Contexto.Provider>
  );
}

/**
 * Tela 6 do mock: a sessão caiu enquanto ele preenchia. O formulário continua
 * montado ATRÁS deste sobreposto — é isso que preserva anexo, valor e as
 * respostas dos checks fiscais.
 */
function SobrepostoReautenticar() {
  return (
    <div className="fixed inset-0 z-50 bg-ink/30">
      <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-paper">
        <AppBar
          titulo="Sua sessão terminou"
          sub="Entre de novo — o que você digitou continua aqui"
        />
        <FluxoEntrar
          // Sem navegação nenhuma: fechar o sobreposto devolve o formulário
          // exatamente como estava.
          aoEntrar={() => {}}
          aviso={
            <>
              <Banner cor="amb" role="alert">
                <strong>Sua sessão terminou enquanto você preenchia.</strong>{" "}
                Entre de novo — o que você digitou continua aqui.
              </Banner>
              <p className="rounded-lg border border-dashed border-grn bg-grn-bg px-2.5 py-2 text-[12.5px] text-grn">
                Nada foi perdido: anexo, valor e respostas dos checks fiscais
                estão guardados nesta tela.
              </p>
            </>
          }
        />
      </div>
    </div>
  );
}
