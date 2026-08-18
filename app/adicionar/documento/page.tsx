"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CampoArquivo, CampoTexto, Escolha } from "@/app/_components/campos";
import { useSessao } from "@/app/_components/sessao";
import { AfirmacaoObra, TelaTrocarObra } from "@/app/_components/obra";
import { Registrado } from "@/app/_components/registrado";
import { useObraDoRegistro } from "@/app/_components/usar-obra-do-registro";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Chip,
  Consequencia,
  Corpo,
  Dica,
  EstadoErro,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarPainel,
  classificarErro,
  criarDocumento,
  criarVinculos,
  garantirFavorecido,
  mensagemDeErro,
  subirParaAcervo,
  type PainelDados,
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
import {
  NF_SERVICO_SEM_CNO_ALAVANCA,
  NF_SERVICO_SEM_CNO_EFEITO,
  NF_SERVICO_SEM_CNO_TITULO,
  ROTULO_SALVAR_SEM_CNO,
} from "@/lib/fiscal/obra";
import {
  alocarCusto,
  ehDocumentoHabil,
  pagamentosCandidatos,
  type Candidato,
} from "@/lib/fiscal/vinculo";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL, parseValorInput } from "@/lib/money";
import type { Classificacao, Documento, Pagamento, TipoDocumento } from "@/lib/types";

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
  | { nome: "formulario" }
  | { nome: "salvando" }
  | {
      nome: "salvo";
      id: string;
      obraNome: string;
      /** Quantos pagamentos entraram ligados a este documento. */
      ligados: number;
      /**
       * Critério 1: o documento entrou e o VÍNCULO falhou. Sem transação entre
       * tabelas no PostgREST, este caso é real — e a tela diz que o documento
       * ficou SEM VÍNCULO, em vez de dar um sucesso mentiroso.
       */
      vinculoFalhou: boolean;
    };

export default function RegistrarDocumento() {
  const router = useRouter();
  const { pedirReautenticacao } = useSessao();
  // A obra deste registro: afirmada na tela, trocável aqui mesmo, e é ELA que
  // vai para o `obra_id` no salvar (critérios 6, 7 e 16).
  const registro = useObraDoRegistro();
  const obra = registro.obra;
  const [trocando, setTrocando] = useState(false);
  const [fase, setFase] = useState<Fase>({ nome: "formulario" });
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

  // Caminho A (critério 1): "já paguei esta nota". Os pagamentos da obra só
  // são buscados quando ele marca — o caminho de captura continua curto.
  const [jaPaguei, setJaPaguei] = useState(false);
  const [painelDaObra, setPainelDaObra] = useState<PainelDados | null>(null);
  const [erroCandidatos, setErroCandidatos] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);

  const erroDe = (campo: ErroCampo["campo"]) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  useEffect(() => {
    if (!jaPaguei || !obra) return;
    let cancelado = false;
    void (async () => {
      try {
        const painel = await carregarPainel(obra.id);
        if (!cancelado) setPainelDaObra(painel);
      } catch (erro) {
        if (!cancelado) setErroCandidatos(mensagemDeErro(erro));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [jaPaguei, obra]);

  /**
   * O documento ainda não existe no banco — os candidatos são ordenados contra
   * um documento PROVISÓRIO montado com o que já está na tela, pela mesma
   * função pura do seletor do caminho B. Sugestão continua sendo ordenação e
   * rótulo; marcação é sempre do dedo do Mateus (critério 10).
   */
  const candidatos: Candidato<Pagamento>[] = useMemo(() => {
    if (!painelDaObra || !obra) return [];
    const provisorio: Documento = {
      id: "novo",
      obraId: obra.id,
      tipo: tipo ?? "nf_material",
      status: statusDocumento(tipo, notaNoCpf),
      valorCentavos: parseValorInput(valor),
      vencimento: null,
      classificacao,
      destinatarioCpfOk: notaNoCpf === "sim",
      retencao11: null,
      motivoQuarentena: null,
      favorecidoNome: nome.trim() || null,
      arquivoPath: "",
    };
    return pagamentosCandidatos(
      provisorio,
      painelDaObra.pagamentos,
      alocarCusto(painelDaObra),
    );
  }, [painelDaObra, obra, tipo, notaNoCpf, valor, classificacao, nome]);

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
      // `obra.id` é o da obra afirmada na tela — não se relê a preferência do
      // aparelho aqui: entre abrir e salvar ela pode ter mudado em outra aba.
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
      // Caminho A: o vínculo vem depois do documento e em outra chamada — não
      // há transação entre tabelas no PostgREST. Falhando, o documento fica
      // salvo e a tela DIZ que ele ficou sem vínculo (critério 1).
      const paraLigar = candidatos.filter((c) => marcados.includes(c.item.id));
      let vinculoFalhou = false;
      if (paraLigar.length > 0) {
        try {
          await criarVinculos(
            paraLigar.map((c) => ({
              pagamentoId: c.item.id,
              documentoId: id,
              obraDoPagamentoId: c.item.obraId,
              obraDoDocumentoId: obra.id,
              documentoHabil: ehDocumentoHabil({
                tipo: tipo as TipoDocumento,
                status,
              }),
            })),
          );
        } catch {
          vinculoFalhou = true;
        }
      }

      setFase({
        nome: "salvo",
        id,
        obraNome: obra.nome,
        ligados: vinculoFalhou ? 0 : paraLigar.length,
        vinculoFalhou,
      });
    } catch (erro) {
      setFase({ nome: "formulario" });
      // Sessão morta descoberta no "Salvar": sobreposto de reautenticação, e
      // NUNCA navegação. O formulário continua montado com anexo, valor e as
      // respostas dos checks fiscais — perder isso no canteiro é perder o
      // registro, e custo não comprovado não existe (IN SRF 84/2001 art. 17).
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErro(erro));
    }
  }

  if (fase.nome === "salvo") {
    return (
      <Registrado
        ano={Number(hojeIso().slice(0, 4))}
        obraNome={fase.obraNome}
        hrefCorrigirObra={`/documento/${fase.id}/obra`}
        aviso={
          fase.vinculoFalhou ? (
            <>
              <strong>O documento foi salvo, mas ficou SEM VÍNCULO</strong> com
              os pagamentos que você marcou. Ele está no acervo e ainda não
              compõe custo confirmado — abra o documento e use &quot;Ligar a um
              pagamento&quot;.
            </>
          ) : undefined
        }
        proximoPasso={
          fase.ligados > 0 ? (
            <>
              nada pendente — {fase.ligados}{" "}
              {fase.ligados === 1 ? "pagamento ligado" : "pagamentos ligados"}
            </>
          ) : (
            <>registrar o pagamento quando ele acontecer</>
          )
        }
        custo={
          fase.ligados > 0
            ? "conta pela data do pagamento ligado — regime de caixa"
            : "soma quando o pagamento for registrado e ligado a esta nota"
        }
      />
    );
  }

  // Tela 12 — troca sem sair do fluxo: este componente continua montado, então
  // os campos já preenchidos seguem intactos ao voltar.
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

  const semCno = obra !== null && obra.cno === null;
  const avisaObraSemCno = semCno && tipo === "nf_servico";

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
            {erroSalvar ? <Banner cor="red" role="alert">{erroSalvar}</Banner> : null}

            {/* Critério 7: o nome da obra por extenso, com o escape ao lado. */}
            <AfirmacaoObra
              rotulo="Registrando em"
              nome={obra.nome}
              onTrocar={
                registro.obras.length > 1 ? () => setTrocando(true) : undefined
              }
            />

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

            {avisaObraSemCno ? (
              // Texto literal do parecer do contador (2026-08-09, seção 4). É
              // ESTA tela que faz agir: a de cadastro se vê uma vez na vida.
              // Não bloqueia (critério 15) — bloquear destruiria o custo de
              // aquisição, que não depende do CNO, para proteger uma aferição
              // que já está danificada.
              <Card className="border-red">
                <Chip cor="red">{NF_SERVICO_SEM_CNO_TITULO}</Chip>
                <p className="mt-2.5 text-[13.5px]">
                  {NF_SERVICO_SEM_CNO_EFEITO}
                </p>
                <Consequencia cor="amb">
                  {NF_SERVICO_SEM_CNO_ALAVANCA}
                </Consequencia>
              </Card>
            ) : null}

            {/* Caminho A do critério 1: o vínculo no ATO do registro, que é o
                caminho mais curto do parecer §5.4 — o caso dele é 1↔1, mesmo
                valor. Nada aqui vem marcado. */}
            <Card className="flex flex-col gap-2">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={jaPaguei}
                  onChange={(e) => {
                    setJaPaguei(e.target.checked);
                    if (!e.target.checked) setMarcados([]);
                  }}
                  className="h-5 w-5 flex-none"
                />
                <span className="text-[13.5px] font-semibold">
                  Já paguei esta nota
                </span>
              </label>

              {jaPaguei ? (
                <>
                  <Dica>
                    Marque os pagamentos já registrados que correspondem a esta
                    nota. Nada vem marcado — o vínculo é você que afirma.
                  </Dica>

                  {erroCandidatos ? (
                    <Banner cor="red" role="alert">
                      Não deu para carregar os pagamentos desta obra:{" "}
                      {erroCandidatos} Você pode salvar a nota assim mesmo e
                      ligar depois, pela tela dela.
                    </Banner>
                  ) : null}

                  {painelDaObra === null && !erroCandidatos ? (
                    <Carregando rotulo="Carregando os pagamentos" />
                  ) : null}

                  {painelDaObra !== null && candidatos.length === 0 ? (
                    <Dica>
                      Nenhum pagamento desta obra está sem nota. Se você já
                      pagou, o pagamento ainda não foi registrado — dá para
                      registrá-lo depois de salvar a nota.
                    </Dica>
                  ) : null}

                  {candidatos.map((c) => {
                    const marcado = marcados.includes(c.item.id);
                    return (
                      <label
                        key={c.item.id}
                        className={`flex min-h-[44px] cursor-pointer gap-3 rounded-[10px] border px-3 py-2.5 ${
                          marcado ? "border-ink bg-soft" : "border-line bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setMarcados((atual) =>
                              atual.includes(c.item.id)
                                ? atual.filter((x) => x !== c.item.id)
                                : [...atual, c.item.id],
                            )
                          }
                          className="mt-1 h-5 w-5 flex-none"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-[14px] font-semibold break-words">
                              {c.item.favorecidoNome ??
                                "Favorecido não informado"}
                            </span>
                            <span className="mono flex-none text-[15px] font-bold">
                              {formatarBRL(c.item.valorCentavos)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[12px] text-mut">
                            {c.item.meio.toUpperCase()} · pago em{" "}
                            {c.item.dataPagamento}
                          </span>
                          {c.sugestao ? (
                            <span className="mt-1 block text-[11.5px] font-semibold text-mut">
                              {c.sugestao}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
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
              : avisaObraSemCno
                ? ROTULO_SALVAR_SEM_CNO
                : "Salvar registro"}
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
