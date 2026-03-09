const PLAYER_NAME_STORAGE_KEY = 'chess-connect.player-name';

type NameStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getStorage(): NameStorage | null {
	if (typeof window === 'undefined') {
		return null;
	}
	return window.localStorage;
}

export function loadPlayerName(storage: NameStorage | null = getStorage()): string {
	if (!storage) {
		return '';
	}
	const value = storage.getItem(PLAYER_NAME_STORAGE_KEY);
	if (!value) {
		return '';
	}
	return value.trim().slice(0, 24);
}

export function savePlayerName(name: string, storage: NameStorage | null = getStorage()): void {
	if (!storage) {
		return;
	}
	const trimmed = name.trim().slice(0, 24);
	if (trimmed.length === 0) {
		return;
	}
	storage.setItem(PLAYER_NAME_STORAGE_KEY, trimmed);
}
