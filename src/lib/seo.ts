export const SITE_NAME = 'Chess Connect';
export const SITE_DESCRIPTION =
	'Chess Connect est un jeu de plateau multijoueur qui mélange echecs et puissance 4, jouable en ligne contre un humain ou un ordinateur.';
export const SITE_LOCALE = 'fr_FR';
export const OG_IMAGE_ALT = 'Logo Chess Connect, un jeu melangeant echecs et puissance 4 en ligne.';
export const TWITTER_CARD = 'summary';

export function buildPageTitle(pageTitle?: string): string {
	return pageTitle ? `${pageTitle} | ${SITE_NAME}` : SITE_NAME;
}

export function toAbsoluteUrl(origin: string, pathOrUrl: string): string {
	return new URL(pathOrUrl, origin).href;
}
