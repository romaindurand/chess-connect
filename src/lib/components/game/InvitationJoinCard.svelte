<script lang="ts">
	interface Props {
		inviterName: string;
		onJoin: (name: string) => Promise<boolean>;
	}

	let { inviterName, onJoin }: Props = $props();

	let name = $state('');

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const success = await onJoin(name);
		if (success) {
			name = '';
		}
	}
</script>

<form class="mb-4 flex flex-wrap items-end gap-3 rounded border p-3" onsubmit={submit}>
	<p class="w-full text-sm text-gray-700">
		Invitation en attente — {inviterName} vous invite à rejoindre la partie.
	</p>
	<label class="grow space-y-2">
		<span class="text-sm font-medium">Votre pseudo</span>
		<input
			class="w-full rounded border border-gray-300 px-3 py-2"
			type="text"
			bind:value={name}
			maxlength="24"
			required
		/>
	</label>
	<button class="rounded bg-black px-3 py-2 text-white" type="submit">Accepter l'invitation</button>
</form>
