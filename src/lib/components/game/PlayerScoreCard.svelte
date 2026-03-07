<script lang="ts">
	interface Props {
		whiteName: string;
		blackName: string;
		whiteScore: number;
		blackScore: number;
		hasTimeControl: boolean;
		timeControlPerPlayerSeconds: number | null;
		whiteTimeRemainingMs: number | null;
		blackTimeRemainingMs: number | null;
		activeTurn: 'white' | 'black';
	}

	let {
		whiteName,
		blackName,
		whiteScore,
		blackScore,
		hasTimeControl,
		timeControlPerPlayerSeconds,
		whiteTimeRemainingMs,
		blackTimeRemainingMs,
		activeTurn
	}: Props = $props();

	function formatClock(ms: number | null): string {
		if (ms === null) {
			return '--:--';
		}
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	function formatInitialControl(seconds: number | null): string {
		if (seconds === null) {
			return '--:--';
		}
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}
</script>

<section class="mb-4 rounded border p-3 text-sm">
	{#if hasTimeControl}
		<p class="mb-2 text-xs text-gray-600">Cadence: {formatInitialControl(timeControlPerPlayerSeconds)} / joueur</p>
	{/if}

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<div class={`rounded border px-3 py-2 ${activeTurn === 'white' ? 'border-black' : 'border-transparent'}`}>
			<p class="font-medium">Blanc - {whiteScore}</p>
			<p class="text-gray-700">{whiteName}</p>
		{#if hasTimeControl}
				<p class={`mt-1 font-mono text-xs ${activeTurn === 'white' ? 'font-semibold text-black' : 'text-gray-700'}`}>
				{formatClock(whiteTimeRemainingMs)}
			</p>
		{/if}
		</div>
		<div class={`rounded border px-3 py-2 ${activeTurn === 'black' ? 'border-black' : 'border-transparent'}`}>
			<p class="font-medium">Noir - {blackScore}</p>
			<p class="text-gray-700">{blackName}</p>
		{#if hasTimeControl}
				<p class={`mt-1 font-mono text-xs ${activeTurn === 'black' ? 'font-semibold text-black' : 'text-gray-700'}`}>
				{formatClock(blackTimeRemainingMs)}
			</p>
		{/if}
		</div>
	</div>
</section>
