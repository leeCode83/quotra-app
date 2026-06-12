-- Fix playground_trials RLS policy to use auth.jwt() instead of current_setting('request.headers')
-- The old policy relied on x-wallet-address header which is not available when using service_role key.
-- With the new JWT auth, RLS can verify the wallet address from the JWT claims.

DROP POLICY IF EXISTS "Users can view their own trial usage" ON public.playground_trials;

CREATE POLICY "Users can view their own trial usage"
ON public.playground_trials
FOR ALL
USING (
  lower(wallet_address) = lower(auth.jwt() ->> 'wallet_address')
);
