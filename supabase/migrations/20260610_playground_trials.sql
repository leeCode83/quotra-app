-- Tabel untuk melacak penggunaan free trial di playground
CREATE TABLE public.playground_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    calls_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT playground_trials_wallet_listing_key UNIQUE (wallet_address, listing_id)
);

-- Indexing for performance
CREATE INDEX idx_playground_trials_wallet_address ON public.playground_trials(wallet_address);
CREATE INDEX idx_playground_trials_listing_id ON public.playground_trials(listing_id);

-- Enable RLS
ALTER TABLE public.playground_trials ENABLE ROW LEVEL SECURITY;

-- Policy (Consumer dapat melihat miliknya, Provider tidak butuh akses langsung, Backend service key memotong/bypass RLS)
CREATE POLICY "Users can view their own trial usage"
ON public.playground_trials
FOR SELECT
USING (lower(wallet_address) = lower(current_setting('request.headers')::json->>'x-wallet-address'));
