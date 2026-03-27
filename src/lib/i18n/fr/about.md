L'idée du jeu n'est pas de moi, c'est [auroralipper sur Instagram](https://www.instagram.com/auroralipper) qui a présenté l'idée dans un réel (https://www.instagram.com/reels/DS8w4FaiMN6/).

Pour la stack technique, j'ai utilisé SvelteKit pour le frontend et Prisma avec SQLite pour la persistance des données (comptes d'authentification). SvelteKit remote functions pour les appels des clients vers le serveur, SSE pour les mises à jour en temps réel et TensorFlow.js pour le moteur d'IA.

La principale fonctionnalité qui m'a poussé à faire ce projet était de pouvoir créer un ordinateur contre lequel jouer pour me former au deep learning. Je comprends tout à fait l'aversion que succitent "les IA" en général, mais il ne s'agit pas ici d'une IA générative ou d'un LLM comme chatGPT.

Les problématiques comme :

- l'énergie consommée pour l'entrainement
- l'énergie consommée pour pour l'inférence
- des données d'entrainement

sont assez éloignées de la réalité de ce projet :

- l'entraînement a été fait sur mon ordinateur personnel
- l'inférence est très peu gourmande en ressources, le projet est hébergé sur une dedibox, c'est l'équivalent d'un gros raspberry pi
- le modèle est principalement entrainé sur des parties contre lui même, et quelques parties que les joueurs acceptent de partager pour l'entrainement de l'IA (option activable/désactivable avant de lancer une partie)

L'IA est basée sur une implémentation de l'algorithme Monte Carlo Tree Search (MCTS) avec un réseau de neurones pour l'évaluation des positions, inspiré de l'approche utilisée par AlphaZero.
