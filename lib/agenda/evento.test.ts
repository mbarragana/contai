import { describe, expect, it } from "vitest";

import { formatarBRL } from "@/lib/money";
import {
  LEMBRETES_EM_MINUTOS,
  eventIdDeCompromisso,
  eventoDesejado,
  falhouSincronizacao,
  precisaSincronizar,
  type CompromissoParaAgenda,
  type EstadoSincronizado,
} from "@/lib/agenda/evento";

/**
 * **CONTAI-092 — o Gate Fiscal do texto do evento e a régua de sincronização.**
 *
 * Os dois blocos mais importantes deste arquivo não testam comportamento: eles
 * testam uma PROIBIÇÃO (critérios 7, 7a-c e 8). Um teste de proibição parece
 * burocracia até o dia em que alguém reescreve a microcópia do evento "para
 * ficar mais claro" e põe a palavra "obrigação" no título — e o evento passa a
 * sair da conta Google do Mateus insinuando prazo tributário onde há obrigação
 * contratual com fornecedor.
 */

/**
 * ⚠️ O valor vem de `formatarBRL`, nunca de um literal "R$ 3.200,00": o
 * `Intl.NumberFormat("pt-BR")` separa o símbolo com espaço NÃO SEPARÁVEL
 * (U+00A0), e um literal com espaço comum reprova o teste sem que nada esteja
 * errado no produto. Quem garante o formato é `lib/money.test.ts`; aqui o que
 * se afirma é a COMPOSIÇÃO do texto.
 */
const VALOR = formatarBRL(320_000);

const PIX_ABERTO: CompromissoParaAgenda = {
  id: "11111111-2222-3333-4444-555555555555",
  origem: "pix",
  situacao: "aberto",
  dataPrevista: "2026-11-20",
  valorPrevistoCentavos: 320_000,
  favorecidoNome: "Empreiteira XYZ",
};

function sincronizado(
  parcial: Partial<EstadoSincronizado> = {},
): EstadoSincronizado {
  return {
    estado: "presente",
    dataSincronizada: "2026-11-20",
    situacaoSincronizada: "aberto",
    ultimoErro: null,
    ...parcial,
  };
}

describe("eventIdDeCompromisso", () => {
  it("é o uuid sem hífens, em minúsculas — 32 caracteres [0-9a-f]", () => {
    const id = eventIdDeCompromisso("11111111-2222-3333-4444-555555555555");
    expect(id).toBe("11111111222233334444555555555555");
    // O Google aceita id customizado em base32hex (dígitos + a..v); hexadecimal
    // é subconjunto estrito disso. Se esta asserção cair, o `insert` passa a
    // devolver 400 — e 400 não tem retry (critério 10).
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
  });

  it("é DETERMINÍSTICO: o mesmo compromisso sempre produz o mesmo id", () => {
    // É isso, e só isso, que torna "nunca um segundo evento" estrutural
    // (critério 3): a segunda criação bate em 409 e vira patch.
    expect(eventIdDeCompromisso(PIX_ABERTO.id)).toBe(
      eventIdDeCompromisso(PIX_ABERTO.id),
    );
  });

  it("normaliza maiúsculas do uuid", () => {
    expect(eventIdDeCompromisso("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")).toBe(
      "aaaaaaaabbbbccccddddeeeeeeeeeeee",
    );
  });

  it("recusa id que não é uuid em vez de mandar um 400 ao Google", () => {
    expect(() => eventIdDeCompromisso("compromisso-1")).toThrow(/não é um uuid/);
    expect(() => eventIdDeCompromisso("")).toThrow(/não é um uuid/);
  });
});

describe("eventoDesejado — quando o evento DEVE existir", () => {
  it("PIX aberto com data: três lembretes popup em 5 dias, 2 dias e no dia", () => {
    const evento = eventoDesejado(PIX_ABERTO);
    expect(evento).not.toBeNull();
    expect(evento!.lembretes).toEqual([
      { method: "popup", minutes: 7200 },
      { method: "popup", minutes: 2880 },
      { method: "popup", minutes: 0 },
    ]);
    expect(evento!.lembretes).toHaveLength(3);
    expect(LEMBRETES_EM_MINUTOS).toEqual([7200, 2880, 0]);
  });

  it("tem HORÁRIO definido às 09:00 de São Paulo, não 'dia inteiro'", () => {
    // Critério 1: num evento de dia inteiro o lembrete de offset zero soaria à
    // meia-noite, que é o único dos três horários em que não dá para pagar.
    const evento = eventoDesejado(PIX_ABERTO)!;
    expect(evento.inicio).toBe("2026-11-20T09:00:00");
    expect(evento.fim).toBe("2026-11-20T09:30:00");
    expect(evento.fuso).toBe("America/Sao_Paulo");
  });

  it("título: favorecido e valor", () => {
    expect(eventoDesejado(PIX_ABERTO)!.titulo).toBe(
      `Pagamento Empreiteira XYZ — ${VALOR}`,
    );
  });

  it("sem favorecido, o título não inventa nome nenhum", () => {
    const evento = eventoDesejado({ ...PIX_ABERTO, favorecidoNome: null })!;
    expect(evento.titulo).toBe(`Pagamento agendado — ${VALOR}`);
    expect(evento.descricao).toContain("Favorecido: não informado");
  });

  it("boleto: a forma de pagamento aparece como 'Boleto'", () => {
    const evento = eventoDesejado({ ...PIX_ABERTO, origem: "boleto" })!;
    expect(evento.descricao).toContain("Forma: Boleto");
  });

  it("descrição traz favorecido, valor, forma e vencimento previsto", () => {
    const d = eventoDesejado(PIX_ABERTO)!.descricao;
    expect(d).toContain("Favorecido: Empreiteira XYZ");
    expect(d).toContain(`Valor previsto: ${VALOR}`);
    expect(d).toContain("Forma: Pix");
    expect(d).toContain("Vencimento previsto: 20/11/2026");
  });
});

describe("eventoDesejado — quando NENHUM evento deve existir", () => {
  it("cartão NUNCA gera evento, em nenhuma situação (critério 2)", () => {
    for (const situacao of ["aberto", "quitado", "cancelado"] as const) {
      expect(
        eventoDesejado({ ...PIX_ABERTO, origem: "cartao", situacao }),
      ).toBeNull();
    }
  });

  it("quitado: o evento é removido, nunca mantido (critério 4)", () => {
    expect(eventoDesejado({ ...PIX_ABERTO, situacao: "quitado" })).toBeNull();
  });

  it("cancelado: o evento é removido (critério 4)", () => {
    expect(eventoDesejado({ ...PIX_ABERTO, situacao: "cancelado" })).toBeNull();
  });

  it("sem data prevista (saldo de quitação parcial): não há dia para apontar", () => {
    expect(eventoDesejado({ ...PIX_ABERTO, dataPrevista: null })).toBeNull();
  });
});

describe("Gate Fiscal do texto do evento (critérios 7, 7a-c e 8)", () => {
  /**
   * **7a** — vocabulário que sugira controle fiscal oficial ou vínculo com
   * apuração. A lista é a do próprio ticket; "fiscal" entra porque a única
   * ocorrência legítima dele no texto é a negação ("não é controle fiscal"), e
   * ela é conferida à parte, por igualdade de frase.
   */
  const PROIBIDOS = [
    "vencimento fiscal",
    "obrigação",
    "obrigacao",
    "prazo legal",
    "darf",
    "aferição",
    "afericao",
    "inss",
    "irpf",
    "gcap",
    "retenção",
    "retencao",
    "documentação hábil",
    "documentacao habil",
    "em dia com o fisco",
    "nota fiscal",
    "custo de aquisição",
  ];

  const CASOS: CompromissoParaAgenda[] = [
    PIX_ABERTO,
    { ...PIX_ABERTO, origem: "boleto" },
    { ...PIX_ABERTO, favorecidoNome: null },
    { ...PIX_ABERTO, valorPrevistoCentavos: 1 },
  ];

  it("nenhum termo de controle fiscal no título nem na descrição", () => {
    for (const caso of CASOS) {
      const evento = eventoDesejado(caso)!;
      const texto = `${evento.titulo}\n${evento.descricao}`.toLowerCase();
      for (const termo of PROIBIDOS) {
        expect(texto, `termo proibido "${termo}" no evento`).not.toContain(
          termo,
        );
      }
    }
  });

  it("a frase de abertura NEGA garantia e nega controle fiscal (7b)", () => {
    // Texto verificado pelo `contador` no Gate Fiscal do ticket e aprovado como
    // está. Alterar esta redação exige conferir a nova contra 7a-c e 8 antes de
    // ir a produção — é o que o critério 8 manda.
    expect(eventoDesejado(PIX_ABERTO)!.descricao).toContain(
      "Lembrete de pagamento agendado no contai — conveniência, não é " +
        "controle fiscal nem garantia de que o pagamento vai sair em dia.",
    );
  });

  it("nenhuma promessa de que o app garante pagamento em dia (critério 7)", () => {
    const texto = eventoDesejado(PIX_ABERTO)!.descricao.toLowerCase();
    expect(texto).not.toContain("garante que você paga");
    expect(texto).not.toContain("em dia com");
  });

  /**
   * **8** — CPF nunca sai do app por este caminho. A varredura é sobre o OBJETO
   * INTEIRO (serializado), não só sobre título e descrição: um campo novo que
   * carregasse identificador — `location`, `extendedProperties`, `attendees` —
   * cairia aqui.
   */
  it("nenhum CPF/CNPJ e nenhum identificador de prestador em campo nenhum", () => {
    const evento = eventoDesejado({
      ...PIX_ABERTO,
      favorecidoNome: "José da Silva",
    })!;
    const serializado = JSON.stringify(evento);
    // Nenhuma sequência de 11+ dígitos (CPF/CNPJ) em lugar nenhum. O eventId é
    // hexadecimal de 32 caracteres e contém letras, então ele próprio não casa
    // por acidente — mas um uuid só de dígitos casaria, e por isso o teste
    // exclui o campo do id explicitamente.
    const semId = { ...evento, eventId: undefined };
    expect(JSON.stringify(semId)).not.toMatch(/\d{11}/);
    // E o objeto não tem campo nenhum além dos sete previstos.
    expect(Object.keys(evento).sort()).toEqual([
      "descricao",
      "eventId",
      "fim",
      "fuso",
      "inicio",
      "lembretes",
      "titulo",
    ]);
    expect(serializado).toContain("José da Silva");
  });
});

describe("precisaSincronizar — a régua da reconciliação (critério 11)", () => {
  it("linha ausente e evento desejado: há o que fazer (backfill)", () => {
    expect(precisaSincronizar(PIX_ABERTO, null)).toBe(true);
  });

  it("linha em dia: nada a fazer", () => {
    expect(precisaSincronizar(PIX_ABERTO, sincronizado())).toBe(false);
  });

  it("data mudou depois da última sincronização: há o que fazer", () => {
    expect(
      precisaSincronizar(
        { ...PIX_ABERTO, dataPrevista: "2026-12-01" },
        sincronizado(),
      ),
    ).toBe(true);
  });

  it("quitado com evento ainda presente: é o lembrete FANTASMA (pre-mortem 3)", () => {
    expect(
      precisaSincronizar({ ...PIX_ABERTO, situacao: "quitado" }, sincronizado()),
    ).toBe(true);
  });

  it("quitado com evento já removido: nada a fazer", () => {
    expect(
      precisaSincronizar(
        { ...PIX_ABERTO, situacao: "quitado" },
        sincronizado({
          estado: "removido",
          dataSincronizada: null,
          situacaoSincronizada: "quitado",
        }),
      ),
    ).toBe(false);
  });

  it("CARTÃO sem linha nenhuma nunca conta como pendente", () => {
    // Senão o card de `/conta` mostraria "Pendentes: 24" numa compra parcelada
    // que, por critério, não gera evento nenhum.
    expect(precisaSincronizar({ ...PIX_ABERTO, origem: "cartao" }, null)).toBe(
      false,
    );
  });

  it("sem data prevista e sem linha: nada pendente", () => {
    expect(precisaSincronizar({ ...PIX_ABERTO, dataPrevista: null }, null)).toBe(
      false,
    );
  });

  it("tentativa que falhou (estado não mudou) continua pendente", () => {
    expect(
      precisaSincronizar(
        PIX_ABERTO,
        sincronizado({
          estado: "removido",
          dataSincronizada: null,
          situacaoSincronizada: null,
          ultimoErro: "Google devolveu 503",
        }),
      ),
    ).toBe(true);
  });
});

describe("falhouSincronizacao — a guarda da linha âmbar do detalhe", () => {
  it("sem linha: não acende (nunca se tentou)", () => {
    expect(falhouSincronizacao(PIX_ABERTO, null)).toBe(false);
  });

  it("pendente mas SEM erro registrado: não acende", () => {
    // É o caso do compromisso criado há dois segundos, com a sincronização em
    // voo: acender aqui diria que falhou algo que não falhou.
    expect(
      falhouSincronizacao(
        PIX_ABERTO,
        sincronizado({
          estado: "removido",
          dataSincronizada: null,
          situacaoSincronizada: null,
        }),
      ),
    ).toBe(false);
  });

  it("erro registrado e ainda pendente: acende", () => {
    expect(
      falhouSincronizacao(
        PIX_ABERTO,
        sincronizado({
          estado: "removido",
          dataSincronizada: null,
          situacaoSincronizada: null,
          ultimoErro: "Google devolveu 503",
        }),
      ),
    ).toBe(true);
  });

  it("erro antigo já resolvido por uma sincronização posterior: apaga", () => {
    // `ultimo_erro` volta a `null` no sucesso — a linha desaparece porque o fato
    // deixou de ser verdadeiro, não porque alguém a dispensou.
    expect(falhouSincronizacao(PIX_ABERTO, sincronizado())).toBe(false);
  });
});
