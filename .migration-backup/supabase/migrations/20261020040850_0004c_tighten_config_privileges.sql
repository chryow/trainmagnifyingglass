/*
# Phase 4c — Tighten table privileges

- verification_config: revoke INSERT and DELETE from anon/authenticated
  (only admin UPDATE is allowed, no INSERT/DELETE needed since the single
  row is seeded).
*/

REVOKE INSERT, DELETE ON public.verification_config FROM anon, authenticated;
