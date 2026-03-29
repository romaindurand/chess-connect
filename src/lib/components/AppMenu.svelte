<script lang="ts">
	import { onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import { Menu, X, Volume2, VolumeX, ChevronDown, Moon, Sun } from '@lucide/svelte';
	import GameDialog from './GameDialog.svelte';
	import { getSoundPreference, setSoundPreference } from '$lib/client/sound-storage';
	import { getDarkModePreference, setDarkModePreference } from '$lib/client/dark-mode-storage';
	import { isSupportedLanguage, setLanguage, type SupportedLanguage } from '$lib/i18n';
	import RulesEn from '$lib/i18n/en/rules.md';
	import RulesFr from '$lib/i18n/fr/rules.md';
	import AboutEn from '$lib/i18n/en/about.md';
	import AboutFr from '$lib/i18n/fr/about.md';
	import ChangelogEn from '$lib/i18n/en/changelog.md';
	import ChangelogFr from '$lib/i18n/fr/changelog.md';
	import { fade, fly } from 'svelte/transition';

	type ActiveModal = 'rules' | 'about' | 'changelog' | null;

	let menuOpen = $state(false);
	let activeModal = $state<ActiveModal>(null);
	let soundEnabled = $state(true);
	let isDarkMode = $state(false);
	let isDesktop = $state(false);
	const languageLabels: Record<SupportedLanguage, string> = {
		fr: 'Français',
		en: 'English'
	};
	const menuTransition = $derived(isDesktop ? fade : fly);
	const menuTransitionParams = $derived(isDesktop ? { duration: 180 } : { x: 200, duration: 200 });

	const currentLanguage = $derived(($locale === 'fr' ? 'fr' : 'en') as SupportedLanguage);
	const RulesContent = $derived($locale === 'fr' ? RulesFr : RulesEn);
	const AboutContent = $derived($locale === 'fr' ? AboutFr : AboutEn);
	const ChangelogContent = $derived($locale === 'fr' ? ChangelogFr : ChangelogEn);

	onMount(() => {
		soundEnabled = getSoundPreference();
		isDarkMode = getDarkModePreference();

		const mediaQuery = window.matchMedia('(min-width: 640px)');
		const updateViewportMode = () => {
			isDesktop = mediaQuery.matches;
		};

		updateViewportMode();
		mediaQuery.addEventListener('change', updateViewportMode);

		return () => {
			mediaQuery.removeEventListener('change', updateViewportMode);
		};
	});

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function closeMenu() {
		menuOpen = false;
	}

	function openModal(modal: ActiveModal) {
		activeModal = modal;
		closeMenu();
	}

	function toggleSound() {
		soundEnabled = !soundEnabled;
		setSoundPreference(soundEnabled);
	}

	function toggleTheme() {
		isDarkMode = !isDarkMode;
		setDarkModePreference(isDarkMode);
		if (isDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	function handleLanguageChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (isSupportedLanguage(value)) {
			setLanguage(value);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeMenu();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative">
	<button
		onclick={toggleMenu}
		class="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
		style="view-transition-name: app-menu-toggle"
		aria-label={menuOpen ? $_('menu.close') : $_('menu.open')}
		aria-expanded={menuOpen}
		title={menuOpen ? $_('menu.close') : $_('menu.open')}
	>
		{#if menuOpen}
			<X size={20} />
		{:else}
			<Menu size={20} />
		{/if}
	</button>

	{#if menuOpen}
		<!-- Backdrop for mobile (slide panel) and desktop (click-outside) -->
		<button
			class="fixed inset-0 z-40 bg-black/30 sm:bg-transparent"
			onclick={closeMenu}
			aria-label={$_('menu.close')}
			tabindex="-1"
		></button>

		<!-- Menu panel -->
		<div
			class="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-white shadow-xl sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-2 sm:w-56 sm:rounded-lg sm:border sm:border-gray-200 sm:shadow-lg dark:bg-gray-900 sm:dark:border-gray-700"
			transition:menuTransition={menuTransitionParams}
		>
			<!-- Mobile header (close button) -->
			<div
				class="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:hidden dark:border-gray-700"
			>
				<span class="font-medium dark:text-gray-100">Menu</span>
				<button
					onclick={closeMenu}
					class="rounded p-1 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
					aria-label={$_('menu.close')}
				>
					<X size={18} />
				</button>
			</div>

			<ul class="flex flex-col py-2">
				<!-- Thème -->
				<li>
					<button
						type="button"
						onclick={toggleTheme}
						class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
						aria-label={$_('menu.theme')}
						title={$_('menu.theme')}
					>
						<span>{$_('menu.theme')}</span>
						<span
							class="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-600 dark:text-gray-400"
						>
							{#if isDarkMode}
								<Sun size={18} />
							{:else}
								<Moon size={18} />
							{/if}
						</span>
					</button>
				</li>

				<!-- Langue -->
				<li class="relative">
					<div
						class="pointer-events-none flex w-full items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-300"
					>
						<span>{$_('menu.language')}</span>
						<span class="flex items-center gap-1 text-gray-600 dark:text-gray-400">
							<span>{languageLabels[currentLanguage]}</span>
							<ChevronDown class="h-3.5 w-3.5" aria-hidden="true" />
						</span>
					</div>
					<select
						class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
						value={currentLanguage}
						onchange={handleLanguageChange}
						aria-label={$_('menu.language')}
					>
						<option value="fr">Français</option>
						<option value="en">English</option>
					</select>
				</li>

				<!-- Son -->
				<li>
					<button
						type="button"
						onclick={toggleSound}
						class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
						aria-label={soundEnabled ? $_('menu.soundOff') : $_('menu.soundOn')}
						title={soundEnabled ? $_('menu.soundOff') : $_('menu.soundOn')}
					>
						<span>{$_('menu.sound')}</span>
						<span
							class="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-600 dark:text-gray-400"
						>
							{#if soundEnabled}
								<Volume2 size={18} />
							{:else}
								<VolumeX size={18} />
							{/if}
						</span>
					</button>
				</li>

				<li class="my-1 border-t border-gray-100 dark:border-gray-800"></li>

				<!-- Règles -->
				<li>
					<button
						onclick={() => openModal('rules')}
						class="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
					>
						{$_('menu.rules')}
					</button>
				</li>

				<!-- À propos -->
				<li>
					<button
						onclick={() => openModal('about')}
						class="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
					>
						{$_('menu.about')}
					</button>
				</li>

				<!-- Changelog -->
				<li>
					<button
						onclick={() => openModal('changelog')}
						class="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
					>
						{$_('menu.changelog')}
					</button>
				</li>
			</ul>
		</div>
	{/if}
</div>

<!-- Modales -->
<GameDialog
	open={activeModal === 'rules'}
	closable={true}
	title={$_('menu.rules')}
	onClose={() => (activeModal = null)}
>
	<div
		class="prose text-gray-700 dark:text-gray-300 dark:prose-invert [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6"
	>
		<RulesContent />
	</div>
</GameDialog>

<GameDialog
	open={activeModal === 'about'}
	closable={true}
	title={$_('menu.about')}
	onClose={() => (activeModal = null)}
>
	<div
		class="prose text-gray-700 dark:text-gray-300 dark:prose-invert [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6"
	>
		<AboutContent />
	</div>
</GameDialog>

<GameDialog
	open={activeModal === 'changelog'}
	closable={true}
	title={$_('menu.changelog')}
	onClose={() => (activeModal = null)}
>
	<div
		class="prose text-gray-700 dark:text-gray-300 dark:prose-invert [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6"
	>
		<ChangelogContent />
	</div>
</GameDialog>
