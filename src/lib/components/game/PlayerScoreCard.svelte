<script lang="ts">
	interface Props {
		whiteName: string;
		blackName: string;
		whiteScore: number;
		blackScore: number;
	}

	let { whiteName, blackName, whiteScore, blackScore }: Props = $props();
</script>

<section class="mb-4 grid grid-cols-2 gap-3 rounded border p-3 text-sm">
	<div>
		<p class="font-medium">Blanc - {whiteScore}</p>
		<p>{whiteName}</p>
	</div>
	<div>
		<p class="font-medium">Noir - {blackScore}</p>
		<p>{blackName}</p>
	</div>
</section>
