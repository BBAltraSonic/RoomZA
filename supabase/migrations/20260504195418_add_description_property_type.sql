-- Add description and property_type columns to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS property_type TEXT
    CHECK (
      property_type IS NULL
      OR property_type = ANY (ARRAY[
        'apartment'::text,
        'house'::text,
        'room'::text,
        'studio'::text,
        'cottage'::text,
        'townhouse'::text
      ])
    );
