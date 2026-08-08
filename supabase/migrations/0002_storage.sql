-- contai — bucket do acervo (CONTAI-001)
-- Meta 3: o original de toda NF/boleto/comprovante sobrevive até venda + 5 anos.
-- Bucket privado; o caminho começa com o user_id, e a policy amarra os dois.

insert into storage.buckets (id, name, public)
values ('acervo', 'acervo', false)
on conflict (id) do nothing;

-- Leitura: só os próprios arquivos.
create policy acervo_dono_select on storage.objects for select
  using (
    bucket_id = 'acervo'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Escrita: só dentro da própria pasta. Sem update/delete: acervo é append-only
-- enquanto não existir uma rotina de expurgo revisada (venda + 5 anos).
create policy acervo_dono_insert on storage.objects for insert
  with check (
    bucket_id = 'acervo'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
