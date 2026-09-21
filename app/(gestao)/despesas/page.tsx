"use client";

import { useGestao } from "@/app/_components/gestao";
import { LinhaDoPainel, Painel } from "@/app/_components/painel";
import {
  Banner,
  Carregando,
  Dica,
  EstadoErro,
} from "@/app/_components/ui";
import { formatarBRL } from "@/lib/money";

/**
 * **Despesas — a rota que o `CONTAI-041` completa.**
 *
 * O critério 10 do `CONTAI-040` deixa esta decisão para o Gate 1: *"rota que só
 * ganha conteúdo no CONTAI-041; até lá o link pode ficar desativado ou o painel
 * omitido"*. Escolha tomada e a razão dela:
 *
 * 1. **O item da sidebar não pode ser link morto** (critério 1 do ticket), logo
 *    a rota existe de verdade.
 * 2. **Nenhuma superfície pode ser perdida entre um ticket e o outro.** A home
 *    de ontem listava TODAS as despesas comprovadas, cada uma com a linha do
 *    regime de caixa ("o resto caiu no ano do pagamento que o gerou") e o link
 *    para o detalhe. O dashboard mostra só as quatro mais recentes. Sem esta
 *    lista, as demais ficariam inalcançáveis até o `CONTAI-041` — perder
 *    superfície por ordem de entrega é a classe D47.
 *
 * O que **não** está aqui é o que o `CONTAI-041` traz: colunas, ordenação,
 * filtros, busca, e as linhas com pendência convivendo com as comprovadas na
 * mesma tabela. A tela diz isso, em vez de fingir que é a tabela.
 */
export default function Despesas() {
  const { estado, tentarDeNovo } = useGestao();

  if (estado.fase === "carregando") {
    return <Carregando rotulo="Carregando as despesas" />;
  }
  if (estado.fase === "erro") {
    return <EstadoErro erro={estado.erro} onTentarDeNovo={tentarDeNovo} />;
  }

  const { resumo, painel } = estado;

  if (resumo === null || painel === null) {
    return (
      <Banner cor="amb" role="status">
        <strong>Nenhuma obra aberta neste aparelho.</strong> As despesas são de
        uma obra só — abra uma em <strong>Obras</strong> para vê-las.
      </Banner>
    );
  }

  return (
    <>
      <Banner cor="amb" role="status">
        <strong>A tabela ainda não chegou.</strong> Colunas, ordenação, filtros
        e as linhas com pendência ao lado das comprovadas entram no próximo
        passo. Abaixo está a lista de despesas comprovadas da obra, como ela já
        existia.
      </Banner>

      {resumo.despesas.length === 0 ? (
        <Dica>
          Nenhuma despesa comprovada em {painel.obra.nome} — despesa comprovada
          é nota e pagamento já ligados. O que está em aberto fica em
          Pendências.
        </Dica>
      ) : (
        <Painel
          data-painel="despesas-comprovadas"
          titulo="Despesas comprovadas"
          descricao="Nota + pagamento já ligados — uma despesa, não duas."
        >
          {resumo.despesas.map((d) => (
            <div key={d.id}>
              <LinhaDoPainel
                href={d.href}
                titulo={d.titulo}
                detalhe={d.detalhe}
                valor={formatarBRL(d.valorCentavos)}
              />
              {/* Regime de caixa: a parte que cai no ano em tela pode ser
                  menor que o conjunto. A linha existia na home e continua —
                  número que muda de ano sem dizer por quê é número que mente. */}
              {d.noAnoCentavos !== d.valorCentavos ? (
                <Dica>
                  Em {resumo.ano}:{" "}
                  <span className="mono">{formatarBRL(d.noAnoCentavos)}</span> —
                  o resto caiu no ano do pagamento que o gerou.
                </Dica>
              ) : null}
            </div>
          ))}
        </Painel>
      )}
    </>
  );
}
