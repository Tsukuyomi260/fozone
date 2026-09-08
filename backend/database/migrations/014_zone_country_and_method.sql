-- ============================================
-- 014 - Pays de la zone et methode de paiement reelle
-- ============================================
-- Probleme corrige: le parcours d'achat imposait les deux methodes beninoises
-- (mtn_bj, moov_bj) a tout le monde. Un promoteur ivoirien ne pouvait donc
-- rien encaisser: la page Moneroo n'affichait que le Benin, ni Wave, ni Orange,
-- et le numero du client partait sans indicatif.
--
-- Le pays appartient a la zone Wi-Fi, pas au compte: un promoteur peut tres
-- bien exploiter un point a Cotonou et un autre a Abidjan.

BEGIN;

ALTER TABLE wifi_zones
    ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'BJ';

ALTER TABLE wifi_zones DROP CONSTRAINT IF EXISTS wifi_zones_country_check;
ALTER TABLE wifi_zones
    ADD CONSTRAINT wifi_zones_country_check
    CHECK (country IN ('BJ', 'CI', 'TG', 'SN', 'ML', 'BF'));

-- La methode reellement utilisee par le client, telle que Moneroo la renvoie
-- (mtn_bj, wave_ci, orange_ci...). La comptabilite affichait jusqu'ici
-- « MTN MoMo Benin » pour toutes les lignes, y compris hors du Benin.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Les zones existantes sont beninoises: le DEFAULT les couvre deja.
-- Les paiements anterieurs gardent payment_method a NULL, l'affichage retombe
-- alors sur le pays de la zone.

CREATE INDEX IF NOT EXISTS idx_wifi_zones_country ON wifi_zones(country);

COMMIT;

-- Verification
-- SELECT name, country, manager_phone FROM wifi_zones ORDER BY created_at;
