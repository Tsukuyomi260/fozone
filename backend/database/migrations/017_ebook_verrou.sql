-- ============================================
-- 017 - Verrou du guide : mot de passe et appareils
-- ============================================
-- La migration 016 a donne un lien propre a chaque acheteur. Un lien se
-- transfere encore: il suffisait de l'envoyer a quelqu'un d'autre.
--
-- Desormais l'acheteur choisit un mot de passe a sa premiere ouverture, et son
-- acces se fixe sur les appareils depuis lesquels il entre ce mot de passe,
-- deux au maximum. Transferer le lien ne suffit plus: il faut aussi le mot de
-- passe, et donner son mot de passe revient a perdre ses propres places.
--
-- On fixe l'appareil, jamais l'adresse IP: derriere le Mobile Money tout le
-- monde partage des adresses qui changent a chaque reconnexion. Verrouiller
-- sur l'IP bloquerait les acheteurs honnetes sans gener personne d'autre.

BEGIN;

ALTER TABLE ebook_licences
    -- Hache par bcrypt, comme les mots de passe des promoteurs.
    -- NULL tant que l'acheteur n'a pas ouvert son lien une premiere fois.
    ADD COLUMN IF NOT EXISTS mot_de_passe_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS mot_de_passe_defini_le TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS max_appareils SMALLINT NOT NULL DEFAULT 2;

ALTER TABLE ebook_licences DROP CONSTRAINT IF EXISTS ebook_licences_max_appareils_check;
ALTER TABLE ebook_licences
    ADD CONSTRAINT ebook_licences_max_appareils_check
    CHECK (max_appareils BETWEEN 1 AND 10);

CREATE TABLE IF NOT EXISTS ebook_appareils (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    licence_id UUID NOT NULL REFERENCES ebook_licences(id) ON DELETE CASCADE,

    -- Le navigateur garde un jeton dans un cookie httpOnly. On n'en stocke que
    -- l'empreinte: une fuite de la base ne donne acces a aucun exemplaire.
    jeton_hash VARCHAR(64) NOT NULL,

    -- De quoi s'y retrouver quand l'acheteur demande qu'on libere une place.
    etiquette VARCHAR(120),

    premiere_vue TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    derniere_vue TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    derniere_ip VARCHAR(64),

    -- Place rendue par l'editeur: l'appareil devra refaire le mot de passe.
    libere BOOLEAN NOT NULL DEFAULT FALSE,
    libere_le TIMESTAMPTZ
);

-- Un meme navigateur peut detenir plusieurs exemplaires: l'unicite porte sur
-- le couple, pas sur le jeton seul.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ebook_appareils_licence_jeton
    ON ebook_appareils(licence_id, jeton_hash);

CREATE INDEX IF NOT EXISTS idx_ebook_appareils_licence
    ON ebook_appareils(licence_id) WHERE libere = FALSE;

COMMENT ON TABLE ebook_appareils IS
    'Appareils autorises pour un exemplaire. Le cookie porte le jeton, la base n''en garde que l''empreinte.';

COMMIT;
