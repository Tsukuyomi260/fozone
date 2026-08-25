# Fô-Zône - Plateforme de vente de tickets Wi-Fi

Plateforme complète pour la vente automatisée de tickets Wi-Fi avec paiements Mobile Money via Moneroo (FedaPay), intégrée à un hotspot MikroTik.

- Production : [fozone.org](https://fozone.org) (frontend) · `api.fozone.org` (backend)

## Vue d'ensemble

Cette plateforme permet de :
- Gérer plusieurs zones Wi-Fi
- Vendre des tickets Wi-Fi en ligne, payés en Mobile Money (MTN, Moov au Bénin)
- Attribuer les tickets automatiquement et de façon atomique après paiement confirmé
- Retrouver un ticket déjà acheté à partir du numéro de téléphone utilisé
- Suivre les statistiques et la comptabilité (chiffre d'affaires brut et net de commission)
- Importer des tickets depuis des fichiers CSV
- Servir les pages du portail captif MikroTik (connexion, redirection après paiement)

## Architecture

### Backend
- **Node.js** avec Express
- **Supabase** (PostgreSQL) pour la base de données — accès exclusivement via la clé de service (pas de RLS ; l'autorisation est vérifiée en code, par `owner_id`)
- **Moneroo** comme agrégateur de paiement (passerelle FedaPay au moment de la rédaction)
- **JWT** pour l'authentification

### Frontend
- **React 18** avec Vite
- **Tailwind CSS** pour le styling
- **React Router** pour la navigation
- Thème sombre/clair avec bascule manuelle

### Portail captif (`hotspot/`)
- `login.html` — page de connexion MikroTik (gabarit `$(...)`), liens vers l'achat et la récupération de ticket
- `redirect.html` — page affichée après authentification hotspot réussie

Ces fichiers sont à copier sur le routeur MikroTik (`/files`), ils ne sont pas servis par le backend.

## Prérequis

- Node.js 18+
- Compte Supabase
- Compte Moneroo (clé API + secret webhook)
- npm

## Installation

### 1. Backend

```bash
cd backend
npm install
cp env.example .env
# Configurer les variables dans .env
npm run dev
```

Le backend démarre sur `http://localhost:3000`.

### 2. Frontend

```bash
cd frontend
npm install
# Créer .env.development.local avec VITE_API_URL=http://localhost:3000/api
npm run dev
```

Le frontend démarre sur `http://localhost:5174`.

> En développement, garder `.env.local` pointé vers la production et surcharger l'URL locale dans `.env.development.local` (prioritaire en mode `dev`, ignoré par Vite en build) évite de re-basculer les variables à chaque session.

### 3. Base de données

1. Exécuter `backend/database/schema.sql` dans le SQL Editor du projet Supabase.
2. Exécuter dans l'ordre les migrations présentes dans `backend/database/migrations/` (numérotées, ex. `007_pricing_snapshot.sql`, `008_users_phone.sql`). Une migration manquante provoque des erreurs de colonne inconnue au runtime, pas au démarrage.

### 4. Portail captif MikroTik

Copier `hotspot/login.html` et `hotspot/redirect.html` dans le dossier `/files` du routeur (via Winbox ou FTP). Le SSID, le lien d'achat (`fozone.org/buy/<zoneId>`) et le lien de récupération (`fozone.org/payment/return`) sont en dur dans `login.html` — à adapter si le domaine ou l'UUID de zone changent.

## Documentation

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
- [Architecture Backend](backend/ARCHITECTURE.md)
- [Guide de configuration](backend/SETUP.md)

## Configuration

### Variables d'environnement Backend

Voir `backend/env.example` pour la liste complète. Points notables :
- `CORS_ORIGIN` accepte plusieurs origines séparées par des virgules (utile pour faire coexister le domaine de prod et un environnement de test)
- `MONEROO_WEBHOOK_SECRET` est obligatoire — sans lui, tous les webhooks Moneroo sont rejetés en silence et aucun ticket n'est jamais livré
- Le taux de commission de l'agrégateur est centralisé dans `backend/src/config/commission.js`, pas dans les variables d'environnement

### Variables d'environnement Frontend

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3000/api
VITE_FRONTEND_URL=http://localhost:5174
```

## Fonctionnalités

### Dashboard Admin
- Vue d'ensemble des statistiques
- Chiffre d'affaires total
- Nombre de tickets vendus
- Recettes du jour (net, commission agrégateur déduite)
- Zones actives

### Gestion des zones Wi-Fi
- Création/modification/suppression
- Localisation GPS
- Adresse IP ou nom d'hôte du routeur (`router_ip` accepte un DNS name)
- Numéro du gérant

### Gestion des tarifs
- Tarifs par zone Wi-Fi
- Montants personnalisables
- Durée de validité
- Un tarif déjà vendu peut être supprimé sans casser l'historique : le nom et la durée sont figés sur le paiement au moment de la vente (`payments.pricing_name`, `payments.pricing_duration_hours`)

### Gestion des tickets
- Import CSV
- Statuts (free, sold, expired)
- Attribution atomique via la fonction Postgres `assign_ticket_atomic` (`FOR UPDATE SKIP LOCKED`), évite la double vente

### Paiements
- Intégration Moneroo (agrégateur), passerelle configurable (`methods` dans `services/moneroo.js`)
- Mode sandbox détecté automatiquement par le préfixe de la clé API (`test_...`) — expose alors la passerelle de démo Moneroo en plus de MTN/Moov
- Support MTN et Moov (Bénin)
- Webhooks sécurisés : signature HMAC-SHA256 vérifiée sur le corps brut de la requête (pas sur une re-sérialisation)
- Idempotence sur `event + paymentId`
- Recherche d'un paiement par numéro de téléphone (`GET /api/payments/lookup/:phone`, route publique, taux limité)
- Le montant facturé est toujours relu depuis la base au moment du paiement — jamais accepté tel quel depuis la requête client

## Sécurité

- Authentification JWT
- Validation des entrées
- Rate limiting
- Vérification des signatures webhook sur le corps brut
- Autorisation vérifiée en code applicatif à chaque requête (`owner_id` sur `wifi_zones`, propagé aux tables liées) — pas de Row Level Security côté Supabase

## Limites connues

- Pas de suite de tests automatisés (`npm test` est un stub)
- Un seul compte peut gérer un ensemble de zones ; pas encore de partage multi-compte sur les mêmes données
- Le rôle utilisateur (`admin` / `revendeur` / `client`) existe en base mais n'est pas encore appliqué par le code

## Licence

ISC

## Support

Pour toute question, contactez l'équipe de développement.
