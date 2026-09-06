-- ============================================
-- 013 - Verification de compte par paliers
-- ============================================
-- Modele: l'inscription donne acces immediat au tableau de bord et a la
-- vente. Seul le RETRAIT exige une identite verifiee.
--
-- Raisonnement: un fraudeur qui vend sans etre verifie ne gagne rien.
-- L'argent arrive sur le compte agregateur de Fo-Zone et il ne peut pas
-- l'en sortir. Bloquer l'acces au tableau de bord ne protegeait rien et
-- faisait fuir les inscrits.
--
-- Les colonnes email_* et kyc_* sont posees ensemble maintenant pour eviter
-- une seconde migration quand la verification d'e-mail et le KYC arriveront.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS kyc_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS kyc_note TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_kyc_status_check;
ALTER TABLE users
    ADD CONSTRAINT users_kyc_status_check
    CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected'));

-- Les comptes existants sont valides d'office: sans ce backfill, le compte
-- proprietaire ne pourrait plus retirer le solde deja accumule.
UPDATE users
SET kyc_status = 'approved',
    kyc_reviewed_at = CURRENT_TIMESTAMP,
    email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP)
WHERE kyc_status = 'none';

-- La file d'attente du super-admin filtre sur ce statut
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);

COMMIT;

-- Verification
-- SELECT email, is_active, kyc_status, email_verified_at IS NOT NULL AS email_verifie
-- FROM users ORDER BY created_at;
