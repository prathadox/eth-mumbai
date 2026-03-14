-- Run this in your Supabase SQL Editor

create table if not exists companies (
  id                   serial primary key,
  name                 text not null,
  slug                 text not null unique,        -- e.g. "acme"
  wallet_address       text not null unique,        -- company's connected wallet
  public_key           text,                        -- secp256k1 pubkey recovered from SIWE sig
  ens_name             text unique,                 -- e.g. "acme.penguin.eth"
  bitgo_wallet_id      text unique,
  bitgo_receive_address text,
  wallet_passphrase_enc text,                       -- BitGo passphrase enc with MASTER_ENCRYPTION_KEY
  created_at           timestamptz default now()
);

create table if not exists employees (
  id             serial primary key,
  company_id     integer not null references companies(id),
  wallet_address text not null,
  ens_name       text not null unique,              -- e.g. "alice.acme.penguin.eth"
  public_key     text,                              -- set when employee claims + sets penguin.pubkey
  status         text not null default 'invited',  -- invited | claimed | active
  created_at     timestamptz default now()
);

create table if not exists contracts (
  id                  serial primary key,
  employee_id         integer not null references employees(id),
  fileverse_file_id   text not null,
  doc_hash            text not null,                -- keccak256(fileId), stored in ENS
  amount_enc          text not null,                -- salary enc with MASTER_ENCRYPTION_KEY (for cron)
  interval            text not null,                -- monthly | biweekly | weekly
  created_by_wallet   text not null,
  last_paid_at        timestamptz,                  -- null = never paid, updated by cron each run
  created_at          timestamptz default now()
);

create table if not exists auth_nonces (
  address    text primary key,
  nonce      text not null,
  expires_at timestamptz not null
);
