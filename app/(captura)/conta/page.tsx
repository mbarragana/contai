"use client";

import { useCallback, useEffect, useState } from "react";

import { COLUNA_DO_FORMULARIO } from "@/app/_components/captura";
import { useSessao } from "@/app/_components/sessao";
import {
  AppBar,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Rodape,
} from "@/app/_components/ui";
import { carregarObras, classificarErro, type ErroDeTela } from "@/lib/data";

/**
 * Tela 7 do mock CONTAI-002 — a conta e a saída (critério 6).
 *
 * DIVERGÊNCIA INTENCIONAL do mock aprovado: a tela 7 diz "para voltar, você
 * precisa do LINK no e-mail" — texto da era do magic link, que já não valia
 * quando o login era por código (decisão de 2026-08-10) e vale menos ainda
 * agora que é por SENHA (decisão de 2026-08-17). Aqui está "senha": a
 * consequência de sair continua real, mas descrita pelo mecanismo que o app
 * tem de verdade.
 */

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; obras: number };

export default function Conta() {
  const { email, sairDaConta } = useSessao();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const obras = await carregarObras();
        if (!cancelado) setEstado({ fase: "pronto", obras: obras.length });
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

  return (
    <>
      <AppBar titulo="Sua conta" sub={email ?? "sessão ativa"} />

      {/* ⚠️ CONTAI-047, critério 7 — `/conta` herda a casca larga SEM
          tratamento dedicado (baixa frequência, fora do motivo do ticket). A
          única coisa que ela recebe é o teto de coluna do grupo: sem ele o
          texto de consequência de "Sair da conta" nasceria com 900px de linha,
          que é regressão de legibilidade, não herança. */}
      <Corpo className={COLUNA_DO_FORMULARIO}>
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando a conta" />
        ) : null}

        {estado.fase === "erro" ? (
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {estado.fase === "pronto" ? (
          <>
            <Card>
              <Linha rotulo="E-mail">{email ?? "—"}</Linha>
              <Linha rotulo="Obras">
                {estado.obras === 1
                  ? "1 cadastrada"
                  : `${estado.obras} cadastradas`}
              </Linha>
              <Linha rotulo="Sessão">ativa neste aparelho</Linha>
            </Card>

            <Dica>
              Você continua logado entre visitas ao canteiro — fechar o app não
              pede a senha de novo. Sair só é necessário se este aparelho deixar
              de ser seu.
            </Dica>

            <Card>
              <Chip cor="red">Sair</Chip>
              <Consequencia cor="red">
                Sair apaga a sessão deste aparelho. Para voltar, você precisa da
                sua senha — se ela só existe no gerenciador deste aparelho,
                confira antes de sair. Não há recuperação por e-mail: senha
                esquecida se troca no painel do Supabase.
              </Consequencia>
              <div className="mt-2.5">
                <Botao
                  variante="ghost"
                  disabled={saindo}
                  onClick={() => {
                    setSaindo(true);
                    void sairDaConta();
                  }}
                  className="border-red-bg text-red"
                >
                  {saindo ? "Saindo…" : "Sair da conta"}
                </Botao>
              </div>
            </Card>
          </>
        ) : null}
      </Corpo>

      <Rodape className={COLUNA_DO_FORMULARIO}>
        <BotaoLink href="/">Voltar ao início</BotaoLink>
      </Rodape>
    </>
  );
}
