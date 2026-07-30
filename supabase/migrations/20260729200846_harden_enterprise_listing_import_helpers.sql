-- Keep the storage-path UUID parser independent of caller-controlled schemas.
alter function private.try_uuid(text)
  set search_path = pg_catalog;
