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
  classificarErro,
  mensagemDeErro,
  type ErroDeTela,
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
  | { nome: "erro"; erro: ErroDeTela }
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
  const anoCorrente = Number(hoje.slice(0, 4));

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
        if (!cancelado) setFase({ nome: "erro", erro: classificarErro(erro) });
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
            <EstadoErro erro={fase.erro} onTentarDeNovo={tentarDeNovo} />
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
        <BotaoLink href={`/obras/${id}/terreno`}>
          Terreno — desembolsos, contrato e informes
        </BotaoLink>
        {/*
          ⚠️ A PRIMEIRA SAÍDA ANUAL DO PRODUTO (CONTAI-036). Sem esta porta ela
          nasceria inalcançável, que é o formato exato da D47: superfície
          gravada e caminho nunca entregue.

          ⚠️ **DOIS ANOS, e o de baixo é o que importa na hora certa.** A
          primeira versão linkava só o ano corrente, e isso é beco sem saída na
          janela real: em **março e abril de N+1** se declara **N**, e o link do
          ano corrente ofereceria justamente o ano que ainda não fechou. A tela
          **não tem seletor de ano** — o mock aprovado (tela 4) não desenhou
          um —, então quem abre o caminho é esta lista.

          O ano não recorta nada na porta: `podeGerarRelatorioAnual` ignora o
          `ano` para efeito de veto, e ele só diz de que ano é o texto.
        */}
        <BotaoLink href={`/obras/${id}/discriminacao/${anoCorrente}`}>
          Discriminação de {anoCorrente} — antes de declarar
        </BotaoLink>
        <BotaoLink href={`/obras/${id}/discriminacao/${anoCorrente - 1}`}>
          Discriminação de {anoCorrente - 1} — o ano que você declara agora
        </BotaoLink>
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
