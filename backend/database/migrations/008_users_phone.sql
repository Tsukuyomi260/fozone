-- ============================================
-- 008 - Numero de telephone sur les comptes
-- ============================================
-- La page Mon Profil expose un champ Telephone, et authController le lit et
-- l'ecrit (getProfile, updateProfile). La colonne n'a jamais existe: Supabase
-- renvoyait une erreur sur la colonne inconnue, que le controleur traduisait
-- en 404 "User not found". Le profil etait donc introuvable pour tout le monde.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Verification
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'users' ORDER BY ordinal_position;
