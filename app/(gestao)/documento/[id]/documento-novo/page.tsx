"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  ChipsDeAnexoExistente,
  CHIP_ARQUIVO_NOVO,
  type PapelDoPacote,
} from "@/app/_components/corrigir";
import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import {
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Dica,
  EstadoErro,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  carregarAnexosDoDocumento,
  carregarDocumento,
  classificarErro,
  type AnexoDoDocumento,
  type ErroDeTela,
} from "@/lib/data";
import { exigeGateDeRetencao, OPCOES_GATE } from "@/lib/fiscal/retencao";
import {
  ORDEM_DO_PACOTE,
  proximaDoPacote,
  type CorrecaoDoPacote,
} from "@/lib/gestao/pacote-correcao";
import { nomeDoArquivoNoAcervo } from "@/lib/acervo";
import { formatarBRL } from "@/lib/money";
import type { Documento } from "@/lib/types";

/**
 * **CONTAI-088 — "recebi um documento novo para esta nota".**
 *
 * Dor de origem (`docs/backlog/103-2026-10-05-ponto-entrada-unico-correcao-documento.md`):
 * na correção real da NFS-e 261→263, o Mateus precisou de duas ações separadas
 * sobre o mesmo papel e acabou subindo o arquivo errado numa delas — duas cópias
 * do mesmo PDF no acervo, sem caminho de remoção (`documento_anexo` nunca teve
 * GRANT de DELETE). Palavras dele: *"eu deveria poder fazer tdoas as correções
 * em uma unica edição: número, valor, retenção"*.
 *
 * ⚠️ **ESTA TELA NÃO FUNDE NADA, E NÃO GRAVA NADA.** A fusão dos três campos num
 * formulário/INSERT único foi avaliada e **recusada** na conversa de origem,
 * reafirmando o CONTAI-021 e os tickets 085/086/087: os três campos vivem em
 * regimes de consequência fiscal diferentes (`numero`/`serie` não move custo nem
 * aferição; retenção não move nenhum dos dois; `valor` é o único que move custo
 * entre exercícios — parecer `2026-08-18-correcao-de-documento-registrado.md`
 * §0(a)). O que existe aqui é **roteamento**: cada correção continua com a sua
 * RPC, o seu motivo e a sua linha em `revisao`.
 *
 * ⚠️ **Nenhuma linha própria em `revisao`** (critério 8): o rastro deste fluxo é
 * exclusivamente a soma das correções efetivamente confirmadas. Sair no meio do
 * pacote deixa valendo o que já foi gravado — nunca é tudo-ou-nada (critério 7).
 *
 * ⚠️ **E NÃO HÁ UPLOAD AQUI** (critério 3): com "vou anexar um arquivo novo", o
 * arquivo só é escolhido dentro da PRIMEIRA correção da sequência, que já tem
 * `CampoArquivo`. Subir o papel aqui deixaria um objeto órfão no bucket se o
 * Mateus desistisse no meio — exatamente o tipo de lixo sem remoção que este
 * ticket existe para não produzir.
 *
 * ⚠️ **O motivo (`PassoMotivo`) não é perguntado aqui, e nunca será** (critério
 * 10 e condição obrigatória do Gate Fiscal): ele é decidido POR correção, porque
 * a obrigatoriedade de anexo é função do motivo daquela correção específica.
 * Motivo compartilhado por desenho herdaria em silêncio a decisão de
 * anexo-obrigatório de uma correção para as outras.
 */
export default function DocumentoNovo() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [documento, setDocumento] = useState<Documento | null>(null);
  const [anexos, setAnexos] = useState<AnexoDoDocumento[]>([]);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);
  const [tentativa, setTentativa] = useState(0);

  /**
   * Os dois passos vivem na MESMA rota (spec, §decisões): é o mesmo padrão que
   * `PassoMotivo` já usa dentro de cada correção, e não há rede entre eles —
   * duas rotas para dois passos sem rede seria navegação sem motivo. "Voltar"
   * preserva a escolha do passo 1 porque ela mora aqui, não na URL.
   */
  const [passo, setPasso] = useState<1 | 2>(1);
  /** Nasce `null`: nada escolhido por padrão, nem quando só há uma opção. */
  const [papel, setPapel] = useState<PapelDoPacote | null>(null);
  const [marcadas, setMarcadas] = useState<CorrecaoDoPacote[]>([]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const d = await carregarDocumento(id);
        // A MESMA chamada que alimenta os chips das três telas de correção: a
        // lista só traz os ADICIONAIS, nunca o `arquivo_path` original.
        const lista = await carregarAnexosDoDocumento(d.id);
        if (cancelado) return;
        setDocumento(d);
        setAnexos(lista);
      } catch (erro) {
        if (!cancelado) setErroCarregar(classificarErro(erro));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setErroCarregar(null);
    setDocumento(null);
    setTentativa((t) => t + 1);
  }, []);

  const documentoHref = `/documento/${id}`;
  const titulo = "Recebi um documento novo";

  if (!documento) {
    return (
      <>
        <CabecalhoDaTela titulo={titulo} />
        <ColunaDeDetalhe>
          {erroCarregar ? (
            <EstadoErro erro={erroCarregar} onTentarDeNovo={tentarDeNovo} />
          ) : (
            <Carregando rotulo="Carregando os anexos deste documento" />
          )}
        </ColunaDeDetalhe>
      </>
    );
  }

  const d = documento;
  const sub = d.favorecidoNome ?? "emitente não identificado";

  // ── Passo 1 — qual papel ───────────────────────────────────────────────
  if (passo === 1) {
    return (
      <>
        <CabecalhoDaTela titulo={titulo} sub={`${sub} · passo 1 de 2`} />
        <ColunaDeDetalhe>
          <Passo>Passo 1 de 2 — qual papel traz a correção</Passo>
          <ChipsDeAnexoExistente
            anexos={anexos}
            titulo="Qual papel traz as correções?"
            escolhido={papel}
            onEscolher={setPapel}
            comArquivoNovo
            dica="Nada aqui nasce escolhido. O arquivo novo, se for o caso, é anexado dentro da primeira correção — nada é gravado nesta tela."
          />
        </ColunaDeDetalhe>

        <RodapeDeAcao>
          <Botao
            variante="primary"
            disabled={papel === null}
            onClick={() => setPasso(2)}
          >
            {papel === null ? "Escolha o papel para continuar" : "Avançar"}
          </Botao>
          <BotaoLink href={documentoHref}>Cancelar</BotaoLink>
        </RodapeDeAcao>
      </>
    );
  }

  // ── Passo 2 — o que esse papel corrige ─────────────────────────────────
  //
  // Sem rede: tudo o que este passo mostra já foi carregado no passo 1.
  //
  // ⚠️ A retenção só entra na lista quando ela EXISTE para este documento — NF de
  // serviço com o gate já respondido. Oferecer a caixa num boleto, ou numa nota
  // cujo gate nunca foi respondido, mandaria o Mateus para uma tela que recusa no
  // topo (as três guardas de `corrigir/retencao`): recusar TARDE é pedir trabalho
  // fiscal que vai para o lixo e ensina que o erro é do app.
  const temGateDeRetencao = exigeGateDeRetencao(d) && d.retencaoNaNota !== null;
  const gateHoje =
    OPCOES_GATE.find((o) => o.valor === d.retencaoNaNota)?.texto ?? "—";

  const opcoes: { valor: CorrecaoDoPacote; rotulo: string }[] = [
    {
      valor: "numero",
      rotulo: `Número da nota — hoje: Nº ${d.numero ?? "(em branco)"}${
        d.serie ? ` · série ${d.serie}` : ""
      }`,
    },
    {
      valor: "valor",
      rotulo: `Valor — hoje: ${
        d.valorCentavos === null ? "(em branco)" : formatarBRL(d.valorCentavos)
      }`,
    },
    ...(temGateDeRetencao
      ? [{ valor: "retencao" as const, rotulo: `Retenção — hoje: ${gateHoje}` }]
      : []),
  ];

  const marcada = (c: CorrecaoDoPacote) => marcadas.includes(c);
  const alternar = (c: CorrecaoDoPacote) =>
    setMarcadas((atuais) =>
      atuais.includes(c) ? atuais.filter((m) => m !== c) : [...atuais, c],
    );

  /**
   * A ordem de navegação é a FIXA (`ORDEM_DO_PACOTE`), nunca a ordem de
   * marcação — e ela não é regra fiscal: o Gate Fiscal é literal em que nenhuma
   * das três depende do resultado das outras.
   */
  const fila = ORDEM_DO_PACOTE.filter(marcada);
  const primeira = proximaDoPacote(
    id,
    fila,
    papel?.tipo === "existente" ? papel.path : null,
  );

  return (
    <>
      <CabecalhoDaTela titulo={titulo} sub={`${sub} · passo 2 de 2`} />
      <ColunaDeDetalhe>
        <Card>
          <Linha rotulo="Papel escolhido">
            {papel?.tipo === "existente"
              ? nomeDoArquivoNoAcervo(papel.path)
              : CHIP_ARQUIVO_NOVO}
          </Linha>
          <div className="mt-2">
            <Botao variante="ghost" onClick={() => setPasso(1)}>
              Trocar o papel
            </Botao>
          </div>
        </Card>

        <Passo>Passo 2 de 2 — o que esse papel corrige</Passo>
        <Card>
          <div className="font-semibold">
            O que este documento novo corrige nesta nota?
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {opcoes.map((o) => (
              <label
                key={o.valor}
                className="flex min-h-[44px] cursor-pointer items-start gap-2.5"
              >
                <input
                  type="checkbox"
                  data-campo="correcoesMarcadas"
                  checked={marcada(o.valor)}
                  onChange={() => alternar(o.valor)}
                  className="mt-1 h-5 w-5 flex-none"
                />
                <span className="text-[13px]">{o.rotulo}</span>
              </label>
            ))}
          </div>
          <Dica>
            Pode marcar mais de uma. Cada correção continua sendo um ato próprio,
            com o seu motivo e o seu registro — você vai respondê-las uma a uma.
          </Dica>
          {temGateDeRetencao ? null : (
            <Dica>
              A retenção não entra nesta lista: ela só existe em nota fiscal de
              serviço cuja pergunta sobre retenção já foi respondida.
            </Dica>
          )}
        </Card>
        <Dica>
          Nada é gravado aqui. Se você sair no meio do caminho, cada correção já
          confirmada continua valendo, e as que faltam continuam acessíveis pelo
          detalhe da nota.
        </Dica>
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        <Botao
          variante="primary"
          disabled={primeira === null}
          onClick={() => {
            if (primeira !== null) router.push(primeira.href);
          }}
        >
          {primeira === null
            ? "Marque ao menos uma correção para continuar"
            : "Continuar"}
        </Botao>
        <Botao variante="ghost" onClick={() => setPasso(1)}>
          Voltar
        </Botao>
      </RodapeDeAcao>
    </>
  );
}
