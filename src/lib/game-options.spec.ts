import { describe, expect, it } from 'vitest';
import { listNonDefaultGameOptions } from '$lib/game-options';

const format = (key: string, values?: Record<string, unknown>): string => {
	if (key === 'options.minutes') {
		return `${values?.value} min`;
	}
	if (key === 'options.seconds') {
		return `${values?.value} s`;
	}
	if (key === 'options.rounds') {
		return `${values?.value} manches`;
	}
	if (key === 'options.timeLimit') {
		return 'Limit de temps';
	}
	const labels: Record<string, string> = {
		'options.opponentType': "Type d'adversaire",
		'options.hostColor': 'Couleur choisie',
		'options.aiDifficulty': 'Niveau ordinateur',
		'options.roundLimit': 'Nombre de manches',
		'options.allowAiTrainingData': "Parties utilisées pour entraîner l'ordinateur",
		'options.ai': 'Ordinateur',
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
		expect(listNonDefaultGameOptions({ timeLimitSeconds: null }, format)).toEqual([]);
		expect(listNonDefaultGameOptions({ timeLimitSeconds: 300 }, format)).toEqual([
			'Limit de temps: 5:00'
		]);
	});

	it('includes future options automatically when not at default', () => {
		const options = {
			timeLimitSeconds: null,
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
					timeLimitSeconds: null,
					opponentType: 'ai',
					hostColor: 'black'
				},
				format
			)
		).toEqual(["Type d'adversaire: Ordinateur", 'Couleur choisie: Noir']);
	});

	it('includes odd round limit when configured', () => {
		expect(listNonDefaultGameOptions({ timeLimitSeconds: null, roundLimit: 5 }, format)).toEqual([
			'Nombre de manches: 5 manches'
		]);
	});

	it('shows training consent option only when disabled', () => {
		expect(
			listNonDefaultGameOptions({ timeLimitSeconds: null, allowAiTrainingData: false }, format)
		).toEqual(["Parties utilisées pour entraîner l'ordinateur: Non"]);
	});
});
