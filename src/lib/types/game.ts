export const BOARD_SIZE = 4;

export type Color = 'white' | 'black';
export type HostColorPreference = Color | 'random';
export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop';
export type ViewerRole = Color | 'guest' | 'spectator';
export type GameStatus = 'waiting' | 'active' | 'finished';
export type OpponentType = 'human' | 'ai';
export type AiDifficulty = 'baseline';

export interface Coord {
	x: number;
	y: number;
}

export interface PieceOnBoard {
	type: PieceType;
	owner: Color;
	pawnDirection: 1 | -1;
}

export type Reserve = Record<PieceType, boolean>;

export interface PlayerInfo {
	name: string;
	joinedAt: number;
}

export interface PlayersByColor {
	white: PlayerInfo | null;
	black: PlayerInfo | null;
}

export interface MatchScore {
	host: number;
	guest: number;
}

export type GameOptionValue = string | number | boolean | null | undefined;

export interface GameOptions {
	timeLimitMinutes: number | null;
	roundLimit?: number | null;
	allowAiTrainingData?: boolean;
	opponentType?: OpponentType;
	hostColor?: HostColorPreference;
	aiDifficulty?: AiDifficulty;
	[key: string]: GameOptionValue;
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
	timeLimitMinutes: null,
	roundLimit: null,
	allowAiTrainingData: true,
	opponentType: 'human',
	hostColor: 'random',
	aiDifficulty: 'baseline'
};

export interface GameState {
	id: string;
	status: GameStatus;
	inviter: PlayerInfo;
	hostColor: Color | null;
	options: GameOptions;
	players: PlayersByColor;
	board: (PieceOnBoard | null)[][];
	reserves: Record<Color, Reserve>;
	turn: Color;
	pliesPlayed: number;
	winner: Color | null;
	bestOfWinner: Color | null;
	score: Record<Color, number>;
	matchScore: MatchScore;
	gameNumber: number;
	bestOf: number | null;
	timeControlEnabled: boolean;
	timeControlPerPlayerSeconds: number | null;
	timeRemainingMs: Record<Color, number> | null;
	turnStartedAt: number | null;
	moveHistory: MoveHistoryEntry[];
	rematchRequestedBy: Color | null;
	createdAt: number;
	lastActivityAt: number;
	version: number;
}

export interface HistorySnapshot {
	board: (PieceOnBoard | null)[][];
	reserves: Record<Color, Reserve>;
	turn: Color;
	pliesPlayed: number;
	status: GameStatus;
	winner: Color | null;
}

export interface MoveHistoryTransition {
	moverColor: Color;
	toBoard: Coord;
	fromBoard?: Coord;
	fromReserve?: { owner: Color; piece: PieceType };
	sound: 'move' | 'capture';
}

export interface MoveHistoryEntry {
	ply: number;
	notation: string;
	before: HistorySnapshot;
	after: HistorySnapshot;
	transition: MoveHistoryTransition;
}

export interface LegalOptions {
	byBoardFrom: Record<string, Coord[]>;
	byReservePiece: Record<PieceType, Coord[]>;
}

export interface GameView {
	state: GameState;
	viewerRole: ViewerRole;
	viewerColor: Color | null;
	viewerIsInviter: boolean;
	joinAllowed: boolean;
	legalOptions: LegalOptions;
	legalOptionsByColor: Record<Color, LegalOptions>;
}

export interface PlaceMove {
	kind: 'place';
	piece: PieceType;
	to: Coord;
}

export interface BoardMove {
	kind: 'move';
	from: Coord;
	to: Coord;
}

export type PlayerMove = PlaceMove | BoardMove;

export interface CreateGamePayload {
	name: string;
	timeLimitMinutes?: number;
	roundLimit?: number;
	allowAiTrainingData?: boolean;
	opponentType?: OpponentType;
	hostColor?: HostColorPreference;
	aiDifficulty?: AiDifficulty;
}

export interface CreateGameResponse {
	gameId: string;
	url: string;
	color: Color | null;
}

export interface JoinGamePayload {
	type: 'join';
	name: string;
}

export interface PlayMovePayload {
	type: 'play';
	move: PlayerMove;
}

export interface RematchRequestPayload {
	type: 'rematch-request';
}

export interface RematchAcceptPayload {
	type: 'rematch-accept';
}

export type GameActionPayload =
	| JoinGamePayload
	| PlayMovePayload
	| RematchRequestPayload
	| RematchAcceptPayload;

export interface ApiErrorPayload {
	error: string;
}

export interface SnapshotEvent {
	type: 'snapshot';
	game: GameView;
}

export interface KeepAliveEvent {
	type: 'keepalive';
	at: number;
}

export type ServerEvent = SnapshotEvent | KeepAliveEvent;

export const PIECES: PieceType[] = ['pawn', 'rook', 'knight', 'bishop'];

export function makeEmptyReserve(): Reserve {
	return {
		pawn: true,
		rook: true,
		knight: true,
		bishop: true
	};
}

export function coordKey(coord: Coord): string {
	return `${coord.x},${coord.y}`;
}

export function isInsideBoard(coord: Coord): boolean {
	return (
		Number.isInteger(coord.x) &&
		Number.isInteger(coord.y) &&
		coord.x >= 0 &&
		coord.y >= 0 &&
		coord.x < BOARD_SIZE &&
		coord.y < BOARD_SIZE
	);
}
