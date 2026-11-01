-- Lettura libera (anche per gli ospiti), modifiche solo per gli utenti con login.
drop policy if exists "Permetti tutto" on public.consegne;

create policy "Lettura per tutti" on public.consegne
  for select to anon, authenticated using (true);

create policy "Inserimento solo con login" on public.consegne
  for insert to authenticated with check (true);

create policy "Modifica solo con login" on public.consegne
  for update to authenticated using (true) with check (true);

create policy "Cancellazione solo con login" on public.consegne
  for delete to authenticated using (true);
