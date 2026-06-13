create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  bounding_box_west double precision not null,
  bounding_box_south double precision not null,
  bounding_box_east double precision not null,
  bounding_box_north double precision not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.neighborhoods enable row level security;

-- Everyone can read neighborhoods
create policy "Neighborhoods are viewable by everyone" 
on public.neighborhoods for select 
using (true);

-- Insert some sample data
insert into public.neighborhoods (slug, name, description, bounding_box_west, bounding_box_south, bounding_box_east, bounding_box_north) values
('cape-town-cbd', 'Cape Town CBD', 'The vibrant heart of the Mother City, offering a mix of historic architecture, modern apartments, and endless entertainment options.', 18.4110, -33.9310, 18.4280, -33.9160),
('braamfontein', 'Braamfontein', 'Johannesburg''s creative and cultural hub, popular with students and young professionals.', 28.0280, -26.1950, 28.0450, -26.1850),
('sandton-central', 'Sandton Central', 'The financial center of South Africa, known for luxury high-rises and premium shopping.', 28.0480, -26.1150, 28.0650, -26.0950),
('rondebosch', 'Rondebosch', 'A leafy Southern Suburb in Cape Town, home to the University of Cape Town and top schools.', 18.4600, -33.9700, 18.4850, -33.9500);