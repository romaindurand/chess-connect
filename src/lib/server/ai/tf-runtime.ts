export type TrainingBackend = 'tensorflow' | 'cpu';

export function chooseTrainingBackend(nodeVersion = process.versions.node): TrainingBackend {
	const majorRaw = nodeVersion.split('.')[0] ?? '';
	const major = Number.parseInt(majorRaw, 10);
	if (!Number.isFinite(major)) {
		return 'cpu';
	}
	return major >= 24 ? 'cpu' : 'tensorflow';
}
