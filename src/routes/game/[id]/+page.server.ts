import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!params.id || params.id.length < 4) {
		error(404, 'Partie introuvable');
	}

	return {
		gameId: params.id
	};
};
