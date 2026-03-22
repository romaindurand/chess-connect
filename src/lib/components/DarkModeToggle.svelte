<script lang="ts">
	import { onMount } from 'svelte';
	import { Moon, Sun } from '@lucide/svelte';
	import { getDarkModePreference, setDarkModePreference } from '$lib/client/dark-mode-storage';

	let isDarkMode = $state(false);

	onMount(() => {
		// Initialiser dengan la préférence sauvegardée (côté client uniquement)
		isDarkMode = getDarkModePreference();
	});

	/**
	 * Bascule le mode dark/light et met à jour le DOM et localStorage
	 */
	function toggleDarkMode() {
		isDarkMode = !isDarkMode;
		setDarkModePreference(isDarkMode);

		// Appliquer/supprimer la classe 'dark' sur l'élément racine HTML
		if (isDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}
</script>

<button
	onclick={toggleDarkMode}
	class="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
	aria-label={isDarkMode ? 'Passer au mode clair' : 'Passer au mode sombre'}
	title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
>
	{#if isDarkMode}
		<Sun size={20} />
	{:else}
		<Moon size={20} />
	{/if}
</button>
