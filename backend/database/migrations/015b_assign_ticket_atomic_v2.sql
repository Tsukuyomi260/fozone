-- ============================================
-- 015b - Attribution stricte par tarif
-- ============================================
-- A executer APRES 015 (la fonction lit tickets.pricing_id).
--
-- L'ancienne version prenait le plus ancien ticket libre de la zone, quel que
-- soit le tarif paye. Desormais un achat de 100 F ne peut sortir qu'un ticket
-- rattache au tarif 100 F. Aucun repli: sans ticket du bon tarif, la vente
-- n'aboutit pas, plutot que de livrer un ticket plus cher.
--
-- FOR UPDATE SKIP LOCKED est conserve: c'est lui qui empeche deux clients
-- simultanes de recevoir le meme ticket.

BEGIN;

CREATE OR REPLACE FUNCTION assign_ticket_atomic(
    p_wifi_zone_id UUID,
    p_payment_id UUID,
    p_pricing_id UUID
)
RETURNS TABLE(ticket_id UUID) AS $$
DECLARE
    v_ticket_id UUID;
BEGIN
    -- Un ticket libre du tarif paye, et rien d'autre
    SELECT id INTO v_ticket_id
    FROM tickets
    WHERE wifi_zone_id = p_wifi_zone_id
      AND status = 'free'
      AND pricing_id = p_pricing_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_ticket_id IS NOT NULL THEN
        UPDATE tickets
        SET status = 'sold',
            payment_id = p_payment_id,
            sold_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_ticket_id;

        RETURN QUERY SELECT v_ticket_id;
    ELSE
        -- Plus aucun ticket de ce tarif
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- L'ancienne signature a deux arguments est supprimee: la laisser vivre
-- permettrait a un appel oublie de continuer a distribuer n'importe quel
-- ticket, exactement le defaut que cette migration corrige.
DROP FUNCTION IF EXISTS assign_ticket_atomic(UUID, UUID);

COMMIT;
