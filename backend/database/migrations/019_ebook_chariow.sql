-- ============================================
-- 019 - Ventes Chariow automatisees
-- ============================================
-- Jusqu'ici chaque acces etait saisi a la main apres lecture de la commande.
-- Chariow envoie un webhook (qu'ils appellent « Pulse ») a chaque vente payee :
-- l'acces peut donc se creer et partir tout seul.
--
-- Le point sensible est la repetition. Chariow reessaie jusqu'a cinq fois
-- quand notre serveur ne repond pas assez vite, et le meme evenement peut
-- donc arriver plusieurs fois. Sans garde, une seule vente produirait
-- plusieurs licences et plusieurs fichiers. Les deux identifiants ci-dessous
-- sont uniques : la seconde tentative d'insertion est refusee par la base,
-- pas par du code qui pourrait oublier de verifier.

BEGIN;

ALTER TABLE ebook_licences
    -- Email de l'acheteur, fourni par Chariow. C'est par la que part le lien.
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),

    -- Identifiant de la vente chez Chariow.
    ADD COLUMN IF NOT EXISTS chariow_sale_id VARCHAR(120),

    -- Identifiant de la livraison du webhook (en-tete x-pulse-delivery-id).
    -- C'est la cle d'idempotence recommandee par Chariow.
    ADD COLUMN IF NOT EXISTS chariow_delivery_id VARCHAR(120),

    -- Suivi de l'envoi du lien, pour savoir qui n'a rien recu.
    ADD COLUMN IF NOT EXISTS lien_envoye_le TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lien_envoye_par VARCHAR(20),
    ADD COLUMN IF NOT EXISTS erreur_envoi TEXT;

-- Deux ventes distinctes ne partagent jamais ces identifiants ; un reessai,
-- si. L'unicite partielle laisse passer autant de lignes manuelles qu'on veut,
-- puisqu'elles ont ces colonnes a NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ebook_licences_chariow_sale
    ON ebook_licences(chariow_sale_id) WHERE chariow_sale_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ebook_licences_chariow_delivery
    ON ebook_licences(chariow_delivery_id) WHERE chariow_delivery_id IS NOT NULL;

-- Retrouver un acheteur par son email quand il ecrit « je n'ai rien recu ».
CREATE INDEX IF NOT EXISTS idx_ebook_licences_email
    ON ebook_licences(email) WHERE email IS NOT NULL;

COMMENT ON COLUMN ebook_licences.chariow_delivery_id IS
    'En-tete x-pulse-delivery-id. Unique : empeche qu''un reessai de Chariow cree un second acces.';

COMMIT;
