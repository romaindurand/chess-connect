# Chess Connect

Chess Connect is a turn-based multiplayer game that combines chess and connect four. Players take turns placing their pieces on a chessboard, aiming to connect four of their pieces in a row while also trying to outmaneuver their opponent with chess-like strategies.

This is a SvelteKit application that serves as the frontend and backend for the game. The server manages game state, player interactions, and real-time updates, while the client provides an interactive interface for players to enjoy the game.

This project is mostly a playground for me to experiment with SvelteKit and local-llms.

## TODO

- [x] animation des pieces
- [x] son des pieces
- [x] historique
- [x] coordonnées des cases
- [x] pas de coups qui se répètent
- [x] créer une IA
- [ ] matchmaking
- [x] couleurs alternées pour la revanche
- [x] choix noir/blanc dans les options
- [x] n'importe quel joueur doit pouvoir proposer une revanche

## IA

### Jouer contre l'IA

Sur la page d'accueil, sélectionner **"Contre l'IA"** puis choisir la couleur souhaitée (Blanc / Noir / Aléatoire) avant de créer la partie.

Le moteur IA utilise MCTS (Monte-Carlo Tree Search) guidé par un réseau conv-résiduel (style AlphaZero-lite) chargé depuis un checkpoint TensorFlow.js au démarrage du serveur.  
Sans checkpoint, le serveur refuse de démarrer — voir section *Entraînement* ci-dessous.

### Entraînement

Le pipeline complet fonctionne en trois étapes :

```bash
# 1. Générer des parties d'auto-jeu → artifacts/ai/self-play.json
pnpm ai:self-play [-- --games=20 --max-plies=200]

# 2. Entraîner le réseau sur les parties générées → checkpoints/model/
pnpm ai:train-network [-- --input=artifacts/ai/self-play.json --output=checkpoints/model]

# 3. (ou) Enchaîner auto-jeu + entraînement statistique en boucle (heuristique sans réseau)
pnpm ai:auto-train [-- --games=20 --max-plies=200]
```

Le checkpoint TF.js est lu depuis `checkpoints/model/` par défaut.  
Pour pointer vers un autre emplacement, définir la variable d'environnement :

```env
AI_CHECKPOINT_PATH=checkpoints/model
```

Les artefacts de self-play sont écrits dans `artifacts/ai/` (ignorés par git).  
Le dossier `checkpoints/model/` est également ignoré par git — il doit être généré localement ou fourni séparément.
