# Agent IoT simulé — Station météo

## Description

Ce programme simule un réseau de stations météo connectées.
Il lit en continu des capteurs simulés (température, humidité, pression,
vent, précipitations) et publie automatiquement une alerte sur le serveur
dès qu'une valeur dépasse les seuils configurés.

## Prérequis

- Node.js 18 ou plus (pour fetch natif)
- Le serveur `station-meteo-serveur` doit être démarré
- Le compte `agent@cours.qc.ca` doit exister dans la base (créé par `npm run seed`)

## Démarrage

```
node publier.js
```

Aucun `npm install` n'est nécessaire. Ce programme n'a aucune dépendance externe.

## Fonctionnement

1. Au démarrage, l'agent s'authentifie avec `agent@cours.qc.ca` / `Motdepasse1!`.
2. Toutes les 5 secondes, il lit les 5 capteurs simulés.
3. Pour chaque capteur, si la valeur est dans les seuils, rien n'est publié.
4. Si la valeur est hors des seuils, une alerte est publiée sur `POST /api/alertes`.

## Capteurs simulés

| Capteur            | Station             | Seuil min | Seuil max | Unité |
|--------------------|---------------------|-----------|-----------|-------|
| temperature        | Montreal-Nord       | 0         | 32        | C     |
| humidite           | Laval-Sud           | 25        | 90        | %     |
| pression           | Longueuil-Est       | 990       | 1030      | hPa   |
| vent               | Montreal-Nord       | 0         | 70        | km/h  |
| precipitations     | Laval-Sud           | 0         | 30        | mm/h  |

## Calcul du niveau d'alerte

Le niveau dépend de l'écart entre la valeur mesurée et le seuil le plus proche,
ramené à la demi-plage des seuils :

- écart inférieur à 25% de la demi-plage : "info"
- écart entre 25% et 75% : "avertissement"
- écart supérieur à 75% : "critique"

## Gestion des erreurs

- **Jeton expiré (401)** : l'agent se reconnecte automatiquement et réessaie.
- **Erreur réseau** : l'agent réessaie jusqu'à 3 fois à 2 secondes d'intervalle.
  Après 3 échecs, la publication est abandonnée et le cycle continue.

## Exemple de sortie console

```
Simulateur agent IoT -- démarrage...
Connecté en tant que agent@cours.qc.ca.
5 capteurs simulés.
Cycle de lecture toutes les 5000 ms. Ctrl+C pour arrêter.

  [OK]    temperature    Station Montreal-Nord    =    24.3 C
  [OK]    humidite       Station Laval-Sud         =      67 %
  [ALERT] pression       Station Longueuil-Est     =     982 hPa  -> avertissement
  [OK]    vent           Station Montreal-Nord    =      45 km/h
  [ALERT] precipitations Station Laval-Sud         =    38.2 mm/h -> critique
```
