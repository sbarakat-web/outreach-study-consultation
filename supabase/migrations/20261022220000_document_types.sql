-- Which required document a file is for (passport, diploma, …); null for "other".
alter table public.documents add column doc_type text;
