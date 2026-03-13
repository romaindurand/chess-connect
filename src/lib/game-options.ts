import { DEFAULT_GAME_OPTIONS, type GameOptions, type GameOptionValue } from '$lib/types/game';

function humanizeOptionKey(key: string): string {
	if (key === 'opponentType') {
		return "Type d'adversaire";
	}
	if (key === 'hostColor') {
		return 'Couleur choisie';
	}
	if (key === 'aiDifficulty') {
		return 'Niveau IA';
	}

	const withSpaces = key
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/_/g, ' ')
		.toLowerCase();
	return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatOptionValue(key: string, value: GameOptionValue): string {
	if (key === 'opponentType' && typeof value === 'string') {
		return value === 'ai' ? 'IA' : 'Humain';
	}
	if (key === 'hostColor' && typeof value === 'string') {
		if (value === 'white') {
			return 'Blanc';
		}
		if (value === 'black') {
			return 'Noir';
		}
		return 'Aléatoire';
	}
	if (key === 'aiDifficulty' && typeof value === 'string') {
		return value === 'baseline' ? 'Baseline' : value;
	}

	if (typeof value === 'boolean') {
		return value ? 'Oui' : 'Non';
	}
	if (typeof value === 'number') {
		if (key.toLowerCase().includes('minutes')) {
			return `${value} min`;
		}
		if (key.toLowerCase().includes('seconds')) {
			return `${value} s`;
		}
		return String(value);
	}
	if (value === null) {
		return 'Aucun';
	}
	return value ?? '';
}

export function listNonDefaultGameOptions(options: GameOptions): string[] {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(options)) {
		const defaultValue = (DEFAULT_GAME_OPTIONS[key] ?? null) as GameOptionValue;
		if (Object.is(value, defaultValue)) {
			continue;
		}
		if (value === undefined) {
			continue;
		}
		lines.push(`${humanizeOptionKey(key)}: ${formatOptionValue(key, value)}`);
	}
	return lines;
}
