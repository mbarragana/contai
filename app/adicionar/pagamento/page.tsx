"use client";

import { useMemo, useState } from "react";

import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
import { AfirmacaoObra, TelaTrocarObra } from "@/app/_components/obra";
import { Registrado } from "@/app/_components/registrado";
import { useSessao } from "@/app/_components/sessao";
import { useObraDoRegistro } from "@/app/_components/usar-obra-do-registro";
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
  classificarErro,
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
  rotulosPagoSemNota,
  validarPagamentoAvulso,
  type EntradaPagamento,
  type ErroCampoPagamento,
} from "@/lib/fiscal/pagamento";
import { hojeIso } from "@/lib/hoje";
import { parseValorInput } from "@/lib/money";
import type { TipoFavorecido } from "@/lib/types";

type Fase =
  | { nome: "formulario" }
  | { nome: "salvando" }
  | {
      nome: "salvo";
      ano: number;
      tipoFavorecido: TipoFavorecido | null;
      id: string;
      obraNome: string;
    };

export default function RegistrarPagamento() {
  // Mesma regra do documento: obra afirmada na tela, trocável aqui, e é ela
  // que grava o `obra_id` (critérios 6, 7 e 16).
  const registro = useObraDoRegistro();
  const { pedirReautenticacao } = useSessao();
  const obra = registro.obra;
  const [trocando, setTrocando] = useState(false);
  const [fase, setFase] = useState<Fase>({ nome: "formulario" });
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeIso);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erros, setErros] = useState<ErroCampoPagamento[]>([]);

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

  // PF não emite NF: o que sustenta o custo dele é o recibo assinado. Os
  // rótulos acompanham o CNPJ/CPF digitado, em vez de assumir PJ.
  const tipoFavorecido = useMemo(
    () => tipoPorDocumento(documento),
    [documento],
  );

  async function salvar() {
    const encontrados = validarPagamentoAvulso(entrada, hojeIso());
    setErros(encontrados);
    setErroSalvar(null);
    if (encontrados.length > 0 || !obra || !comprovante) return;

    setFase({ nome: "salvando" });
    try {
      if (tipoFavorecido === null) throw new Error("CNPJ/CPF inválido.");

      const comprovantePath = await subirParaAcervo(comprovante, "comprovante");
      const favorecidoId = await garantirFavorecido({
        nome: nome.trim(),
        documento: soDigitos(documento),
        tipo: tipoFavorecido,
      });

      // A obra que está na tela, não a preferência do aparelho.
      const id = await criarPagamento({
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

      setFase({
        nome: "salvo",
        ano: anoCalendario(data),
        tipoFavorecido,
        id,
        obraNome: obra.nome,
      });
    } catch (erro) {
      setFase({ nome: "formulario" });
      // Sessão morta descoberta no "Salvar": sobreposto de reautenticação, e
      // NUNCA navegação. O formulário continua montado com comprovante, valor
      // e data — perder isso no canteiro é perder o registro, e custo não
      // comprovado não existe (IN SRF 84/2001 art. 17).
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErro(erro));
    }
  }

  if (fase.nome === "salvo") {
    const salvos = rotulosPagoSemNota(fase.tipoFavorecido);
    return (
      <Registrado
        ano={fase.ano}
        obraNome={fase.obraNome}
        hrefCorrigirObra={`/pagamento/${fase.id}/obra`}
        proximoPasso={
          <>
            vincular {salvos.documento} quando chegar{" "}
            <span className="text-[12px] text-mut">(em breve — US-003)</span>
          </>
        }
        custo={`só conta depois de vincular ${salvos.documento}`}
      />
    );
  }

  const rotulos = rotulosPagoSemNota(tipoFavorecido);

  // Tela 12 — troca sem sair do fluxo.
  if (trocando && obra) {
    return (
      <TelaTrocarObra
        obras={registro.obras}
        hoje={hojeIso()}
        onEscolher={(escolhida) => {
          registro.escolher(escolhida);
          setTrocando(false);
        }}
        onCancelar={() => setTrocando(false)}
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
        {registro.fase === "carregando" ? (
          <Carregando rotulo="Carregando a obra" />
        ) : null}

        {registro.fase === "erro" ? (
          <EstadoErro
            erro={registro.erro ?? { tipo: "falha", mensagem: "" }}
            onTentarDeNovo={registro.recarregar}
          />
        ) : null}

        {registro.fase === "pronta" && obra ? (
          <>
            {erroSalvar ? (
              <Banner cor="red" role="alert">
                {erroSalvar}
              </Banner>
            ) : null}

            <AfirmacaoObra
              rotulo="Registrando em"
              nome={obra.nome}
              onTrocar={
                registro.obras.length > 1 ? () => setTrocando(true) : undefined
              }
            />

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
              Vai nascer como{" "}
              <strong>aguardando {rotulos.documento}</strong>.{" "}
              {tipoFavorecido === "pf" ? (
                <>
                  Prestador PF não emite nota: o que sustenta o custo é o recibo
                  assinado com nome, CPF e descrição do serviço — junto deste
                  comprovante.
                </>
              ) : tipoFavorecido === "pj" ? (
                <>
                  Quando a nota chegar (mensal ou consolidada), você vincula
                  este e outros pagamentos a ela — o custo só conta no IR com a
                  nota junto.
                </>
              ) : (
                <>
                  Informe o CNPJ/CPF do favorecido: PJ deve NF, PF deve recibo
                  assinado (nome, CPF e descrição do serviço). O custo só conta
                  no IR com o documento junto.
                </>
              )}
            </Banner>
          </>
        ) : null}
      </Corpo>

      {registro.fase === "pronta" ? (
        <Rodape>
          <Passo>Interação 3 de 3 ↓</Passo>
          <Botao
            variante="primary"
            onClick={salvar}
            disabled={fase.nome === "salvando"}
          >
            {fase.nome === "salvando"
              ? "Salvando…"
              : `Salvar — aguardando ${rotulos.documento}`}
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
