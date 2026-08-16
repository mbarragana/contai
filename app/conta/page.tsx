"use client";

import { useCallback, useEffect, useState } from "react";

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
 * DIVERGÊNCIA INTENCIONAL do mock aprovado: a tela 7 ainda diz "para voltar,
 * você precisa do LINK no e-mail". Isso é texto da era do magic link e
 * contradiz a decisão do Mateus de 2026-08-10 (critério 2 do ticket), que
 * trocou o link pelo código de 6 dígitos. Aqui está "código" — a consequência
 * de sair continua real (precisa do e-mail para voltar), mas descrita pelo
 * mecanismo que o app tem de verdade.
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

      <Corpo>
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
              pede código de novo. Sair só é necessário se este aparelho deixar
              de ser seu.
            </Dica>

            <Card>
              <Chip cor="red">Sair</Chip>
              <Consequencia cor="red">
                Sair apaga a sessão deste aparelho. Para voltar, você precisa do
                código que chega no e-mail — e sem sinal no canteiro isso pode
                significar não registrar a nota hoje.
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

      <Rodape>
        <BotaoLink href="/">Voltar ao início</BotaoLink>
      </Rodape>
    </>
  );
}
