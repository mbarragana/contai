"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CampoArquivo, CampoTexto, Escolha } from "@/app/_components/campos";
import { Registrado } from "@/app/_components/registrado";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  Dica,
  EstadoErro,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarObra,
  criarDocumento,
  garantirFavorecido,
  mensagemDeErro,
  subirParaAcervo,
} from "@/lib/data";
import {
  avisaInss,
  classificacaoProposta,
  CONSEQUENCIA_SEM_RETENCAO,
  exigeRetencao,
  motivoQuarentena,
  retencaoParaBanco,
  statusDocumento,
  validarDocumento,
  type EntradaDocumento,
  type ErroCampo,
  type RespostaCpf,
  type RespostaRetencao,
} from "@/lib/fiscal/documento";
import { soDigitos, tipoPorDocumento } from "@/lib/fiscal/identificacao";
import { parseValorInput } from "@/lib/money";
import type { Classificacao, Obra, TipoDocumento } from "@/lib/types";

const TIPOS = [
  { valor: "nf_material", texto: "NF material" },
  { valor: "nf_servico", texto: "NF serviço" },
  { valor: "boleto", texto: "Boleto" },
] as const satisfies readonly { valor: TipoDocumento; texto: string }[];

const CLASSIFICACOES = [
  { valor: "material", texto: "Material" },
  { valor: "mao_obra", texto: "Mão de obra" },
] as const satisfies readonly { valor: Classificacao; texto: string }[];

const RESPOSTAS_CPF = [
  { valor: "sim", texto: "Sim" },
  { valor: "nao", texto: "Não" },
] as const satisfies readonly { valor: RespostaCpf; texto: string }[];

const RESPOSTAS_RETENCAO = [
  { valor: "sim", texto: "Sim" },
  { valor: "nao", texto: "Não" },
  { valor: "nao_sei", texto: "Não sei" },
] as const satisfies readonly { valor: RespostaRetencao; texto: string }[];

type Fase =
  | { nome: "carregando" }
  | { nome: "erro"; mensagem: string }
  | { nome: "formulario" }
  | { nome: "salvando" }
  | { nome: "salvo" };

export default function RegistrarDocumento() {
  const router = useRouter();
  const [obra, setObra] = useState<Obra | null>(null);
  const [fase, setFase] = useState<Fase>({ nome: "carregando" });
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState<TipoDocumento | null>(null);
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [classificacao, setClassificacao] = useState<Classificacao | null>(null);
  const [notaNoCpf, setNotaNoCpf] = useState<RespostaCpf | null>(null);
  const [retencao11, setRetencao11] = useState<RespostaRetencao | null>(null);
  const [erros, setErros] = useState<ErroCampo[]>([]);

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

  /** Proposta automática a partir do tipo; o humano pode corrigir. */
  function escolherTipo(novo: TipoDocumento) {
    setTipo(novo);
    setClassificacao(classificacaoProposta(novo));
    if (!exigeRetencao(novo)) setRetencao11(null);
  }

  const entrada: EntradaDocumento = useMemo(
    () => ({
      tipo,
      favorecidoNome: nome,
      favorecidoDocumento: documento,
      valorCentavos: parseValorInput(valor),
      vencimento: vencimento || null,
      classificacao,
      notaNoCpf,
      retencao11,
      temArquivo: arquivo !== null,
    }),
    [
      tipo,
      nome,
      documento,
      valor,
      vencimento,
      classificacao,
      notaNoCpf,
      retencao11,
      arquivo,
    ],
  );

  const erroDe = (campo: ErroCampo["campo"]) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  async function salvar() {
    const encontrados = validarDocumento(entrada);
    setErros(encontrados);
    setErroSalvar(null);
    if (encontrados.length > 0 || !obra || !arquivo) return;

    setFase({ nome: "salvando" });
    try {
      const tipoFavorecido = tipoPorDocumento(documento);
      if (tipoFavorecido === null) throw new Error("CNPJ/CPF inválido.");

      const arquivoPath = await subirParaAcervo(arquivo, "documento");
      const favorecidoId = await garantirFavorecido({
        nome: nome.trim(),
        documento: soDigitos(documento),
        tipo: tipoFavorecido,
      });

      const status = statusDocumento(tipo, notaNoCpf);
      const id = await criarDocumento({
        obra_id: obra.id,
        favorecido_id: favorecidoId,
        tipo: tipo as TipoDocumento,
        arquivo_path: arquivoPath,
        valorCentavos: entrada.valorCentavos as number,
        vencimento: tipo === "boleto" ? vencimento : null,
        classificacao,
        destinatario_cpf_ok: notaNoCpf === "sim",
        retencao_11: exigeRetencao(tipo) ? retencaoParaBanco(retencao11) : null,
        status,
        motivo_quarentena: motivoQuarentena(notaNoCpf),
      });

      // Documento fora do CPF: a consequência tem que aparecer na hora.
      if (status === "quarentena") {
        router.push(`/documento/${id}`);
        return;
      }
      setFase({ nome: "salvo" });
    } catch (erro) {
      setErroSalvar(mensagemDeErro(erro));
      setFase({ nome: "formulario" });
    }
  }

  if (fase.nome === "salvo") {
    return (
      <Registrado
        ano={new Date().getFullYear()}
        proximoPasso={
          <>
            registrar o pagamento quando ele acontecer{" "}
            <span className="text-[12px] text-mut">(em breve — US-003)</span>
          </>
        }
        custo="soma quando o pagamento for registrado"
      />
    );
  }

  return (
    <>
      <AppBar
        titulo="Registrar documento"
        sub={
          arquivo
            ? "Interação 2 de 3 — arquivo anexado ✓"
            : "Interação 2 de 3 — anexe o arquivo"
        }
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
            {erroSalvar ? <Banner cor="red" role="alert">{erroSalvar}</Banner> : null}

            <Card className="flex flex-col gap-3.5">
              <CampoArquivo
                rotulo="Arquivo"
                ajuda="PDF, XML ou foto — obrigatório, é o que fica no acervo."
                accept=".pdf,.xml,image/*"
                arquivo={arquivo}
                onChange={setArquivo}
                erro={erroDe("temArquivo")}
              />
              <Escolha
                rotulo="Tipo"
                opcoes={TIPOS}
                valor={tipo}
                onChange={escolherTipo}
                erro={erroDe("tipo")}
              />
              <CampoTexto
                rotulo="Emitente"
                valor={nome}
                onChange={setNome}
                placeholder="Razão social de quem emitiu"
                erro={erroDe("favorecidoNome")}
              />
              <CampoTexto
                rotulo="CNPJ / CPF do emitente"
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
              {tipo === "boleto" ? (
                <CampoTexto
                  rotulo="Vencimento"
                  tipo="date"
                  valor={vencimento}
                  onChange={setVencimento}
                  erro={erroDe("vencimento")}
                />
              ) : null}
              <Escolha
                rotulo="Classificação"
                opcoes={CLASSIFICACOES}
                valor={classificacao}
                onChange={setClassificacao}
                erro={erroDe("classificacao")}
              />
            </Card>

            <Card className="flex flex-col gap-3.5">
              <Escolha
                destaque
                rotulo="A nota está no seu CPF?"
                opcoes={RESPOSTAS_CPF}
                valor={notaNoCpf}
                onChange={setNotaNoCpf}
                erro={erroDe("notaNoCpf")}
              />
              {notaNoCpf === "nao" ? (
                <Banner cor="red" role="alert">
                  Vai para <strong>quarentena</strong>: não entra no custo de
                  aquisição. Peça a nota no seu CPF.
                </Banner>
              ) : null}

              {exigeRetencao(tipo) ? (
                <>
                  <Escolha
                    destaque
                    rotulo="NF de serviço: tem retenção de 11%?"
                    opcoes={RESPOSTAS_RETENCAO}
                    valor={retencao11}
                    onChange={setRetencao11}
                    erro={erroDe("retencao11")}
                  />
                  {avisaInss(tipo, retencao11) ? (
                    <Banner cor="amb" role="status">
                      {CONSEQUENCIA_SEM_RETENCAO} O registro é salvo mesmo
                      assim — esse INSS fica para você pagar na regularização
                      da obra.
                    </Banner>
                  ) : null}
                </>
              ) : null}
            </Card>

            <Dica>
              Olhe na nota antes de responder — &quot;não&quot; no CPF leva à
              quarentena; &quot;não/não sei&quot; na retenção gera o aviso do
              INSS. Sem responder, não salva.
            </Dica>
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
            {fase.nome === "salvando" ? "Salvando…" : "Salvar registro"}
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
