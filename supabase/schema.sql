-- ZERO STORE COMPLETE DATABASE
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  game text not null,
  description text not null default '',
  price bigint not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id),
  product_id uuid not null references public.products(id),
  amount bigint not null check (amount >= 0),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','payment_review','paid','completed','cancelled')),
  payment_proof_path text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = 'customer');
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select using (is_available = true or public.is_admin());
drop policy if exists "admin insert products" on public.products;
create policy "admin insert products" on public.products for insert with check (public.is_admin());
drop policy if exists "admin update products" on public.products;
create policy "admin update products" on public.products for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete products" on public.products;
create policy "admin delete products" on public.products for delete using (public.is_admin());
drop policy if exists "buyer creates own orders" on public.orders;
create policy "buyer creates own orders" on public.orders for insert with check (buyer_id = auth.uid());
drop policy if exists "buyer reads own orders admin reads all" on public.orders;
create policy "buyer reads own orders admin reads all" on public.orders for select using (buyer_id = auth.uid() or public.is_admin());
drop policy if exists "admin updates orders" on public.orders;
create policy "admin updates orders" on public.orders for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "buyer uploads proof to own order" on public.orders;
create policy "buyer uploads proof to own order" on public.orders for update using (buyer_id = auth.uid() and status = 'awaiting_payment')
with check (buyer_id = auth.uid() and status = 'payment_review');

-- Storage buckets (public product images, private payment proofs)
insert into storage.buckets(id,name,public) values ('store-images','store-images',true)
on conflict (id) do nothing;
insert into storage.buckets(id,name,public) values ('payment-proofs','payment-proofs',false)
on conflict (id) do nothing;

drop policy if exists "public can view store images" on storage.objects;
create policy "public can view store images" on storage.objects for select using (bucket_id = 'store-images');
drop policy if exists "admin uploads store images" on storage.objects;
create policy "admin uploads store images" on storage.objects for insert with check (bucket_id = 'store-images' and public.is_admin());
drop policy if exists "admin updates store images" on storage.objects;
create policy "admin updates store images" on storage.objects for update using (bucket_id = 'store-images' and public.is_admin());
drop policy if exists "admin deletes store images" on storage.objects;
create policy "admin deletes store images" on storage.objects for delete using (bucket_id = 'store-images' and public.is_admin());

drop policy if exists "buyer upload own payment proof" on storage.objects;
create policy "buyer upload own payment proof" on storage.objects for insert
with check (bucket_id = 'payment-proofs' and auth.uid()::text = (storage.foldername(name))[2]);
drop policy if exists "buyer and admin read payment proof" on storage.objects;
create policy "buyer and admin read payment proof" on storage.objects for select
using (bucket_id = 'payment-proofs' and (public.is_admin() or auth.uid()::text = (storage.foldername(name))[2]));

-- PROMOSI ADMIN:
-- 1) Buat akun admin melalui aplikasi.
-- 2) Ambil UUID akun di Authentication > Users.
-- 3) Jalankan perintah berikut dengan UUID milik admin:
-- update public.profiles set role = 'admin' where id = 'UUID_ADMIN';
-- Jangan pernah mengizinkan user mengubah role sendiri.
