"use client";

/**
 * A agenda inteira — o destino do "ver todos (N)" do critério 43.
 *
 * A home mostra TODOS os vencidos e no máximo 3 abertos. Esta tela não corta
 * nada: é onde o corte da home deixa de esconder.
 */

import { useCallback, useEffect, useState } from "react";

import { BlocoAgendados } from "@/app/_components/agendado";
import {
  AppBar,
  BarraAdicionar,
  BotaoLink,
  Banner,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import {
  carregarCompromissos,
  carregarObras,
  classificarErro,
  type ErroDeTela,
} from "@/lib/data";
import { montarAgendaDaHome, type AgendaHome } from "@/lib/fiscal/compromisso";
import { escolherObraAtiva } from "@/lib/fiscal/obra";
import { hojeIso } from "@/lib/hoje";
import { lerObraPreferida } from "@/lib/obra-ativa";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; erro: ErroDeTela }
  | { fase: "pronto"; agenda: AgendaHome; obraNome: string };

export default function Agenda() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const hoje = hojeIso();

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const obras = await carregarObras();
        const ativa = escolherObraAtiva(obras, lerObraPreferida());
        if (!ativa) throw new Error("Nenhuma obra aberta.");
        const todos = await carregarCompromissos(ativa.id);
        if (cancelado) return;
        setEstado({
          fase: "pronto",
          // ⚠️ SEM TETO: o corte de 3 é da HOME (critério 43), e esta é a tela
          // para onde o "ver todos (N)" manda. Cortar aqui também seria
          // esconder duas vezes.
          agenda: montarAgendaDaHome(todos, hoje, Infinity),
          obraNome: ativa.nome,
        });
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa, hoje]);

  const tentarDeNovo = useCallback(() => {
    setEstado({ fase: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  return (
    <>
      <AppBar
        titulo="Agendados"
        sub={estado.fase === "pronto" ? estado.obraNome : undefined}
      />
      <Corpo>
        {estado.fase === "carregando" ? (
          <Carregando rotulo="Carregando os agendamentos" />
        ) : null}
        {estado.fase === "erro" ? (
          <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />
        ) : null}
        {estado.fase === "pronto" ? (
          estado.agenda.vazia ? (
            <Banner cor="grn" role="status">
              <strong>Nenhum agendamento em aberto.</strong> Tudo que estava
              marcado já foi respondido.
            </Banner>
          ) : (
            <>
              <BlocoAgendados agenda={estado.agenda} hoje={hoje} />
              <Dica>
                Nenhum destes valores entra em soma nenhuma do app — eles não
                compõem custo de aquisição enquanto o dinheiro não sair.
              </Dica>
            </>
          )
        ) : null}
      </Corpo>
      <BarraAdicionar
        voltar={
          <BotaoLink href="/" variante="primary">
            Voltar ao início
          </BotaoLink>
        }
      />
    </>
  );
}
