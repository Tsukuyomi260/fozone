-- ============================================
-- 010 - Montants figes sur le paiement + lien direct au promoteur
-- ============================================
-- Jusqu'ici la commission etait calculee a la lecture, jamais stockee.
-- Acceptable pour un affichage; inacceptable pour un solde: le jour ou le
-- taux change (commission.js annonce deja un passage de 2% a 1,8%), tous les
-- soldes historiques se recalculeraient, y compris ceux deja verses.
--
-- On fige donc les montants a la vente, comme la migration 007 l'a fait pour
-- pricing_name.
--
-- Modele: Fo-Zone preleve 5% du brut, commission agregateur INCLUSE dedans.
--   ticket 200 F -> platform_fee = 10 F -> net_to_tenant = 190 F
--   sur ces 10 F, l'agregateur prend 4 F (2%), marge Fo-Zone = 6 F
--
-- owner_id est denormalise depuis wifi_zones: sans lui, chaque calcul de
-- solde imposerait de resoudre wifi_zones.owner_id -> zoneIds -> payments.

BEGIN;

-- 1. Colonnes
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS net_to_tenant DECIMAL(10, 2);

-- 2. Backfill du proprietaire depuis la zone
UPDATE payments p
SET owner_id = wz.owner_id
FROM wifi_zones wz
WHERE p.wifi_zone_id = wz.id
  AND p.owner_id IS NULL;

-- 3. Backfill des montants au taux courant (5%), arrondi au franc entier:
--    le XOF n'a pas de subdivision. ROUND() de Postgres sur DECIMAL arrondit
--    au plus proche, comme le Math.round() de commission.js.
UPDATE payments
SET platform_fee = ROUND(amount * 0.05),
    net_to_tenant = amount - ROUND(amount * 0.05)
WHERE platform_fee IS NULL;

-- 4. Index: chaque calcul de solde filtre sur (owner_id, status)
CREATE INDEX IF NOT EXISTS idx_payments_owner_status ON payments(owner_id, status);

-- 5. Index manquant depuis l'origine: toutes les requetes comptables et du
--    dashboard filtrent sur completed_at, sans index.
CREATE INDEX IF NOT EXISTS idx_payments_completed_at ON payments(completed_at);

COMMIT;

-- Verification: la somme des composantes doit egaler le brut, ligne par ligne
-- SELECT id, amount, platform_fee, net_to_tenant,
--        (platform_fee + net_to_tenant = amount) AS coherent
-- FROM payments
-- ORDER BY created_at DESC
-- LIMIT 20;
--
-- Aucune ligne incoherente attendue:
-- SELECT count(*) FROM payments WHERE platform_fee + net_to_tenant <> amount;
