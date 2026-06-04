# Serveur — Console de supervision d'alertes météo sécurisée

Le lien vers le dépôt GitHub : **https://github.com/rauf-mifteev/Ahuntsic_Web_API_Secure_IoT**

## Description

Ce projet est réalisé dans le cadre du cours de Développement d'applications de supervision
et de monitorage au Collège Ahuntsic (420-317-AH). Il fait évoluer le serveur de l'examen
pratique 2 (alertes persistées sur MongoDB, architecture trois couches) pour y ajouter la
sécurité, la traçabilité, le temps réel et un agent IoT simulé.

L'interface web est fournie et n'a pas été modifiée. Le travail porte entièrement sur le
serveur et sur l'agent. Le projet est construit en **4 chantiers successifs cumulatifs** :

| Chantier | Fonctionnalité | Concepts appliqués |
|---|---|---|
| **Chantier 1** | **Authentification et autorisation** : modèle Utilisateur, hachage bcrypt, token JWT, middlewares `verifierToken` et `autoriserRoles`, matrice de contrôle d'accès par rôle sur toutes les routes. | bcrypt, jsonwebtoken, `select: false`, `config/config.js` |
| **Chantier 2** | **Traçabilité des actions** : champs `creeePar` et `resoluePar` sur le modèle Alerte, collection d'audit `AlerteAuditSupression` pour les suppressions, `.populate()` sur toutes les routes GET. | Mongoose `ref`, `.populate()`, audit séparé |
| **Chantier 3** | **Temps réel avec Socket.IO** : branchement sur le même serveur HTTP qu'Express, poignée de main JWT, émission des trois événements (`alerte:nouvelle`, `alerte:resolue`, `alerte:supprimee`) après chaque mutation. | `http.createServer`, `Server` Socket.IO, `io.use()`, `app.set("io", io)` |
| **Chantier 4** | **Simulateur d'agent IoT et statistiques** : programme autonome `agent-alertes/publier.js` qui lit en boucle 5 capteurs simulés et publie une alerte uniquement lors d'un dépassement de seuil ; route `GET /api/statistiques` agrégée sur 24 h. | `fetch` natif Node 18, `setInterval`, retry réseau, `Alerte.aggregate()`, `Promise.all` |

## Prérequis

- Node.js 18 ou plus
- npm
- MongoDB

Vérifier que MongoDB tourne (PowerShell) :

```
Get-Service MongoDB
```

## Installation

Dans le dossier `serveur/`, exécuter :

```
npm install
```

Copier le fichier de configuration :

```
cp .env.exemple .env
```

Remplir `JWT_SECRET` avec une valeur d'au moins 32 caractères. Commande recommandée :

```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Amorcer la base de données (à faire une seule fois, ou pour repartir d'un état propre) :

```
npm run seed
```

## Démarrage

```
npm start
```

Le terminal affiche :

```
MongoDB : connecté
HTTP + Socket.IO sur http://localhost:3000  [development]
```

Ouvrir ensuite `interface-fournie/index.html` dans le navigateur.

Pour démarrer l'agent IoT dans un terminal séparé (aucun `npm install` requis) :

```
cd agent-alertes
node publier.js
```

## Comptes de démonstration

Tous les comptes sont créés par `npm run seed`. Mot de passe identique pour tous : `Motdepasse1!`

| Courriel | Role | Droits |
|---|---|---|
| `lecteur@cours.qc.ca` | lecteur | Consulter les alertes uniquement |
| `operateur@cours.qc.ca` | operateur | Consulter + créer + résoudre |
| `administrateur@cours.qc.ca` | administrateur | Tous les droits + supprimer + statistiques |
| `agent@cours.qc.ca` | operateur | Compte de service utilisé par l'agent IoT |

## Scénario de démonstration

1. Démarrer MongoDB, puis `npm run seed`, puis `npm start`.
2. Dans un deuxième terminal : `cd agent-alertes && node publier.js`.
3. Ouvrir `interface-fournie/index.html` dans le navigateur.
4. Se connecter avec `lecteur@cours.qc.ca` / `Motdepasse1!` : le bouton « Ajouter » est masqué. Les alertes de l'agent apparaissent en temps réel sans F5. Tenter de résoudre une alerte : toast d'erreur 403.
5. Se déconnecter, se reconnecter avec `operateur@cours.qc.ca` : boutons « Ajouter » et « Résoudre » visibles. Résoudre une alerte : la carte devient grise et affiche le courriel de l'opérateur dans `resoluePar`.
6. Se déconnecter, se reconnecter avec `administrateur@cours.qc.ca` : bouton « Supprimer » visible sur chaque carte. Supprimer une alerte : la carte disparaît dans tous les onglets ouverts. Cliquer sur « Statistiques » : les 4 sections agrégées s'affichent.

## Routes disponibles

### Authentification

| Méthode | Route | Accès | Description | Codes retournés |
|---|---|---|---|---|
| POST | `/api/auth/inscription` | public | Créer un compte (rôle `lecteur` par défaut) | 201, 400, 409 |
| POST | `/api/auth/connexion` | public | Obtenir un token JWT | 200, 401 |
| GET | `/api/auth/moi` | tous les rôles | Profil de l'utilisateur connecté | 200, 401 |

### Alertes

| Méthode | Route | Lecteur | Operateur | Admin | Codes retournés |
|---|---|---|---|---|---|
| GET | `/api/alertes` | oui | oui | oui | 200, 400, 401 |
| GET | `/api/alertes/:id` | oui | oui | oui | 200, 400, 401, 404 |
| POST | `/api/alertes` | non | oui | oui | 201, 400, 401, 403 |
| PATCH | `/api/alertes/:id/resolue` | non | oui | oui | 200, 400, 401, 403, 404 |
| PUT | `/api/alertes/:id` | non | non | oui | 200, 400, 401, 403, 404 |
| DELETE | `/api/alertes/:id` | non | non | oui | 200, 400, 401, 403, 404 |

### Statistiques

| Méthode | Route | Accès | Description | Codes retournés |
|---|---|---|---|---|
| GET | `/api/statistiques` | administrateur | Tableau de bord agrégé sur 24 h | 200, 401, 403 |

## Paramètres de GET /api/alertes

| Paramètre | Effet | Défaut |
|---|---|---|
| `?niveau=critique` | Filtre exact. Retourne 400 si la valeur est hors enum. | (tous) |
| `?type=temperature` | Filtre exact, normalisé en minuscules. | (tous) |
| `?resolue=false` | Filtre booléen. Accepte `true` ou `false`. | (tous) |
| `?q=canicule` | Recherche dans le champ `message`, insensible à la casse. | (tous) |
| `?since=2026-06-01` | Filtre `horodatage >=` cette date (format ISO 8601). | (illimité) |
| `?until=2026-06-05` | Filtre `horodatage <=` cette date (format ISO 8601). | (illimité) |
| `?sort=horodatage` | Champ de tri : `horodatage`, `niveau` ou `createdAt`. | `horodatage` |
| `?order=asc` | Direction du tri : `asc` ou `desc`. | `desc` |
| `?page=2` | Numéro de page, entier >= 1. | `1` |
| `?limit=5` | Taille de page, entier entre 1 et 100. | `10` |

La réponse est toujours une enveloppe paginée :

```json
{
  "donnees": [ { "...alerte..." } ],
  "total":   7,
  "page":    1,
  "limit":   10,
  "pages":   1
}
```

## Modèle d'une alerte

```json
{
  "id":         "6620a1f8c4e3b5a1f8c4e3b5",
  "source":     "Station Montreal-Nord",
  "type":       "temperature",
  "niveau":     "critique",
  "message":    "temperature : 38.5 C hors des seuils [0, 32]",
  "horodatage": "2026-06-01T10:30:00.000Z",
  "resolue":    false,
  "resolueAt":  null,
  "creeePar":   { "id": "...", "courriel": "agent@cours.qc.ca", "nom": "Agent IoT (compte de service)" },
  "resoluePar": null,
  "createdAt":  "2026-06-01T10:30:00.000Z",
  "updatedAt":  "2026-06-01T10:30:00.000Z"
}
```

Champs envoyés par le client lors d'un POST ou d'un PUT : `source`, `type`, `niveau`, `message` uniquement.
Les champs `id`, `horodatage`, `resolue`, `resolueAt`, `creeePar`, `resoluePar`, `createdAt`
et `updatedAt` sont toujours générés ou remplis par le serveur.

Valeurs autorisées pour `niveau` : `info`, `avertissement`, `critique`.

## Modèle de la réponse des statistiques

```json
{
  "alertesParNiveau": { "info": 8, "avertissement": 6, "critique": 3 },
  "alertesResoluesVsOuvertes": { "resolues": 11, "ouvertes": 6 },
  "topSources": [
    { "source": "Station Montreal-Nord", "compte": 7 },
    { "source": "Station Laval-Sud",     "compte": 3 }
  ],
  "totalAlertes24h": 17
}
```

## Structure des fichiers

```
serveur/
├── package.json
├── .env.exemple                    <- modèle de configuration (versionné)
├── .gitignore                      <- exclut node_modules/ et .env
├── app.js                          <- point d'entrée, middlewares, démarrage
├── socket.js                       <- branchement Socket.IO, poignée de main JWT
├── config/
│   ├── bd.js                       <- connexion MongoDB encapsulée
│   └── config.js                   <- lecture et validation des variables .env
├── modeles/
│   ├── Alerte.js                   <- schéma Mongoose (creeePar, resoluePar)
│   ├── Utilisateur.js              <- schéma Mongoose des utilisateurs
│   └── AlerteAuditSupression.js    <- trace des suppressions
├── services/
│   ├── alertes.service.js          <- logique métier alertes, populate
│   ├── auth.service.js             <- inscription, connexion, vérification JWT
│   ├── statistiques.service.js     <- agrégations MongoDB sur 24 h
│   └── requete.js                  <- utilitaire filtres / tri / pagination
├── controleurs/
│   ├── alertes.controleur.js       <- logique HTTP + émission Socket.IO
│   ├── auth.controleur.js          <- logique HTTP authentification
│   ├── statistiques.controleur.js  <- logique HTTP statistiques
│   └── erreurs.middleware.js       <- middleware d'erreur central (4 arguments)
├── middlewares/
│   └── auth.middleware.js          <- verifierToken + autoriserRoles
├── routes/
│   ├── alertes.routes.js           <- câblage URL -> contrôleur + matrice de rôles
│   ├── auth.routes.js              <- câblage authentification
│   └── statistiques.routes.js      <- câblage statistiques
├── donnees/
│   └── seed.js                     <- 4 utilisateurs + 6 alertes météo
└── tests-insomnia/
    └── collection-projet-final.json

agent-alertes/
├── publier.js     <- simulateur IoT, node publier.js, aucun npm install requis
└── README.md
```

## Variables d'environnement

Le fichier `.env` (non versionné) est créé à partir de `.env.exemple` :

```
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/station-meteo
JWT_SECRET=<secret-de-64-caracteres-minimum-genere-avec-crypto>
JWT_EXPIRATION=2h
CORS_ORIGINES=
TAILLE_MAX_CORPS=100kb
```

`JWT_SECRET` doit faire au moins 32 caractères. Le serveur refuse de démarrer sinon.

## Journalisation

Chaque requête reçue est affichée dans le terminal avec la méthode, l'URL, le code de statut
et la durée. Les connexions Socket.IO sont également journalisées :

```
MongoDB : connecté
HTTP + Socket.IO sur http://localhost:3000  [development]
GET /api/alertes?page=1&limit=10 401 (21ms)
POST /api/auth/connexion 200 (366ms)
socket+ z9xRukLMMzBKIWkPAAAD (administrateur)
GET /api/alertes?page=1&limit=10 200 (157ms)
PATCH /api/alertes/6a1fb098d709bf943ac39df3/resolue 200 (97ms)
GET /api/alertes?page=1&limit=10 200 (40ms)
GET /api/statistiques 200 (30ms)
DELETE /api/alertes/6a1fb09dd709bf943ac39dfd 200 (86ms)
GET /api/alertes?page=1&limit=10 200 (41ms)
```
