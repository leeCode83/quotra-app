-- Atomic quota decrement — tidak ada race condition
-- Mengembalikan remaining_calls setelah decrement, atau -1 jika sudah 0
--
-- Jalankan file ini di Supabase SQL Editor.
-- Fungsi ini menggantikan pola SELECT+UPDATE yang non-atomic
-- di gateway helpers.ts untuk mencegah race condition
-- saat banyak consumer melakukan request secara bersamaan.

CREATE OR REPLACE FUNCTION decrement_remaining_calls(p_id UUID)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining integer;
BEGIN
  UPDATE listings
  SET remaining_calls = remaining_calls - 1
  WHERE id = p_id AND remaining_calls > 0
  RETURNING remaining_calls INTO v_remaining;

  IF v_remaining IS NULL THEN
    RETURN -1; -- tidak ada update berarti remaining_calls sudah 0
  END IF;

  RETURN v_remaining;
END;
$$;
