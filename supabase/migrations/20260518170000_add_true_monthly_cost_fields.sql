alter table public.listings
  add column if not exists electricity_included boolean,
  add column if not exists electricity_estimate integer check (electricity_estimate is null or electricity_estimate >= 0),
  add column if not exists water_included boolean,
  add column if not exists water_estimate integer check (water_estimate is null or water_estimate >= 0),
  add column if not exists wifi_available boolean,
  add column if not exists wifi_included boolean,
  add column if not exists wifi_estimate integer check (wifi_estimate is null or wifi_estimate >= 0),
  add column if not exists parking_included boolean,
  add column if not exists parking_estimate integer check (parking_estimate is null or parking_estimate >= 0),
  add column if not exists security_fee_estimate integer check (security_fee_estimate is null or security_fee_estimate >= 0);
