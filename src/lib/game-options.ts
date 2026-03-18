import { DEFAULT_GAME_OPTIONS, type GameOptions, type GameOptionValue } from '$lib/types/game';

type OptionFormatter = (key: string, values?: Record<string, unknown>) => string;

function humanizeOptionKey(key: string, format: OptionFormatter): string {
	if (key === 'opponentType') {
		return format('options.opponentType');
	}
	if (key === 'hostColor') {
		return format('options.hostColor');
	}
	if (key === 'aiDifficulty') {
		return format('options.aiDifficulty');
	}
	if (key === 'roundLimit') {
		return format('options.roundLimit');
	}
	if (key === 'timeLimitSeconds') {
		return format('options.timeLimit');
	}
	if (key === 'incrementPerMoveSeconds') {
		return format('options.incrementPerMove');
	}
	if (key === 'allowAiTrainingData') {
		return format('options.allowAiTrainingData');
	}

	const withSpaces = key
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/_/g, ' ')
		.toLowerCase();
	return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatOptionValue(key: string, value: GameOptionValue, format: OptionFormatter): string {
	if (key === 'opponentType' && typeof value === 'string') {
		return value === 'ai' ? format('options.ai') : format('options.human');
	}
	if (key === 'hostColor' && typeof value === 'string') {
		if (value === 'white') {
			return format('options.white');
		}
		if (value === 'black') {
			return format('options.black');
		}
		return format('options.random');
	}
	if (key === 'aiDifficulty' && typeof value === 'string') {
		return value === 'baseline' ? 'Baseline' : value;
	}
	if (key === 'roundLimit' && typeof value === 'number') {
		return format('options.rounds', { value });
	}
	if (key === 'timeLimitSeconds' && typeof value === 'number') {
		const minutes = Math.floor(value / 60);
		const seconds = value % 60;
		return `${minutes}:${String(seconds).padStart(2, '0')}`;
	}
	if (key === 'incrementPerMoveSeconds' && typeof value === 'number') {
		return format('options.seconds', { value });
	}

	if (typeof value === 'boolean') {
		return value ? format('options.yes') : format('options.no');
	}
	if (typeof value === 'number') {
		if (key.toLowerCase().includes('minutes')) {
			return format('options.minutes', { value });
		}
		if (key.toLowerCase().includes('seconds')) {
			return format('options.seconds', { value });
		}
		return String(value);
	}
	if (value === null) {
		return format('options.none');
	}
	return value ?? '';
}

export function listInvitationGameOptions(
	options: GameOptions,
	format: OptionFormatter = (key) => key
): string[] {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(options)) {
		if (value === undefined) {
			continue;
		}
		// Skip opponentType when it's 'human' (obvious context for invitations)
		if (key === 'opponentType' && value === 'human') {
			continue;
		}
		// Skip aiDifficulty for human-vs-human games
		if (key === 'aiDifficulty' && options.opponentType === 'human') {
			continue;
		}
		// Increment is only meaningful for timed games
		if (key === 'incrementPerMoveSeconds' && options.timeLimitSeconds === null) {
			continue;
		}
		lines.push(`${humanizeOptionKey(key, format)}: ${formatOptionValue(key, value, format)}`);
	}
	return lines;
}

export function listNonDefaultGameOptions(
	options: GameOptions,
	format: OptionFormatter = (key) => key
): string[] {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(options)) {
		const defaultValue = (DEFAULT_GAME_OPTIONS[key] ?? null) as GameOptionValue;
		if (Object.is(value, defaultValue)) {
			continue;
		}
		if (value === undefined) {
			continue;
		}
		lines.push(`${humanizeOptionKey(key, format)}: ${formatOptionValue(key, value, format)}`);
	}
	return lines;
}
