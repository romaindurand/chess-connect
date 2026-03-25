# Chess Connect

Chess Connect is a turn-based multiplayer game that combines chess and connect four. Players take turns placing their pieces on a chessboard, aiming to connect four of their pieces in a row while also trying to outmaneuver their opponent with chess-like strategies.

This is a SvelteKit application that serves as the frontend and backend for the game. The server manages game state, player interactions, and real-time updates, while the client provides an interactive interface for players to enjoy the game.

This project is mostly a playground for me to experiment with SvelteKit and local-llms.

## Installation

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Create a `.env` file based on `.env.example`
4. Run `pnpm prisma:generate` to generate the Prisma client
5. Apply database migrations: `pnpm prisma:migrate:deploy`
6. Start the development server: `pnpm dev`

## TODO

- [x] animation des pieces
- [x] son des pieces
- [x] historique
- [x] coordonnées des cases
- [x] pas de coups qui se répètent
- [x] créer un ordinateur
- [x] couleurs alternées pour la revanche
- [x] choix noir/blanc dans les options
- [x] n'importe quel joueur doit pouvoir proposer une revanche
- [x] internationalisation
- [x] ne pas limiter à un BO3, rendre le nombre de parties configurable
- [x] création de compte avec token d'auth (pas de login/password, juste un token généré aléatoirement à la création du compte)
- [x] permettre de refuser l'utilisation de sa partie pour l'entraînement de l'ordinateur
- [x] permettre le choix de la couleur en joueur contre joueur (pas juste en joueur contre ordinateur)
- [x] en temps limité, ajouter une option qui ajoute des secondes à chaque coup joué (ex: 30s + 10s par coup)
- [x] pour le temps limité, permettre de préciser les secondes (pour le moment on ne gère que les minites)
- [x] matchmaking
- [x] dark mode
- [x] drag&drop des pieces
- [x] animation scroll de victoire
- [x] son pour partie ranked trouvée
- [x] permettre la sélection d'une piece, même quand ce n'est pas son tour
- [x] rendre le bouton d'historique plus visible + status activé/désactivé
- [x] ajouter une confirmation visuelle quand on copie le lien de la partie
- [x] ajouter des crédits pour la vidéo (https://www.instagram.com/reels/DS8w4FaiMN6/)
- [x] réécrire les règles du jeu en s'inspirant plus de cette vidéo
- [x] ajouter des paramètres (son du jeu, langue, règles, à propos, etc.)
- [x] repenser l'ergonomie des différents menus
- [ ] système d'achievements
- [ ] déplacer les messages d'erreur à un endroit plus adapté

Idées d'achievements:

- "Initiative" : gagner une partie en jouant le premier coup
- "Pas si vite" : bloquer avec une de ses pièces un aligment adverse de 3 pièces
- "Inarrêtable" : gagner une partie sans que l'adversaire puisse aligner plus de 2 pièces
- "Maître des lignes" : avoir gagné au moins une partie sur chacune des lignes (1, 2, 3, 4)
- "Maître des colonnes" : avoir gagné au moins une partie sur chacune des colonnes (A, B, C, D)
- "Maître des diagonales" : avoir gagné au moins une partie sur chacune des diagonales (A1-D4, A4-D1)
- "IA bully" : gagner 10 parties contre l'ordinateur
- "IA destroyer" : gagner 100 parties contre l'ordinateur
- "IA annihilator" : gagner 1000 parties contre l'ordinateur
- "Marathonien" : jouer 100 parties (peu importe le résultat)
- "Marathonien ultime" : jouer 1000 parties (peu importe le résultat)
- "Revanche !" : gagner une partie contre le même adversaire après avoir perdu contre lui
- "Belle !" : gagner la belle après avoir perdu un match, gagné la revanche, puis gagné la belle (BO3)
- "Collectionneur" : débloquer tous les achievements précédents
- "Contributeur" : jouer plus de 10 parties avec l'option d'enregistrement pour l'entraînement de l'IA activée (contribution au dataset d'entraînement)
- "Philanthrope" : jouer plus de 100 parties avec l'option d'enregistrement pour l'entraînement de l'IA activée (contribution au dataset d'entraînement)

## Base de donnees (SQLite)

La persistance des comptes d'authentification utilise Prisma avec SQLite.

- En dev: `DATABASE_URL="file:./dev.db"` (fichier cree dans le dossier `prisma/`)
- En prod: definir `DATABASE_URL` vers un fichier persistant, par exemple `file:/var/lib/chess-connect/prod.db`

Appliquer les migrations:

```bash
pnpm prisma:migrate:deploy
```

En local, creer/appliquer une migration de dev:

```bash
pnpm prisma:migrate:dev -- --name init-auth
```

## IA

### Jouer contre l'ordinateur

Sur la page d'accueil, sélectionner **"Contre l'ordinateur"** puis choisir la couleur souhaitée (Blanc / Noir / Aléatoire) avant de créer la partie.

Le moteur IA utilise MCTS (Monte-Carlo Tree Search) guidé par un réseau conv-résiduel (style AlphaZero-lite) chargé depuis un checkpoint TensorFlow.js au démarrage du serveur.  
Sans checkpoint, le serveur refuse de démarrer — voir section _Entraînement_ ci-dessous.

### Entraînement

Le serveur nécessite un checkpoint `checkpoints/model/model.json` au démarrage. Ce checkpoint n'est pas inclus dans git et doit être généré localement.

**Pipeline requis pour jouer contre l'ordinateur :**

```bash
# Récupérer les parties enregistrées depuis le serveur de prod
scp user@server:/path_to_chess_connect/artifacts/ai/recorded-games.jsonl ./artifacts/ai/recorded-games-prod.jsonl

# Générer des parties d'auto-jeu → artifacts/ai/self-play.json
pnpm ai:self-play -- --games=1000 --max-plies=128

# Reanalyser les parties enregistrées avec MCTS + fusion avec self-play pour enrichir le dataset d'entraînement
pnpm ai:reanalyse-games -- \
  --games=artifacts/ai/recorded-games.jsonl \
  --games=artifacts/ai/recorded-games-prod.jsonl \
  --base=artifacts/ai/self-play.json \
  --output=artifacts/ai/training-data.json	\
  --simulations=32

# Entraîner le réseau conv-résiduel → checkpoints/model/model.json
pnpm ai:train-network -- \
  --dataset=artifacts/ai/training-data.json \
	--output=checkpoints/model \
	--epochs=100 --batch=64

# Entrainer le réseau conv-résiduel sur le dataset de self-play uniquement (sans les parties humaines enregistrées)
pnpm ai:train-network -- \
	--dataset=artifacts/ai/self-play.json \
	--output=checkpoints/model \
	--epochs=100

# Envoi du model entraîné au serveur de prod (ex: via scp)
scp checkpoints/model/* user@server:/path_to_chess_connect/checkpoints/model/
```

Les deux scripts affichent une progression en temps réel avec estimation du temps restant.
`ai:train-network` affiche aussi l'avancement intra-époque (batch par batch) pour éviter les longues périodes sans sortie.

Pendant l'entraînement, le script écrit aussi la loss dans `checkpoints/model/training-loss.json`.
Pour visualiser la courbe en direct (et après entraînement), lancer:

```bash
pnpm ai:loss-dashboard -- --metrics=checkpoints/model/training-loss.json --port=4780
```

Puis ouvrir `http://localhost:4780`.

Le dashboard affiche:

- la loss batch (échantillonnée)
- la loss de fin d'époque
- un diagnostic automatique des tendances (plateau, divergence, variance)

Pour `ai:train-network`, le backend est en mode `auto` par défaut :

- tentative du backend natif `tensorflow` (`tfjs-node`, plus rapide)
- bascule automatique sur `cpu` si le backend natif n'est pas stable dans l'environnement courant

**Commandes auxiliaires (artefact de fréquences, hors checkpoint réseau) :**

```bash
# Enchaîner auto-jeu + construction de l'artefact de fréquences en une seule commande
# ⚠ Ne produit PAS le checkpoint réseau utilisé par le serveur
pnpm ai:auto-train [-- --games=64 --max-plies=64]

# Construire l'artefact de fréquences à partir d'un dataset existant (ou en générer un)
pnpm ai:train [-- --input=artifacts/ai/self-play.json]
```

Le checkpoint TF.js est lu depuis `checkpoints/model/` par défaut.  
Pour pointer vers un autre emplacement, définir la variable d'environnement :

```env
AI_CHECKPOINT_PATH=checkpoints/model
```

Les artefacts de self-play sont écrits dans `artifacts/ai/` (ignorés par git).  
Le dossier `checkpoints/model/` est également ignoré par git — il doit être généré localement ou fourni séparément.

### Réutiliser les parties humaines pour l'entraînement

Les parties terminées (joueur vs joueur et joueur vs ordinateur) peuvent être enregistrées automatiquement
dans un fichier JSONL local :

```env
AI_GAMES_PATH=artifacts/ai/recorded-games.jsonl
```

Chaque position rejouée est ensuite reanalysée avec MCTS pour produire une distribution complète
des coups (au lieu d'un simple one-hot du coup joué), puis fusionnée avec le dataset self-play.

```bash
# Reanalyse des parties enregistrées avec MCTS + fusion avec self-play
pnpm ai:reanalyse-games -- \
	--games=artifacts/ai/recorded-games.jsonl \
	--base=artifacts/ai/self-play.json \
	--output=artifacts/ai/training-data.json \
	--simulations=32

# Entraînement sur dataset fusionné
pnpm ai:train-network -- --dataset=artifacts/ai/training-data.json --output=checkpoints/model
```

Pour fusionner plusieurs sources (local + serveur de prod), répéter `--games` :

```bash
pnpm ai:reanalyse-games -- \
	--games=artifacts/ai/recorded-games.jsonl \
	--games=artifacts/ai/recorded-games-prod.jsonl \
	--base=artifacts/ai/self-play.json \
	--output=artifacts/ai/training-data.json
```

Options utiles :

- `--simulations=<n>` : budget MCTS par position pendant la reanalyse (défaut: 32)
- `--max-games=<n>` : limite le nombre de parties rejouées
- `--max-samples-per-game=<n>` : limite le nombre de positions extraites par partie
