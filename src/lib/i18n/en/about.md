The game idea isn't mine — it was [auroralipper on Instagram](https://www.instagram.com/auroralipper) who presented it in a reel (https://www.instagram.com/reels/DS8w4FaiMN6/).

For the tech stack, I used SvelteKit for the frontend and Prisma with SQLite for data persistence (authentication accounts). SvelteKit remote functions for client-to-server calls, SSE for real-time updates, and TensorFlow.js for the AI engine.

The main feature that drove me to build this project was creating a computer opponent to play against as a way to learn deep learning. I fully understand the aversion that "AI" generally provokes, but this is not a generative AI or an LLM like ChatGPT.

Concerns such as:

- energy consumed for training
- energy consumed for inference
- training data

are quite far from the reality of this project:

- training was done on my personal computer
- inference is very lightweight in terms of resources; the project is hosted on a dedibox, which is roughly the equivalent of a large Raspberry Pi
- the model is mainly trained on games against itself, plus a few games that players agree to share for AI training (an option that can be toggled before starting a game)

The AI is based on an implementation of the Monte Carlo Tree Search (MCTS) algorithm with a neural network for position evaluation, inspired by the approach used by AlphaZero.
