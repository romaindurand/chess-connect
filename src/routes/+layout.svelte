<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';
	import { initI18n, resolveInitialLanguage, setLanguage } from '$lib/i18n';
	import { buildPageTitle, SITE_NAME, toAbsoluteUrl } from '$lib/seo';
	import { getDarkModePreference } from '$lib/client/dark-mode-storage';

	let { children } = $props();
	initI18n();

	const canonicalUrl = $derived(page.url.href);
	const ogImageUrl = $derived(toAbsoluteUrl(page.url.origin, favicon));

	onMount(() => {
		setLanguage(resolveInitialLanguage());
		// Initialiser le mode dark lors du montage
		const isDarkMode = getDarkModePreference();
		if (isDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	});

	$effect(() => {
		if (typeof document === 'undefined') {
			return;
		}
		document.documentElement.lang = $locale ?? 'fr';
	});
</script>

<svelte:head>
	<title>{buildPageTitle()}</title>
	<meta name="description" content={$_('meta.siteDescription')} />
	<link rel="canonical" href={canonicalUrl} />
	<link rel="icon" type="image/png" href={favicon} />

	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content={$_('meta.siteLocale')} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={buildPageTitle()} />
	<meta property="og:description" content={$_('meta.siteDescription')} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:alt" content={$_('meta.ogImageAlt')} />

	<meta name="twitter:card" content={$_('meta.twitterCard')} />
	<meta name="twitter:title" content={buildPageTitle()} />
	<meta name="twitter:description" content={$_('meta.siteDescription')} />
	<meta name="twitter:image" content={ogImageUrl} />
</svelte:head>
{@render children()}
