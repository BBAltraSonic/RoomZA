-- Create ENUMs
CREATE TYPE public.application_status AS ENUM ('submitted', 'under_review', 'shortlisted', 'rejected', 'approved', 'withdrawn');
CREATE TYPE public.document_type AS ENUM ('id', 'payslip');
CREATE TYPE public.notification_type AS ENUM ('new_application', 'new_message', 'viewing_proposed', 'viewing_booked');

-- Create applications table
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    renter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status public.application_status NOT NULL DEFAULT 'submitted',
    full_name TEXT NOT NULL,
    income NUMERIC NOT NULL,
    employment_status TEXT NOT NULL,
    move_in_date DATE NOT NULL,
    household_size INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX applications_renter_id_idx ON public.applications(renter_id);
CREATE INDEX applications_listing_id_idx ON public.applications(listing_id);

-- Create documents table
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    type public.document_type NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX documents_application_id_idx ON public.documents(application_id);

-- Create notification_events table
CREATE TABLE public.notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMP WITH TIME ZONE,
    digest_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX notification_events_recipient_id_idx ON public.notification_events(recipient_id);

-- Updated_at triggers
-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- RLS setup
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- Applications RLS
CREATE POLICY "Renters can view their own applications" 
    ON public.applications FOR SELECT 
    TO authenticated
    USING (auth.uid() = renter_id);

CREATE POLICY "Renters can create their own applications" 
    ON public.applications FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = renter_id AND public.has_profile_role('renter'));

CREATE POLICY "Renters can update their own applications" 
    ON public.applications FOR UPDATE 
    TO authenticated
    USING (auth.uid() = renter_id AND public.has_profile_role('renter'));

CREATE POLICY "Landlords can view applications to their listings" 
    ON public.applications FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.listings 
            WHERE public.listings.id = listing_id AND public.listings.landlord_id = auth.uid()
        )
    );

CREATE POLICY "Landlords can update application statuses" 
    ON public.applications FOR UPDATE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.listings 
            WHERE public.listings.id = listing_id AND public.listings.landlord_id = auth.uid()
        )
    );

-- Documents RLS
CREATE POLICY "Renters can view their own documents" 
    ON public.documents FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE public.applications.id = application_id AND public.applications.renter_id = auth.uid()
        )
    );

CREATE POLICY "Renters can insert documents for their applications" 
    ON public.documents FOR INSERT 
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.applications 
            WHERE public.applications.id = application_id AND public.applications.renter_id = auth.uid()
        )
    );

CREATE POLICY "Landlords can view documents for applications to their listings" 
    ON public.documents FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.applications 
            JOIN public.listings ON public.listings.id = public.applications.listing_id
            WHERE public.applications.id = application_id AND public.listings.landlord_id = auth.uid()
        )
    );

-- Notification Events RLS
CREATE POLICY "Users can view their own notifications"
    ON public.notification_events FOR SELECT
    TO authenticated
    USING (auth.uid() = recipient_id);

CREATE POLICY "Users can update their own notifications"
    ON public.notification_events FOR UPDATE
    TO authenticated
    USING (auth.uid() = recipient_id);

-- Storage bucket RLS addition
CREATE POLICY "Landlords can read application documents for their listings"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'application-documents'
    AND public.has_profile_role('landlord')
    AND exists (
        SELECT 1 FROM public.documents
        JOIN public.applications ON public.documents.application_id = public.applications.id
        JOIN public.listings ON public.applications.listing_id = public.listings.id
        WHERE public.documents.file_url = storage.objects.name
        AND public.listings.landlord_id = auth.uid()
    )
  );
