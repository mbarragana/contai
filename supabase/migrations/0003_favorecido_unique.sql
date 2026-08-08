-- contai — favorecido único por dono + documento (correção do Gate 2, CONTAI-001)
--
-- Sem esta unicidade, dois toques no "Salvar" (ou um retry de rede) criam dois
-- favorecidos com o mesmo CNPJ/CPF: os pagamentos se dividem entre eles e a
-- agregação CPF-por-CPF da ficha Pagamentos Efetuados sai partida em dois.
-- A chave inclui user_id porque é o que a RLS isola — e é o que permite o
-- upsert (on_conflict) em lib/data.ts resolver o conflito dentro do próprio dono.
--
-- `documento` é gravado só com dígitos (soDigitos, lib/fiscal/identificacao.ts).

alter table favorecido
  add constraint favorecido_dono_documento_unico unique (user_id, documento);
