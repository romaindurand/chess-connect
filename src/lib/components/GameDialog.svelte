<script lang="ts">
	import type { Snippet } from 'svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		open: boolean;
		title?: string;
		closable?: boolean;
		onClose?: () => void;
		children?: Snippet;
	}

	let { open, title = '', closable = true, onClose = () => {}, children }: Props = $props();

	function requestClose(): void {
		if (!closable) {
			return;
		}
		onClose();
	}

	function onCancel(event: Event): void {
		if (!closable) {
			event.preventDefault();
			return;
		}
		event.preventDefault();
		onClose();
	}

	function onDialogClick(event: MouseEvent): void {
		if (!closable) {
			return;
		}
		if (event.target === event.currentTarget) {
			onClose();
		}
	}
</script>

{#if open}
	<dialog
		open
		oncancel={onCancel}
		onclick={onDialogClick}
		class="fixed inset-0 z-50 m-0 flex h-screen w-screen max-w-none items-center justify-center bg-black/50 p-4 dark:bg-black/70"
	>
		<div
			class="w-full max-w-md rounded-lg border border-gray-300 bg-white p-6 text-left shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<div class="flex items-start justify-between gap-3">
				{#if title}
					<h2 class="text-xl font-semibold">{title}</h2>
				{/if}
				{#if closable}
					<button
						type="button"
						onclick={requestClose}
						class="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:text-gray-200"
						>{$_('common.close')}</button
					>
				{/if}
			</div>

			<div class="mt-2 text-sm text-gray-700 dark:text-gray-300">
				{@render children?.()}
			</div>
		</div>
	</dialog>
{/if}
