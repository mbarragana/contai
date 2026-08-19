import { describe, expect, it } from "vitest";

import {
  anoCalendario,
  CORPO_DIFERENCA_SEM_EXPLICACAO,
  DATA_QUE_VALE_PARA_O_CUSTO,
  ehDataValida,
  MEIO_PAGAMENTO_AVULSO,
  rotulosPagoSemComprovante,
  rotulosPagoSemNota,
  STATUS_PAGAMENTO_AVULSO,
  textoDiferencaSemExplicacao,
  tituloDiferencaSemExplicacao,
  validarPagamentoAvulso,
  type EntradaPagamento,
} from "@/lib/fiscal/pagamento";
import { formatarBRL } from "@/lib/money";

const CNPJ_VALIDO = "11.222.333/0001-81";
const HOJE = "2026-08-08";

function entradaValida(over: Partial<EntradaPagamento> = {}): EntradaPagamento {
  return {
    favorecidoNome: "AJE Construções",
    favorecidoDocumento: CNPJ_VALIDO,
    valorCentavos: 1500000,
    dataPagamento: "2026-08-05",
    temComprovante: true,
    ...over,
  };
}

describe("anoCalendario (regime de caixa)", () => {
  it("o ano do custo é o da data do pagamento", () => {
    expect(anoCalendario("2026-08-05")).toBe(2026);
    expect(anoCalendario("2027-01-02")).toBe(2027);
  });

  it("virada de ano: 31/12 e 01/01 caem em anos diferentes", () => {
    expect(anoCalendario("2026-12-31")).toBe(2026);
    expect(anoCalendario("2027-01-01")).toBe(2027);
  });
});

describe("ehDataValida", () => {
  it("aceita ISO real e recusa data inexistente", () => {
    expect(ehDataValida("2026-08-05")).toBe(true);
    expect(ehDataValida("2026-02-30")).toBe(false);
    expect(ehDataValida("05/08/2026")).toBe(false);
    expect(ehDataValida("")).toBe(false);
  });
});

describe("rótulos do pagamento sem documento hábil", () => {
  it("favorecido PJ deve NF", () => {
    const r = rotulosPagoSemNota("pj");
    expect(r.documento).toBe("NF");
    expect(r.chip).toBe("Pago sem nota");
    expect(r.semVinculo).toBe("sem NF vinculada");
    expect(r.consequencia).toContain("NF");
    expect(r.consequencia).not.toContain("recibo");
  });

  it("favorecido PF deve recibo assinado, nunca NF", () => {
    const r = rotulosPagoSemNota("pf");
    expect(r.documento).toBe("recibo");
    expect(r.chip).toBe("Pago sem recibo");
    expect(r.semVinculo).toBe("sem recibo vinculado");
    // O recibo só é hábil com nome, CPF completo e descrição do serviço.
    expect(r.consequencia).toContain("recibo assinado");
    expect(r.consequencia).toContain("CPF");
    expect(r.consequencia).toContain("descrição do serviço");
    expect(r.consequencia).not.toContain("NF");
  });

  it("tipo desconhecido não assume PJ: pede o CNPJ/CPF", () => {
    const r = rotulosPagoSemNota(null);
    expect(r.documento).toBe("documento hábil");
    expect(r.consequencia).toContain("CNPJ/CPF");
  });
});

describe("pagamento avulso", () => {
  it("nasce como PIX aguardando NF", () => {
    expect(MEIO_PAGAMENTO_AVULSO).toBe("pix");
    expect(STATUS_PAGAMENTO_AVULSO).toBe("aguardando_nf");
  });

  const campos = (e: EntradaPagamento, hoje = HOJE) =>
    validarPagamentoAvulso(e, hoje).map((x) => x.campo);

  it("entrada completa passa", () => {
    expect(validarPagamentoAvulso(entradaValida(), HOJE)).toEqual([]);
  });

  /**
   * ⚠️ ERA "sem comprovante NÃO salva" (CONTAI-001..018) e virou o oposto no
   * CONTAI-019, critério 46. A cobertura não foi apagada: ela passou a afirmar
   * o ESTADO QUE NASCE, que é o que o ADENDO 2 §5 do parecer determinou —
   * "o botão grava sempre; o que muda é o estado que nasce", e o §4:
   * *nunca recuse o registro de um fato consumado.*
   *
   * O bloqueio antigo aplicava DOIS PESOS ao mesmo fato do mundo (a
   * confirmação de compromisso já gravava sem comprovante), e o mais duro dos
   * dois é o que empurra para não registrar — a falha da meta 1 pelo lado de
   * fora.
   */
  it("sem comprovante GRAVA — e nasce em pendência, não em recusa", () => {
    expect(
      validarPagamentoAvulso(entradaValida({ temComprovante: false }), HOJE),
      "a falta do comprovante deixou de ser erro de campo",
    ).toEqual([]);

    // O estado que nasce: fora do custo confirmado (o elegível é 0, provado em
    // `vinculo.test.ts`) e uma pendência com o peso do favorecido.
    expect(rotulosPagoSemComprovante("pf").gravidade).toBe("red");
    expect(rotulosPagoSemComprovante("pj").gravidade).toBe("amb");
  });

  it("favorecido sem CNPJ/CPF válido não salva", () => {
    expect(
      campos(entradaValida({ favorecidoDocumento: "12345678900000" })),
    ).toContain("favorecidoDocumento");
  });

  it("data no futuro não passa — jogaria o custo no ano errado", () => {
    expect(campos(entradaValida({ dataPagamento: "2027-01-02" }))).toContain(
      "dataPagamento",
    );
    // A data de hoje é válida.
    expect(campos(entradaValida({ dataPagamento: HOJE }))).toEqual([]);
  });

  it("valor e data ausentes viram erro, nunca zero silencioso", () => {
    const erros = campos(
      entradaValida({ valorCentavos: null, dataPagamento: null }),
    );
    expect(erros).toContain("valorCentavos");
    expect(erros).toContain("dataPagamento");
  });
});


describe("pago sem comprovante — o peso muda com o favorecido (crit. 47)", () => {
  it("PJ com NF: âmbar, texto LITERAL da tabela do ADENDO 2 §5", () => {
    const r = rotulosPagoSemComprovante("pj");
    expect(r.gravidade).toBe("amb");
    expect(r.consequencia).toBe(
      "pago sem comprovante — o custo existe, ainda não está demonstrável",
    );
  });

  it("PF com recibo: VERMELHO, porque o comprovante é constitutivo", () => {
    // ADENDO 2 §1: "Sem o rastro bancário não existe condição 3 — não é custo
    // mal documentado, é custo INEXISTENTE para efeito de prova." A cor não é
    // estética: é a diferença entre "falta provar quando saiu" e "não há custo".
    const r = rotulosPagoSemComprovante("pf");
    expect(r.gravidade).toBe("red");
    expect(r.consequencia).toBe(
      "sem o comprovante da transferência, este recibo não sustenta custo nenhum",
    );
  });

  it("tipo desconhecido não assume PJ: cai no lado seguro e pede o CNPJ/CPF", () => {
    // O parecer não tem linha para este caso (a tabela do §5 tem duas). Nada
    // aqui inventa consequência fiscal: o texto diz que não dá para dizer.
    const r = rotulosPagoSemComprovante(null);
    expect(r.gravidade).toBe("red");
    expect(r.consequencia).toContain("CNPJ/CPF");
  });
});

describe("textos com consequência fiscal — copiados, não reescritos", () => {
  it("§F.4 — a frase ancora no PAGAMENTO e traz o valor (critério 31e)", () => {
    // A minuta do `designer` foi reprovada por ancorar no PREVISTO: previsão
    // não decide custo nenhum, quem limita é o documento hábil. Com previsto de
    // R$ 9.000 e nota de R$ 10.000 a frase estaria errada em tela.
    // `formatarBRL` separa "R$" do número com ESPAÇO INSEPARÁVEL (U+00A0), que
    // é o que o Intl produz em pt-BR — por isso o valor entra por ele, e não
    // como literal: um espaço comum aqui reprovaria um texto correto.
    expect(tituloDiferencaSemExplicacao(30_000)).toBe(
      `${formatarBRL(30_000)} do que você pagou ainda estão sem explicação.`,
    );
    expect(tituloDiferencaSemExplicacao(30_000)).toMatch(
      /^R\$\s300,00 do que você pagou ainda estão sem explicação\.$/,
    );
    expect(CORPO_DIFERENCA_SEM_EXPLICACAO).toBe(
      "Enquanto estiverem, ficam fora do custo de aquisição. Se forem juros, " +
        "multa ou algo que não é da obra, ficam fora para sempre — e não há o " +
        "que cobrar. Se forem obra, entram no custo quando houver nota no seu " +
        "CPF que os cubra; até lá, contam como pago sem nota.",
    );
    expect(textoDiferencaSemExplicacao(30_000)).toContain(formatarBRL(30_000));
    expect(textoDiferencaSemExplicacao(30_000)).toContain(
      CORPO_DIFERENCA_SEM_EXPLICACAO,
    );
  });

  it("§F.5 — a frase substituta do CONTAI-018, com o exemplo", () => {
    expect(DATA_QUE_VALE_PARA_O_CUSTO).toBe(
      "A data que vale para o custo é a do pagamento, não a da nota. Nota de " +
        "dezembro paga em janeiro é custo do ano seguinte.",
    );
  });

  it("nenhum texto novo diz 'regime de caixa' nem 'previsto/efetivado' (crit. 7)", () => {
    const tudo = [
      DATA_QUE_VALE_PARA_O_CUSTO,
      CORPO_DIFERENCA_SEM_EXPLICACAO,
      tituloDiferencaSemExplicacao(30_000),
      rotulosPagoSemComprovante("pj").consequencia,
      rotulosPagoSemComprovante("pf").consequencia,
    ]
      .join(" ")
      .toLowerCase();
    expect(tudo).not.toContain("regime de caixa");
    expect(tudo).not.toContain("efetivado");
  });
});
