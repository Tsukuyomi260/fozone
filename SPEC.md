# Spécification technique — plateforme de vente de tickets Wi-Fi

Document destiné à un apprenant qui reconstruit une plateforme équivalente depuis zéro,
dans son propre dépôt.

**Aucune valeur secrète ici.** Uniquement des noms de variables, leur rôle et l'endroit où
les définir. Pas de clé, pas de mot de passe, pas d'IP de routeur, pas de numéro de
téléphone, pas d'identifiant de projet.

---

## Avertissement : trois idées reçues à corriger d'emblée

La demande initiale supposait une architecture qui n'est **pas** celle de ce projet. Trois
corrections, avant toute chose, parce qu'elles changent tout le reste :

| Hypothèse de départ | Réalité du projet |
|---|---|
| Le backend pilote le MikroTik via l'API RouterOS (port 8728/8729), un VPN ou RADIUS | **Le backend ne parle jamais au routeur.** Aucune librairie RouterOS, aucun VPN, aucun RADIUS. Le routeur et la plateforme ne se connaissent pas. |
| Intégration directe du SDK FedaPay | **Aucun SDK FedaPay.** La plateforme parle à **Moneroo**, un agrégateur, en HTTP via `axios`. FedaPay n'est qu'une passerelle que Moneroo utilise en aval. |
| Connexion automatique du client après paiement (login par MAC, auto-submit) | **Il n'y en a pas.** Le client reçoit un identifiant et un mot de passe affichés à l'écran, qu'il saisit lui-même sur le portail captif. |

Le modèle réel est **le stock pré-importé** : le gérant exporte des utilisateurs depuis son
MikroTik en CSV, les importe dans la plateforme, et la plateforme en distribue un à chaque
paiement confirmé. C'est volontairement découplé — et c'est le choix d'architecture le plus
important à comprendre avant de coder quoi que ce soit.

**Conséquence directe** : la plateforme n'a besoin d'aucun accès réseau au routeur. Pas de
VPN à monter, pas de port à ouvrir, pas d'IP publique à acheter. Un routeur derrière une
connexion domestique avec IP dynamique fonctionne très bien. C'est ce qui rend le produit
déployable chez n'importe quel gérant en moins d'une heure.

---

## 1. Stack

### Backend

| Élément | Version | Rôle |
|---|---|---|
| Node.js | 18+ | Exécution |
| Express | ^4.18.2 | Serveur HTTP et routage |
| @supabase/supabase-js | ^2.38.4 | Client Postgres via PostgREST |
| jsonwebtoken | ^9.0.2 | Jetons d'authentification |
| bcryptjs | ^2.4.3 | Hachage des mots de passe |
| express-validator | ^7.0.1 | Validation des entrées |
| axios | ^1.6.2 | Appels à l'agrégateur de paiement |
| multer | ^1.4.5-lts.1 | Réception du fichier CSV de tickets |
| csv-parser | ^3.0.0 | Lecture du CSV |
| helmet | ^7.1.0 | En-têtes de sécurité |
| express-rate-limit | ^7.1.5 | Limitation de débit |
| winston | ^3.11.0 | Journalisation |
| dotenv | ^16.3.1 | Variables d'environnement |

**Aucune librairie RouterOS.** Il n'y en a pas besoin : voir l'avertissement ci-dessus.

### Frontend

| Élément | Version | Rôle |
|---|---|---|
| React | ^18.2.0 | Interface |
| Vite | ^5.0.8 | Build et serveur de développement |
| react-router-dom | ^6.20.0 | Navigation |
| Tailwind CSS | ^3.3.6 | Styles (`darkMode: 'class'`) |
| recharts | ^3.7.0 | Graphiques de la comptabilité |
| lucide-react | ^0.294.0 | Icônes |
| react-hot-toast | ^2.4.1 | Notifications |
| date-fns | ^2.30.0 | Dates |

> `@supabase/supabase-js` figure dans les dépendances du frontend mais **n'est importé nulle
> part**. Vestige d'une première version qui parlait directement à Supabase depuis le
> navigateur. À ne pas reproduire : le frontend ne doit jamais toucher la base.

### Structure du dépôt

```
backend/
  database/
    schema.sql            Schéma initial (tables + fonctions SQL)
    migrations/           Migrations numérotées, à exécuter dans l'ordre
  src/
    config/               Connexion base, journalisation, taux de commission, pays, seuils
    controllers/          Logique métier, un fichier par domaine
    middleware/           Authentification, validation, gestion d'erreurs
    routes/               Déclaration des endpoints et de leurs validateurs
    services/             Appels sortants (agrégateur de paiement)
    utils/                Attribution atomique des tickets, calcul de solde, idempotence
    app.js                Assemblage Express
    server.js             Point d'entrée
frontend/
  public/                 Favicon
  src/
    components/           Layouts, composants partagés
    config/               URLs d'API, référentiel des pays, thème
    pages/                Une page par écran
      admin/              Écrans réservés au compte plateforme
    services/             Appels à l'API backend
    templates/            Générateur des pages du portail captif
hotspot/                  Pages MikroTik de référence (copiées sur le routeur)
```

---

## 2. Architecture et hébergement

### Qui tourne où

| Composant | Hébergeur | Détail |
|---|---|---|
| Backend | Render | Service web Node. Build `npm install`, démarrage `npm start` (`node src/server.js`). Écoute sur `process.env.PORT`. |
| Frontend | Vercel | Build `vite build`, sortie `dist/`. `vercel.json` réécrit toutes les routes vers `index.html` (application monopage). |
| Base de données | Supabase | **Postgres uniquement.** Pas d'Auth, pas de Storage, pas d'Edge Functions. |
| Portail captif | Le routeur MikroTik lui-même | Fichiers HTML statiques dans `/files` du routeur. Rien n'est servi par le backend. |

**Supabase Auth n'est pas utilisé.** L'authentification est maison : table `users`, mots de
passe hachés avec bcrypt, jetons JWT signés par le backend. Supabase ne sert que de
Postgres managé, accédé via PostgREST avec la clé de service.

### Flux

```
Client Wi-Fi
   │ se connecte au SSID
   ▼
Portail captif (HTML sur le routeur)   ──── aucun lien réseau ────► Backend
   │ clic « Acheter un ticket »
   ▼
Page d'achat (frontend, Vercel)
   │ POST /payments/intent
   ▼
Backend (Render) ──► Moneroo ──► FedaPay ──► opérateur Mobile Money
   │                   │
   │  ◄── webhook ─────┘
   ▼
Postgres (Supabase) : paiement confirmé, un ticket passe de « libre » à « vendu »
   │
   ▼
Page de confirmation : identifiant + mot de passe affichés au client
   │ le client les recopie
   ▼
Portail captif : il se connecte avec ces identifiants
```

Le routeur ne communique avec personne. Il connaît seulement les utilisateurs hotspot que le
gérant y a créés une fois pour toutes, et dont les identifiants ont été exportés en CSV puis
importés dans la plateforme.

---

## 3. Connexion au MikroTik

**Il n'y en a pas.** C'est la réponse complète, et c'est un choix d'architecture, pas un
manque.

### Pourquoi

Faire piloter un routeur domestique depuis un serveur dans le cloud suppose : une IP
publique fixe ou un VPN maintenu, un port d'API ouvert, un compte d'administration partagé,
et une disponibilité permanente. Chez un gérant au Bénin ou en Côte d'Ivoire, derrière une
connexion Starlink ou 4G, ces conditions ne tiennent pas. Chaque coupure deviendrait une
vente perdue.

### Ce qui remplace la connexion

Le gérant crée une réserve d'utilisateurs hotspot sur son routeur (fonction d'export de
MikroTik), les exporte en CSV, puis importe ce CSV dans la plateforme. Chaque ligne devient
un ticket « libre ». La vente consiste à faire passer un ticket de « libre » à « vendu » et à
montrer ses identifiants au client. Le routeur les connaît déjà : rien à lui transmettre.

**Conséquences à assumer :**

- Pas de création de compte à la volée : il faut du stock, et une rupture bloque les ventes.
  La plateforme refuse alors l'achat plutôt que d'encaisser sans contrepartie (voir §7).
- Pas de lecture de consommation en temps réel. Le décompte de la durée est géré par le
  profil MikroTik, côté routeur.
- Pas de suppression des tickets expirés par la plateforme. C'est au routeur de les faire
  expirer, via les profils et ses propres planificateurs.
- La colonne `wifi_zones.router_ip` existe mais sert **uniquement** à construire un lien
  cliquable vers le portail sur la page de confirmation. Le backend ne s'y connecte jamais.

### Et si le routeur est injoignable pendant un paiement ?

La question ne se pose pas : la vente n'implique pas le routeur. Si le routeur est éteint, le
client ne voit même pas le portail et ne peut pas lancer d'achat. S'il tombe après le
paiement, le client a ses identifiants et se connectera plus tard.

### Côté RouterOS (ce que le gérant configure lui-même, une fois)

Versions testées : **RouterOS 7**, sur RB951Ui-2HnD. Le projet a hérité d'une configuration
écrite pour RouterOS 6, d'où deux pièges rencontrés :

- **Format de date des planificateurs.** RouterOS 6 écrit `aug/22/2026`, RouterOS 7 attend
  `2026-08-22`. Des planificateurs hérités de v6 ne se déclenchaient jamais, silencieusement.
- **`on-logout` destructeur.** Une configuration contenait
  `on-logout=/ip hotspot user remove`. Un simple bail DHCP perdu supprimait le compte d'un
  client **qui avait payé**. À ne jamais reproduire.
- **`on-login` liant le ticket à une adresse MAC.** Cassé par la randomisation MAC des
  téléphones modernes : le client ne se reconnectait plus.

---

## 4. Parcours d'achat

### Étape par étape

1. Le client se connecte au SSID. Le routeur intercepte sa première requête HTTP et affiche
   `login.html`.
2. Il clique sur **Acheter un ticket**. Lien en dur vers
   `https://<domaine>/buy/<identifiant-de-zone>`.
3. La page d'achat charge la zone et ses tarifs (routes publiques), affiche les forfaits
   disponibles et grise ceux dont le stock est épuisé.
4. Il choisit un forfait, saisit son numéro Mobile Money, valide.
5. Le backend vérifie le stock du tarif, lit le montant **en base** (jamais depuis la
   requête), crée un paiement chez l'agrégateur et renvoie une URL de paiement.
6. Le client paie sur la page de l'agrégateur, puis sur celle de l'opérateur.
7. L'agrégateur appelle le webhook du backend. Celui-ci vérifie la signature, marque le
   paiement confirmé, attribue un ticket du tarif payé.
8. Le client est redirigé vers la page de retour, qui affiche **identifiant et mot de passe**,
   avec un bouton de copie.
9. Il retourne sur le portail captif, saisit ces identifiants, et navigue.

L'étape 9 est manuelle. Aucune connexion automatique, aucun auto-submit, aucun login par MAC.

### Variables MikroTik utilisées dans `login.html`

Ce sont des balises `$(...)` interprétées **par le routeur** avant d'envoyer la page. Elles ne
doivent jamais être altérées par un générateur de gabarit.

| Balise | Rôle |
|---|---|
| `$(link-login-only)` | URL de soumission du formulaire de connexion |
| `$(link-orig)` / `$(link-orig-esc)` | Page que le client voulait atteindre |
| `$(if chap-id)` … `$(endif)` | Bloc d'authentification CHAP |
| `$(chap-id)`, `$(chap-challenge)` | Jetons du défi CHAP |
| `$(username)` | Pré-remplissage du champ identifiant |
| `$(if error)` … `$(error)` … `$(endif)` | Message d'erreur de connexion |
| `$(if trial == 'yes')` | Bloc d'essai gratuit, si activé |
| `$(mac-esc)` | Adresse MAC, utilisée pour le lien d'essai |

`$(mac)` et `$(ip)` **ne sont pas utilisés** : la plateforme n'identifie pas l'appareil.

### Fichiers du hotspot

| Fichier | Modifié ? |
|---|---|
| `login.html` | Oui — refonte visuelle, ajout des boutons « Acheter » et « Récupérer mon ticket », message promotionnel optionnel |
| `redirect.html` | Oui — refonte visuelle uniquement |
| `md5.js`, `img/*.svg` | **Non, et à ne jamais supprimer** : fournis par MikroTik, indispensables à la connexion CHAP et aux icônes des champs |

Les gabarits sont produits par un générateur côté frontend : le gérant choisit un style, saisit
le nom affiché, un pied de page, un numéro d'assistance, et télécharge les deux fichiers
pré-remplis avec l'identifiant de **sa** zone. Point critique : un fichier contenant
l'identifiant d'une autre zone encaisse sur cette zone-là.

**Règle absolue du générateur : aucune ressource distante.** Pas de CDN d'icônes, pas de
police Google, pas d'image hébergée ailleurs. Le client n'a aucun accès Internet avant de
s'être connecté — tout ce qui n'est pas dans le fichier ne s'affichera pas. Les icônes sont du
SVG écrit en ligne, les fonds sont des dégradés CSS.

### Walled garden

Liste des hôtes à autoriser avant connexion. Sans elle, le client clique sur « Acheter » et
n'arrive nulle part — c'est la panne numéro un d'un nouveau gérant.

```
/ip hotspot walled-garden ip
add action=accept dst-host=<domaine-frontend>
add action=accept dst-host=www.<domaine-frontend>
add action=accept dst-host=<domaine-api>
add action=accept dst-host=checkout.moneroo.io
add action=accept dst-host=api.moneroo.io
add action=accept dst-host=process.fedapay.com
add action=accept dst-host=api.fedapay.com
add action=accept dst-host=fonts.googleapis.com
add action=accept dst-host=fonts.gstatic.com
# si un lien WhatsApp figure sur le portail
add action=accept dst-host=wa.me
add action=accept dst-host=api.whatsapp.com

/ip hotspot walled-garden
add action=allow dst-host=<domaine-frontend>
add action=allow dst-host=*.<domaine-frontend>
add action=allow dst-host=*.moneroo.io
add action=allow dst-host=*.fedapay.com
```

Deux pièges :

- `walled-garden` simple ne couvre que le HTTP. C'est `walled-garden ip` qui laisse passer le
  HTTPS, donc tout le parcours d'achat.
- `dst-host` s'appuie sur le cache DNS du routeur. Si le DHCP distribue un DNS externe aux
  clients, les règles ne correspondent plus et les paiements échouent malgré une configuration
  qui semble correcte.

Le paiement Mobile Money lui-même part en USSD sur le réseau de l'opérateur : rien à autoriser.

---

## 5. Paiement

### Mode d'intégration

Redirection. Le backend appelle `POST /v1/payments/initialize` chez l'agrégateur et reçoit une
`checkout_url` vers laquelle le navigateur du client est envoyé. Pas de widget, pas de
formulaire de carte hébergé chez nous — donc aucune donnée de paiement ne transite par la
plateforme.

Corps envoyé : montant (entier), devise, description, URL de retour, objet client
(email, prénom, nom, téléphone), métadonnées (zone et tarif), et la liste des méthodes
autorisées.

La liste des méthodes est **optionnelle** côté agrégateur : omise, toutes les méthodes activées
dans le tableau de bord sont proposées. La plateforme l'envoie quand même, calculée d'après le
pays de la zone, pour qu'un client ivoirien voie les méthodes ivoiriennes.

> Un code de méthode inconnu fait rejeter **toute** la requête. Vérifier chaque code contre
> l'API avant de l'ajouter : un code pris dans la documentation s'est révélé invalide et aurait
> bloqué tous les paiements d'un pays.

### Webhook

1. **Vérification de signature** — HMAC-SHA256 sur le **corps brut**, comparé en temps
   constant. Le corps brut doit être conservé par le parseur JSON ; signer une
   re-sérialisation de l'objet produit une signature différente et tous les webhooks sont
   rejetés en silence.
2. **Idempotence** — clé `<événement>_<identifiant de paiement>` enregistrée dans une table
   dédiée. Un rejeu renvoie le ticket déjà attribué au lieu d'en consommer un second.
3. **Double vérification** — le webhook ne transporte pas le dossier complet. Un appel
   `GET /v1/payments/<id>` récupère la méthode réellement utilisée, le numéro du payeur et la
   référence de transaction de la passerelle.
4. **Attribution** du ticket, puis réponse 200.

### Paiement confirmé mais ticket non créé

Le cas est traité explicitement, parce qu'il correspond à de l'argent encaissé sans
contrepartie :

- L'idempotence n'est **pas** enregistrée en cas d'échec d'attribution. Le backend répond 500,
  l'agrégateur rejoue le webhook, et le rejeu retente l'attribution.
- Un paiement déjà marqué confirmé est réexaminé : s'il n'a pas de ticket, on retente. Un
  court-circuit naïf (« déjà confirmé, on sort ») refermerait le problème sans jamais livrer.
- Une ligne de journal explicite nomme le paiement concerné.
- En amont, l'achat est **refusé** (409) si le tarif n'a plus de ticket : le meilleur moyen de
  ne pas avoir à réparer est de ne pas encaisser.

### Statuts en base

`pending` → `completed` | `failed` | `cancelled`.

---

## 6. Base de données

### Tables

**`users`** — comptes de gestion.
`id` uuid PK · `email` varchar unique · `password_hash` varchar · `full_name` varchar ·
`role` varchar · `is_active` bool · `phone` varchar · `email_verified_at` timestamptz ·
`kyc_status` varchar · `kyc_reviewed_at` timestamptz · `kyc_reviewed_by` uuid → users ·
`kyc_note` text · `created_at` · `updated_at`

**`wifi_zones`** — un point Wi-Fi.
`id` uuid PK · `name` varchar · `router_ip` varchar (affichage seulement) ·
`manager_phone` varchar · `country` varchar(2) · `latitude` / `longitude` decimal ·
`address` text · `owner_id` uuid → users **ON DELETE CASCADE** · `created_at` · `updated_at`

**`pricings`** — forfaits d'une zone.
`id` uuid PK · `wifi_zone_id` uuid → wifi_zones · `name` varchar · `amount` decimal > 0 ·
`duration_hours` int · `ticket_profile` varchar (profil MikroTik correspondant) ·
`description` text · `is_active` bool · `created_at` · `updated_at`

**`tickets`** — le stock.
`id` uuid PK · `wifi_zone_id` uuid → wifi_zones · `username` varchar · `password` varchar ·
`profile` varchar · `pricing_id` uuid → pricings · `status` varchar
(`free`/`reserved`/`sold`/`expired`) · `payment_id` uuid · `sold_at` timestamptz ·
**UNIQUE(wifi_zone_id, username)**

**`payments`** — les ventes.
`id` uuid PK · `moneroo_payment_id` varchar unique · `wifi_zone_id` uuid → wifi_zones ·
`owner_id` uuid → users · `amount` decimal · `platform_fee` decimal · `net_to_tenant` decimal ·
`phone` varchar · `pricing_id` uuid → pricings · `pricing_name` varchar ·
`pricing_duration_hours` int · `payment_method` varchar · `currency` varchar(3) ·
`status` varchar · `transaction_id` varchar · `completed_at` · `failed_at`

**`withdrawals`** — demandes de versement.
`id` uuid PK · `owner_id` uuid → users · `amount` decimal · `payout_phone` varchar ·
`status` varchar (`pending`/`approved`/`paid`/`rejected`) · `requested_at` ·
`processed_at` · `processed_by` uuid → users · `note` text

**`team_members`** — partage d'un compte.
`id` uuid PK · `owner_id` uuid → users · `member_id` uuid → users ·
**UNIQUE(member_id)** · **CHECK(owner_id <> member_id)**

**`payment_idempotency`** — anti-rejeu.
`id` uuid PK · `idempotency_key` varchar unique · `payment_id` uuid → payments

### Index qui comptent

```sql
CREATE INDEX idx_tickets_free_by_pricing ON tickets(wifi_zone_id, pricing_id) WHERE status = 'free';
CREATE INDEX idx_payments_owner ON payments(owner_id);
CREATE INDEX idx_team_members_member ON team_members(member_id);
```

Le premier est le chemin critique de la vente : chercher un ticket libre d'un tarif donné.

### Deux colonnes figées, et pourquoi

`platform_fee`, `net_to_tenant`, `pricing_name` et `pricing_duration_hours` sont **copiées sur
le paiement au moment de la vente**. Si le taux de commission change ou si un tarif est
supprimé, l'historique comptable ne doit pas être réécrit. Recalculer à la lecture est le
piège le plus coûteux de ce type de produit.

### Fonction d'attribution atomique

```sql
CREATE OR REPLACE FUNCTION assign_ticket_atomic(
    p_wifi_zone_id UUID, p_payment_id UUID, p_pricing_id UUID
) RETURNS TABLE(ticket_id UUID) AS $func$
DECLARE v_ticket_id UUID;
BEGIN
    SELECT id INTO v_ticket_id FROM tickets
    WHERE wifi_zone_id = p_wifi_zone_id AND status = 'free' AND pricing_id = p_pricing_id
    ORDER BY created_at ASC LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_ticket_id IS NOT NULL THEN
        UPDATE tickets SET status = 'sold', payment_id = p_payment_id,
            sold_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = v_ticket_id;
        RETURN QUERY SELECT v_ticket_id;
    END IF;
END;
$func$ LANGUAGE plpgsql;
```

`FOR UPDATE SKIP LOCKED` est le cœur du dispositif : deux clients qui paient à la même seconde
reçoivent deux tickets différents, jamais le même, sans blocage.

### RLS

**Désactivée, délibérément.** Le backend se connecte avec la clé de service, qui contourne
toute politique. L'isolation entre gérants est assurée **dans le code**, par un filtre
`owner_id` sur chaque requête.

C'est un choix défendable mais exigeant : **un seul `SELECT` sans filtre `owner_id` expose les
données de tous les gérants.** Pour un débutant, activer RLS est plus sûr. Si vous gardez ce
modèle, centralisez la résolution du propriétaire dans un middleware unique et ne lisez jamais
l'identifiant du propriétaire depuis la requête HTTP.

---

## 7. Tickets et forfaits

### Format des codes

Les identifiants **ne sont pas générés par la plateforme**. Ils viennent du routeur, exportés
en CSV. Leur format dépend donc de MikroTik ou du générateur utilisé par le gérant. La
plateforme impose seulement l'unicité par zone, garantie par une contrainte en base.

Colonnes CSV reconnues : `Username`, `Password`, `Profile` (casse indifférente).

### Modélisation des forfaits

Un forfait porte **le prix et le nom commercial** ; la durée réelle et le débit sont définis par
le **profil MikroTik** sur le routeur. La colonne `duration_hours` n'est qu'un affichage.

Le lien entre les deux est `pricings.ticket_profile` : le profil du CSV détermine à quel forfait
le ticket appartient. Sans ce lien, un ticket n'est vendable par aucun forfait — la plateforme
le signale à l'import plutôt que de le laisser dormir.

**Règle d'attribution : tarif exact, aucun repli.** Un achat à 100 F ne peut livrer qu'un
ticket du forfait à 100 F. Sans stock, la vente est refusée. Un repli « n'importe quel ticket
libre » existait au départ : il livrait des forfaits d'un mois à des clients ayant payé une
heure, silencieusement.

### Rupture de stock

Contrôle au moment de créer l'intention de paiement. Stock à zéro → 409, aucun appel à
l'agrégateur, aucun paiement créé, forfait grisé « Épuisé » sur la page d'achat.

> **Limite connue, à corriger si vous recommencez** : le contrôle a lieu à l'ouverture du
> paiement, pas à sa confirmation. S'il reste un ticket et que six clients lancent l'achat en
> même temps, les six passent le contrôle et un seul est servi. Le statut `reserved` existe
> dans le schéma pour cela mais n'est pas utilisé : réserver le ticket à la création du
> paiement, le libérer après expiration, fermerait définitivement le trou.

Une alerte remonte dans l'interface dès qu'un forfait tombe sous un seuil (10 tickets).

### Vouchers imprimables

**Non implémentés.** Le gérant imprime ses tickets depuis MikroTik s'il le souhaite ; la
plateforme ne couvre que la vente en ligne.

---

## 8. Authentification, rôles, tableau de bord

### Plateforme multi-gérants

Chaque gérant possède ses zones, ses tarifs, ses tickets, sa comptabilité et son solde.
L'isolation repose sur `wifi_zones.owner_id` et `payments.owner_id`.

### Rôles

| Rôle | Portée |
|---|---|
| `admin` | Un gérant ordinaire. Voit et gère uniquement ses propres zones. |
| `super_admin` | Le compte plateforme. Ne possède aucune zone, ne vend rien. Voit tous les gérants, valide les identités et les demandes de retrait. |

Même page de connexion pour les deux, redirection selon le rôle.

### Propriétaire effectif

Un gérant peut ajouter des **membres d'équipe** : comptes distincts, mêmes données, solde
commun. D'où une notion centrale, résolue **à chaque requête** dans le middleware
d'authentification :

```
propriétaire effectif = soi-même, ou l'inviteur si l'on est membre d'une équipe
```

Tous les contrôleurs filtrent sur ce propriétaire effectif, jamais sur l'identifiant du compte
connecté. Il n'est pas stocké dans le jeton : une invitation peut être révoquée, et un jeton de
plusieurs jours continuerait d'ouvrir l'accès.

### Modèle économique et solde

La plateforme prélève un pourcentage du montant brut de chaque ticket, **frais d'agrégateur
inclus dedans** : un seul prélèvement pour le gérant.

Le solde n'est **jamais stocké**. Il est dérivé à chaque lecture :

```
solde = somme(net_to_tenant des paiements confirmés)
      − somme(montants des retraits validés ou payés)
```

Un solde stocké finit toujours par diverger : double crédit sur rejeu de webhook, panne entre
deux écritures, correction manuelle en base. Un solde dérivé ne peut pas.

Les retraits sont validés manuellement par le compte plateforme, qui effectue le virement
Mobile Money lui-même. Vendre est libre dès l'inscription ; **retirer** exige une vérification
d'identité. Un fraudeur qui vend sans être vérifié ne gagne rien : l'argent reste sur le compte
agrégateur.

> ⚠️ **Point juridique, hors code.** Détenir les fonds de tiers relève, dans l'UEMOA, de la
> réglementation BCEAO sur la monnaie électronique. À faire valider par un juriste avant
> d'ouvrir à des tiers.

### Indicateurs du tableau de bord

| Indicateur | Calcul |
|---|---|
| Chiffre d'affaires total | Somme des montants bruts des paiements confirmés des zones du propriétaire |
| Recettes du jour | Idem, filtré sur la date du jour |
| Net du jour | Somme des `net_to_tenant` figés, **jamais recalculée** |
| Tickets vendus | Comptage des tickets au statut `sold` |
| Zones actives | Zones ayant au moins un ticket vendu |
| Répartition par opérateur | Groupement des paiements confirmés par `payment_method` |

Les cinq premières requêtes sont indépendantes : les lancer en parallèle fait passer la page
de 2,9 s à environ 1 s.

---

## 9. Variables d'environnement

**Noms uniquement.** Ne jamais committer de valeur ; `.env` doit figurer dans `.gitignore`.

### Backend (Render, et `.env` en local)

| Nom | Rôle |
|---|---|
| `PORT` | Port d'écoute, fourni par l'hébergeur |
| `NODE_ENV` | `development` ou `production` |
| `SUPABASE_URL` | URL du projet Postgres |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé de service. **Contourne toute sécurité : serveur uniquement, jamais dans le frontend** |
| `SUPABASE_ANON_KEY` | Clé publique, non utilisée aujourd'hui |
| `JWT_SECRET` | Signature des jetons. Une chaîne aléatoire longue |
| `JWT_EXPIRES_IN` | Durée de validité des jetons (ex. `7d`) |
| `MONEROO_API_KEY` | Clé de l'agrégateur. Son préfixe détermine le mode bac à sable |
| `MONEROO_WEBHOOK_SECRET` | **Obligatoire.** Sans lui, tous les webhooks sont rejetés et aucun ticket n'est jamais livré |
| `MONEROO_BASE_URL` | URL de l'API de l'agrégateur |
| `FRONTEND_URL` | Base des URL de retour après paiement |
| `CORS_ORIGIN` | Origines autorisées, séparées par des virgules |
| `LOG_LEVEL` | Niveau de journalisation |

### Frontend (Vercel, et `.env.local`)

| Nom | Rôle |
|---|---|
| `VITE_API_URL` | URL de l'API backend, suffixe `/api` compris |
| `VITE_FRONTEND_URL` | Base publique, pour générer les liens d'achat |

> Tout ce qui commence par `VITE_` est **inclus dans le bundle et visible par n'importe qui**.
> Aucun secret ne doit jamais y figurer.

---

## 10. Pièges rencontrés

Ceux qui ont coûté de l'argent ou du temps. C'est la partie la plus utile du document.

### Argent

| Piège | Effet | Correction |
|---|---|---|
| Montant accepté depuis la requête | Le client pouvait choisir son prix | Montant lu en base à partir du tarif ; `pricing_id` obligatoire |
| Signature du webhook sur le corps re-sérialisé | Tous les webhooks rejetés, aucun ticket livré | Conserver le corps brut dans le parseur JSON |
| Court-circuit « paiement déjà confirmé » | Un échec d'attribution devenait définitif au rejeu | Vérifier l'existence du ticket avant de sortir |
| Attribution sans tenir compte du tarif | Un ticket d'un mois livré pour un achat d'une heure | Attribution stricte par `pricing_id`, sans repli |
| Aucun contrôle de stock avant paiement | Encaissement sans contrepartie en heure de pointe | Refus en 409 avant tout appel à l'agrégateur |
| Zone d'un gérant suspendu encore vendeuse | Un compte banni continuait d'encaisser | Vérification de `is_active` du propriétaire à la création du paiement |

### Silencieux

| Piège | Effet | Correction |
|---|---|---|
| Fonction SQL `RETURNS TABLE` lue comme un objet | Chaque vente réussie était comptée comme un échec, journal alarmant et 500 renvoyé à l'agrégateur | Lire `data[0].ticket_id` |
| Code de méthode de paiement invalide | Tous les paiements d'un pays auraient été rejetés | Vérifier chaque code contre l'API avant de l'ajouter |
| Liste de méthodes figée sur un pays | Un gérant d'un autre pays ne pouvait rien encaisser | Méthodes dérivées du pays de la zone |
| Indicatif téléphonique ajouté selon la longueur | Numéro ivoirien envoyé sans indicatif | Indicatif dérivé du pays de la zone |
| Pagination avec paramètres en texte | `from + limit - 1` concaténait : la page 2 chargeait 1 000 lignes | `parseInt` sur chaque paramètre |

### Interface et exploitation

| Piège | Effet | Correction |
|---|---|---|
| CDN d'icônes dans le portail captif | Aucune icône : pas d'accès Internet avant connexion | SVG écrit en ligne, zéro ressource distante |
| Thème sombre appliqué par le layout seul | Page ouverte depuis un lien direct affichée en clair | Script bloquant dans `index.html` |
| « Validation failed » brut affiché au visiteur | Inscription bloquée sans explication | Message par champ, et `trim()` sur l'email |
| Deux requêtes d'authentification par appel API | 600 ms de taxe sur chaque page | Une seule requête imbriquée, plus un cache court |
| Identifiant de zone en dur dans `login.html` | Un gérant recopiant le fichier vendait les tickets d'un autre | Générateur produisant un fichier par zone |

### Ce que je ferais différemment

1. **Activer RLS dès le départ.** Le filtrage en code marche, mais un seul oubli expose les
   données de tous les gérants.
2. **Réserver le ticket à la création du paiement**, pas à sa confirmation.
3. **Écrire les tests d'abord sur le chemin de l'argent.** Les bugs les plus coûteux étaient
   silencieux : rien ne plantait, l'argent partait au mauvais endroit.
4. **Ne jamais recalculer un montant historique.** Figer dès la première version.
5. **Journaliser le dossier complet du premier webhook reçu.** Deviner l'emplacement des
   champs a coûté plusieurs allers-retours.
6. **Choisir un nom de produit avant de créer le dépôt.** Le projet traîne encore un ancien
   nom dans `package.json`.

---

## 11. Coûts et limites

| Service | Plan | Limites à surveiller |
|---|---|---|
| Vercel | Gratuit (Hobby) | Suffisant pour une application monopage. Usage commercial : vérifier les conditions |
| Render | Service web | Un plan gratuit met le service en veille après inactivité : le premier webhook après la veille peut expirer. **À éviter sur le chemin d'un paiement** |
| Supabase | Gratuit | Pause du projet après inactivité prolongée, quota de stockage et de bande passante |
| Agrégateur | Commission par transaction | Montant minimum et maximum par méthode (ici 100 à 1 000 000 XOF) |

**Latence** : héberger le backend loin de la base multiplie les allers-retours. Chaque appel
API en fait plusieurs. Placer les deux dans la même région est le gain le plus simple à
obtenir.

**Sauvegardes** : celles du plan gratuit Supabase uniquement. **Aucune sauvegarde applicative,
aucune restauration testée.** À mettre en place avant d'accepter de l'argent de tiers — c'est
la lacune la plus grave de ce projet aujourd'hui.

---

## Ordre de construction

Chaque étape produit quelque chose de testable. Ne pas passer à la suivante avant que la
précédente fonctionne.

**1. Base et schéma.** Créer le projet Postgres, exécuter le schéma, insérer un gérant et une
zone à la main.
*Testable :* les tables existent, les requêtes de lecture répondent.

**2. Backend minimal.** Express, connexion à la base, une route de santé, une route listant les
zones.
*Testable :* `curl` renvoie les zones.

**3. Authentification.** Inscription, connexion, jeton JWT, middleware qui protège les routes.
*Testable :* une route protégée refuse sans jeton, accepte avec.

**4. Isolation par propriétaire.** Filtrer chaque requête. Créer un second gérant et vérifier
qu'il ne voit rien du premier.
*Testable :* c'est le test de sécurité le plus important du projet. Ne pas le sauter.

**5. Tickets.** Import CSV, stock par forfait, fonction d'attribution atomique.
*Testable :* appeler la fonction deux fois en parallèle ne donne jamais deux fois le même
ticket.

**6. Frontend de gestion.** Connexion, liste des zones, tarifs, import de tickets.
*Testable :* un gérant crée une zone, un tarif, importe du stock.

**7. Page d'achat publique.** Lecture de la zone et des tarifs sans authentification.
*Testable :* la page s'ouvre dans une fenêtre privée, les forfaits épuisés sont grisés.

**8. Paiement en bac à sable.** Intention, redirection, webhook, signature, idempotence.
*Testable :* un paiement de test livre un ticket, et le rejeu du webhook n'en livre pas un
second.

**9. Le chemin de l'échec.** Vider le stock, tenter un achat : refus avant tout encaissement.
Simuler un webhook en double, un webhook mal signé, un paiement sans ticket.
*Testable :* aucun cas ne laisse d'argent encaissé sans contrepartie.

**10. Portail captif.** Gabarit `login.html`, walled garden, achat réel de bout en bout depuis
un téléphone.
*Testable :* un vrai client achète et se connecte.

**11. Comptabilité et solde.** Montants figés à la vente, solde dérivé, demandes de retrait.
*Testable :* un cycle complet demande → validation → paiement, avec un solde cohérent.

**12. Passage en production.** Clés réelles, domaine, CORS, sauvegardes, surveillance.
*Testable :* un achat réel au plus petit tarif, de bout en bout.

> Les étapes 4, 5, 8 et 9 sont celles qui protègent l'argent. Si le temps manque, c'est
> ailleurs qu'il faut couper.
