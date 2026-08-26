-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0000 · Extensions
-- ─────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;      -- case-insensitive emails

-- Dedicated schema for internal helper functions (RLS predicates, triggers).
-- Kept out of `public` so it is not exposed through PostgREST.
create schema if not exists app;
