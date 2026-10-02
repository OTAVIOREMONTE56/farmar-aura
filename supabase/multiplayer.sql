-- Execute manually in the Supabase SQL Editor. No remote execution by the app.
begin;
create schema if not exists aura_private;
revoke all on schema aura_private from public, anon, authenticated;
create table if not exists public.aura_rooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-F0-9]{6}$'),
 host_id uuid not null references auth.users(id),
 guest_id uuid references auth.users(id),
 phase text not null default 'waiting' check (phase in ('waiting','loading','round','round-result','result','closed')),
 match_no integer not null default 1,
 round_no integer not null default 1 check (round_no between 1 and 5),
 sequence jsonb not null default '[]', players jsonb not null default '[]',
 ready boolean[] not null default array[false,false],
 replay boolean[] not null default array[false,false],
 round_at bigint not null default 0, play_at bigint not null default 0,
 next_at bigint not null default 0, first_at bigint,
 seen_at bigint[] not null default array[0::bigint,0::bigint],
 revision bigint not null default 0,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '24 hours'),
 check (guest_id is null or guest_id <> host_id)
);
alter table public.aura_rooms enable row level security;
revoke all on public.aura_rooms from anon, authenticated;
grant select on public.aura_rooms to authenticated;
drop policy if exists aura_members_read on public.aura_rooms;
create policy aura_members_read on public.aura_rooms for select to authenticated
 using ((select auth.uid()) = host_id or (select auth.uid()) = guest_id);

create or replace function aura_private.duration(k text) returns integer
language sql immutable set search_path = '' as $$
 select case k when 'Q' then 2100 when 'W' then 1300 when 'E' then 2000
 when 'R' then 1500 when 'T' then 1000 when 'Y' then 2500 else 0 end;
$$;
create or replace function aura_private.new_player() returns jsonb
language sql immutable set search_path = '' as $$
 select jsonb_build_object('lives',3,'score',0,'combo',1,'cleanWins',0,'index',0,
 'roundStart',0,'roundHadError',false,'status','player','availableAt',0,'retryAt',0,
 'lastRequest',null,'event',null,'first',false);
$$;
create or replace function aura_private.append_move(s jsonb) returns jsonb
language sql volatile set search_path = '' as $$
 select s || jsonb_build_array((array['Q','W','E','R','T','Y'])[1+floor(random()*6)::integer]);
$$;
create or replace function aura_private.demo_length(s jsonb, r integer) returns bigint
language sql immutable set search_path = '' as $$
 select 1100 + coalesce(sum(aura_private.duration(value) + greatest(260,750-(r-1)*45)),0)::bigint + 3000
 from jsonb_array_elements_text(s);
$$;
create or replace function aura_private.begin_round(r public.aura_rooms, t bigint)
returns public.aura_rooms language plpgsql set search_path = '' as $$
declare i integer; p jsonb;
begin
 r.phase := 'round'; r.round_at := t; r.play_at := t + aura_private.demo_length(r.sequence,r.round_no);
 r.first_at := null; r.next_at := 0;
 for i in 0..1 loop
  p := r.players->i;
  p := p || jsonb_build_object('index',0,'roundStart',(p->>'score')::integer,
   'roundHadError',false,'first',false,'retryAt',0,'availableAt',r.play_at,
   'status',case when (p->>'lives')::integer > 0 then 'player' else 'out' end,'event',null,'lastRequest',null);
  r.players := jsonb_set(r.players,array[i::text],p);
 end loop;
 return r;
end;
$$;

-- All mutations are serialized by a row lock and validated on the server.
-- No client can write lives, Aura, sequence, opponent state or phase directly.
create or replace function public.aura_room_action(
 p_action text, p_room uuid default null, p_code text default null,
 p_key text default null, p_match integer default null, p_round integer default null,
 p_request uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid(); r public.aura_rooms; p jsonb; slot integer; idx integer;
 t bigint := floor(extract(epoch from clock_timestamp())*1000)::bigint;
 dirty boolean := false; score integer; lives integer; n integer; bonus integer; i integer;
begin
 if u is null then raise exception 'Autenticação necessária.'; end if;
 if p_action = 'create' then
  if (select count(*) from public.aura_rooms where host_id=u and created_at>now()-interval '1 hour') >= 20 then
   raise exception 'Limite de salas. Tente novamente mais tarde.';
  end if;
  for i in 1..10 loop
   begin
    insert into public.aura_rooms(code,host_id,seen_at)
    values (upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),u,array[t,0::bigint]) returning * into r;
    return jsonb_build_object('room',to_jsonb(r),'server_now',t);
   exception when unique_violation then null;
   end;
  end loop;
  raise exception 'Não foi possível gerar código. Tente novamente.';
 elsif p_action = 'join' then
  select * into r from public.aura_rooms where code=upper(trim(p_code)) for update;
  if not found or r.expires_at <= now() or r.phase='closed' then raise exception 'Sala não encontrada ou expirada.'; end if;
  if r.host_id=u then raise exception 'Abra a sala em outro aparelho para entrar como Jogador 2.'; end if;
  if r.guest_id=u then return jsonb_build_object('room',to_jsonb(r),'server_now',t); end if;
  if r.phase <> 'waiting' or r.guest_id is not null then raise exception 'Sala cheia ou partida em andamento.'; end if;
  if t-r.seen_at[1]>90000 then raise exception 'O criador da sala desconectou.'; end if;
  r.guest_id := u; r.phase := 'loading'; r.players := jsonb_build_array(aura_private.new_player(),aura_private.new_player());
  r.seen_at[2] := t; dirty := true;
 else
  select * into r from public.aura_rooms where id=p_room for update;
  if not found or (u <> r.host_id and u is distinct from r.guest_id) then raise exception 'Você não pertence a esta sala.'; end if;
  if r.phase='closed' then return jsonb_build_object('room',to_jsonb(r),'server_now',t); end if;
  slot := case when u=r.host_id then 1 else 2 end;
  if r.expires_at<=now() or (r.guest_id is not null and t-r.seen_at[3-slot]>90000) then
   r.phase := 'closed'; dirty := true;
  elsif p_action='leave' then r.phase := 'closed'; dirty := true;
  else
   if t-r.seen_at[slot]>=10000 then r.seen_at[slot] := t; dirty := true; end if;
   -- Round-result lasts long enough for both final animations and the score card.
   if r.phase='round-result' and t>=r.next_at then
    if r.round_no=5 then r.phase := 'result';
    else r.round_no := r.round_no+1; r.sequence := aura_private.append_move(r.sequence); r := aura_private.begin_round(r,t+1000);
    end if;
    dirty := true;
   end if;
   if p_action='ready' and r.phase='loading' then
    r.ready[slot] := true; dirty := true;
    if r.ready[1] and r.ready[2] then
     r.sequence := aura_private.append_move(aura_private.append_move('[]'::jsonb));
     r := aura_private.begin_round(r,t+1500);
    end if;
   elsif p_action='replay' and r.phase='result' then
    r.replay[slot] := true; dirty := true;
    if r.replay[1] and r.replay[2] then
     r.match_no := r.match_no+1; r.round_no := 1; r.replay := array[false,false];
     r.players := jsonb_build_array(aura_private.new_player(),aura_private.new_player());
     r.sequence := aura_private.append_move(aura_private.append_move('[]'::jsonb));
     r := aura_private.begin_round(r,t+1500);
    end if;
   elsif p_action='move' then
    p := r.players->(slot-1);
    if p_request is null or p_key is null or p_key not in ('Q','W','E','R','T','Y') then raise exception 'Movimento inválido.'; end if;
    if r.phase='round' and p_match=r.match_no and p_round=r.round_no and t>=r.play_at
     and p->>'status'='player' and t >= (p->>'availableAt')::bigint
     and p_request::text is distinct from p->>'lastRequest' then
     idx := (p->>'index')::integer; score := (p->>'score')::integer; lives := (p->>'lives')::integer;
     if p_key <> r.sequence->>idx then
      lives := lives-1;
      p := p || jsonb_build_object('lives',lives,'index',0,'combo',1,'cleanWins',0,'roundHadError',true,
       'status',case when lives=0 then 'out' else 'player' end,
       'retryAt',case when lives=0 then 0 else t+1200 end,
       'availableAt',case when lives=0 then t else t+1200+aura_private.demo_length(r.sequence,r.round_no) end,
       'event',jsonb_build_object('id',p_request,'kind','error','key',p_key,'at',t));
     else
      idx := idx+1; score := score+25; bonus := 0;
      if idx=jsonb_array_length(r.sequence) then
       r.first_at := coalesce(r.first_at,t);
       if t-r.first_at<=30 then bonus := 50; end if;
       n := case when (p->>'roundHadError')::boolean then 0 else (p->>'cleanWins')::integer+1 end;
       score := score+100*r.round_no+case when (p->>'roundHadError')::boolean then 0 else 50 end+bonus;
       p := p || jsonb_build_object('status','finished','cleanWins',n,'combo',greatest(1,n),'first',bonus=50);
      end if;
      p := p || jsonb_build_object('index',idx,'score',score,'retryAt',0,
       'availableAt',t+aura_private.duration(p_key),
       'event',jsonb_build_object('id',p_request,'kind','hit','key',p_key,'at',t));
     end if;
     p := p || jsonb_build_object('lastRequest',p_request);
     r.players := jsonb_set(r.players,array[(slot-1)::text],p); dirty := true;
    end if;
   elsif p_action not in ('sync','ready','replay') then raise exception 'Ação desconhecida.';
   end if;
   if r.phase='round' and t>=r.play_at and r.players->0->>'status' in ('finished','out')
    and r.players->1->>'status' in ('finished','out') then
    r.phase := 'round-result';
    r.next_at := greatest(t,(r.players->0->>'availableAt')::bigint,(r.players->1->>'availableAt')::bigint)+3000;
    dirty := true;
   end if;
  end if;
 end if;
 if dirty then
  r.revision := r.revision+1;
  update public.aura_rooms set guest_id=r.guest_id,phase=r.phase,match_no=r.match_no,
   round_no=r.round_no,sequence=r.sequence,players=r.players,ready=r.ready,replay=r.replay,
   round_at=r.round_at,play_at=r.play_at,next_at=r.next_at,first_at=r.first_at,
   seen_at=r.seen_at,revision=r.revision where id=r.id;
 end if;
 return jsonb_build_object('room',to_jsonb(r),'server_now',t);
end;
$$;
revoke all on all functions in schema aura_private from public, anon, authenticated;
revoke all on function public.aura_room_action(text,uuid,text,text,integer,integer,uuid) from public, anon;
grant execute on function public.aura_room_action(text,uuid,text,text,integer,integer,uuid) to authenticated;
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='aura_rooms') then
  alter publication supabase_realtime add table public.aura_rooms;
 end if;
end $$;
commit;
