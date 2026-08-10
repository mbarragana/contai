"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AvisoEquiparacao, PendenciaCno } from "@/app/_components/obra";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Rodape,
} from "@/app/_components/ui";
import {
  CamposCno,
  CamposIdentidade,
  CamposPremissas,
  CamposTerreno,
  estadoDaObra,
  paraBanco,
  paraEntrada,
  type EstadoObra,
} from "@/app/obras/_campos";
import {
  atualizarObra,
  carregarObra,
  mensagemDeErro,
} from "@/lib/data";
import { validarObra, type ErroCampoObra } from "@/lib/fiscal/obra";
import { hojeIso } from "@/lib/hoje";
import type { Obra } from "@/lib/types";

/**
 * Dados da obra, editáveis (critério 5): o CNO sai depois do início da obra e o
 * ITBI/escritura é pago depois da compra do terreno — cadastro imutável
 * obrigaria SQL de novo, que é a dor D9.
 */

type Fase =
  | { nome: "carregando" }
  | { nome: "erro"; mensagem: string }
  | { nome: "pronto" }
  | { nome: "salvando" };

export default function DadosDaObra() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [obra, setObra] = useState<Obra | null>(null);
  const [estado, setEstado] = useState<EstadoObra | null>(null);
  const [fase, setFase] = useState<Fase>({ nome: "carregando" });
  const [erros, setErros] = useState<ErroCampoObra[]>([]);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const hoje = hojeIso();

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const carregada = await carregarObra(id);
        if (cancelado) return;
        setObra(carregada);
        setEstado(estadoDaObra(carregada));
        setFase({ nome: "pronto" });
      } catch (erro) {
        if (!cancelado) setFase({ nome: "erro", mensagem: mensagemDeErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setFase({ nome: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  const atualizar = useCallback(
    <C extends keyof EstadoObra>(campo: C, valor: EstadoObra[C]) => {
      setSalvo(false);
      setEstado((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    },
    [],
  );

  const entrada = useMemo(
    () => (estado ? paraEntrada(estado) : null),
    [estado],
  );
  const erroDe = (campo: ErroCampoObra["campo"]) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  async function salvar() {
    if (!entrada) return;
    const encontrados = validarObra(entrada, hoje);
    setErros(encontrados);
    setErroSalvar(null);
    if (encontrados.length > 0) return;

    setFase({ nome: "salvando" });
    try {
      await atualizarObra(id, paraBanco(entrada));
      const recarregada = await carregarObra(id);
      setObra(recarregada);
      setEstado(estadoDaObra(recarregada));
      setSalvo(true);
      setFase({ nome: "pronto" });
    } catch (erro) {
      setErroSalvar(mensagemDeErro(erro));
      setFase({ nome: "pronto" });
    }
  }

  if (fase.nome === "carregando" || fase.nome === "erro" || !estado || !obra) {
    return (
      <>
        <AppBar titulo="Dados da obra" />
        <Corpo>
          {fase.nome === "erro" ? (
            <EstadoErro mensagem={fase.mensagem} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando a obra" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href="/obras">Ver minhas obras</BotaoLink>
        </Rodape>
      </>
    );
  }

  const props = { estado, atualizar, erroDe };

  return (
    <>
      <AppBar titulo="Dados da obra" sub={obra.nome} />
      <Corpo>
        {salvo ? (
          <Banner cor="grn" role="status">
            Alterações salvas em <strong>{obra.nome}</strong>.
          </Banner>
        ) : null}
        {erroSalvar ? (
          <Banner cor="red" role="alert">
            {erroSalvar}
          </Banner>
        ) : null}

        <AvisoEquiparacao obra={obra} />
        {obra.cno ? null : <PendenciaCno obra={obra} hoje={hoje} />}

        <CamposIdentidade {...props} />
        <CamposCno {...props} hoje={hoje} obraParaPendencia={obra} />
        <CamposTerreno {...props} />
        <CamposPremissas {...props} />

        <Dica>
          Corrigir a data de início muda o prazo do CNO e o período que a
          aferição enxerga — informe sempre a data real.
        </Dica>
      </Corpo>
      <Rodape>
        <Botao
          variante="primary"
          onClick={salvar}
          disabled={fase.nome === "salvando"}
        >
          {fase.nome === "salvando" ? "Salvando…" : "Salvar alterações"}
        </Botao>
        <BotaoLink href="/">Voltar</BotaoLink>
      </Rodape>
    </>
  );
}
