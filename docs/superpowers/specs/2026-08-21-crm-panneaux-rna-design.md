# CRM Panneaux Publicitaires RNA — Design

Date : 2026-08-21
Statut : validé par l'utilisateur (brainstorm)

## Contexte

RNA est une société de panneaux publicitaires basée à Madagascar. Elle gère un parc
de panneaux publicitaires (formats 2x1m, 4x3m, 6x3m, 8x3m, 12x3m) loués à des clients
sur des contrats de location de 6 mois. Le business a deux volets : implantation de
panneaux, et impression/pose d'affiches.

Aujourd'hui, la gestion se fait sur Excel : pas de vision temps réel de l'inventaire,
pas de suivi centralisé des contrats/échéances, pas de suivi d'entretien, pas de
visibilité commerciale consolidée (revenus par panneau/ville/client).

## Objectif

Construire une interface web (CRM léger + carte interactive) pour centraliser et
moderniser la gestion du parc de panneaux, remplaçant les fichiers Excel.

## Échelle cible

- < 500 panneaux
- 3 utilisateurs simultanés
- Budget hébergement visé : ~0€/mois (free tiers)

## Rôles utilisateurs

- **Dev** : accès technique complet (logs, config, tout ce que voit l'admin).
- **Admin** : accès complet à la gestion et aux données financières (contrats, prix,
  clients, suppression). Ne peut pas casser l'infrastructure technique.
- **User** (terrain : commerciaux/techniciens) : accès à la carte, aux fiches
  panneaux, peut ajouter des photos, des entretiens, et créer des demandes
  (nouveau panneau, nouveau contrat). Toute action sensible (modifier/supprimer un
  contrat, changer un prix, supprimer un panneau) crée une **demande d'approbation**
  en attente de validation par un admin, visible dans une file dédiée du dashboard
  admin.

## Stack technique

- **Framework** : Next.js (App Router, TypeScript) — une seule codebase full-stack
  (UI + API routes), pour rester maintenable par un dev solo.
- **UI** : Tailwind CSS + shadcn/ui. Direction visuelle inspirée d'Airbnb (cards,
  ombres douces, espacements généreux, typographie soignée) adaptée en palette
  bleu/professionnel.
- **Carte** : MapLibre GL JS. Deux fonds gratuits, basculables comme sur Google
  Maps : OpenStreetMap (plan) et Esri World Imagery (satellite). Carte bornée sur
  l'emprise de Madagascar.
- **Base de données** : PostgreSQL (Supabase ou Neon, free tier) via Prisma ORM.
- **Stockage photos** : Supabase Storage (free tier).
- **Authentification** : Auth.js (NextAuth), email + mot de passe, 3 rôles
  (dev/admin/user).
- **Hébergement** : Vercel (free tier).
- **Historique des locations** : conservé en base PostgreSQL (jamais supprimé,
  seulement archivé) — pas de blockchain, complexité jugée inutile à cette échelle.
- **Notifications** : in-app uniquement pour la V1 (pas d'email/SMS).

## Modèle de données

### Billboard (Panneau)
- `reference` (unique, généré auto — ex: `ANM 001 TNR`, préfixe ville)
- `lat`, `lng`
- `city`
- `dimensions` (enum : 2x1, 4x3, 6x3, 8x3, 12x3)
- `sides` (1 ou 2 faces)
- `status` (dérivé automatiquement : disponible / en location / expire bientôt
  (< 1 mois) / expiré / en maintenance)
- `currentPhotoUrl` (mis à jour à chaque nouvelle pose)
- relations : `contracts[]`, `maintenanceRecords[]`, `installationHistory[]`

### Client
- `name`, `contactInfo`
- relation : `contracts[]`

### Contract (Contrat / Location)
- `billboardId`, `clientId`
- `startDate`, `endDate` (défaut : +6 mois)
- `amount`
- `status` (actif / expiré / terminé)
- Jamais supprimé physiquement — archivé pour conserver l'historique.

### MaintenanceRecord (Entretien)
- `billboardId`, `date`, `type` (ex: antirouille), `comment`, `technician`
- Alerte si aucun contrôle depuis X mois (X paramétrable globalement par l'admin).

### ApprovalRequest (Demande d'approbation)
- `requestedBy` (userId), `type` (create_contract / edit_contract /
  delete_billboard / edit_price / ...), `payload`, `status` (pending / approved /
  rejected), `reviewedBy`, `reviewedAt`

### User
- `email`, `passwordHash`, `role` (dev / admin / user)

## Écrans

1. **Carte + BD — vue split-screen** (écran d'accueil par défaut)
   Carte interactive à gauche, tableau des panneaux à droite (colonnes triables :
   référence, ville, statut, client, dates). Sélection synchronisée dans les deux
   sens (clic ligne → centre carte, clic marqueur → surligne ligne). Filtres
   (statut, ville, dimension) au-dessus. Clic sur un panneau ouvre un drawer
   d'aperçu rapide avec lien "voir en détail".

2. **Carte plein écran**
   Même carte, sans le tableau, pour une vue terrain dégagée. Clic droit sur la
   carte ou bouton "+ Ajouter un panneau" pour créer un panneau (positionnement par
   pin).

3. **Base de données plein écran**
   Même tableau, sans la carte, pour une consultation/tri/export type tableur.

4. **Fiche panneau dédiée** (page complète par panneau)
   Photo grand format, référence, dimensions, ville, statut. Onglets :
   - *Contrat en cours* (client, dates, montant, actions renouveler/terminer)
   - *Historique* (timeline des locations passées + photos)
   - *Entretien* (timeline des interventions + bouton "ajouter intervention")

5. **Espace Clients (CRM léger)**
   Liste des clients avec recherche. Fiche client : coordonnées + historique de
   tous les contrats/panneaux loués par ce client.

6. **Dashboard admin**
   KPIs : nombre de panneaux disponibles/loués, revenus par panneau/ville/client,
   alertes actives (contrats expirant sous 1 mois, entretiens en retard). File des
   demandes d'approbation en attente (users).

7. **Auth**
   Connexion email/mot de passe, redirection vers la vue split-screen par défaut
   selon le rôle.

## Évolutivité (hors périmètre V1, à garder en tête)

- Filtrage/reporting sur panneaux endommagés.
- Notifications email/SMS.
- Export de rapports (PDF/Excel).
- Gestion plus fine des permissions si l'équipe grandit au-delà de 3 users.

## Hors périmètre (explicitement écarté)

- Blockchain pour l'historique des locations (jugé inutile à cette échelle — la
  base PostgreSQL avec conservation des enregistrements archivés suffit).
