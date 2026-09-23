"use client";

/**
 * NOVA COMPRA NO CARTÃO — CONTAI-022, critérios 2 a 5, 11, 12, 14.
 *
 * ⚠️ Esta compra **nasce sempre agendamento** — o dinheiro só sai quando a
 * fatura for paga. Nunca passa por `decidirRegistro`: quem decide o branch é
 * só o gate do parcelamento (`lib/fiscal/fatura.ts`), nunca `data ≤ hoje`
 * (adendo §B(c) — uma compra de ontem no cartão não vira pagamento por
 * caminho nenhum).
 *
 * Cenário: **captura** (mock, s1) — mas a densidade é maior que o formulário
 * de PIX/boleto porque o vencimento da fatura é um campo a mais, obrigatório
 * (achado do `cto-obra`: sem ele a compra nunca vence e nunca bloqueia
 * relatório anual).
 */

import { useMemo, useState } from "react";

import { CampoTexto, Escolha } from "@/app/_components/campos";
import {
  CamposCurtos,
  COLUNA_DO_FORMULARIO,
  PassosDaCaptura,
} from "@/app/_components/captura";
import { useSessao } from "@/app/_components/sessao";
import { AfirmacaoObra, TelaTrocarObra } from "@/app/_components/obra";
import { useObraDoRegistro } from "@/app/_components/usar-obra-do-registro";
import {
  AppBar,
  Banner,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  classificarErro,
  criarCompraCartao,
  garantirFavorecido,
  mensagemDeErroDeGravacao,
} from "@/lib/data";
import {
  RECUSA_PARCELADO,
  validarCompraCartao,
  type ErroCampoCompraCartao,
  type EntradaCompraCartao,
  type RespostaParcelamento,
} from "@/lib/fiscal/fatura";
import { tipoPorDocumento } from "@/lib/fiscal/identificacao";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL, parseValorInput } from "@/lib/money";
import { formatarDataBR } from "@/lib/fiscal/obra";

const RESPOSTAS_PARC = [
  { valor: "vista", texto: "À vista" },
  { valor: "parcelado", texto: "Parcelado" },
] as const satisfies readonly { valor: RespostaParcelamento; texto: string }[];

type Fase =
  | { nome: "formulario" }
  | { nome: "salvando" }
  | {
      nome: "agendado";
      faturaId: string;
      favorecidoNome: string;
      valorCentavos: number;
      dataCompra: string;
      dataVencimento: string;
    };

export default function NovaCompraCartao() {
  const registro = useObraDoRegistro();
  const { pedirReautenticacao } = useSessao();
  const obra = registro.obra;
  const [trocando, setTrocando] = useState(false);
  const [fase, setFase] = useState<Fase>({ nome: "formulario" });
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [parcelado, setParcelado] = useState<RespostaParcelamento | null>(null);
  const [valor, setValor] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [erros, setErros] = useState<ErroCampoCompraCartao[]>([]);

  const erroDe = (campo: ErroCampoCompraCartao["campo"]) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  const entrada: EntradaCompraCartao = useMemo(
    () => ({
      favorecidoNome: nome,
      favorecidoDocumento: documento,
      valorCentavos: parseValorInput(valor),
      dataCompra,
      dataVencimentoFatura: dataVencimento,
      parcelado,
    }),
    [nome, documento, valor, dataCompra, dataVencimento, parcelado],
  );

  const podeSalvar = validarCompraCartao(entrada).length === 0;
  // Nomeia o PRIMEIRO campo que falta — mesmo padrão do CONTAI-032 (o botão
  // desabilitado diz o que fazer, nunca só "preencha algo").
  const faltando =
    parcelado === "vista"
      ? nome.trim().length < 2
        ? "o favorecido"
        : parseValorInput(valor) === null
          ? "o valor"
          : !dataCompra
            ? "a data da compra"
            : !dataVencimento
              ? "o vencimento da fatura"
              : null
      : null;

  const tipoFavorecido = useMemo(() => tipoPorDocumento(documento), [documento]);

  async function salvar() {
    setErroSalvar(null);
    const encontrados = validarCompraCartao(entrada);
    setErros(encontrados);
    if (encontrados.length > 0 || !obra) return;

    setFase({ nome: "salvando" });
    try {
      if (tipoFavorecido === null) throw new Error("CNPJ/CPF inválido.");
      const favorecidoId = await garantirFavorecido({
        nome: nome.trim(),
        documento,
        tipo: tipoFavorecido,
      });
      const valorCentavos = entrada.valorCentavos as number;
      const { faturaId } = await criarCompraCartao({
        obraId: obra.id,
        favorecidoId,
        valorCentavos,
        dataCompra,
        dataVencimentoFatura: dataVencimento,
      });
      setFase({
        nome: "agendado",
        faturaId,
        favorecidoNome: nome.trim(),
        valorCentavos,
        dataCompra,
        dataVencimento,
      });
    } catch (erro) {
      setFase({ nome: "formulario" });
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErroDeGravacao(erro, "na lista de compras desta fatura"));
    }
  }

  if (fase.nome === "agendado") {
    return (
      <>
        <AppBar titulo="Agendado" sub={fase.favorecidoNome} />
        <PassosDaCaptura atual={3} />
        <Corpo className={COLUNA_DO_FORMULARIO}>
          <Banner cor="amb" role="status">
            <strong>Agendado para {formatarDataBR(fase.dataVencimento)}.</strong>{" "}
            Nada entrou em custo.
          </Banner>
          <Card className="border-dashed border-amb">
            <Linha rotulo="Favorecido">{fase.favorecidoNome}</Linha>
            <Linha rotulo="Valor previsto">
              <span className="mono text-mut">~ {formatarBRL(fase.valorCentavos)}</span>
            </Linha>
            <Linha rotulo="Data da compra">
              <span className="mono">{formatarDataBR(fase.dataCompra)}</span>
            </Linha>
            <Linha rotulo="Quando o dinheiro sai">
              <strong>para {formatarDataBR(fase.dataVencimento)}</strong>{" "}
              <span className="hint text-mut">vencimento da fatura</span>
            </Linha>
            <Dica>
              A data da compra <strong>não decide ano nenhum</strong>. Quem
              decide é o dia em que a fatura (ou a parte dela) for paga.
            </Dica>
          </Card>
          <Banner cor="red" role="status">
            ⚠️ <strong>Ressalva que viaja junto:</strong> a tese do ano do
            pagamento da fatura é defensável, não pacífica. Exige confirmação
            de contador humano (CRC) antes da primeira declaração que a use.
          </Banner>
        </Corpo>
        {/* Critério 8: "Ver a fatura" e "Voltar ao início" são rotas de
            `app/(gestao)/` — abrem com o shell, e o fluxo termina num lugar
            reconhecível do produto. */}
        <Rodape className={COLUNA_DO_FORMULARIO}>
          <BotaoLink href={`/fatura/${fase.faturaId}`} variante="primary">
            Ver a fatura
          </BotaoLink>
          <BotaoLink href="/adicionar/compra-cartao">
            Registrar outra compra
          </BotaoLink>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

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
        titulo="Nova compra no cartão"
        sub={`hoje é ${formatarDataBR(hojeIso())}`}
      />
      <PassosDaCaptura atual={2} />
      {/* ⚠️ Sem rail, pela mesma decisão do `po` que valeu para o pagamento
          (Fora de Escopo do CONTAI-047): fluxo curto e sem extração. */}
      <Corpo className={COLUNA_DO_FORMULARIO}>
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

            <Banner cor="amb" role="status">
              <strong>Esta compra nasce sempre agendamento</strong> — o
              dinheiro só sai quando a fatura for paga. O favorecido é o{" "}
              <strong>lojista</strong>, nunca o banco nem a administradora.
            </Banner>

            <Card className="flex flex-col gap-3.5">
              <Escolha
                destaque
                campo="parc"
                rotulo="Parcelado?"
                opcoes={RESPOSTAS_PARC}
                valor={parcelado}
                onChange={setParcelado}
                erro={parcelado === null ? erroDe("parcelado") : undefined}
              />
              {parcelado === "parcelado" ? (
                <Banner cor="red" role="alert">
                  <strong>{RECUSA_PARCELADO}</strong>
                </Banner>
              ) : null}
            </Card>

            {parcelado === "vista" ? (
              <Card className="flex flex-col gap-3.5">
                {/* CONTAI-047, critério 2 — escalares curtos em pares na tela
                    larga. A `Escolha` "Parcelado?" e a `RECUSA_PARCELADO` que
                    a acompanha ficam no card de cima, em coluna única: bloco de
                    pergunta fiscal não divide largura (Pre-mortem 1). */}
                <CamposCurtos>
                  <CampoTexto
                    campo="favorecido"
                    rotulo="Favorecido"
                    valor={nome}
                    onChange={setNome}
                    placeholder="O lojista — nunca o banco ou a administradora"
                    erro={erroDe("favorecidoNome")}
                  />
                  <CampoTexto
                    campo="favorecidoDocumento"
                    rotulo="CNPJ / CPF do favorecido"
                    valor={documento}
                    onChange={setDocumento}
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                  />
                </CamposCurtos>
                <CampoTexto
                  campo="fValor"
                  rotulo="Valor da compra"
                  valor={valor}
                  onChange={setValor}
                  inputMode="decimal"
                  placeholder="0,00"
                  erro={erroDe("valorCentavos")}
                />
                <CamposCurtos>
                  <CampoTexto
                    campo="fCompra"
                    rotulo="Data da compra"
                    tipo="date"
                    valor={dataCompra}
                    onChange={setDataCompra}
                    ajuda="Fica registrada e não decide ano nenhum — serve para ligar a nota à fatura."
                    erro={erroDe("dataCompra")}
                  />
                  <CampoTexto
                    campo="fVenc"
                    rotulo="Vencimento da fatura"
                    tipo="date"
                    valor={dataVencimento}
                    onChange={setDataVencimento}
                    ajuda="Esta é a data prevista do agendamento. Sem ela a compra nunca vence e nunca bloqueia relatório anual."
                    erro={erroDe("dataVencimentoFatura")}
                  />
                </CamposCurtos>
              </Card>
            ) : null}
          </>
        ) : null}
      </Corpo>
      {registro.fase === "pronta" ? (
        <Rodape className={COLUNA_DO_FORMULARIO}>
          <Passo>Passo 2 de 2 ↓</Passo>
          <BotaoSalvar
            ocupado={fase.nome === "salvando"}
            variante="ghost"
            onClick={salvar}
            disabled={fase.nome === "salvando" || !podeSalvar}
          >
            {fase.nome === "salvando"
              ? "Salvando…"
              : parcelado === null
                ? "Diga se é parcelado para continuar"
                : parcelado === "parcelado"
                  ? "Compra parcelada não é aceita aqui"
                  : !podeSalvar
                    ? faltando
                      ? `Informe ${faltando} para continuar`
                      : "Preencha os campos para continuar"
                    : "Agendar — não entra no custo"}
          </BotaoSalvar>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      ) : (
        <Rodape className={COLUNA_DO_FORMULARIO}>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      )}
    </>
  );
}
