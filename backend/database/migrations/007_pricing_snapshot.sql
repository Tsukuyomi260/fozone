-- ============================================
-- 007 - Figer le tarif sur le paiement
-- ============================================
-- Objectif: pouvoir supprimer puis recreer un tarif sans casser la comptabilite.
--
-- Avant: payments.pricing_id REFERENCES pricings(id) sans ON DELETE.
--        Postgres refusait donc la suppression d'un tarif deja vendu, et un
--        contournement par CASCADE aurait detruit les paiements.
--
-- Apres: le nom et la duree du tarif sont copies sur le paiement au moment de
--        la vente. La comptabilite lit cette copie, plus la ligne pricings.
--        La cle etrangere passe en ON DELETE SET NULL: supprimer un tarif
--        detache les paiements sans les alterer.
--
-- payments.amount contenait deja le montant reellement paye: le chiffre
-- d'affaires n'a jamais dependu de la table pricings.

BEGIN;

-- 1. Colonnes de snapshot
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS pricing_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pricing_duration_hours INTEGER;

-- 2. Backfill des paiements existants depuis le tarif encore lie
UPDATE payments p
SET pricing_name = pr.name,
    pricing_duration_hours = pr.duration_hours
FROM pricings pr
WHERE p.pricing_id = pr.id
  AND p.pricing_name IS NULL;

-- 3. Passer la cle etrangere en ON DELETE SET NULL
ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_pricing_id_fkey;

ALTER TABLE payments
    ADD CONSTRAINT payments_pricing_id_fkey
    FOREIGN KEY (pricing_id) REFERENCES pricings(id) ON DELETE SET NULL;

COMMIT;

-- Verification
-- SELECT id, amount, pricing_id, pricing_name, pricing_duration_hours
-- FROM payments ORDER BY created_at DESC LIMIT 10;
