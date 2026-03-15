<script lang="ts">
	import { page } from '$app/state';
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';
	import {
		buildPageTitle,
		OG_IMAGE_ALT,
		SITE_DESCRIPTION,
		SITE_LOCALE,
		SITE_NAME,
		toAbsoluteUrl,
		TWITTER_CARD
	} from '$lib/seo';

	let { children } = $props();

	const canonicalUrl = $derived(page.url.href);
	const ogImageUrl = $derived(toAbsoluteUrl(page.url.origin, favicon));
</script>

<svelte:head>
	<title>{buildPageTitle()}</title>
	<meta name="description" content={SITE_DESCRIPTION} />
	<link rel="canonical" href={canonicalUrl} />
	<link rel="icon" type="image/png" href={favicon} />

	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content={SITE_LOCALE} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={buildPageTitle()} />
	<meta property="og:description" content={SITE_DESCRIPTION} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:alt" content={OG_IMAGE_ALT} />

	<meta name="twitter:card" content={TWITTER_CARD} />
	<meta name="twitter:title" content={buildPageTitle()} />
	<meta name="twitter:description" content={SITE_DESCRIPTION} />
	<meta name="twitter:image" content={ogImageUrl} />
</svelte:head>
{@render children()}
