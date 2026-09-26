"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ControleVerDocumento,
  LightboxDoAnexo,
  useModoDoPreview,
  useUrlDoAnexo,
} from "@/app/_components/anexo-preview";
import { CampoArquivo, CampoTexto, Escolha } from "@/app/_components/campos";
import {
  CamposCurtos,
  COLUNA_DO_FORMULARIO,
  GradeDaCaptura,
  LinhaDoResumo,
  PassosDaCaptura,
} from "@/app/_components/captura";
import { useSessao } from "@/app/_components/sessao";
import { AfirmacaoObra, TelaTrocarObra } from "@/app/_components/obra";
import { Registrado } from "@/app/_components/registrado";
import { BlocoRetencaoDaCaptura } from "@/app/_components/retencao";
import { useObraDoRegistro } from "@/app/_components/usar-obra-do-registro";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  BotaoSalvar,
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
  buscarNotasComNumero,
  carregarPainel,
  classificarErro,
  criarDocumento,
  criarLinhasRetencao,
  criarVinculos,
  garantirFavorecido,
  mensagemDeErro,
  mensagemDeErroDeGravacao,
  subirParaAcervo,
  type PainelDados,
} from "@/lib/data";
import {
  AJUDA_DATA_EMISSAO,
  AJUDA_NUMERO,
  AJUDA_SERIE,
  bloqueiaPorCnoDeOutraObra,
  classificacaoProposta,
  cnoReferenciadoParaBanco,
  CONSEQUENCIA_QUARENTENA,
  duplicataDe,
  exigeCnoReferenciado,
  exigeIdentificacaoDaNota,
  exigeRetencao,
  motivoQuarentena,
  notaTrazCnoParaBanco,
  numeroParaBanco,
  pendenteDeCno,
  resumoAfirmado,
  ROTULO_DA_RESPOSTA_CPF,
  ROTULO_DO_CNO_NA_NOTA,
  ROTULO_DO_TIPO,
  SEM_ARQUIVO_DIALOGO_ANEXAR,
  SEM_ARQUIVO_DIALOGO_CONSEQUENCIA,
  SEM_ARQUIVO_DIALOGO_PORQUE,
  SEM_ARQUIVO_DIALOGO_SALVAR,
  SEM_ARQUIVO_DIALOGO_TITULO,
  serieParaBanco,
  statusDocumento,
  validarDocumento,
  type DocumentoRegistrado,
  type EntradaDocumento,
  type ErroCampo,
  type RespostaCnoNota,
  type RespostaCpf,
} from "@/lib/fiscal/documento";
import {
  acaoDaRetencaoParcial,
  CHIP_RETENCAO_PARCIALMENTE_GRAVADA,
  contagemDaRetencaoParcial,
  DICA_GATE_DESTACADA,
  DICA_GATE_DESTACADA_LARGA,
  OPCOES_GATE,
  PERGUNTA_GATE,
  SUGESTAO_GATE_CONFIRA,
  SUGESTAO_RETENCAO_CHIP,
  SUGESTAO_RETENCAO_FALHOU,
  SUGESTAO_RETENCAO_LENDO,
  type EntradaLinhaRetencao,
} from "@/lib/fiscal/retencao";
import { soDigitos, tipoPorDocumento } from "@/lib/fiscal/identificacao";
import {
  ACAO_NOTA_SEM_CNO,
  CNO_NAO_ALCANCA_O_CUSTO,
  CONSEQUENCIA_CNO_DA_NOTA,
  formatarDataBR,
  NF_SERVICO_SEM_CNO_ALAVANCA,
  NF_SERVICO_SEM_CNO_EFEITO,
  NF_SERVICO_SEM_CNO_TITULO,
  ROTULO_SALVAR_SEM_CNO,
} from "@/lib/fiscal/obra";
import {
  alocarCusto,
  ehDocumentoHabil,
  pagamentosCandidatos,
  VINCULO_QUARENTENA_NAO_GERA_CUSTO,
  type Candidato,
} from "@/lib/fiscal/vinculo";
import { tamanhoLegivelDoAnexo } from "@/lib/acervo";
import {
  ABRIR_PDF_EM_ABA,
  ehXml,
  VER_DOCUMENTO_LARGA,
  VER_DOCUMENTO_PISO,
  XML_SEM_PREVIEW,
} from "@/lib/preview-anexo";
import type { SugestaoLinhaRetencao } from "@/lib/extracao/retencao-texto";
import { paraCentavos, type ExtracaoDocumento } from "@/lib/extracao/schema";
import { hojeIso } from "@/lib/hoje";
import { centavosParaInput, formatarBRL, parseValorInput } from "@/lib/money";
import type {
  Classificacao,
  Documento,
  Pagamento,
  RespostaRetencaoNaNota,
  TipoDocumento,
} from "@/lib/types";

/**
 * ⚠️ Os rótulos vêm de `lib/fiscal/documento.ts` desde o CONTAI-047, e não
 * estão mais escritos aqui: o resumo do rail mostra a MESMA palavra que o botão
 * marcado — texto duplicado é texto que diverge no primeiro ajuste.
 */
const TIPOS = [
  { valor: "nf_material", texto: ROTULO_DO_TIPO.nf_material },
  { valor: "nf_servico", texto: ROTULO_DO_TIPO.nf_servico },
  { valor: "boleto", texto: ROTULO_DO_TIPO.boleto },
] as const satisfies readonly { valor: TipoDocumento; texto: string }[];

const CLASSIFICACOES = [
  { valor: "material", texto: "Material" },
  { valor: "mao_obra", texto: "Mão de obra" },
] as const satisfies readonly { valor: Classificacao; texto: string }[];

const RESPOSTAS_CPF = [
  { valor: "sim", texto: ROTULO_DA_RESPOSTA_CPF.sim },
  { valor: "nao", texto: ROTULO_DA_RESPOSTA_CPF.nao },
] as const satisfies readonly { valor: RespostaCpf; texto: string }[];

/**
 * CONTAI-007, critério 1 — **três toques, zero digitação** (pre-mortem 1: se o
 * campo fosse livre, de 14 dígitos, o ticket voltava). O CNO das obras
 * cadastradas o app já tem; o que falta é o que está no papel.
 */
const RESPOSTAS_CNO = [
  { valor: "desta_obra", texto: ROTULO_DO_CNO_NA_NOTA.desta_obra },
  { valor: "outra_obra", texto: ROTULO_DO_CNO_NA_NOTA.outra_obra },
  { valor: "nao_traz", texto: ROTULO_DO_CNO_NA_NOTA.nao_traz },
] as const satisfies readonly { valor: RespostaCnoNota; texto: string }[];

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
      /**
       * A nota entrou em quarentena. Só chega a esta confirmação quando o
       * vínculo TAMBÉM falhou: no caminho normal quem diz a consequência é a
       * tela do documento, e a navegação acontece antes daqui.
       */
      quarentena: boolean;
      /** CONTAI-033 — a confirmação não pode dizer "arquivo guardado" quando não há. */
      semArquivo: boolean;
      /**
       * CONTAI-007, critério 3 — a nota entrou COM PENDÊNCIA de CNO. A
       * consequência é dita na confirmação (tela 7 do mock), e não só na lista
       * de pendências: "nunca em branco silencioso" quer dizer que ele vê o
       * efeito no ato, enquanto ainda se lembra de qual nota é.
       */
      semCno: boolean;
      /**
       * CONTAI-053, critério 3 — quantas linhas de retenção foram TENTADAS e
       * quantas ENTRARAM. Documento e linhas gravam em dois statements (sem
       * transação pelo PostgREST), então "entrou tudo" não pode ser suposto.
       *
       * ⚠️ Os dois números juntos, e não um booleano `retencaoFalhou`: a
       * mensagem do spec diz **quantas** entraram e quantas não — o pre-mortem 4
       * do ticket é exatamente o "1 de 3 ficou fora em silêncio".
       */
      retencoesTentadas: number;
      retencoesEntraram: number;
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
  /**
   * **CONTAI-048 — ver o papel anexado sem sair do formulário.**
   *
   * ⚠️ Três estados que NÃO tocam em nada fiscal: a URL local do arquivo, o
   * modo de exibição (imagem / PDF embutido / PDF em aba nova) e o modal
   * aberto ou fechado. Preview não preenche campo, não valida o digitado e não
   * impede salvar (critérios 2 e 4 do ticket).
   */
  const urlDoAnexo = useUrlDoAnexo(arquivo);
  const modoDoAnexo = useModoDoPreview(arquivo);
  const [verDocumento, setVerDocumento] = useState(false);
  const [tipo, setTipo] = useState<TipoDocumento | null>(null);
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [valor, setValor] = useState("");
  const [numero, setNumero] = useState("");
  // Opcional: nem toda NFS-e municipal tem série. Campo PRÓPRIO (R6) — grudar
  // "1042/2" no número é gravar dois dados num só, sem volta.
  const [serie, setSerie] = useState("");
  // ⚠️ Nasce VAZIO e continua vazio até o dedo do Mateus (R3): nada de "hoje",
  // de `created_at` nem da data do pagamento. Data inventada em campo fiscal é
  // pior do que campo vazio — vazio pergunta, preenchido afirma.
  const [dataEmissao, setDataEmissao] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [classificacao, setClassificacao] = useState<Classificacao | null>(null);
  const [notaNoCpf, setNotaNoCpf] = useState<RespostaCpf | null>(null);
  /**
   * **CONTAI-038, critério 1 — o GATE.** Duas opções, nada pré-marcado.
   *
   * ⚠️ **MUDOU NO CONTAI-053**: até aqui o comentário dizia que o repeater de
   * linhas "NÃO vive aqui". Abaixo de 880px continua sendo verdade — gate e nada
   * mais, as linhas no detalhe, sentado. **A partir de 880px** o formulário de
   * linha aparece nesta tela (`BlocoRetencaoDaCaptura`), porque a Dor de Origem é
   * ter que voltar depois para completar o que já se leu na hora, e porque o
   * cenário de gestão do Mateus é justamente a tela larga.
   *
   * ⚠️ **MUDOU NO CONTAI-062 — a resposta e a ORIGEM dela viajam juntas, num
   * estado só.** O gate agora pode nascer de duas fontes: do dedo do Mateus ou
   * da leitura do PDF (ADENDO 5 §1/§3 do parecer
   * `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`) — e a tela tem
   * de dizer qual das duas foi, porque sugestão nunca pode se passar por
   * afirmação (salvaguarda 1).
   *
   * **Por que UM estado com dois campos, e não `retencaoNaNota` +
   * `origemGateRetencao` separados**: é o que torna a decisão do critério 7
   * ATÔMICA. A sugestão chega tarde, num `await`, e só pode preencher o gate se
   * ele ainda estiver vazio NAQUELE instante — nunca com base no valor que o
   * efeito capturou quando nasceu. Com dois `useState` não há como ler o valor
   * mais recente e derivar a origem correspondente na mesma transição: o
   * updater de `setRetencaoNaNota` receberia o valor fresco, mas
   * `setOrigemGateRetencao` não teria como saber se o primeiro se aplicou ou
   * não, e resolver isso por `ref` espelhado depende de o efeito de espelho ter
   * rodado antes da resposta chegar. Com um estado só, `setGateDeRetencao((atual)
   * => atual ?? ...)` é puro, atômico e correto em qualquer ordem — a resposta
   * manual do Mateus vence SEMPRE, inclusive quando ele responde com o fetch em
   * voo.
   *
   * ⚠️ **A origem NUNCA grava**: no "Salvar registro" só `resposta` viaja para
   * `criarDocumento`. Não existe (nem pode existir) um terceiro valor
   * `"sugerida"` no enum `retencao_na_nota` do banco — sem migration, sem
   * coluna nova (critério 6).
   */
  const [gateDeRetencao, setGateDeRetencao] = useState<{
    resposta: RespostaRetencaoNaNota;
    origem: "manual" | "sugerida";
  } | null>(null);
  const retencaoNaNota = gateDeRetencao?.resposta ?? null;
  /**
   * O valor cuja pílula deve aparecer como SUGESTÃO (âmbar + selo) em vez de
   * resposta afirmada (preenchido escuro). `null` nos dois casos em que não há
   * sugestão a sinalizar: gate vazio, ou gate respondido pelo Mateus.
   */
  const gateSugerido =
    gateDeRetencao?.origem === "sugerida" ? gateDeRetencao.resposta : null;
  /**
   * **CONTAI-053 — as linhas de retenção antes de o documento existir.**
   *
   * ⚠️ **Em memória, e nada mais:** nenhuma linha toca o banco antes do "Salvar
   * registro" — quem afirma o registro continua sendo aquele botão. Criar o
   * documento mais cedo para poder gravar linha por linha é o documento órfão do
   * pre-mortem 3 do ticket.
   */
  const [linhasPendentes, setLinhasPendentes] = useState<EntradaLinhaRetencao[]>(
    [],
  );

  /**
   * **CONTAI-055 — a sugestão determinística do CONTAI-054, nesta tela.**
   *
   * Três estados, e nenhum deles é fiscal: a leitura a confirmar, a espera e a
   * falha. Quem os produz é o efeito logo abaixo; quem os mostra é o
   * `BlocoRetencaoDaCaptura`.
   *
   * ⚠️ A sugestão **nunca** carrega `composicao`, `tributo`, `eDescontoEfetivo`
   * nem `quemRecolhe` — o tipo `SugestaoLinhaRetencao` não os declara (Gate
   * Fiscal do ticket, herdado do CONTAI-054).
   */
  const [sugestaoRetencao, setSugestaoRetencao] =
    useState<SugestaoLinhaRetencao | null>(null);
  const [lendoSugestaoRetencao, setLendoSugestaoRetencao] = useState(false);
  const [falhouSugestaoRetencao, setFalhouSugestaoRetencao] = useState(false);

  /**
   * ⚠️ **Sair de "destacada" APAGA as linhas acumuladas**, pela mesma razão do
   * `setCnoNaNota(null)` ao trocar de obra: uma linha guardada numa nota que o
   * gate diz não ter retenção é afirmação órfã — e ela gravaria no banco contra
   * um `retencao_na_nota` que a contradiz. Voltar para "destacada" devolve o
   * bloco ao estado vazio; nunca há linha fantasma (spec, §2).
   *
   * ⚠️ **CONTAI-062 — todo toque aqui é MANUAL, sem exceção**, inclusive o toque
   * na opção que a leitura já tinha sugerido. É esse toque que troca a pílula de
   * âmbar+selo para o preenchido escuro de sempre: ele é a confirmação explícita
   * de uma sugestão (o "confirmar implícito" é seguir em frente sem tocar e
   * apertar "Salvar registro"). Tocar na MESMA opção não muda a resposta e, por
   * isso, não encosta em `linhasPendentes` — só a origem muda (critério 8).
   */
  function responderGateDeRetencao(resposta: RespostaRetencaoNaNota) {
    setGateDeRetencao({ resposta, origem: "manual" });
    if (resposta !== "destacada") setLinhasPendentes([]);
  }
  /**
   * CONTAI-007 — a pergunta do CNO. Nasce `null`, como todo campo fiscal deste
   * formulário: **a extração nunca a preenche** (é pergunta sobre o papel na
   * mão, não leitura de PDF — mesma regra de `notaNoCpf`).
   *
   * ⚠️ **O gate de retenção deixou de estar nesta lista no CONTAI-062**, e só
   * ele: o ADENDO 5 §1 do parecer o reclassifica como fato impresso e
   * aritmeticamente conferível. `notaNoCpf`, `cnoNaNota` e os quatro campos de
   * classificação da linha continuam 100% manuais (ADENDO 5 §4).
   */
  const [cnoNaNota, setCnoNaNota] = useState<RespostaCnoNota | null>(null);
  const [erros, setErros] = useState<ErroCampo[]>([]);
  /**
   * CONTAI-033 — o diálogo do §A.7.1. **Overlay dentro desta tela**, nunca rota
   * nova (decisão de design 1 do mock): o caminho de captura continua em 1
   * tela, e "Anexar agora" volta ao campo do anexo sem perder nada digitado.
   */
  const [mostrarDialogoSemArquivo, setMostrarDialogoSemArquivo] =
    useState(false);

  // US-008 Fase 2 — extração automática (Gemini). Só sugere: quem afirma o
  // campo continua sendo o dedo do Mateus em "Salvar registro". Nunca toca
  // `notaNoCpf` — pergunta de admissibilidade do documento inteiro, fora de
  // qualquer sugestão (ADENDO 5 §1/§4).
  //
  // ⚠️ E nunca toca o gate de retenção TAMPOUCO — mas agora por um motivo
  // diferente, e o CONTAI-062 corrigiu a frase que dizia "pergunta fiscal, não
  // leitura de PDF": o gate É sugerido a partir do PDF, só não por AQUI. Quem o
  // sugere é o parser determinístico local (`/api/sugerir-retencao`), num
  // caminho separado e sem provedor de IA — decisão de gatilho da Viabilidade do
  // CONTAI-062: amarrar a sugestão do gate ao botão do Gemini criaria dois
  // caminhos com dois modos de falha e deixaria sem sugestão quem escolhe o tipo
  // à mão.
  const [extraindo, setExtraindo] = useState(false);
  const [erroExtracao, setErroExtracao] = useState<string | null>(null);
  const [extracao, setExtracao] = useState<ExtracaoDocumento | null>(null);

  async function extrairDaNota() {
    if (!arquivo) return;
    setExtraindo(true);
    setErroExtracao(null);
    setExtracao(null);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const resposta = await fetch("/api/extrair-documento", {
        method: "POST",
        body: form,
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErroExtracao(
          typeof corpo?.erro === "string"
            ? corpo.erro
            : "Não foi possível extrair os dados desta nota.",
        );
        return;
      }
      const lido = corpo as ExtracaoDocumento;
      setExtracao(lido);

      // Só preenche campo VAZIO (mesma regra de `preencherValorDaNota` em
      // adicionar/pagamento): extração não sobrescreve o que o Mateus já
      // digitou.
      if (lido.tipo && tipo === null) escolherTipo(lido.tipo);
      if (lido.classificacao && classificacao === null) {
        setClassificacao(lido.classificacao);
      }
      setNumero((atual) => atual || lido.numero || "");
      setSerie((atual) => atual || lido.serie || "");
      setDataEmissao((atual) => atual || lido.dataEmissao || "");
      setVencimento((atual) => atual || lido.vencimento || "");
      setNome((atual) => atual || lido.favorecidoNome || "");
      setDocumento((atual) => atual || lido.favorecidoDocumento || "");
      const centavos = paraCentavos(lido.valorReais);
      setValor((atual) => atual || (centavos !== null ? centavosParaInput(centavos) : ""));
    } catch {
      setErroExtracao("Não foi possível falar com o Gemini agora.");
    } finally {
      setExtraindo(false);
    }
  }

  /** Proposta automática a partir do tipo; o humano pode corrigir. */
  function escolherTipo(novo: TipoDocumento) {
    setTipo(novo);
    setClassificacao(classificacaoProposta(novo));
    // Tipo que não pergunta retenção não pode carregar gate NEM linha: as duas
    // coisas só existem em NF de serviço (CONTAI-053).
    if (!exigeRetencao(novo)) {
      setGateDeRetencao(null);
      setLinhasPendentes([]);
    }
    // Sair de NF de serviço apaga a resposta do CNO: ela só existe ali, e uma
    // resposta guardada em tipo que não a pergunta é afirmação órfã.
    if (!exigeCnoReferenciado(novo)) setCnoNaNota(null);
  }

  /**
   * ══ CONTAI-055/062 — a chamada a `POST /api/sugerir-retencao` ═══════════════
   *
   * **Quando** (⚠️ **mudou no CONTAI-062**): basta um PDF anexado num tipo que
   * pergunta retenção. **O gate saiu da pré-condição** — era ele que fazia a
   * leitura só rodar DEPOIS de o Mateus marcar "destacada" à mão, que é
   * literalmente a Dor de Origem deste ticket (*"eu não espero clicar em nada, se
   * estou anexando o pdf e mandando extrair automaticamente"*). Agora a leitura
   * roda sozinha e o resultado pode preencher o gate como sugestão (ADENDO 5
   * §1/§3 do parecer
   * `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`).
   *
   * ⚠️ **A leitura roda mesmo com o gate já em `"nenhuma"`, e isso é de
   * propósito**: ela nunca contradiz o Mateus (o efeito abaixo só preenche o gate
   * quando ele está `null`), mas a sugestão fica guardada — se ele mudar de ideia
   * e marcar "destacada" à mão, o trecho literal e a linha aparecem na hora, sem
   * um segundo fetch e sem trocar de anexo.
   *
   * **Por que EFEITO e não no `onChange` do gate**: as duas coisas que invalidam
   * a sugestão são `tipo` e ARQUIVO, e o arquivo pode ser trocado a qualquer
   * momento. Com a chamada num handler, a sugestão do PDF anterior sobreviveria à
   * troca do anexo — leitura de um papel exibida ao lado de outro. Aqui quem
   * manda é o `alvo` logo abaixo: ele É a regra de invalidação, num lugar só.
   *
   * ⚠️ **Falha NUNCA bloqueia o registro** (critério 4): não há `throw`, não há
   * erro de campo e o "Salvar registro" não olha para nada disto. O pior caso é o
   * formulário de linha em branco, que é o comportamento do CONTAI-053 sozinho.
   *
   * ⚠️ **Nada aqui grava**: a rota só lê o PDF que vai no corpo e devolve uma
   * sugestão a confirmar. O que grava continua sendo o "Salvar registro".
   *
   * ⚠️ A chamada acontece em QUALQUER largura, inclusive no piso de 375px onde o
   * bloco está escondido por CSS. É deliberado e foi aprovado no Gate 2: ler
   * `window.innerWidth` para decidir seria a corrida de hidratação que o spec do
   * CONTAI-053 proíbe, e o custo de uma leitura LOCAL sem gravação não justifica
   * trocar a disciplina.
   * **A condição de validade disto está nomeada**: vale enquanto
   * `/api/sugerir-retencao` for parser determinístico local. No dia em que ela
   * chamar provedor de IA pago, gastar cota numa tela onde o resultado está
   * escondido deixa de ser aceitável — e aí a saída é um gate por `matchMedia`
   * dentro de um efeito (nunca no render), não desligar a sugestão.
   *
   * ⚠️ Sem `AbortController` de propósito (nit não-bloqueante do Gate 2): o
   * `cancelado` já impede resposta velha de virar estado, e a requisição é um POST
   * local de milissegundos. Abortar de verdade só passa a valer a pena quando
   * houver custo por chamada do outro lado — mesma condição do parágrafo acima.
   *
   * O `alvo` abaixo é o PDF que a sugestão desta tela descreve — ou `null` quando
   * não há sugestão possível. É ele, e não três condições espalhadas, que define
   * de quem a sugestão é: **mudou o alvo, a sugestão anterior morre**.
   */
  const alvoDaSugestaoDeRetencao =
    exigeRetencao(tipo) && arquivo !== null && arquivo.type === "application/pdf"
      ? arquivo
      : null;

  /**
   * ⚠️ **A invalidação é ajustada no RENDER, não dentro do efeito** — é o padrão
   * do React para estado que acompanha um valor derivado, e é o que o
   * `react-hooks/set-state-in-effect` cobra (mesmo padrão do `useEsperaLonga` em
   * `ui.tsx`). Uma sugestão que sobrevive à troca do anexo é a leitura de um papel
   * exibida ao lado de outro.
   *
   * ⚠️ **CONTAI-062, bloqueante do Gate 2 — o GATE morre aqui junto com a linha.**
   * A primeira versão deste ticket zerava `sugestaoRetencao`/`falhou`/`lendo` e
   * deixava `gateDeRetencao` de pé: trocado o PDF reconhecido por um sem padrão,
   * por uma foto, ou removido o anexo, a pílula continuava marcada "Destacada" com
   * o selo "Sugerida" — sem trecho literal embaixo, sem linha nenhuma, motivada
   * por um papel que já não está mais ali. É a MESMA regra que este bloco sempre
   * aplicou à linha, só que faltava aplicar ao gate (ADENDO 5 §3, salvaguardas 1
   * e 4 do parecer `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`:
   * gate e linha se sugerem juntos, logo têm de MORRER juntos).
   */
  const [alvoVistoDaSugestao, setAlvoVistoDaSugestao] = useState(
    alvoDaSugestaoDeRetencao,
  );
  if (alvoVistoDaSugestao !== alvoDaSugestaoDeRetencao) {
    setAlvoVistoDaSugestao(alvoDaSugestaoDeRetencao);
    setSugestaoRetencao(null);
    setFalhouSugestaoRetencao(false);
    setLendoSugestaoRetencao(alvoDaSugestaoDeRetencao !== null);
    // ⚠️ **Só a resposta SUGERIDA morre.** Uma resposta manual — "nenhuma"
    // inclusive — é afirmação do Mateus sobre a nota, e trocar o anexo não a
    // revoga: é o critério 7 ("resposta manual sempre vence") aplicado à troca de
    // papel, não só à corrida do fetch.
    if (gateDeRetencao?.origem === "sugerida") {
      setGateDeRetencao(null);
      // E a linha vai com o gate — mesma limpeza que `escolherTipo` faz: linha de
      // retenção sem gate "destacada" por trás é afirmação órfã, e gravaria
      // contra um `retencao_na_nota` que a contradiz.
      setLinhasPendentes([]);
    }
  }

  useEffect(() => {
    if (alvoDaSugestaoDeRetencao === null) return;

    let cancelado = false;
    void (async () => {
      try {
        const form = new FormData();
        form.append("arquivo", alvoDaSugestaoDeRetencao);
        // ⚠️ **Só o arquivo viaja desde o CONTAI-062** — o campo
        // `retencaoNaNota` saiu do corpo junto com a pré-condição. A rota lê o
        // PDF e devolve `{ sugestao }`; quem decide o que fazer com isso é este
        // efeito.
        const resposta = await fetch("/api/sugerir-retencao", {
          method: "POST",
          body: form,
        });
        if (cancelado) return;
        if (!resposta.ok) {
          setFalhouSugestaoRetencao(true);
          return;
        }
        const corpo = (await resposta.json()) as {
          sugestao: SugestaoLinhaRetencao | null;
        };
        if (cancelado) return;
        // ⚠️ `null` não é falha, e não é `"nenhuma"`: é a nota sem padrão
        // reconhecido. O estado certo dela é o gate VAZIO e o formulário em
        // branco, em silêncio — ausência de padrão não é prova de ausência de
        // retenção (ADENDO 5 §3, salvaguardas 2 e 3: nunca `"nao_destacada"`,
        // nunca `"nao_sei"`). Por isso não existe nenhum `else` aqui.
        if (corpo.sugestao) {
          setSugestaoRetencao(corpo.sugestao);
          // ⚠️ **Gate e linha na MESMA ação** (ADENDO 5 §3, salvaguarda 4): a
          // condição é a própria existência da sugestão, então não há caminho em
          // que o gate se sugira sem o rótulo/valor que o motivou.
          //
          // ⚠️ **E a resposta manual do Mateus vence SEMPRE** (critério 7): o
          // updater lê o valor MAIS RECENTE do estado, não o que o efeito
          // capturou quando nasceu. Se ele respondeu o gate enquanto o fetch
          // estava em voo — em qualquer direção, "Nenhuma" inclusive —, `atual`
          // já não é `null` e a sugestão não encosta nele. Sobrescrever aqui
          // seria o app afirmando algo que ele acabou de negar, que é pior que o
          // bug que este ticket corrige.
          setGateDeRetencao(
            (atual) => atual ?? { resposta: "destacada", origem: "sugerida" },
          );
        }
      } catch {
        if (!cancelado) setFalhouSugestaoRetencao(true);
      } finally {
        if (!cancelado) setLendoSugestaoRetencao(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [alvoDaSugestaoDeRetencao]);

  const entrada: EntradaDocumento = useMemo(
    () => ({
      tipo,
      favorecidoNome: nome,
      favorecidoDocumento: documento,
      valorCentavos: parseValorInput(valor),
      numero,
      serie,
      dataEmissao,
      vencimento: vencimento || null,
      classificacao,
      notaNoCpf,
      retencaoNaNota,
      cnoNaNota,
      // O CNO da obra AFIRMADA NA TELA — não a preferência do aparelho. É ele
      // que a resposta "é o CNO desta obra" afirma estar impresso no papel.
      cnoDaObra: obra?.cno ?? null,
    }),
    [
      tipo,
      nome,
      documento,
      valor,
      numero,
      serie,
      dataEmissao,
      vencimento,
      classificacao,
      notaNoCpf,
      retencaoNaNota,
      cnoNaNota,
      obra,
    ],
  );

  // Caminho A (critério 1): "já paguei esta nota". Os pagamentos da obra só
  // são buscados quando ele marca — o caminho de captura continua curto.
  const [jaPaguei, setJaPaguei] = useState(false);
  const [painelDaObra, setPainelDaObra] = useState<PainelDados | null>(null);
  const [erroCandidatos, setErroCandidatos] = useState<string | null>(null);
  const [tentativaCandidatos, setTentativaCandidatos] = useState(0);
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
  }, [jaPaguei, obra, tentativaCandidatos]);

  /**
   * CONTAI-006, critério 3: este carregamento acontece DENTRO do formulário já
   * preenchido, então o "Tentar de novo" não pode ser o recarregamento de
   * página que o `Carregando` faz por padrão — recarregar aqui é perder anexo,
   * valor e as respostas dos checks fiscais.
   */
  const recarregarCandidatos = useCallback(() => {
    setErroCandidatos(null);
    setTentativaCandidatos((t) => t + 1);
  }, []);

  // ── Aviso de possível duplicidade (critério 11 / R7) ───────────────────
  //
  // AVISO, nunca bloqueio: número não é único globalmente, e recusar aqui
  // impediria o registro de uma nota legítima de outro emitente. É a primeira
  // defesa do produto contra custo contado DUAS VEZES — e custo inflado em
  // Bens e Direitos vai para a declaração, cobrado com multa.
  //
  // A busca só sai quando os DOIS dados que identificam a nota estão na tela
  // (número e CNPJ/CPF do emitente): sem emitente não há duplicidade a afirmar.
  // Falha de rede aqui é SILENCIOSA de propósito — a ausência do aviso não
  // pode virar um erro que impede o registro do fato consumado.
  const numeroLimpo = numeroParaBanco(numero);
  const emitenteDigitos = soDigitos(documento);
  // A resposta viaja COM a pergunta que a produziu: mudou o número ou o
  // emitente, o aviso some no mesmo render, sem precisar de um `setState` de
  // limpeza dentro do efeito. Aviso de duplicidade apontando para o número
  // anterior seria pior do que aviso nenhum.
  const chaveDaBusca = `${obra?.id ?? ""}|${numeroLimpo ?? ""}|${serie.trim()}|${emitenteDigitos}`;
  const [achado, setAchado] = useState<{
    chave: string;
    documento: DocumentoRegistrado | null;
  } | null>(null);
  const duplicata = achado?.chave === chaveDaBusca ? achado.documento : null;

  useEffect(() => {
    if (!obra || !exigeIdentificacaoDaNota(tipo)) return;
    if (!numeroLimpo || tipoPorDocumento(emitenteDigitos) === null) return;
    let cancelado = false;
    const chave = `${obra.id}|${numeroLimpo}|${serie.trim()}|${emitenteDigitos}`;
    // Meio segundo depois da última tecla: o número da nota é digitado dígito
    // a dígito, e uma consulta por dígito é ruído no canteiro.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const registradas = await buscarNotasComNumero(obra.id, numeroLimpo);
          if (cancelado) return;
          setAchado({
            chave,
            documento: duplicataDe(
              {
                numero: numeroLimpo,
                serie,
                emitenteDocumento: emitenteDigitos,
              },
              registradas,
            ),
          });
        } catch {
          // Sem aviso é o estado seguro: o registro segue.
        }
      })();
    }, 500);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [obra, tipo, numeroLimpo, serie, emitenteDigitos]);

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
      // A identificação da nota não entra na ordenação dos candidatos: quem
      // casa pagamento com documento é valor + favorecido, nunca o número.
      numero: null,
      serie: null,
      dataEmissao: null,
      vencimento: null,
      classificacao,
      destinatarioCpfOk: notaNoCpf === "sim",
      // O gate e as linhas não participam da ordenação dos candidatos: quem
      // casa pagamento com documento é valor + favorecido. Mesma razão do
      // `numero` e do CNO.
      retencaoNaNota: null,
      retencoes: [],
      // O CNO da nota não participa da ordenação dos candidatos: quem casa
      // pagamento com documento é valor + favorecido. Mesma razão do `numero`.
      cnoReferenciado: null,
      notaTrazCno: null,
      motivoQuarentena: null,
      // O documento ainda não existe; o favorecido dele também não tem id
      // ainda (`garantirFavorecido` roda no salvar). Nada aqui depende disso:
      // a ordenação dos candidatos casa por NOME e valor.
      favorecidoId: null,
      favorecidoNome: nome.trim() || null,
      favorecidoDocumento: soDigitos(documento) || null,
      // Só a NULIDADE importa aqui, e ela importa mesmo: `ehDocumentoHabil`
      // olha este campo, e o seletor rotula candidato como "não gera custo
      // confirmado" a partir dele. O conteúdo da string é irrelevante — o
      // documento ainda não existe, e o path real sai do upload no salvar.
      arquivoPath: arquivo ? "escolhido" : null,
    };
    return pagamentosCandidatos(
      provisorio,
      painelDaObra.pagamentos,
      alocarCusto(painelDaObra),
    );
  }, [
    painelDaObra,
    obra,
    tipo,
    notaNoCpf,
    valor,
    classificacao,
    nome,
    documento,
    arquivo,
  ]);

  /**
   * O que o botão "Salvar registro" chama. **Não é `salvar()`** desde o
   * CONTAI-033: a falta do arquivo deixou de ser erro de campo e virou uma
   * PERGUNTA (§A.7.1), feita uma vez, no ato.
   *
   * Ordem que importa: os erros de campo vêm PRIMEIRO. Abrir o diálogo em cima
   * de um formulário que nem salvaria seria perguntar sobre o arquivo quando o
   * que falta é o valor.
   */
  function tentarSalvar() {
    const encontrados = validarDocumento(entrada, hojeIso());
    setErros(encontrados);
    setErroSalvar(null);
    if (encontrados.length > 0 || !obra) return;

    if (arquivo === null) {
      // ⚠️ PARA AQUI: não salva, não navega. O formulário inteiro continua
      // montado atrás do overlay.
      setMostrarDialogoSemArquivo(true);
      return;
    }

    void salvar();
  }

  async function salvar() {
    const encontrados = validarDocumento(entrada, hojeIso());
    setErros(encontrados);
    setErroSalvar(null);
    if (encontrados.length > 0 || !obra) return;

    setFase({ nome: "salvando" });
    try {
      const tipoFavorecido = tipoPorDocumento(documento);
      if (tipoFavorecido === null) throw new Error("CNPJ/CPF inválido.");

      // ⚠️ `null` é estado legítimo (CONTAI-033, §A.3): a nota grava sem o
      // papel, e as três guardas cuidam de ela não valer nada até ele chegar.
      const arquivoPath = arquivo
        ? await subirParaAcervo(arquivo, "documento")
        : null;
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
        // Boleto não é perguntado, logo não grava (R5). NF grava o número tal
        // como foi digitado — `numeroParaBanco` só tira o espaço em volta.
        numero: exigeIdentificacaoDaNota(tipo) ? numeroParaBanco(numero) : null,
        serie: exigeIdentificacaoDaNota(tipo) ? serieParaBanco(serie) : null,
        data_emissao: exigeIdentificacaoDaNota(tipo) ? dataEmissao : null,
        vencimento: tipo === "boleto" ? vencimento : null,
        classificacao,
        destinatario_cpf_ok: notaNoCpf === "sim",
        // CONTAI-038 — o gate vai para o banco como ele é, sem tradução: não
        // há terceiro estado a colapsar. Em material/boleto grava `null`
        // porque a pergunta não existe ali.
        retencao_na_nota: exigeRetencao(tipo) ? retencaoNaNota : null,
        // CONTAI-007 — o CNO IMPRESSO na nota, e o tri-estado que o acompanha.
        // O `obra.cno` que entra aqui é o da obra AFIRMADA NA TELA, que é o que
        // a resposta "é o CNO desta obra" afirma estar no papel. "É o de outra
        // obra" nunca chega até aqui: `validarDocumento` já barrou.
        cno_referenciado: cnoReferenciadoParaBanco(tipo, cnoNaNota, obra.cno),
        nota_traz_cno: notaTrazCnoParaBanco(tipo, cnoNaNota),
        status,
        motivo_quarentena: motivoQuarentena(notaNoCpf),
      });

      // ══ CONTAI-053, critério 3 — as linhas de retenção da captura ════════
      //
      // Só agora, e nunca antes: o `documento_id` é obrigatório e o documento
      // acabou de nascer. Mesmo padrão não-transacional do vínculo logo abaixo.
      //
      // ⚠️ A falha aqui NÃO é erro de tela e NÃO desfaz nada: o documento já
      // está no banco, e é documentação hábil normalmente. Ela é RELATADA na
      // confirmação, com os números — nunca engolida (pre-mortem 4).
      //
      // A lista já está zerada se o gate ou o tipo mudaram; a condição repetida
      // aqui é a mesma do `retencao_na_nota` acima, para que nenhuma linha
      // atravesse um caminho em que o gate gravado não a sustenta.
      const linhasParaGravar =
        exigeRetencao(tipo) && retencaoNaNota === "destacada"
          ? linhasPendentes
          : [];
      let retencoesEntraram = 0;
      if (linhasParaGravar.length > 0) {
        try {
          retencoesEntraram = await criarLinhasRetencao(id, linhasParaGravar);
        } catch {
          retencoesEntraram = 0;
        }
      }
      /**
       * ⚠️ **Alguma linha ficou fora** — e o caso NÃO é só falha de rede: o
       * `criarLinhasRetencao` também descarta linha incompleta antes do insert
       * (segundo anel do Gate Fiscal), então "1 de 3" é alcançável de verdade, e
       * não apenas "0 de N" pela atomicidade do array. É esta variável, e não um
       * `catch`, que decide se a confirmação tem algo a relatar.
       */
      const retencaoIncompleta = retencoesEntraram < linhasParaGravar.length;

      // Caminho A: o vínculo vem depois do documento e em outra chamada — não
      // há transação entre tabelas no PostgREST. Falhando, o documento fica
      // salvo e a tela DIZ que ele ficou sem vínculo (critério 1).
      //
      // ⚠️ QUARENTENA TAMBÉM LIGA (critério 8). A navegação para a tela do
      // documento acontecia ANTES daqui, e os pagamentos marcados eram
      // descartados sem uma palavra. O parecer diz o contrário: vincular
      // quarentena é permitido e útil — é o que impede a mesma despesa de
      // contar duas vezes —, com o texto de VINCULO_QUARENTENA_NAO_GERA_CUSTO
      // dito na hora, que os dois seletores já mostram. O vínculo entra com
      // `documentoHabil: false`: ele não gera custo confirmado, e o pagamento
      // NÃO vira `conciliado`.
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
                // Guarda 1: sem arquivo o vínculo entra com `documentoHabil:
                // false` — ele impede a despesa de contar duas vezes e NÃO
                // gera custo confirmado.
                arquivoPath,
              }),
            })),
          );
        } catch {
          vinculoFalhou = true;
        }
      }

      // Documento fora do CPF: a consequência tem que aparecer na hora — e
      // agora com os vínculos já gravados.
      //
      // ⚠️ Só navega quando o vínculo NÃO falhou. Empurrar para a tela do
      // documento com o vínculo quebrado engolia o aviso do critério 1
      // exatamente no ramo em que ele mais importa: a nota em quarentena não
      // sustenta custo, o pagamento marcado continua "pago sem nota", e a
      // despesa segue contada duas vezes — que é a dor de origem do ticket.
      // Falhando, a confirmação fica AQUI e diz as duas coisas.
      //
      // ⚠️ **Linha de retenção que ficou fora SEGURA a navegação também**
      // (bloqueante do Gate 2 do CONTAI-053), pela mesma razão do vínculo: o
      // critério 3 diz que **a confirmação** informa quantas linhas entraram e
      // quantas não, e o `router.push` pulava justamente a tela que carrega esse
      // card. Contar com `/documento/[id]` para denunciar a lacuna só funcionaria
      // no caso "0 de N" (o chip `CHIP_RETENCAO_SEM_LINHA`); com "1 de 3" a tela
      // de destino mostra a linha que entrou e **cala** as duas que não — que é
      // exatamente o silêncio do pre-mortem 4.
      if (status === "quarentena" && !vinculoFalhou && !retencaoIncompleta) {
        router.push(`/documento/${id}`);
        return;
      }

      setFase({
        nome: "salvo",
        id,
        obraNome: obra.nome,
        ligados: vinculoFalhou ? 0 : paraLigar.length,
        vinculoFalhou,
        quarentena: status === "quarentena",
        semArquivo: arquivoPath === null,
        semCno: pendenteDeCno(tipo, cnoNaNota),
        retencoesTentadas: linhasParaGravar.length,
        retencoesEntraram,
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
      setErroSalvar(mensagemDeErroDeGravacao(erro, "na lista de documentos desta obra"));
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
              {fase.quarentena ? (
                <>
                  {" "}
                  E esta nota está em <strong>quarentena</strong>:{" "}
                  {CONSEQUENCIA_QUARENTENA} Ligar o pagamento continua valendo a
                  pena — é o que impede a mesma despesa de ser contada duas
                  vezes.
                </>
              ) : null}
            </>
          ) : fase.quarentena ? (
            /* ⚠️ **Ramo novo no Gate 2 do CONTAI-053, e ele era INALCANÇÁVEL
               antes**: quarentena com vínculo intacto sempre navegava para
               `/documento/[id]`. Agora ela pode parar aqui, quando uma linha de
               retenção ficou fora — e uma confirmação que diz só "Salvo ✓" para
               uma nota em quarentena seria o sucesso mentiroso que o
               `arquivoNoAcervo` já corrigiu uma vez nesta mesma tela. O texto do
               ramo de cima não muda em byte nenhum. */
            <>
              Esta nota está em <strong>quarentena</strong>:{" "}
              {CONSEQUENCIA_QUARENTENA}
            </>
          ) : undefined
        }
        arquivoNoAcervo={!fase.semArquivo}
        /* Tela 7 do mock do CONTAI-004 — critério 3. A pendência aparece AQUI,
           no ato, além de entrar na lista de pendências (critério 4): o texto
           é o MESMO do bloqueio, porque a consequência fiscal é a mesma; o que
           muda é haver conserto (pedir a nota certa) ou não. */
        extra={
          fase.semCno || fase.retencoesEntraram < fase.retencoesTentadas ? (
            <>
              {fase.semCno ? (
                <Card className="border-amb">
                  <Chip cor="amb">A nota não traz CNO</Chip>
                  <Consequencia cor="amb">{CONSEQUENCIA_CNO_DA_NOTA}</Consequencia>
                  <Dica>
                    {CNO_NAO_ALCANCA_O_CUSTO} Ação:{" "}
                    <strong>{ACAO_NOTA_SEM_CNO}</strong> — enquanto ainda houver
                    parcela a liberar.
                  </Dica>
                </Card>
              ) : null}
              {/* ══ CONTAI-053, critério 3 — resultado parcial das linhas ════
                  ⚠️ **`extra`, não `aviso`** (spec, §4): a nota foi salva e é
                  documentação hábil normalmente — o que ficou pendente é só a
                  informação de retenção, mesma severidade visual da pendência de
                  CNO logo acima. O vermelho do `aviso` é do vínculo, que é outra
                  coisa: lá o pagamento fica sem nota.
                  Silencioso no sucesso total, igual ao vínculo. */}
              {fase.retencoesEntraram < fase.retencoesTentadas ? (
                <Card className="border-amb" data-retencao="parcial">
                  <Chip cor="amb">{CHIP_RETENCAO_PARCIALMENTE_GRAVADA}</Chip>
                  <p className="mt-2.5 text-[13.5px]">
                    {contagemDaRetencaoParcial(
                      fase.retencoesEntraram,
                      fase.retencoesTentadas,
                    )}
                  </p>
                  <Consequencia cor="amb">
                    {acaoDaRetencaoParcial(
                      fase.retencoesTentadas - fase.retencoesEntraram,
                    )}
                  </Consequencia>
                  <div className="mt-3">
                    <BotaoLink href={`/documento/${fase.id}`}>
                      Abrir esta nota
                    </BotaoLink>
                  </div>
                </Card>
              ) : null}
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
          /**
           * ⚠️ **Trocar a obra ZERA a resposta do CNO**, e não é zelo: a
           * pergunta é *"qual CNO está impresso nesta nota?"* e as três
           * respostas são todas relativas à obra da tela. Mantida a resposta,
           * "é o CNO desta obra" continuaria selecionado com o SIGNIFICADO
           * TROCADO por baixo — e gravaria o CNO da obra nova como se fosse o
           * do papel. É o mesmo raciocínio do bloqueante 5 do Gate 2 do
           * CONTAI-021, onde trocar o destino zera os desfechos.
           *
           * É também o que torna "Registrar na outra obra" uma saída de
           * verdade para o bloqueio: ele volta ao formulário com a pergunta
           * em aberto, e responde de novo olhando o mesmo papel.
           */
          setCnoNaNota(null);
        }}
        onCancelar={() => setTrocando(false)}
      />
    );
  }

  const semCnoNaObra = obra !== null && obra.cno === null;
  const avisaObraSemCno = semCnoNaObra && tipo === "nf_servico";

  /**
   * ══ Tela 5 do mock do CONTAI-004 — BLOQUEIO, e não aviso (critério 2) ══
   *
   * Tela inteira, e não um banner no meio do formulário: o registro NÃO vai
   * acontecer, e um banner deixaria o "Salvar" ali do lado, convidando ao
   * toque que o ticket existe para impedir.
   *
   * ⚠️ As DUAS saídas são do pre-mortem 2, e a primeira é a que importa:
   * *"a tela de bloqueio precisa oferecer 'registrar na outra obra' como ação,
   * não só recusar"*. Recusar sem saída, com a nota na mão, empurra o registro
   * para a obra errada — que é o dano que se queria evitar.
   *
   * Só existe quando há outra obra para onde ir. Com uma obra só, a saída
   * honesta é corrigir a resposta: o app não inventa obra.
   */
  if (bloqueiaPorCnoDeOutraObra(tipo, cnoNaNota) && obra) {
    return (
      <>
        <AppBar
          titulo="CNO impresso é de outra obra"
          sub={`${numero ? `NF de serviço ${numero} · ` : ""}${nome || "emitente não informado"} · ${obra.nome}`}
        />
        {/* ⚠️ A tela de BLOQUEIO não ganha largura nenhuma: é texto de
            consequência fiscal, e esticar a linha dele é a regressão de
            legibilidade que o critério 2 proíbe. Nenhuma palavra dela mudou. */}
        <Corpo className={COLUNA_DO_FORMULARIO}>
          <Card className="border-red">
            <Chip cor="red">Bloqueado — não é aviso</Chip>
            <p className="mt-2.5 text-[13.5px]">{CONSEQUENCIA_CNO_DA_NOTA}</p>
          </Card>
          <Dica>
            {CNO_NAO_ALCANCA_O_CUSTO} Por isso o registro é barrado aqui, e não
            vira pendência: <strong>não há conserto depois da emissão</strong>.
          </Dica>
        </Corpo>
        <Rodape className={COLUNA_DO_FORMULARIO}>
          {registro.obras.length > 1 ? (
            <Botao variante="primary" onClick={() => setTrocando(true)}>
              Registrar na outra obra
            </Botao>
          ) : (
            <Dica>
              Só existe uma obra cadastrada — cadastre a obra do CNO impresso
              antes de registrar esta nota.
            </Dica>
          )}
          <Botao variante="ghost" onClick={() => setCnoNaNota(null)}>
            Voltar e corrigir a resposta
          </Botao>
        </Rodape>
      </>
    );
  }

  return (
    <>
      <AppBar
        titulo="Registrar documento"
        sub={
          arquivo
            ? "Passo 2 de 3 — arquivo anexado ✓"
            : "Passo 2 de 3 — anexe o arquivo"
        }
      />
      {/* CONTAI-047 — decorativo e só em tela larga; o "Passo 2 de 3" acima e
          o "Passo 3 de 3 ↓" do rodapé continuam exatamente onde estavam. */}
      <PassosDaCaptura atual={2} />

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

            {/* ══ CONTAI-047 — a grade `formulário + rail` ════════════════
                Abaixo de 880px isto some e vira a coluna única de sempre, com
                o anexo em cima, que é onde ele já está no celular hoje. */}
            <GradeDaCaptura
              rail={
                <>
                  {/* ⚠️ O ANEXO só MUDOU DE LUGAR (critério 1a). Mesmo
                      componente, mesmo `accept`, mesma ajuda, mesma ausência
                      de `erro` — a falta do arquivo continua sendo a PERGUNTA
                      do §A.7.1 no "Salvar", nunca erro de campo. */}
                  <Card className="flex flex-col gap-3">
                    {/* ⚠️ A ajuda mudou com o CONTAI-033: o arquivo **não é
                        mais obrigatório para gravar** (§A.3) — ele é o que faz
                        a nota valer. Dizer "obrigatório" numa tela que grava
                        sem ele seria a recusa antiga sobrevivendo como texto. */}
                    <CampoArquivo
                      campo="arquivo"
                      rotulo="Arquivo"
                      ajuda="PDF, XML ou foto — é ele que faz a nota valer no acervo. Não tem à mão? Dá para registrar e anexar depois."
                      accept=".pdf,.xml,image/*"
                      arquivo={arquivo}
                      /* Trocou o arquivo com o Lightbox aberto? Fecha: o que
                         estava à vista não é mais o anexo da vez. Aqui, e não
                         num efeito — este é o ÚNICO caminho pelo qual o anexo
                         muda. */
                      onChange={(novo) => {
                        setArquivo(novo);
                        setVerDocumento(false);
                      }}
                      /* ⚠️ **CONTAI-048, Estado F — o acesso do PISO, e SÓ o
                         do piso** (`larga:hidden`): em tela larga quem manda
                         é o botão do rail, logo abaixo. Dois controles com a
                         mesma função visíveis ao mesmo tempo seria um deles
                         sobrando. Não é campo, não é passo: é um link ao lado
                         de uma linha que já existia. */
                      acaoNoSucesso={
                        <ControleVerDocumento
                          data-ver="piso"
                          modo={modoDoAnexo}
                          url={urlDoAnexo}
                          rotulo={VER_DOCUMENTO_PISO}
                          rotuloPdfEmNovaAba={ABRIR_PDF_EM_ABA}
                          onAbrir={() => setVerDocumento(true)}
                          className="font-semibold text-mut underline larga:hidden"
                        />
                      }
                    />

                    {/* ⚠️ **CONTAI-048 — a miniatura deixou de ser 52×52, e só
                        para IMAGEM.** Ela confirma "é este o papel"; ler CNPJ,
                        valor e data continua sendo trabalho do Lightbox, que
                        abre sob demanda logo abaixo (Gate 0, Estados B e E).
                        PDF segue com ícone: thumbnail de PDF no cliente exige
                        lib nova e não paga esta feature.

                        Só em `larga`: no celular o próprio campo já diz o nome
                        do arquivo, e repetir seria roubar linha do caminho
                        curto — lá o acesso é o link do Estado F, acima. */}
                    {arquivo ? (
                      <div className="hidden flex-col gap-2.5 rounded-[10px] border border-line px-2.5 py-2.5 larga:flex">
                        {modoDoAnexo === "imagem" && urlDoAnexo ? (
                          // ⚠️ `key={urlDoAnexo}`: trocar só o `src` não faz o
                          // navegador recarregar de forma confiável quando o
                          // arquivo muda — a miniatura ficaria na foto antiga.
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={urlDoAnexo}
                            src={urlDoAnexo}
                            alt={`Pré-visualização de ${arquivo.name}`}
                            data-miniatura="anexo"
                            className="h-[120px] w-full rounded-[10px] bg-soft object-cover"
                          />
                        ) : null}
                        <div className="flex items-center gap-3">
                          {modoDoAnexo === "imagem" && urlDoAnexo ? null : (
                            <span
                              aria-hidden="true"
                              className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-lg bg-soft text-[20px]"
                            >
                              {ehXml(arquivo) ? "🧾" : "📄"}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-semibold">
                              {arquivo.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-mut">
                              {tamanhoLegivelDoAnexo(arquivo.size)}
                            </span>
                          </span>
                          {/* Abre o MESMO seletor do campo acima — não existe
                              segundo input nem segundo estado de arquivo.
                              ⚠️ Escopado por `data-campo` (Gate 2): um
                              `input[type="file"]` global acertaria o primeiro
                              file input que aparecesse na tela, e o dia em que
                              existir um segundo (comprovante, foto da obra) o
                              botão passa a trocar o arquivo errado — em
                              silêncio, no anexo que sustenta a nota. */}
                          <button
                            type="button"
                            onClick={() =>
                              document
                                .querySelector<HTMLInputElement>(
                                  'input[data-campo="arquivo"]',
                                )
                                ?.click()
                            }
                            className="flex-none text-[11.5px] text-mut underline"
                          >
                            Trocar arquivo
                          </button>
                        </div>

                        {/* Estado D: XML não ganha botão, e a tela DIZ por quê
                            em vez de deixar o buraco falando sozinho. */}
                        {ehXml(arquivo) ? (
                          <p className="text-[11.5px] text-mut">
                            {XML_SEM_PREVIEW}
                          </p>
                        ) : null}

                        {/* ⚠️ ACIMA do "🪄 Extrair dados da nota (beta)", e a
                            ordem é do Gate 0 (Estado C): ver o papel antes de
                            rodar IA sobre ele. Em PDF + dedo/tela estreita este
                            controle já nasce `<a target="_blank">` — ver
                            `CONSULTA_PDF_EM_NOVA_ABA`. */}
                        <ControleVerDocumento
                          data-ver="larga"
                          modo={modoDoAnexo}
                          url={urlDoAnexo}
                          rotulo={VER_DOCUMENTO_LARGA}
                          rotuloPdfEmNovaAba={ABRIR_PDF_EM_ABA}
                          onAbrir={() => setVerDocumento(true)}
                          className="flex min-h-[40px] w-full items-center justify-center rounded-[10px] border border-ink bg-white px-3 text-center text-[13px] font-bold"
                        />
                      </div>
                    ) : null}

                    {/* A extração continua condicionada ao PDF e continua só
                        SUGERINDO campo vazio — nunca `notaNoCpf`. O que mudou é
                        que ela ficou colada ao arquivo que lê, em vez de
                        enterrada no meio do formulário (Decisão 3 do mock).

                        ⚠️ **CONTAI-062 corrigiu a frase "nunca o gate de
                        retenção" que estava aqui**: o gate É sugerido a partir
                        do PDF, só não por ESTE botão. Quem o sugere é o parser
                        determinístico local, sozinho, ao anexar o arquivo —
                        caminho separado, sem provedor de IA, sem clique. */}
                    {arquivo && arquivo.type === "application/pdf" ? (
                      <div className="flex flex-col gap-2">
                        <Botao
                          variante="ghost"
                          type="button"
                          onClick={extrairDaNota}
                          disabled={extraindo}
                        >
                          {extraindo
                            ? "Lendo o PDF…"
                            : "🪄 Extrair dados da nota (beta)"}
                        </Botao>
                        {erroExtracao ? (
                          <Banner cor="amb" role="status">
                            {erroExtracao} Preencha os campos abaixo à mão.
                          </Banner>
                        ) : null}
                        {extracao ? (
                          <Banner
                            cor={
                              extracao.confianca === "baixa" ? "amb" : "grn"
                            }
                            role="status"
                          >
                            Dados extraídos automaticamente do PDF — confira
                            cada campo antes de salvar.
                            {extracao.confianca === "baixa"
                              ? " O PDF não estava muito legível: confira com atenção redobrada."
                              : null}
                          </Banner>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>

                  {/* ⚠️ **ESPELHO, NUNCA PENDÊNCIA** (Decisão 4 do mock,
                      Pre-mortem 0 do ticket). Aqui só aparece o que já foi
                      afirmado; quarentena, gate de retenção e o bloqueio de
                      CNO de outra obra continuam inline, no card da pergunta
                      que os gera. Nenhum `Banner`/`Consequencia` entra neste
                      card.

                      Só em `larga`: no piso de 375px um resumo de cinco linhas
                      acima do formulário é fricção no momento da captura, e o
                      critério 10 manda o canteiro continuar como está. */}
                  <Card className="hidden flex-col larga:flex">
                    <div className="text-[13px] font-bold">Resumo até agora</div>
                    <div className="mt-1.5">
                      {resumoAfirmado(entrada, formatarBRL).map((linha) => (
                        <LinhaDoResumo
                          key={linha.rotulo}
                          rotulo={linha.rotulo}
                          valor={linha.valor}
                        />
                      ))}
                    </div>
                    <div className="mt-2">
                      <Dica>
                        Atualiza sozinho conforme você preenche — nada aqui se
                        afirma sozinho.
                      </Dica>
                    </div>
                  </Card>
                </>
              }
            >
              <Card className="flex flex-col gap-3.5">
                <Escolha
                  campo="tipo"
                  rotulo="Tipo"
                  opcoes={TIPOS}
                  valor={tipo}
                  onChange={escolherTipo}
                  erro={erroDe("tipo")}
                />
                {/* Critério 2 (R5): os dois campos ficam NO MESMO PASSO do
                    valor — nenhum passo novo (pre-mortem 1). E não aparecem em
                    boleto: título de cobrança não compõe discriminação nenhuma. */}
                {exigeIdentificacaoDaNota(tipo) ? (
                  <>
                    {/* CONTAI-047, critério 2 — escalares CURTOS lado a lado a
                        partir de 880px. Número e série cabem numa linha e são os
                        dois pedaços da mesma identificação. */}
                    <CamposCurtos>
                      <CampoTexto
                        campo="numero"
                        rotulo="Número da nota"
                        valor={numero}
                        onChange={setNumero}
                        ajuda={AJUDA_NUMERO}
                        placeholder="Como está impresso"
                        erro={erroDe("numero")}
                      />
                      {/* R6: campo próprio, NUNCA concatenada no número. Opcional
                          e sem erro possível — nem toda NFS-e tem série, e exigir
                          aqui faria o Mateus inventar um valor para poder salvar. */}
                      <CampoTexto
                        campo="serie"
                        rotulo="Série (quando houver)"
                        valor={serie}
                        onChange={setSerie}
                        ajuda={AJUDA_SERIE}
                      />
                    </CamposCurtos>
                    {/* Critério 8: o rótulo diz o que a data É e o que ela NÃO
                        É. Sem esta frase o campo é lido como "a data que vale
                        para o IR" — e quem decide o ano do custo é o pagamento.
                        Fica em linha própria: `AJUDA_DATA_EMISSAO` é a frase que
                        ensina a regra, e espremê-la em meia coluna é o erro que o
                        Gate 2 do CONTAI-039 já pegou uma vez. */}
                    <CampoTexto
                      campo="data_emissao"
                      rotulo="Data de emissão"
                      tipo="date"
                      valor={dataEmissao}
                      onChange={setDataEmissao}
                      ajuda={AJUDA_DATA_EMISSAO}
                      erro={erroDe("dataEmissao")}
                    />
                  </>
                ) : null}
                <CamposCurtos>
                  <CampoTexto
                    campo="emitente"
                    rotulo="Emitente"
                    valor={nome}
                    onChange={setNome}
                    placeholder="Razão social de quem emitiu"
                    erro={erroDe("favorecidoNome")}
                  />
                  <CampoTexto
                    campo="cnpj"
                    rotulo="CNPJ / CPF do emitente"
                    valor={documento}
                    onChange={setDocumento}
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    erro={erroDe("favorecidoDocumento")}
                  />
                </CamposCurtos>
                {/* ⚠️ DIVERGÊNCIA DELIBERADA DO MOCK, e ela é de regra, não de
                    gosto: o mock escreve "registrada em 15/03", e aqui sai
                    "15/03/2026". A fonte é o ADENDO 3 §G.2 do parecer
                    docs/pareceres/2026-08-18-compromisso-versus-pagamento.md,
                    que se declara GERAL — "vale para todos, não só para este
                    texto": data sem ano, num produto cujo invariante é regime de
                    caixa, é defeito onde quer que apareça. `formatarDataBR` é
                    hoje o único formato de data de toda tela fiscal do app;
                    encurtar só neste banner criaria a única exceção do projeto. */}
                {duplicata ? (
                  <Banner cor="amb" role="status">
                    Essa nota já foi registrada em{" "}
                    {formatarDataBR(duplicata.registradoEm)}. Confira antes de
                    salvar — a mesma nota registrada duas vezes conta o custo em
                    dobro na declaração.{" "}
                    <a
                      className="font-semibold underline"
                      href={`/documento/${duplicata.id}`}
                    >
                      Ver registro existente
                    </a>
                  </Banner>
                ) : null}
                {/* Valor e vencimento: os dois são escalares curtos do critério
                    2. Sem boleto o valor fica sozinho na primeira coluna — meia
                    largura é o tamanho certo de um campo de 8 caracteres. */}
                <CamposCurtos>
                  <CampoTexto
                    campo="valor"
                    rotulo="Valor"
                    valor={valor}
                    onChange={setValor}
                    inputMode="decimal"
                    placeholder="0,00"
                    erro={erroDe("valorCentavos")}
                  />
                  {tipo === "boleto" ? (
                    <CampoTexto
                      campo="vencimento"
                      rotulo="Vencimento"
                      tipo="date"
                      valor={vencimento}
                      onChange={setVencimento}
                      erro={erroDe("vencimento")}
                    />
                  ) : null}
                </CamposCurtos>
                {/* ⚠️ `Escolha` FICA EM COLUNA ÚNICA — Pre-mortem 1 do ticket.
                    Classificação decide material × mão de obra, que é o que
                    alimenta a base de aferição: pergunta fiscal não divide
                    largura com outro campo. */}
                <Escolha
                  campo="classificacao"
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
                  campo="nota_no_seu_cpf"
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

                {/* ══ CONTAI-038, critério 1 — o GATE, e nada além dele ════
                    Duas opções, nenhuma pré-marcada, no mesmo lugar do campo
                    antigo (ordem: … CPF → retenção → CNO).

                    ⚠️ **"Destacada" NÃO abre banner de consequência**, ao
                    contrário do campo que ele substituiu: não há consequência
                    fiscal aberta neste momento — só um dado a completar depois.
                    O aviso antigo dizia "não abate na aferição do INSS" como se
                    a retenção decidisse o abatimento, e é exatamente essa
                    premissa que o §2 do parecer de 2026-09-18 derruba. */}
                {exigeRetencao(tipo) ? (
                  <>
                    <Escolha
                      destaque
                      campo="retencaoNaNota"
                      rotulo={PERGUNTA_GATE}
                      opcoes={OPCOES_GATE}
                      valor={retencaoNaNota}
                      onChange={responderGateDeRetencao}
                      erro={erroDe("retencaoNaNota")}
                      /* ⚠️ **CONTAI-062** — âmbar + selo "Sugerida" enquanto a
                         resposta for da leitura, e não dele. Dois canais, nunca
                         só cor (ADENDO 5 §3, salvaguarda 1). `null` no momento
                         em que ele toca a pílula: aí a resposta passa a ser
                         afirmação e a pílula vira o preenchido escuro de
                         sempre. */
                      sugerido={gateSugerido}
                    />

                    {/* ══ CONTAI-062 — os estados da LEITURA, ao lado do gate ══
                        ⚠️ **Fora do repeater, e por isso visíveis em QUALQUER
                        largura** — inclusive com o gate ainda vazio, que é
                        justamente o caso novo deste ticket. Antes eles moravam
                        dentro do `BlocoRetencaoDaCaptura` (`hidden larga:flex`),
                        onde só existiam ≥880px E só depois de "destacada": ou
                        seja, invisíveis exatamente quando passaram a importar.

                        ⚠️ Com o gate em `"nenhuma"` os dois se calam. Ele já
                        respondeu que esta nota não destaca retenção; dizer
                        "lendo a retenção desta nota" ou "não deu para ler a
                        retenção" em cima disso é contradizer a resposta dele com
                        ruído — e a leitura, se chegar, não vai mexer no gate
                        mesmo (ela só preenche gate vazio). */}
                    {lendoSugestaoRetencao && retencaoNaNota !== "nenhuma" ? (
                      <div role="status" data-sugestao="gate-lendo">
                        <Dica>{SUGESTAO_RETENCAO_LENDO}</Dica>
                      </div>
                    ) : null}
                    {/* ⚠️ Âmbar CALMO, nunca vermelho, e **nunca bloqueia o
                        "Salvar registro"** (critério 9): a frase diz as duas
                        coisas — a leitura não aconteceu e o caminho manual
                        continua aberto. Não é erro de campo, não gera pendência
                        e o botão não olha para isto. */}
                    {!lendoSugestaoRetencao &&
                    falhouSugestaoRetencao &&
                    sugestaoRetencao === null &&
                    retencaoNaNota !== "nenhuma" ? (
                      <div data-sugestao="gate-falhou">
                        <Banner cor="amb" role="status">
                          {SUGESTAO_RETENCAO_FALHOU}
                        </Banner>
                      </div>
                    ) : null}

                    {retencaoNaNota === "destacada" ? (
                      <>
                        {/* ══ CONTAI-062 — o TRECHO LITERAL, ao lado do gate ══
                            ⚠️ **Exigência fiscal, não enfeite** (ADENDO 5 §3,
                            salvaguarda 1): como o gate controla se uma seção
                            inteira aparece, a sugestão tem de mostrar o trecho
                            que o parser leu, ali, para o Mateus conferir contra
                            o papel sem procurar. Abaixo de 880px o repeater está
                            escondido por CSS, então este é o ÚNICO lugar onde
                            esse trecho existe — é por isso que ele mora aqui e
                            não lá dentro.

                            Mesma legenda (`SUGESTAO_RETENCAO_CHIP`), mesma
                            formatação da citação (aspas, negrito, valor em
                            `mono`) e mesma cor do banner de dentro do
                            `FormularioDeLinha`: repetido em tela larga de
                            propósito, para os dois lugares não parecerem dois
                            achados diferentes. O que muda é só o rodapé — aqui o
                            curto, porque ainda não há campo nenhum sendo
                            editado.

                            ⚠️ A condição é "há sugestão guardada E o gate está
                            em destacada", nunca "a sugestão chegou junto com o
                            gate": se ele responder "Nenhuma" e depois mudar de
                            ideia à mão, o trecho aparece na hora, sem novo
                            fetch. */}
                        {sugestaoRetencao ? (
                          <div data-sugestao="gate">
                            <Banner cor="amb" role="status">
                              <Chip cor="amb">{SUGESTAO_RETENCAO_CHIP}</Chip>
                              <p className="mt-1.5 text-[14px] leading-tight font-bold break-words">
                                {`“${sugestaoRetencao.rotuloLiteral}” — `}
                                <span className="mono">
                                  {formatarBRL(sugestaoRetencao.valorCentavos)}
                                </span>
                              </p>
                              <p className="mt-1.5 text-[12px]">
                                {SUGESTAO_GATE_CONFIRA}
                              </p>
                            </Banner>
                          </div>
                        ) : null}
                        {/* ⚠️ **Duas dicas no DOM, uma por largura** — spec do
                            CONTAI-053, §3. A de baixo de 880px é **byte a byte**
                            a de sempre (critério 6); a de 880px para cima existe
                            porque "você detalha isso depois" fica FALSO ao lado
                            do formulário que detalha agora. Quem escolhe é o
                            CSS, nunca `window.innerWidth`. */}
                        <div className="larga:hidden">
                          <Dica>{DICA_GATE_DESTACADA}</Dica>
                        </div>
                        <div className="hidden larga:block">
                          <Dica>{DICA_GATE_DESTACADA_LARGA}</Dica>
                        </div>
                        {/* ══ CONTAI-053 — o repeater, ENTRE a resposta
                            "Destacada" e a pergunta do CNO (spec, §1). Dentro
                            deste card de propósito: é aqui que uma pendência
                            fiscal nova pode nascer, e consequência não sai do
                            campo que a gera (Decisão 4 da casca larga).
                            Sempre montado com o gate em "destacada"; escondido
                            por CSS abaixo de 880px. */}
                        <BlocoRetencaoDaCaptura
                          linhas={linhasPendentes}
                          /* CONTAI-055 — a leitura do PDF, a confirmar.
                             ⚠️ `lendoSugestao`/`falhouSugestao` saíram no
                             CONTAI-062: esses dois estados agora aparecem ao
                             lado do gate, acima, em qualquer largura. */
                          sugestao={sugestaoRetencao}
                          onAdicionar={(linha) => {
                            setLinhasPendentes((atual) => [...atual, linha]);
                            /* ⚠️ **A sugestão é CONSUMIDA ao adicionar a linha.**
                               Sem isto, remover a linha adicionada devolveria o
                               formulário vazio com a mesma sugestão de volta — o
                               app reafirmando uma leitura que ele acabou de
                               rejeitar, que é o oposto do critério 5. */
                            setSugestaoRetencao(null);
                          }}
                          onRemover={(indice) =>
                            setLinhasPendentes((atual) =>
                              atual.filter((_, i) => i !== indice),
                            )
                          }
                        />
                      </>
                    ) : null}
                  </>
                ) : null}

                {/* ══ CONTAI-007, critério 1 — o CNO impresso na nota ═══════
                    Última pergunta do passo, como no mock (ordem: … CPF →
                    retenção → CNO). ESCOLHA, nunca digitação (pre-mortem 1).

                    ⚠️ "É o CNO desta obra" SOME quando a obra não tem CNO, e o
                    sumiço é regra: a nota não pode trazer impresso um número que
                    não existe. Oferecer a opção ali seria oferecer uma afirmação
                    falsa a um toque de distância — e o card vermelho logo abaixo
                    já diz o que fazer. */}
                {exigeCnoReferenciado(tipo) ? (
                  <>
                    <Escolha
                      destaque
                      campo="cno_referenciado"
                      rotulo="Qual CNO está impresso nesta nota?"
                      opcoes={
                        semCnoNaObra
                          ? RESPOSTAS_CNO.filter((o) => o.valor !== "desta_obra")
                          : RESPOSTAS_CNO
                      }
                      valor={cnoNaNota}
                      onChange={setCnoNaNota}
                      erro={erroDe("cnoNaNota")}
                    />
                    <Dica>
                      {semCnoNaObra ? (
                        <>
                          Esta obra ainda não tem CNO, então nenhuma nota pode
                          trazer o CNO dela impresso. Três toques, zero digitação
                          — o CNO não se digita aqui.
                        </>
                      ) : (
                        <>
                          {obra.nome} · <span className="mono">CNO {obra.cno}</span>.
                          Três toques, zero digitação — o CNO não se digita aqui.
                        </>
                      )}
                    </Dica>
                    {cnoNaNota === "nao_traz" ? (
                      <Banner cor="amb" role="status">
                        {CONSEQUENCIA_CNO_DA_NOTA} Salva assim mesmo, com
                        pendência — {ACAO_NOTA_SEM_CNO}.
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
                  {/* CONTAI-007, critério 8 — a entrada da tela 14, desenhada e
                      aprovada em 2026-08-10 e só agora construtível (depende de
                      `numero` e `data_emissao`, do CONTAI-004). É o único item
                      do lote que RECUPERA valor em vez de só registrar perda —
                      e vale enquanto houver parcela a liberar. */}
                  <div className="mt-3">
                    <BotaoLink href={`/obras/${obra.id}/notas-sem-cno`}>
                      Ver as notas desta obra emitidas sem CNO
                    </BotaoLink>
                  </div>
                </Card>
              ) : null}

              {/* Caminho A do critério 1: o vínculo no ATO do registro, que é o
                  caminho mais curto do parecer §5.4 — o caso dele é 1↔1, mesmo
                  valor. Nada aqui vem marcado. */}
              <Card className="flex flex-col gap-2">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                  <input
                    data-campo="jaPaguei"
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

                    {/* Critério 8: quarentena PODE ser ligada — é o que impede a
                        mesma despesa de contar duas vezes —, e o texto do parecer
                        é dito na hora, como nos dois seletores. */}
                    {notaNoCpf === "nao" ? (
                      <Banner cor="red" role="status">
                        {VINCULO_QUARENTENA_NAO_GERA_CUSTO}
                      </Banner>
                    ) : null}

                    {erroCandidatos ? (
                      <Banner cor="red" role="alert">
                        Não deu para carregar os pagamentos desta obra:{" "}
                        {erroCandidatos} Você pode salvar a nota assim mesmo e
                        ligar depois, pela tela dela.
                      </Banner>
                    ) : null}

                    {painelDaObra === null && !erroCandidatos ? (
                      <Carregando
                        rotulo="Carregando os pagamentos"
                        onTentarDeNovo={recarregarCandidatos}
                      />
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
                            data-campo="pagamentosCandidatos"
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

              {/* ⚠️ **As duas variantes, e só a cláusula da retenção muda**
                  (spec do CONTAI-053, §3, textos c e d). A de baixo de 880px fica
                  **byte a byte** como sempre foi — critério 6, regressão: ela
                  continua dizendo "que você preenche depois" porque lá, no piso,
                  é exatamente o que acontece. */}
              <div className="larga:hidden">
                <Dica>
                  Olhe na nota antes de responder — &quot;não&quot; no CPF leva à
                  quarentena; &quot;destacada&quot; na retenção abre o detalhamento
                  linha a linha, que você preenche depois. Sem responder, não salva.
                </Dica>
              </div>
              <div className="hidden larga:block">
                <Dica>
                  Olhe na nota antes de responder — &quot;não&quot; no CPF leva à
                  quarentena; &quot;destacada&quot; na retenção abre o detalhamento
                  linha a linha, logo abaixo, nesta mesma tela. Sem responder, não
                  salva.
                </Dica>
              </div>
            </GradeDaCaptura>
          </>
        ) : null}
      </Corpo>

      {registro.fase === "pronta" ? (
        <Rodape className={COLUNA_DO_FORMULARIO}>
          <Passo>Passo 3 de 3 ↓</Passo>
          <BotaoSalvar
            ocupado={fase.nome === "salvando"}
            variante="primary"
            onClick={tentarSalvar}
            disabled={fase.nome === "salvando"}
          >
            {fase.nome === "salvando"
              ? "Salvando…"
              : avisaObraSemCno
                ? ROTULO_SALVAR_SEM_CNO
                : "Salvar registro"}
          </BotaoSalvar>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      ) : (
        <Rodape className={COLUNA_DO_FORMULARIO}>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      )}

      {/* ══ CONTAI-048 — o Lightbox (Estado E do Gate 0) ═══════════════════
          Fora da grade, por cima de tudo: o formulário continua montado atrás
          e nada do que já foi digitado se perde. Só abre por clique; fechado,
          não ocupa espaço nem rede. */}
      {verDocumento && arquivo && urlDoAnexo ? (
        <LightboxDoAnexo
          arquivo={arquivo}
          url={urlDoAnexo}
          modo={modoDoAnexo}
          onFechar={() => setVerDocumento(false)}
        />
      ) : null}

      {/* ══ O diálogo do §A.7.1 — CONTAI-033 ═══════════════════════════════
          ⚠️ **Overlay nesta mesma tela, e o formulário continua montado
          atrás.** Decisão de design 1 do mock: o caminho de captura fica em 1
          tela, e "Anexar agora" devolve o foco ao campo do anexo sem perder
          nada digitado. Rota nova aqui custaria o formulário inteiro.

          É o PRIMEIRO modal do app — não existe componente de diálogo para
          reaproveitar, e criar um "sistema de modais" a partir de um caso é
          abstração prematura. Ele mora aqui, local, até existir o segundo.

          Todo o texto é LITERAL do parecer, lido das constantes de
          `lib/fiscal/documento.ts`. Nada é redigido nesta camada. */}
      {mostrarDialogoSemArquivo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          data-dialogo="sem-arquivo"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={SEM_ARQUIVO_DIALOGO_TITULO}
            className="max-h-[85vh] w-full max-w-[420px] overflow-y-auto rounded-[14px] border border-line bg-paper px-[18px] py-4"
          >
            <h2 className="text-[16px] font-bold">
              {SEM_ARQUIVO_DIALOGO_TITULO}
            </h2>
            <p className="mt-2.5 text-[13.5px]">{SEM_ARQUIVO_DIALOGO_PORQUE}</p>
            {/* As duas guardas, ditas ANTES de gravar. */}
            <Consequencia cor="red">
              {SEM_ARQUIVO_DIALOGO_CONSEQUENCIA}
            </Consequencia>
            <div className="mt-3.5 flex flex-col gap-2">
              {/* ⚠️ Chama `salvar()` DIRETO, não `tentarSalvar()`: passar pelo
                  handler reabriria o diálogo que acabou de ser respondido. */}
              <Botao
                variante="primary"
                type="button"
                onClick={() => {
                  setMostrarDialogoSemArquivo(false);
                  void salvar();
                }}
              >
                {SEM_ARQUIVO_DIALOGO_SALVAR}
              </Botao>
              <Botao
                variante="ghost"
                type="button"
                onClick={() => {
                  setMostrarDialogoSemArquivo(false);
                  // Devolve o foco ao campo do anexo. Nada foi salvo e nada
                  // foi perdido — o formulário nunca desmontou.
                  // ⚠️ Mesmo seletor escopado do "Trocar arquivo" (Gate 2 do
                  // CONTAI-047): o `input[type="file"]` genérico que morava
                  // aqui é a mesma fragilidade, no mesmo campo.
                  document
                    .querySelector<HTMLInputElement>(
                      'input[data-campo="arquivo"]',
                    )
                    ?.focus();
                }}
              >
                {SEM_ARQUIVO_DIALOGO_ANEXAR}
              </Botao>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
