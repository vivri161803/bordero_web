-- Aggiunge provincia e note di consegna alle fermate (opzionale: l'upload funziona anche senza).
alter table public.consegne add column if not exists provincia text;
alter table public.consegne add column if not exists note_consegna text;
