# RNA Panneau V2 — Business Specification

> **Date** : 2026-09-10  
> **Contexte** : Évolution de la gestion de parc publicitaire vers **CRM + Facturation intégrée + Suivi paiement**

---

## 1. Contexte & Vision

### V1 → V2
- **V1** : Gestion simple de parc (panneaux, contrats basiques, données clients légales)
- **V2** : Plateforme complète — CRM client lean + facturation intégrée + relance paiement + alertes financières

### Objectif principal
Réduire friction administrativo-financière : de "plusieurs outils" → une seule source de vérité pour clients, contrats, factures, paiements.

---

## 2. Données & Entités Principales

### Parc publicitaire
- **~500 panneaux** actuellement
- **Formats** : recto-verso, V-shape, face unique (dimensions 2x1, 4x3, 6x3, 8x3, 12x3)
- **Impression** : éco-solvant, UV, laminées
- **Identification** : `DIA-0001-A / DIA-0001-B` (par face)
- **Localisation** : lieu textuel + GPS optionnel
- **États** : loué, libre, en maintenance, à réparer

### Clients
- **Types** : entreprises (pas de particuliers)
- **Fiche** : Nom, NIF, STAT, RCS, Carte Fiscale, contact(s), documents joints
- **KPIs** : CA total, nombre de faces actuels, dette, factures impayées, premier contrat (date)
- **Contacts multiples** : commercial + facturation (minimum)
- **Historique** : journal d'activité (appels, mails, RDV) optionnel à terme

### Contrats vs Bons de Commande
- **Bon de Commande (BC)** : engagement court terme, tactique
- **Contrat** : relation commerciale durable, peut couvrir plusieurs faces
- **Distinction critique** : tracée dans le système mais processus métier identique
- **Tarification** : par face (mensuel / semestriel / annuel)
- **Reconduction** : cas par cas (tacite, express, ou négocié selon client)
- **Cycle** : durée variable (précisée par client)

### Impressions
- **Workflow** : création → location → impression → pose → facturation
- **Étapes** :
  1. Client demande face (contrat signé)
  2. **Bon à tirer envoyé au client par mail** → client valide par réponse email
  3. Après validation → **lancement impression**
  4. Pose chez prestataire
  5. Facturation

- **Bon à tirer (BAT)** : processus EXTERNE (email client) — système ne track que la date d'envoi pour audit
- **Alerte** : J-X avant expiration impression

### Factures
- **Génération** : manuelle par utilisateur dans l'app (pas auto après contrat)
- **Éditer** = générer invoice + exporter PDF prêt à envoyer
- **Données obligatoires** : NIF/STAT/RCS client, détails face, TVA (20%), montant
- **États** : éditée / non-éditée
- **Alerte** : notification si facture pas générée (deadline TBD par user)
- **Suivi paiement** : alerte 15j si facture non payée

### Alertes & Relances
- **Fin contrat** : J-30 avant date fin (à qui ? configurable par contrat)
- **Impression expiration** : J-X (paramétrable)
- **Paiement** : J-15 si facture impayée
- **Canal** : email + dans-app (configurable)
- **Clients destinataires** : oui, fin contrat peut être envoyée au client direct

---

## 3. Workflows Métier

### Process classique (location face)
```
BC signé
  ↓
Contrat créé en système
  ↓
Client fait "bon à tirer" → email + validation client
  ↓
Lancement impression [BAT validé]
  ↓
Pose & localisation confirmée
  ↓
Facturation (manuel) → PDF généré
  ↓
Suivi paiement (alerte si retard)
  ↓
Fin contrat (30j alerte avant)
```

### Reconduction contrat
- Demande de reconduction (devis possible depuis système)
- Accord client → nouveau contrat
- Ou refus → exit face (préparation maintenance)

---

## 4. Utilisateurs & Permissions

### Profils
- **Dirigeant / Admin** : accès complet, logs audit, gestion droits
- **Commercial** : création/edit clients & contrats, devis reconduction
- **Technicien** : tracking impressions, poses, maintenance
- **Comptable** : facturation, suivi paiement, rapports financiers

### Permissions
- Granulaires (admin gère qui voit/edit quoi)
- Restriction géographique possible (optionnel)
- **Audit** : logs obligatoires pour actions sensibles (delete, éditer facture, relance paiement)

---

## 5. Données Sensibles & Sécurité

**À chiffrer** :
- N° NIF, STAT, RCS
- Carte fiscale (si document)

**Pas de 2FA** pour V2 (scope limité, équipe < 3)

---

## 6. Reporting & Dashboard

### Métriques clés
- Taux d'occupation (faces loués / total)
- Panneaux libres (par région)
- À réparer / en maintenance
- Rotation affiches (par face)
- **Factures à échéance** (non payées, > 15j)
- Carte géographique (statut par panneau)

### Fréquence
- Tableau de bord temps-réel
- Rapports mensuels/à la demande (CA, impayés, etc.)

---

## 7. Priorités Client (de la réunion)

1. **Relance paiement & fin contrat** (alertes, suivi dette)
2. **Facturation intégrée** (génération + PDF)
3. **Automation** (devis reconduction, alertes bulk)
4. Suivi paiements détaillé
5. Vue globale KPIs société

---

## 8. Dépendances Métier

```
Panneaux & Impressions (A)
  ↓
Contrats & BC (B)
  ↓
Facturation (C) ← BLOQUE Relance Paiement (D)
↓
Alertes paiement & fin contrat
↓
Dashboard & Reporting (F)

CRM Client (E) — PARALLÈLE

Permissions (G) — PARTIEL dès le départ
Automation (H) — ATTEND C + D + E
```

---

## 9. Clarifications Apportées (2026-09-10)

- ✅ **Bon à tirer** : envoyé par RNA au client via email, validation client par réponse email, puis impression. État système : date d'envoi (audit), pas de workflow système.
- ✅ **Factures** : générées manuellement par utilisateur. "Éditer" = générer + exporter PDF prêt à envoyer. Alerte si non générée.
- ⏳ **Priorité roadmap** : Bloc C (Facturation) vs Bloc D (Relance) en premier ?

---

## 10. Prochaines Étapes

1. Valider priorité roadmap (C vs D first)
2. Définir blocs de travail cohérents
3. Identifier risques métier / edge cases
4. Brainstormer architecture
