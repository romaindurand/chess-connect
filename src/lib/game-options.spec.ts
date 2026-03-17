import { describe, expect, it } from 'vitest';
import { listNonDefaultGameOptions } from '$lib/game-options';

const format = (key: string, values?: Record<string, unknown>): string => {
	if (key === 'options.minutes') {
		return `${values?.value} min`;
	}
	if (key === 'options.seconds') {
		return `${values?.value} s`;
	}
	const labels: Record<string, string> = {
		'options.opponentType': "Type d'adversaire",
		'options.hostColor': 'Couleur choisie',
		'options.aiDifficulty': 'Niveau IA',
		'options.ai': 'IA',
		'options.human': 'Humain',
		'options.white': 'Blanc',
		'options.black': 'Noir',
		'options.random': 'Aléatoire',
		'options.yes': 'Oui',
		'options.no': 'Non',
		'options.none': 'Aucun'
	};
	return labels[key] ?? key;
};

describe('game options listing', () => {
	it('returns only non-default options', () => {
		expect(listNonDefaultGameOptions({ timeLimitMinutes: null }, format)).toEqual([]);
		expect(listNonDefaultGameOptions({ timeLimitMinutes: 5 }, format)).toEqual([
			'Time limit minutes: 5 min'
		]);
	});

	it('includes future options automatically when not at default', () => {
		const options = {
			timeLimitMinutes: null,
			allowTakeback: true,
			maxHints: 3
		};
		expect(listNonDefaultGameOptions(options, format)).toEqual([
			'Allow takeback: Oui',
			'Max hints: 3'
		]);
	});

	it('formats AI creation options when they differ from defaults', () => {
		expect(
			listNonDefaultGameOptions(
				{
					timeLimitMinutes: null,
					opponentType: 'ai',
					hostColor: 'black'
				},
				format
			)
		).toEqual(["Type d'adversaire: IA", 'Couleur choisie: Noir']);
	});
});
