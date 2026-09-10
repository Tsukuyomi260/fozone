-- ============================================
-- 015 - Un ticket appartient a un tarif
-- ============================================
-- Probleme corrige: assign_ticket_atomic prenait le plus ancien ticket libre
-- de la zone, sans regarder ce que le client avait paye. Un client qui payait
-- 100 F pouvait donc recevoir un ticket « 1 Mois » a 3 000 F, en silence.
--
-- L'intention existait deja: la page d'import envoyait un pricing_id, le
-- backend le validait, puis le jetait faute de colonne pour l'accueillir.
--
-- ATTENTION: cette migration doit etre appliquee AVANT le deploiement du code.
-- La nouvelle fonction d'attribution exige tickets.pricing_id.

BEGIN;

-- ---------------------------------------------------------------- colonnes

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS pricing_id UUID REFERENCES pricings(id) ON DELETE SET NULL;

-- Profil MikroTik correspondant au tarif ('5h', '24h-online'...), pour que les
-- imports suivants se rattachent seuls a partir de la colonne Profile du CSV.
ALTER TABLE pricings
    ADD COLUMN IF NOT EXISTS ticket_profile VARCHAR(255);

-- C'est la requete du chemin de vente: chercher un ticket libre d'un tarif.
CREATE INDEX IF NOT EXISTS idx_tickets_free_by_pricing
    ON tickets(wifi_zone_id, pricing_id)
    WHERE status = 'free';

-- ------------------------------------------------- rattachement du stock

-- Les profils MikroTik ne ressemblent a aucun nom de tarif ('5h' vs
-- « 5 HEURE »), et les durees saisies ne sont pas fiables: la correspondance
-- est donc ecrite explicitement, zone par zone.
UPDATE pricings p
SET ticket_profile = m.profile
FROM (
    VALUES
        ('33074f8e-9ad1-48f3-a3f5-8413f00090d1'::uuid, '5 HEURE',   '5h'),
        ('33074f8e-9ad1-48f3-a3f5-8413f00090d1'::uuid, '24 HEURES', '24h-online'),
        ('33074f8e-9ad1-48f3-a3f5-8413f00090d1'::uuid, '3 Jours',   '3d-Online'),
        ('33074f8e-9ad1-48f3-a3f5-8413f00090d1'::uuid, '1Semaine',  '7d'),
        ('9afd979e-a575-4f34-9832-a393f0abfcf8'::uuid, '3 Jours',   '3d-online'),
        ('9afd979e-a575-4f34-9832-a393f0abfcf8'::uuid, '7 jours',   '7d-online'),
        ('9afd979e-a575-4f34-9832-a393f0abfcf8'::uuid, '30 jours',  '30d-online')
) AS m(zone_id, pricing_name, profile)
WHERE p.wifi_zone_id = m.zone_id
  AND p.name = m.pricing_name;

-- Les tickets libres suivent le profil declare sur leur tarif.
UPDATE tickets t
SET pricing_id = p.id
FROM pricings p
WHERE t.wifi_zone_id = p.wifi_zone_id
  AND t.profile = p.ticket_profile
  AND t.pricing_id IS NULL;

-- Les tickets deja vendus sont rattaches au tarif reellement paye: plus fiable
-- que le profil, et utile aux statistiques.
UPDATE tickets t
SET pricing_id = pay.pricing_id
FROM payments pay
WHERE t.payment_id = pay.id
  AND pay.pricing_id IS NOT NULL
  AND t.pricing_id IS NULL;

COMMIT;

-- ---------------------------------------------------------------- controle
-- Un ticket libre sans tarif n'est plus vendable: cette liste doit etre vide,
-- sinon le promoteur doit rattacher le profil depuis la page Tickets.
--
-- SELECT z.name AS zone, t.profile, count(*) AS tickets_non_vendables
-- FROM tickets t
-- JOIN wifi_zones z ON z.id = t.wifi_zone_id
-- WHERE t.status = 'free' AND t.pricing_id IS NULL
-- GROUP BY z.name, t.profile
-- ORDER BY z.name, t.profile;
