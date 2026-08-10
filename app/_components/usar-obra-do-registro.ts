"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { carregarObras, mensagemDeErro } from "@/lib/data";
import { escolherObraAtiva } from "@/lib/fiscal/obra";
import { lerObraPreferida } from "@/lib/obra-ativa";
import type { Obra } from "@/lib/types";

/**
 * A obra de UM registro (critérios 6, 7 e 16).
 *
 * Duas regras que não podem ser otimizadas para longe:
 * 1. Sem valor confiável de obra ativa o formulário nem abre — manda para a
 *    lista. Nada é gravado em obra nenhuma antes de uma escolha explícita.
 * 2. A obra que o registro grava é a que está NESTE estado, isto é, a que
 *    esteve na tela no momento do salvar — nunca a preferência lida de novo na
 *    hora de gravar. Trocar aqui não mexe na preferência do aparelho: é uma
 *    afirmação sobre este registro, não sobre a navegação.
 */

export type FaseObraDoRegistro = "carregando" | "erro" | "pronta";

export interface ObraDoRegistro {
  fase: FaseObraDoRegistro;
  mensagem: string | null;
  obras: Obra[];
  obra: Obra | null;
  escolher: (obra: Obra) => void;
  recarregar: () => void;
}

export function useObraDoRegistro(): ObraDoRegistro {
  const router = useRouter();
  const [fase, setFase] = useState<FaseObraDoRegistro>("carregando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [obras, setObras] = useState<Obra[]>([]);
  const [obra, setObra] = useState<Obra | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const todas = await carregarObras();
        const ativa = escolherObraAtiva(todas, lerObraPreferida());
        if (cancelado) return;
        if (!ativa) {
          router.replace("/obras");
          return;
        }
        setObras(todas);
        setObra(ativa);
        setFase("pronta");
      } catch (erro) {
        if (cancelado) return;
        setMensagem(mensagemDeErro(erro));
        setFase("erro");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [router, tentativa]);

  const recarregar = useCallback(() => {
    setFase("carregando");
    setMensagem(null);
    setTentativa((t) => t + 1);
  }, []);

  return { fase, mensagem, obras, obra, escolher: setObra, recarregar };
}
