# Deploiement public - lien partageable avec tous les employes

Le lien `http://127.0.0.1:8770/` est toujours local: il fonctionne uniquement sur le PC qui lance le serveur.

Le lien `http://192.168.x.x:8780/` fonctionne seulement sur le meme reseau local, si le pare-feu Windows autorise le port.

Pour qu'un employe puisse ouvrir la plateforme depuis n'importe quel ordinateur avec un vrai lien, il faut heberger la plateforme sur internet.

## Option recommandee: Render

1. Creer un compte sur:

```text
https://render.com
```

2. Creer un nouveau service:

```text
New + > Web Service
```

3. Envoyer ce dossier `plateforme` dans un depot GitHub, ou importer le dossier selon la methode Render disponible.

4. Parametres du service:

```text
Environment: Node
Build Command: npm install
Start Command: npm start
```

5. Render donnera un lien public, par exemple:

```text
https://systeme-performance-durable-sm.onrender.com
```

Ce lien est celui a envoyer aux employes.

## Important sur la conservation des reponses

La plateforme stocke les reponses dans:

```text
data/server-state.json
```

Sur certains hebergeurs gratuits, les fichiers peuvent etre remis a zero lors d'un redeploiement. Pour un usage professionnel durable, il faut ajouter:

- soit un disque persistant Render;
- soit une base de donnees;
- soit Supabase / PostgreSQL.

## Option temporaire: tunnel public

Si tu veux partager rapidement la plateforme lancee sur ton PC, tu peux utiliser un tunnel comme Cloudflare Tunnel ou ngrok.

Principe:

1. Lancer la plateforme:

```powershell
node server.js
```

2. Lancer le tunnel vers le port utilise, par exemple `8780`.

3. Le tunnel donne une URL publique `https://...`.

4. Envoyer cette URL aux employes.

Le PC doit rester allume et connecte. Si le PC s'eteint, le lien ne fonctionne plus.

## Resume simple

- Meme PC seulement: `http://127.0.0.1:8770/`
- Meme reseau Wi-Fi/Ethernet: `http://192.168.x.x:8780/`
- Tout ordinateur / internet: hebergement public ou tunnel public

