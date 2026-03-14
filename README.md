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

Le moteur IA utilise MCTS (Monte-Carlo Tree Search, 100 simulations par coup) avec un fast-path de détection de coup gagnant immédiat.

### Scripts d'entraînement

```bash
# Générer des parties d'auto-jeu et écrire un artefact JSON
pnpm ai:self-play [-- --games=20 --max-plies=200]

# Lire un artefact existant et lancer une passe d'entraînement
pnpm ai:train [-- --input=artifacts/ai/artifact.json --output=artifacts/ai/trained.json]

# Enchaîner auto-jeu + entraînement en boucle
pnpm ai:auto-train [-- --games=20 --max-plies=200]
```

Les artefacts sont écrits dans `artifacts/ai/`. L'architecture est conçue pour être étendue vers un réseau de valeur/politique (style AlphaZero) via TensorFlow.js.
