-- ============================================================
--  BOLÃO COPA 2026 — Estrutura do banco (rode no Supabase)
--  Cole tudo isso em: Supabase > SQL Editor > New query > Run
-- ============================================================

-- Tabela de usuários (nome + senha simples)
create table if not exists usuarios (
  nome text primary key,
  senha text not null,
  criado_em timestamptz default now()
);

-- Palpites: um por usuário por jogo
create table if not exists palpites (
  id bigint generated always as identity primary key,
  nome text references usuarios(nome) on delete cascade,
  jogo_id text not null,
  casa int,
  fora int,
  atualizado_em timestamptz default now(),
  unique (nome, jogo_id)
);

-- Resultados manuais lançados pelo admin (têm prioridade sobre a API)
create table if not exists resultados_manuais (
  jogo_id text primary key,
  casa int,
  fora int,
  atualizado_em timestamptz default now()
);

-- Libera leitura/escrita pública (bolão entre amigos; sem login do Supabase).
-- Como a app valida senha por conta própria, deixamos as políticas abertas.
alter table usuarios enable row level security;
alter table palpites enable row level security;
alter table resultados_manuais enable row level security;

create policy "acesso_total_usuarios" on usuarios for all using (true) with check (true);
create policy "acesso_total_palpites" on palpites for all using (true) with check (true);
create policy "acesso_total_resultados" on resultados_manuais for all using (true) with check (true);
