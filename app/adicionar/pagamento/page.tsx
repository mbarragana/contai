"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
import { Registrado } from "@/app/_components/registrado";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  EstadoErro,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarObra,
  criarPagamento,
  garantirFavorecido,
  mensagemDeErro,
  subirParaAcervo,
} from "@/lib/data";
import { soDigitos, tipoPorDocumento } from "@/lib/fiscal/identificacao";
import {
  MEIO_PAGAMENTO_AVULSO,
  STATUS_PAGAMENTO_AVULSO,
  anoCalendario,
  validarPagamentoAvulso,
  type EntradaPagamento,
  type ErroCampoPagamento,
} from "@/lib/fiscal/pagamento";
import { parseValorInput } from "@/lib/money";
import type { Obra } from "@/lib/types";

type Fase =
  | { nome: "carregando" }
  | { nome: "erro"; mensagem: string }
  | { nome: "formulario" }
  | { nome: "salvando" }
  | { nome: "salvo"; ano: number };

function hojeIso(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default function RegistrarPagamento() {
  const [obra, setObra] = useState<Obra | null>(null);
  const [fase, setFase] = useState<Fase>({ nome: "carregando" });
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeIso);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erros, setErros] = useState<ErroCampoPagamento[]>([]);

  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const carregada = await carregarObra();
        if (cancelado) return;
        setObra(carregada);
        setFase({ nome: "formulario" });
      } catch (erro) {
        if (cancelado) return;
        setFase({ nome: "erro", mensagem: mensagemDeErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setFase({ nome: "carregando" });
    setTentativa((t) => t + 1);
  }, []);

  const entrada: EntradaPagamento = useMemo(
    () => ({
      favorecidoNome: nome,
      favorecidoDocumento: documento,
      valorCentavos: parseValorInput(valor),
      dataPagamento: data || null,
      temComprovante: comprovante !== null,
    }),
    [nome, documento, valor, data, comprovante],
  );

  const erroDe = (campo: ErroCampoPagamento["campo"]) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  async function salvar() {
    const encontrados = validarPagamentoAvulso(entrada, hojeIso());
    setErros(encontrados);
    setErroSalvar(null);
    if (encontrados.length > 0 || !obra || !comprovante) return;

    setFase({ nome: "salvando" });
    try {
      const tipoFavorecido = tipoPorDocumento(documento);
      if (tipoFavorecido === null) throw new Error("CNPJ/CPF inválido.");

      const comprovantePath = await subirParaAcervo(comprovante, "comprovante");
      const favorecidoId = await garantirFavorecido({
        nome: nome.trim(),
        documento: soDigitos(documento),
        tipo: tipoFavorecido,
      });

      await criarPagamento({
        obra_id: obra.id,
        favorecido_id: favorecidoId,
        valorCentavos: entrada.valorCentavos as number,
        data_pagamento: data,
        meio: MEIO_PAGAMENTO_AVULSO,
        // Cartão dependeria da Q4 (ano da compra vs. ano da fatura); PIX tem
        // uma data só.
        data_compra: null,
        comprovante_path: comprovantePath,
        status: STATUS_PAGAMENTO_AVULSO,
      });

      setFase({ nome: "salvo", ano: anoCalendario(data) });
    } catch (erro) {
      setErroSalvar(mensagemDeErro(erro));
      setFase({ nome: "formulario" });
    }
  }

  if (fase.nome === "salvo") {
    return (
      <Registrado
        ano={fase.ano}
        proximoPasso={
          <>
            vincular a NF quando ela chegar{" "}
            <span className="text-[12px] text-mut">(em breve — US-003)</span>
          </>
        }
        custo="só conta quando a NF for vinculada"
      />
    );
  }

  return (
    <>
      <AppBar
        titulo="Registrar pagamento"
        sub="Interação 2 de 3 — PIX sem documento"
      />

      <Corpo>
        {fase.nome === "carregando" ? (
          <Carregando rotulo="Carregando a obra" />
        ) : null}

        {fase.nome === "erro" ? (
          <EstadoErro mensagem={fase.mensagem} onTentarDeNovo={tentarDeNovo} />
        ) : null}

        {fase.nome === "formulario" || fase.nome === "salvando" ? (
          <>
            {erroSalvar ? (
              <Banner cor="red" role="alert">
                {erroSalvar}
              </Banner>
            ) : null}

            <Card className="flex flex-col gap-3.5">
              <CampoTexto
                rotulo="Favorecido"
                valor={nome}
                onChange={setNome}
                placeholder="Quem recebeu o PIX"
                erro={erroDe("favorecidoNome")}
              />
              <CampoTexto
                rotulo="CNPJ / CPF do favorecido"
                valor={documento}
                onChange={setDocumento}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                erro={erroDe("favorecidoDocumento")}
              />
              <CampoTexto
                rotulo="Valor"
                valor={valor}
                onChange={setValor}
                inputMode="decimal"
                placeholder="0,00"
                erro={erroDe("valorCentavos")}
              />
              <CampoTexto
                rotulo="Data do pagamento"
                tipo="date"
                valor={data}
                onChange={setData}
                erro={erroDe("dataPagamento")}
              />
              <CampoArquivo
                rotulo="Comprovante"
                ajuda="Anexe o comprovante do PIX — obrigatório."
                accept=".pdf,image/*"
                arquivo={comprovante}
                onChange={setComprovante}
                erro={erroDe("temComprovante")}
              />
            </Card>

            <Banner cor="amb" role="status">
              Vai nascer como <strong>aguardando NF</strong>. Quando a nota
              chegar (mensal ou consolidada), você vincula este e outros
              pagamentos a ela — o custo só conta no IR com a nota junto.
            </Banner>
          </>
        ) : null}
      </Corpo>

      {fase.nome === "formulario" || fase.nome === "salvando" ? (
        <Rodape>
          <Passo>Interação 3 de 3 ↓</Passo>
          <Botao
            variante="primary"
            onClick={salvar}
            disabled={fase.nome === "salvando"}
          >
            {fase.nome === "salvando" ? "Salvando…" : "Salvar — aguardando NF"}
          </Botao>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      ) : (
        <Rodape>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      )}
    </>
  );
}
