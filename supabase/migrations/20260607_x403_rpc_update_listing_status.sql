CREATE OR REPLACE FUNCTION update_listing_status(p_listing_id UUID, p_status TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update tabel listings utama
    UPDATE listings 
    SET status = p_status 
    WHERE id = p_listing_id;

    -- Jika status dirubah menjadi revoked, lakukan cascade update
    IF p_status = 'revoked' THEN
        UPDATE consumer_permissions 
        SET status = 'revoked' 
        WHERE listing_id = p_listing_id AND status = 'active';
    END IF;
END;
$$;
