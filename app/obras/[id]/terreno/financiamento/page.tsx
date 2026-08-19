"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CampoTexto } from "@/app/_components/campos";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarFinanciamento,
  carregarObra,
  classificarErro,
  criarFinanciamento,
  mensagemDeErro,
  type ErroDeTela,
} from "@/lib/data";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { ehDataValida } from "@/lib/fiscal/pagamento";
import { PRECO_CONTRATADO_NAO_E_CUSTO } from "@/lib/fiscal/terreno";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL, parseValorInput } from "@/lib/money";
import type { Financiamento, Obra } from "@/lib/types";

/**
 * Cadastro do contrato de financiamento — **1x na vida** (critério 7).
 *
 * ⚠️ A ENTRADA NÃO É CAMPO DESTA TELA: ela é um desembolso datado, com
 * comprovante, e mora em `/obras/[id]/terreno/desembolsos`. Um lugar só para
 * desembolso datado — dois caminhos para o mesmo dinheiro é como nasce dupla
 * contagem.
 *
 * ⚠️ Nada de identificador real em exemplo: o repositório é público.
 */

type Fase =
  | { nome: "carregando" }
  | { nome: "erro"; erro: ErroDeTela }
  | { nome: "pronto" }
  | { nome: "salvando" };

interface ErroCampo {
  campo: string;
  mensagem: string;
}

export default function ContratoDoFinanciamento() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [fase, setFase] = useState<Fase>({ nome: "carregando" });
  const [obra, setObra] = useState<Obra | null>(null);
  const [existente, setExistente] = useState<Financiamento | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [instituicao, setInstituicao] = useState("");
  const [numeroContrato, setNumeroContrato] = useState("");
  const [dataContrato, setDataContrato] = useState("");
  const [preco, setPreco] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [erros, setErros] = useState<ErroCampo[]>([]);

  const hoje = hojeIso();

  const carregar = useCallback(async () => {
    const [carregada, contrato] = await Promise.all([
      carregarObra(id),
      carregarFinanciamento(id),
    ]);
    setObra(carregada);
    setExistente(contrato);
  }, [id]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        await carregar();
        if (!cancelado) setFase({ nome: "pronto" });
      } catch (erro) {
        if (!cancelado) setFase({ nome: "erro", erro: classificarErro(erro) });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar, tentativa]);

  const erroDe = (campo: string) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  async function salvar() {
    const encontrados: ErroCampo[] = [];
    if (instituicao.trim() === "") {
      encontrados.push({
        campo: "instituicao",
        mensagem: "Informe a instituição credora.",
      });
    }
    if (!ehDataValida(dataContrato)) {
      encontrados.push({
        campo: "dataContrato",
        mensagem: "Informe a data do contrato.",
      });
    } else if (dataContrato > hoje) {
      encontrados.push({
        campo: "dataContrato",
        mensagem: "Data no futuro — informe a data real do contrato.",
      });
    }
    const precoCentavos = parseValorInput(preco);
    if (precoCentavos === null || precoCentavos <= 0) {
      encontrados.push({
        campo: "preco",
        mensagem: "Informe o preço contratado.",
      });
    }
    const numParcelas = parcelas.trim() === "" ? null : Number(parcelas.trim());
    if (numParcelas !== null && (!Number.isInteger(numParcelas) || numParcelas < 1)) {
      encontrados.push({
        campo: "parcelas",
        mensagem: "Número de parcelas inválido — deixe em branco se não souber.",
      });
    }
    setErros(encontrados);
    setErroSalvar(null);
    if (encontrados.length > 0) return;

    setFase({ nome: "salvando" });
    try {
      await criarFinanciamento({
        obraId: id,
        instituicao: instituicao.trim(),
        numeroContrato: numeroContrato.trim() === "" ? null : numeroContrato.trim(),
        dataContrato,
        precoContratadoCentavos: precoCentavos!,
        numeroParcelas: numParcelas,
      });
      router.push(`/obras/${id}/terreno`);
    } catch (erro) {
      setErroSalvar(mensagemDeErro(erro));
      setFase({ nome: "pronto" });
    }
  }

  if (fase.nome === "carregando" || fase.nome === "erro" || !obra) {
    return (
      <>
        <AppBar titulo="Contrato do financiamento" />
        <Corpo>
          {fase.nome === "erro" ? (
            <EstadoErro
              erro={fase.erro}
              onTentarDeNovo={() => {
                setFase({ nome: "carregando" });
                setTentativa((t) => t + 1);
              }}
            />
          ) : (
            <Carregando rotulo="Carregando o contrato" />
          )}
        </Corpo>
        <Rodape>
          <BotaoLink href={`/obras/${id}/terreno`}>Voltar ao terreno</BotaoLink>
        </Rodape>
      </>
    );
  }

  // Um contrato por obra (`unique (obra_id)`): o escopo fechado pelo Mateus é
  // financiamento SÓ DO TERRENO. Dois contratos exigiriam migration nova e
  // decisão consciente, então a tela mostra o que existe em vez de oferecer um
  // segundo cadastro que o banco recusaria.
  if (existente) {
    return (
      <>
        <AppBar titulo="Contrato do financiamento" sub={obra.nome} />
        <Corpo>
          <Card>
            <Linha rotulo="Instituição credora">{existente.instituicao}</Linha>
            {existente.numeroContrato ? (
              <Linha rotulo="Número do contrato">
                <span className="mono">{existente.numeroContrato}</span>
              </Linha>
            ) : null}
            <Linha rotulo="Data do contrato">
              <span className="mono">
                {formatarDataBR(existente.dataContrato)}
              </span>
            </Linha>
            <Linha rotulo="Preço contratado">
              <span className="mono">
                {formatarBRL(existente.precoContratadoCentavos)}
              </span>
            </Linha>
            {existente.numeroParcelas ? (
              <Linha rotulo="Parcelas">{existente.numeroParcelas}</Linha>
            ) : null}
            <Consequencia cor="amb">{PRECO_CONTRATADO_NAO_E_CUSTO}</Consequencia>
          </Card>
          <Dica>
            O contrato é cadastrado uma vez na vida. O que se repete é o{" "}
            <strong>informe anual</strong>, uma vez por ano, em jan/fev.
          </Dica>
        </Corpo>
        <Rodape>
          <BotaoLink href={`/obras/${id}/terreno`} variante="primary">
            Voltar ao terreno
          </BotaoLink>
        </Rodape>
      </>
    );
  }

  return (
    <>
      <AppBar titulo="Contrato do financiamento" sub={`${obra.nome} · 1x na vida`} />
      <Corpo>
        {erroSalvar ? (
          <Banner cor="red" role="alert">
            {erroSalvar}
          </Banner>
        ) : null}

        <Card className="flex flex-col gap-3.5">
          <CampoTexto
            rotulo="Instituição credora"
            valor={instituicao}
            onChange={setInstituicao}
            placeholder="Banco Litoral"
            erro={erroDe("instituicao")}
          />
          <CampoTexto
            rotulo="Número do contrato (opcional)"
            valor={numeroContrato}
            onChange={setNumeroContrato}
            inputMode="numeric"
            erro={erroDe("numeroContrato")}
          />
          <CampoTexto
            rotulo="Data do contrato"
            tipo="date"
            valor={dataContrato}
            onChange={setDataContrato}
            ajuda="É a partir dela que o painel enumera os anos do financiamento."
            erro={erroDe("dataContrato")}
          />
          <CampoTexto
            rotulo="Preço contratado"
            valor={preco}
            onChange={setPreco}
            inputMode="decimal"
            placeholder="0,00"
            erro={erroDe("preco")}
          />
          <CampoTexto
            rotulo="Número de parcelas (opcional)"
            valor={parcelas}
            onChange={setParcelas}
            inputMode="numeric"
            erro={erroDe("parcelas")}
          />
        </Card>

        <Card className="border-amb">
          <Consequencia cor="amb">{PRECO_CONTRATADO_NAO_E_CUSTO}</Consequencia>
        </Card>

        <Card>
          <Dica>
            <strong>A entrada não é campo desta tela.</strong> Ela é um
            desembolso com data e comprovante próprios, e entra em{" "}
            <em>“O que saiu do seu bolso”</em> — junto com ITBI e escritura, que
            podem cair em outro ano.
          </Dica>
        </Card>
      </Corpo>

      <Rodape>
        <Botao
          variante="primary"
          onClick={() => void salvar()}
          disabled={fase.nome === "salvando"}
        >
          {fase.nome === "salvando" ? "Salvando…" : "Cadastrar contrato"}
        </Botao>
        <BotaoLink href={`/obras/${id}/terreno`}>Voltar ao terreno</BotaoLink>
      </Rodape>
    </>
  );
}
