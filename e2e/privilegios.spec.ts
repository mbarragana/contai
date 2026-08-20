import { expect, test } from "@playwright/test";

import { consultarAdmin } from "./banco";

/**
 * O teste que teria pegado o incidente de 2026-08-17 (app publicado devolvendo
 * `permission denied for table obra` depois de um login bem-sucedido).
 *
 * Por que os outros 30 E2E não pegaram: eles exercitam COMPORTAMENTO contra o
 * Postgres local, e o stack local do CLI vem com `alter default privileges`
 * ligado no schema `public` — toda tabela criada por migration já nascia
 * acessível para `anon` e `authenticated`. No projeto remoto esse default está
 * desligado, e as migrations 0001-0004 não concediam privilégio nenhum. O
 * comportamento era idêntico nos dois bancos; a CONFIGURAÇÃO é que não era.
 *
 * A migration 0005 fecha isso para as tabelas que existem hoje, revogando
 * antes de conceder — depois dela o banco local tem exatamente os privilégios
 * do remoto. Este teste fecha para as tabelas de AMANHÃ: tabela nova nasce sem
 * privilégio nenhum, não aparece no mapa abaixo, e a suíte fica vermelha com o
 * nome dela — em vez de passar aqui e quebrar em produção.
 *
 * Quando um ticket criar tabela ou precisar de um verbo novo, o GRANT vai na
 * migration DELE e o mapa abaixo muda no MESMO diff. É essa a intenção: o
 * privilégio é decisão visível, nunca herança silenciosa do ambiente.
 */

/** O que `authenticated` pode fazer, tabela por tabela. Espelha a 0005. */
const ESPERADO: Record<string, string> = {
  obra: "INSERT,SELECT,UPDATE",
  favorecido: "INSERT,SELECT,UPDATE",
  documento: "INSERT,SELECT,UPDATE",
  pagamento: "INSERT,SELECT,UPDATE",
  // Leitura, escrita e remoção do VÍNCULO (migration 0006, CONTAI-018). O
  // DELETE é a exceção do append-only e está justificado lá: o vínculo não é
  // acervo, é uma afirmação sobre correspondência — e afirmação errada infla o
  // custo de aquisição que vai para a declaração. `documento` e `pagamento`
  // continuam sem DELETE.
  pagamento_documento: "DELETE,INSERT,SELECT",

  // ── CONTAI-019 (migration 0007) ────────────────────────────────────────
  // As cinco nascem aqui, e as cinco precisaram de `revoke` ANTES do `grant`:
  // tabela criada no stack local do CLI sai com tudo liberado para `anon` e
  // `authenticated` pelo `alter default privileges`, e no remoto sai com nada.
  // Sem o revoke, este teste passaria verde num banco mais permissivo que a
  // produção — que é exatamente o incidente de 2026-08-17.
  //
  // UPDATE serve a três atos: quitar/cancelar (`situacao`), "mudou a data"
  // (`data_prevista`) e `motivo_cancelamento`. Sem DELETE: previsão que não se
  // realizou vira 'cancelado' COM MOTIVO, nunca apagada (parecer §3).
  compromisso: "INSERT,SELECT,UPDATE",
  // Só leitura e escrita: desfazer uma quitação é ticket com parecer, e
  // privilégio sem caminho na interface é superfície à toa.
  compromisso_pagamento: "INSERT,SELECT",
  // O rastro de "mudou a data". Sem UPDATE e sem DELETE — apagar rastro é o
  // oposto do que ele existe para fazer.
  compromisso_data_historico: "INSERT,SELECT",
  // UPDATE é da RESOLUÇÃO da diferença (`resolucao` + `resolvido_em`), que
  // muda com o tempo. O VALOR da diferença nunca muda (critério 32) e o DELETE
  // não existe: "resolver não apaga o registro da diferença".
  pagamento_diferenca: "INSERT,SELECT,UPDATE",
  // O "não" da sugestão de quitação, por par. Registrado para não ser
  // reperguntado — logo, nunca apagado.
  quitacao_recusada: "INSERT,SELECT",

  // ── CONTAI-010 (migration 0008) ────────────────────────────────────────
  // As três nascem aqui e as três precisaram de `revoke` ANTES do `grant`:
  // tabela criada no stack local do CLI sai com tudo liberado para `anon` e
  // `authenticated` pelo `alter default privileges`, e no remoto sai com nada.
  //
  // UPDATE serve a UM ato, e ele TEM caminho na tela: COMPLETAR a data de
  // pagamento (e o comprovante) de um desembolso que ficou sem ela — critério
  // 23, `completarDesembolsoTerreno`. Sem ele, a pendência de complemento não
  // teria como ser resolvida pela tela, e correção que exige SQL é a dor D9 de
  // volta. Sem DELETE: acervo append-only.
  terreno_desembolso: "INSERT,SELECT,UPDATE",
  // ⚠️ SEM UPDATE nas duas, e a ausência é a decisão (revisão de 2026-08-19).
  // Não existe `.update()` para elas em `lib/data.ts`: o grant não entregava o
  // remédio que prometia (o conserto de um informe com rubricas trocadas
  // continuaria sendo SQL à mão), e comprava a superfície de reescrever
  // registro fiscal sem rastro. O remédio de verdade é tela + rastro + grant no
  // mesmo diff — CONTAI-024. Ver a justificativa por extenso na 0008.
  financiamento: "INSERT,SELECT",
  financiamento_informe: "INSERT,SELECT",

  // ── CONTAI-021 (migration 0009) ────────────────────────────────────────
  // As cinco nascem aqui e as cinco precisaram de `revoke` ANTES do `grant`,
  // pelo mesmo motivo das anteriores.
  //
  // ⚠️ NENHUMA DELAS TEM UPDATE OU DELETE, e nas cinco a ausência é a decisão:
  // * `revisao` — parecer §5, regra dura 1: "append-only: sem update, sem
  //   delete, NEM PARA O DONO". É o critério 8 do ticket, e é a razão de o
  //   rastro ser tabela própria em vez de coluna JSONB em `documento` (que tem
  //   UPDATE desde a 0005, porque a correção precisa dele — privilégio no
  //   Postgres é por TABELA, nunca por coluna).
  revisao: "INSERT,SELECT",
  // O snapshot de custo antes/depois POR ANO E POR OBRA. É a prova que
  // sustenta a conversa de retificadora anos depois; editável, deixaria de
  // ser prova.
  revisao_ano_afetado: "INSERT,SELECT",
  // Anexo ADICIONAL (carta de correção / nota substitutiva). O acervo só
  // cresce: `documento.arquivo_path` não se substitui (parecer §1).
  documento_anexo: "INSERT,SELECT",
  // A baixa é INSERT em `pendencia_desfecho`, nunca UPDATE aqui (critérios 19
  // e 21). Sem UPDATE, "reabrir a antiga" é impossível de representar — e é
  // esse o objetivo: reabrir apagaria o fato de que ela foi tratada.
  pendencia: "INSERT,SELECT",
  // O desfecho é o fato que fica legível em 2034.
  pendencia_desfecho: "INSERT,SELECT",
};

/**
 * O mapa acima só enxerga TABELA. A migration 0009 trouxe as PRIMEIRAS FUNÇÕES
 * do repo, e **função nasce com `execute` para `public`** — em qualquer
 * Postgres, local ou remoto —, o que inclui `anon`. Um mapa só de tabela
 * ficaria verde com uma função de ESCRITA aberta ao anônimo: mesma família do
 * incidente de 2026-08-17, com a superfície pior (escrita, não leitura).
 *
 * Decisão do `cto-obra` no Gate 2 do CONTAI-021: o teste passa a cobrir função
 * **neste ticket**, com o mesmo desenho do de tabela — toda função de `public`
 * precisa de decisão explícita aqui, `anon` e `PUBLIC` sem nada, e
 * `authenticated` com EXECUTE exatamente nas que o app chama.
 *
 * ⚠️ `postgres` e `service_role` ficam DE FORA do mapa, como no de tabela:
 * nenhum caminho do produto os usa (não há server-side com secret key), e
 * medir papel que o app não assume é ruído.
 *
 * ⚠️ Sobrecarga: nenhuma função aqui é sobrecarregada, então o NOME identifica.
 * No dia em que duas versões da mesma função existirem, este mapa passa a
 * precisar da assinatura — e o teste de "nenhuma função fora do mapa" avisa,
 * porque as duas aparecem com o mesmo nome.
 */
const FUNCOES_ESPERADAS: Record<string, string> = {
  // As cinco que a interface chama, e as duas auxiliares que elas chamam por
  // dentro. As auxiliares precisam de EXECUTE porque as funções são
  // `security invoker`: sem o privilégio, a chamada interna falharia com o
  // papel do app.
  baixar_pendencia: "authenticated",
  corrigir_documento: "authenticated",
  corrigir_nome_favorecido: "authenticated",
  marcar_emitente_errado: "authenticated",
  mover_documento_de_obra: "authenticated",
  pendencia_do_ano: "authenticated",
  revisao_gravar_anos: "authenticated",

  // ⚠️ A FUNÇÃO DO TRIGGER, e ela aparece com `execute` para `PUBLIC` e `anon`
  // de propósito — **documentada, não silenciada**. Ela é `returns trigger`, e
  // o Postgres RECUSA chamada direta de função de trigger ("trigger functions
  // can only be called as triggers"), então o privilégio é inofensivo. Não foi
  // revogada porque trigger não é executado pelo chamador: revogar aqui não
  // muda nada no que ela faz, e deixaria no arquivo um `revoke` que sugere uma
  // proteção que não é dele.
  //
  // Se algum dia uma função de trigger passar a ser chamável (por exemplo,
  // extraindo o corpo para uma função normal), a linha abaixo tem de mudar no
  // mesmo diff — e é para isso que ela está escrita e não omitida.
  pendencia_uma_aberta_por_chave: "PUBLIC,anon,authenticated",
};

test.describe("privilégios do schema public", () => {
  test("nenhuma tabela sem decisão explícita de GRANT", () => {
    const tabelas = consultarAdmin(
      `select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by c.relname;`,
      "listar tabelas de public",
    ).map(([nome]) => nome);

    expect(
      tabelas.sort(),
      "tabela em public fora do mapa de privilégios: ou ela recebe GRANT " +
        "explícito na migration que a criou (e entra em ESPERADO), ou ela " +
        "vai para produção inacessível — foi assim que o app caiu em 2026-08-17",
    ).toEqual(Object.keys(ESPERADO).sort());
  });

  test("authenticated tem exatamente os verbos que o app executa", () => {
    const concedido = new Map(
      consultarAdmin(
        `select table_name, string_agg(distinct privilege_type, ',' order by privilege_type)
           from information_schema.role_table_grants
          where table_schema = 'public' and grantee = 'authenticated'
          group by table_name;`,
        "ler grants de authenticated",
      ).map(([tabela, privs]) => [tabela, privs]),
    );

    for (const [tabela, esperado] of Object.entries(ESPERADO)) {
      expect(
        concedido.get(tabela) ?? "(nenhum)",
        `privilégios de authenticated em ${tabela}`,
      ).toBe(esperado);
    }
  });

  test("nenhuma função de public sem decisão explícita de GRANT", () => {
    const funcoes = consultarAdmin(
      `select p.proname
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
        order by p.proname;`,
      "listar funções de public",
    ).map(([nome]) => nome);

    expect(
      funcoes.sort(),
      "função em public fora do mapa de privilégios: função NASCE com " +
        "`execute` para `public` (que inclui `anon`) em qualquer Postgres. " +
        "Ou ela recebe revoke/grant explícito na migration que a criou (e " +
        "entra em FUNCOES_ESPERADAS), ou vai para produção executável pelo " +
        "anônimo — a mesma classe de erro do incidente de 2026-08-17, com " +
        "superfície de ESCRITA",
    ).toEqual(Object.keys(FUNCOES_ESPERADAS).sort());
  });

  test("EXECUTE das funções: só o papel que o app assume", () => {
    const linhas = consultarAdmin(
      `select routine_name, grantee
         from information_schema.routine_privileges
        where specific_schema = 'public'
          and privilege_type = 'EXECUTE'
          and grantee in ('PUBLIC', 'anon', 'authenticated')
        order by routine_name, grantee;`,
      "ler EXECUTE das funções",
    );

    // Agrupado em JS, e não com `string_agg(... order by ...)`: a ordenação do
    // Postgres depende do collation do container, e 'PUBLIC' × 'anon' cai
    // exatamente na diferença entre C e en_US. Um teste de privilégio não pode
    // ficar vermelho por causa de collation.
    const concedido = new Map<string, string[]>();
    for (const [funcao, grantee] of linhas) {
      concedido.set(funcao, [...(concedido.get(funcao) ?? []), grantee]);
    }

    for (const [funcao, esperado] of Object.entries(FUNCOES_ESPERADAS)) {
      expect(
        (concedido.get(funcao) ?? ["(nenhum)"]).sort().join(","),
        `EXECUTE em ${funcao}`,
      ).toBe(esperado.split(",").sort().join(","));
    }
  });

  test("anon não recebe nada — não existe acesso anônimo no produto", () => {
    const vazado = consultarAdmin(
      `select table_name, privilege_type
         from information_schema.role_table_grants
        where table_schema = 'public' and grantee = 'anon'
        order by table_name, privilege_type;`,
      "ler grants de anon",
    );

    expect(
      vazado,
      "a base guarda CPF, CNO e as notas da obra; o `anon` só serve para o " +
        "GoTrue emitir token. Privilégio aqui é vazamento em potencial",
    ).toEqual([]);
  });
});
