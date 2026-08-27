-- ============================================
-- 009 - Role super_admin pour la plateforme multi-promoteurs
-- ============================================
-- Le compte super-admin administre la plateforme (validation des retraits,
-- vue sur tous les promoteurs) mais ne possede aucune zone Wi-Fi lui-meme.
-- 'admin' redevient donc simplement "un promoteur", au meme titre que
-- 'revendeur'/'client' qui existaient deja sans jamais etre utilises.

BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'revendeur', 'client', 'super_admin'));

COMMIT;

-- Verification
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'users'::regclass AND contype = 'c';
