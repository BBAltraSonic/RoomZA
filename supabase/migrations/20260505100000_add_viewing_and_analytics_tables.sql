-- Create Enum
CREATE TYPE public.viewing_status AS ENUM ('booked', 'cancelled', 'completed');

-- viewing_slots
CREATE TABLE public.viewing_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_booked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX viewing_slots_listing_id_idx ON public.viewing_slots(listing_id);

-- viewing_slot_offers
CREATE TABLE public.viewing_slot_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NOT NULL REFERENCES public.viewing_slots(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_slot_offer UNIQUE (slot_id, application_id)
);

CREATE INDEX viewing_slot_offers_slot_id_idx ON public.viewing_slot_offers(slot_id);
CREATE INDEX viewing_slot_offers_application_id_idx ON public.viewing_slot_offers(application_id);

-- viewings
CREATE TABLE public.viewings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES public.viewing_slots(id) ON DELETE CASCADE,
    status public.viewing_status NOT NULL DEFAULT 'booked',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_viewing_slot UNIQUE (slot_id)
);

CREATE INDEX viewings_application_id_idx ON public.viewings(application_id);

-- analytics_events
CREATE TABLE public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX analytics_events_user_id_idx ON public.analytics_events(user_id);

-- RPC for atomic booking (Defense in Depth)
CREATE OR REPLACE FUNCTION public.book_viewing_slot_atomic(target_slot_id uuid, target_application_id uuid)
RETURNS uuid AS $$
DECLARE
  new_viewing_id uuid;
BEGIN
  -- Layer 3: Environment Guard & DB constraint. Guarantee the offer exists.
  IF NOT EXISTS (
    SELECT 1 FROM public.viewing_slot_offers
    WHERE slot_id = target_slot_id AND application_id = target_application_id
  ) THEN
    RAISE EXCEPTION 'Slot % was not offered to application %', target_slot_id, target_application_id;
  END IF;

  -- Atomically lock and update slot
  UPDATE public.viewing_slots
  SET is_booked = true
  WHERE id = target_slot_id AND is_booked = false
  RETURNING id INTO target_slot_id;

  IF target_slot_id IS NULL THEN
    RAISE EXCEPTION 'Slot is already booked or does not exist';
  END IF;

  INSERT INTO public.viewings (application_id, slot_id, status)
  VALUES (target_application_id, target_slot_id, 'booked')
  RETURNING id INTO new_viewing_id;

  RETURN new_viewing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS setup
ALTER TABLE public.viewing_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_slot_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- viewing_slots Policies
CREATE POLICY "Landlords can manage viewings for their listings"
    ON public.viewing_slots FOR ALL
    TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Renters can view slots offered to them"
    ON public.viewing_slots FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.viewing_slot_offers vso
            JOIN public.applications a ON a.id = vso.application_id
            WHERE vso.slot_id = viewing_slots.id AND a.renter_id = auth.uid()
        )
    );

-- viewing_slot_offers Policies
CREATE POLICY "Landlords can view/create offers for their slots"
    ON public.viewing_slot_offers FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.viewing_slots 
            WHERE public.viewing_slots.id = slot_id AND public.viewing_slots.created_by = auth.uid()
        )
    );

CREATE POLICY "Renters can view their slot offers"
    ON public.viewing_slot_offers FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE public.applications.id = application_id AND public.applications.renter_id = auth.uid()
        )
    );

-- viewings Policies
CREATE POLICY "Landlords can view/manage viewings on their listings"
    ON public.viewings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.applications a
            JOIN public.listings l ON l.id = a.listing_id
            WHERE a.id = application_id AND l.landlord_id = auth.uid()
        )
    );

CREATE POLICY "Renters can view their own viewings"
    ON public.viewings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE public.applications.id = application_id AND public.applications.renter_id = auth.uid()
        )
    );

-- analytics_events Policies
CREATE POLICY "Users can insert their own analytics"
    ON public.analytics_events FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
