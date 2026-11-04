-- ============================================
-- 018 - Suivi des ventes du guide
-- ============================================
-- Les acces etaient generes depuis un terminal, sans trace de ce qu'ils
-- avaient rapporte. En passant la generation dans l'espace super-admin, on
-- enregistre au passage ce que l'acheteur a paye et par quel canal: le
-- tableau peut alors afficher un total vendu et une repartition.
--
-- Rien n'est obligatoire: un acces offert, un echange ou un exemplaire de
-- test se creent sans montant.

BEGIN;

ALTER TABLE ebook_licences
    -- Montant paye, dans l'unite de la devise (pas de centimes en XOF).
    ADD COLUMN IF NOT EXISTS montant INTEGER,
    ADD COLUMN IF NOT EXISTS devise VARCHAR(3) NOT NULL DEFAULT 'XOF',

    -- D'ou vient la vente: chariow, whatsapp, especes, offert, autre.
    ADD COLUMN IF NOT EXISTS provenance VARCHAR(30),

    -- Note libre: numero de commande Chariow, contexte, rien du tout.
    ADD COLUMN IF NOT EXISTS note TEXT,

    -- Pays du numero, pour reafficher le bon indicatif et le bon format.
    ADD COLUMN IF NOT EXISTS pays VARCHAR(2);

ALTER TABLE ebook_licences DROP CONSTRAINT IF EXISTS ebook_licences_montant_check;
ALTER TABLE ebook_licences
    ADD CONSTRAINT ebook_licences_montant_check
    CHECK (montant IS NULL OR montant >= 0);

ALTER TABLE ebook_licences DROP CONSTRAINT IF EXISTS ebook_licences_provenance_check;
ALTER TABLE ebook_licences
    ADD CONSTRAINT ebook_licences_provenance_check
    CHECK (provenance IS NULL OR provenance IN ('chariow', 'whatsapp', 'especes', 'offert', 'autre'));

-- Le tableau de bord additionne par canal et par periode.
CREATE INDEX IF NOT EXISTS idx_ebook_licences_provenance
    ON ebook_licences(provenance) WHERE provenance IS NOT NULL;

COMMIT;
