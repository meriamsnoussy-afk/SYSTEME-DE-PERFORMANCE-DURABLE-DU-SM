# Systeme de Performance Durable du SM

Plateforme web statique fonctionnelle pour audit collaboratif, reception des reponses employes, pilotage, SWOT, plan d'action et rapport global.

## Fonctionnement interconnecte en reseau

Cette version contient un serveur inclus (`server.js`). Il centralise les reponses des employes dans:

```text
data/server-state.json
```

Lancer le serveur depuis le dossier `plateforme`:

```powershell
node server.js
```

Le terminal affiche deux types d'adresses:

```text
http://localhost:8770/
http://ADRESSE-IP-DU-PC:8770/
```

Si le port `8770` est deja occupe, lancer par exemple:

```powershell
$env:PORT=8780
node server.js
```

Puis ouvrir:

```text
http://ADRESSE-IP-DU-PC:8780/
```

Les autres PC du meme reseau doivent ouvrir l'adresse IP, par exemple:

```text
http://192.168.1.20:8770/
```

Le PC qui lance `server.js` devient le serveur central. Les reponses saisies par les employes sur les autres PC arrivent automatiquement dans `Reception reponses`.

## Pour un lien qui marche depuis tout ordinateur

Un lien `127.0.0.1` ne peut jamais etre partage avec les employes: il designe toujours l'ordinateur de la personne qui l'ouvre.

Un lien `192.168.x.x` fonctionne uniquement sur le meme reseau local.

Pour un lien partageable avec tout ordinateur, il faut deployer la plateforme sur internet ou utiliser un tunnel public. Voir:

```text
DEPLOIEMENT-PUBLIC.md
```

## Droits d'acces

- `Employe / repondeur`: voit uniquement les questionnaires ISO 9001, ISO 56001, Limites du SM et ses propres reponses.
- `Administrateur`: voit toutes les reponses, le tableau de bord, SWOT, plan d'action, rapport, sources et actualisation.

## Fonctionnement metier

1. L'employe saisit son nom et sa fonction.
2. La plateforme affiche uniquement les questions liees a cette fonction.
3. L'employe renseigne sa reponse, le test NC, l'observation et l'action proposee.
4. En cliquant sur `Enregistrer la reponse`, la reponse apparait dans `Reception reponses`.
5. Les modules suivants se recalculent automatiquement:
   - tableau de bord;
   - maturite par referentiel;
   - SWOT intelligent;
   - plan d'action;
   - rapport global;
   - priorisation.

Si `server.js` n'est pas lance, la plateforme fonctionne en mode local. Dans ce cas, utiliser `Exporter reponses` et `Importer reponses`.

## Actualiser les fichiers a tout moment

- Barre laterale: `Remplacer Excel` pour charger un nouveau questionnaire.
- Page `Sources / MAJ`: remplacer les PDF ISO.
- Page `Sources / MAJ`: exporter/importer une sauvegarde complete.

## Lancer la plateforme

Depuis le dossier `plateforme`, utiliser de preference:

```powershell
node server.js
```

Puis ouvrir:

```text
http://127.0.0.1:8770/
```

## Inclus

- 311 questions d'audit extraites du fichier Excel v1.
- 45 questions de limites du SM.
- 8 fonctions/roles.
- Reception des reponses employes.
- Export/import des reponses JSON.
- Export/import sauvegarde complete.
- SWOT, actions et rapport recalcules automatiquement.
- Manuel utilisateur Word telechargeable.
