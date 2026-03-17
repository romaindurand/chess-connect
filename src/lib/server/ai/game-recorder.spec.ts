import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import type { GameState } from '$lib/types/game';

import { extractMovesFromHistory, recordCompletedGame } from './game-recorder';
import { makeActiveState } from './test-helpers';

describe('game recorder', () => {
	it('extracts place and move actions from move history', () => {
		const state = makeActiveState() as GameState;
		state.moveHistory = [
			{
				ply: 1,
				notation: '1. R@A1',
				before: {
					board: state.board,
					reserves: state.reserves,
					turn: 'white',
					pliesPlayed: 0,
					status: 'active',
					winner: null
				},
				after: {
					board: state.board,
					reserves: state.reserves,
					turn: 'black',
					pliesPlayed: 1,
					status: 'active',
					winner: null
				},
				transition: {
					moverColor: 'white',
					toBoard: { x: 0, y: 0 },
					fromReserve: { owner: 'white', piece: 'rook' },
					sound: 'move'
				}
			},
			{
				ply: 2,
				notation: '1... NA2-B4',
				before: {
					board: state.board,
					reserves: state.reserves,
					turn: 'black',
					pliesPlayed: 1,
					status: 'active',
					winner: null
				},
				after: {
					board: state.board,
					reserves: state.reserves,
					turn: 'white',
					pliesPlayed: 2,
					status: 'active',
					winner: null
				},
				transition: {
					moverColor: 'black',
					fromBoard: { x: 0, y: 1 },
					toBoard: { x: 1, y: 3 },
					sound: 'move'
				}
			}
		];

		const moves = extractMovesFromHistory(state);
		expect(moves).toHaveLength(2);
		expect(moves[0]).toEqual({
			color: 'white',
			move: { kind: 'place', piece: 'rook', to: { x: 0, y: 0 } }
		});
		expect(moves[1]).toEqual({
			color: 'black',
			move: { kind: 'move', from: { x: 0, y: 1 }, to: { x: 1, y: 3 } }
		});
	});

	it('does not record rounds when training consent is disabled', () => {
		const state = makeFinishedState();
		state.options.allowAiTrainingData = false;

		const outputPath = join(mkdtempSync(join(tmpdir(), 'chess-connect-')), 'games.jsonl');
		recordCompletedGame(state, outputPath);

		expect(existsSync(outputPath)).toBe(false);
	});

	it('records completed rounds when training consent is enabled', () => {
		const state = makeFinishedState();
		state.options.allowAiTrainingData = true;

		const outputPath = join(mkdtempSync(join(tmpdir(), 'chess-connect-')), 'games.jsonl');
		recordCompletedGame(state, outputPath);

		expect(existsSync(outputPath)).toBe(true);
		const lines = readFileSync(outputPath, 'utf8').trim().split('\n');
		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0]).id).toBe(`${state.id}-g${state.gameNumber}`);
	});
});

function makeFinishedState(): GameState {
	const state = makeActiveState();
	state.status = 'finished';
	state.winner = 'white';
	state.lastActivityAt = Date.now();
	state.moveHistory = [
		{
			ply: 1,
			notation: '1. R@A1',
			before: {
				board: state.board,
				reserves: state.reserves,
				turn: 'white',
				pliesPlayed: 0,
				status: 'active',
				winner: null
			},
			after: {
				board: state.board,
				reserves: state.reserves,
				turn: 'black',
				pliesPlayed: 1,
				status: 'finished',
				winner: 'white'
			},
			transition: {
				moverColor: 'white',
				toBoard: { x: 0, y: 0 },
				fromReserve: { owner: 'white', piece: 'rook' },
				sound: 'move'
			}
		}
	];
	return state;
}
