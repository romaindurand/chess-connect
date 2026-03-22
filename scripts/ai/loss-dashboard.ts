#!/usr/bin/env tsx
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

function readArg(name: string, fallback: string): string {
	const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
	return raw ? raw.slice(name.length + 3) : fallback;
}

function readIntArg(name: string, fallback: number): number {
	const v = Number.parseInt(readArg(name, String(fallback)), 10);
	return Number.isFinite(v) && v > 0 ? v : fallback;
}

const metricsPath = path.resolve(readArg('metrics', 'checkpoints/model/training-loss.json'));
const port = readIntArg('port', 4780);

function renderHtml(): string {
	return `<!doctype html>
<html lang="fr">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Loss Dashboard</title>
	<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
	<style>
		:root {
			--bg: #f5f7fb;
			--card: #ffffff;
			--text: #172033;
			--muted: #4d5a74;
			--line-batch: #4f81d8;
			--line-epoch: #d6462f;
			--border: #d7deec;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			padding: 24px;
			font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
			background: radial-gradient(circle at 10% 10%, #eaf0ff, var(--bg));
			color: var(--text);
		}
		main {
			max-width: 1200px;
			margin: 0 auto;
			display: grid;
			gap: 16px;
		}
		.card {
			background: var(--card);
			border: 1px solid var(--border);
			border-radius: 14px;
			padding: 16px;
			box-shadow: 0 8px 30px rgba(27, 41, 78, 0.08);
		}
		h1 {
			margin: 0;
			font-size: 1.4rem;
		}
		.meta {
			display: flex;
			flex-wrap: wrap;
			gap: 10px 16px;
			color: var(--muted);
			font-size: 0.95rem;
		}
		.badge {
			display: inline-block;
			padding: 3px 10px;
			border-radius: 999px;
			font-size: 0.82rem;
			font-weight: 600;
		}
		.badge.running { background: #e2f2ff; color: #0f4d92; }
		.badge.completed { background: #e7f8e8; color: #1f6f2a; }
		.badge.failed { background: #fde7e6; color: #8d2424; }
		.grid-2 {
			display: grid;
			gap: 16px;
			grid-template-columns: 2fr 1fr;
		}
		@media (max-width: 920px) {
			.grid-2 { grid-template-columns: 1fr; }
		}
		ul { margin: 0; padding-left: 18px; }
		li { margin: 6px 0; }
		.small { color: var(--muted); font-size: 0.9rem; }
	</style>
</head>
<body>
	<main>
		<section class="card">
			<h1>Loss Training Dashboard</h1>
			<p class="small">Auto-refresh toutes les 1.5s. Données lues depuis training-loss.json.</p>
			<div class="meta" id="meta"></div>
		</section>
		<section class="card">
			<canvas id="lossChart" height="120"></canvas>
		</section>
		<section class="grid-2">
			<section class="card">
				<h2>Patterns détectés automatiquement</h2>
				<ul id="diagnostics"></ul>
			</section>
			<section class="card">
				<h2>Repères à surveiller</h2>
				<ul>
					<li>Baisse régulière puis plateau: apprentissage stable.</li>
					<li>Loss qui remonte sur plusieurs époques: divergence ou LR trop agressif.</li>
					<li>Oscillations très fortes batch par batch: batch trop petit, données trop bruitées.</li>
					<li>Chute très rapide vers une valeur basse puis stagnation précoce: capacité limitée ou données peu variées.</li>
				</ul>
			</section>
		</section>
	</main>

	<script>
		const ctx = document.getElementById('lossChart');
		const meta = document.getElementById('meta');
		const diagnostics = document.getElementById('diagnostics');

		const chart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: [],
				datasets: [
					{
						label: 'Loss batch (échantillonnée)',
						data: [],
						borderColor: getComputedStyle(document.documentElement).getPropertyValue('--line-batch').trim(),
						borderWidth: 1.5,
						tension: 0.25,
						pointRadius: 0
					},
					{
						label: "Loss fin d'époque",
						data: [],
						borderColor: getComputedStyle(document.documentElement).getPropertyValue('--line-epoch').trim(),
						borderWidth: 2.5,
						tension: 0.2,
						pointRadius: 3
					}
				]
			},
			options: {
				animation: false,
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: { position: 'top' }
				},
				scales: {
					x: { title: { display: true, text: 'Progression (batch global)' } },
					y: { title: { display: true, text: 'Loss' } }
				}
			}
		});

		function average(arr) {
			if (!arr.length) return 0;
			return arr.reduce((a, b) => a + b, 0) / arr.length;
		}

		function stddev(arr) {
			if (arr.length < 2) return 0;
			const m = average(arr);
			const variance = average(arr.map((x) => (x - m) * (x - m)));
			return Math.sqrt(variance);
		}

		function addDiagnostic(line) {
			const li = document.createElement('li');
			li.textContent = line;
			diagnostics.appendChild(li);
		}

		function updateDiagnostics(report) {
			diagnostics.innerHTML = '';
			const epochLosses = (report.epochLosses || []).map((e) => e.loss);
			const batchLosses = (report.batchLossSamples || []).map((e) => e.loss);

			if (!epochLosses.length) {
				addDiagnostic('Pas encore assez de données: attendre au moins 1 époque.');
				return;
			}

			const first = epochLosses[0];
			const last = epochLosses[epochLosses.length - 1];
			const recentEpochs = epochLosses.slice(-5);
			const slopeApprox = recentEpochs.length > 1 ? (recentEpochs[recentEpochs.length - 1] - recentEpochs[0]) / (recentEpochs.length - 1) : 0;

			if (last < first * 0.8) {
				addDiagnostic('Baisse nette de la loss depuis le début: apprentissage utile en cours.');
			} else if (last > first * 1.05) {
				addDiagnostic("Loss plus haute qu'au départ: suspicion de divergence, réduire le learning rate ou augmenter batch.");
			} else {
				addDiagnostic('Loss globalement stable: vérifier si le modèle a atteint un plateau.');
			}

			if (slopeApprox > 0.005) {
				addDiagnostic('Tendance récente à la hausse: stopper tôt et relancer avec LR plus faible.');
			} else if (slopeApprox < -0.005) {
				addDiagnostic('Tendance récente à la baisse: poursuivre quelques époques supplémentaires peut aider.');
			} else {
				addDiagnostic('Tendance récente quasi plate: plateau probable, privilégier plus de diversité de données.');
			}

			const lastBatches = batchLosses.slice(-60);
			if (lastBatches.length >= 10) {
				const m = average(lastBatches);
				const sd = stddev(lastBatches);
				if (m > 0 && sd / m > 0.25) {
					addDiagnostic('Forte variance batch: essayer un batch plus grand (ex: 64 -> 128) ou lisser les données.');
				} else {
					addDiagnostic("Variance batch raisonnable: signal d'entraînement plutôt stable.");
				}
			}

			if (report.status === 'failed' && report.errorMessage) {
				addDiagnostic('Entraînement en échec: ' + report.errorMessage);
			}
		}

		function render(report) {
			const status = report.status || 'running';
			meta.innerHTML = '';
			const statusBadge = document.createElement('span');
			statusBadge.className = 'badge ' + status;
			statusBadge.textContent = 'Statut: ' + status;
			meta.appendChild(statusBadge);

			const infos = [
				'Époques: ' + report.epochs,
				'Batch: ' + report.batchSize,
				'Samples: ' + report.totalSamples,
				'Backend: ' + report.backend,
				'Mise à jour: ' + new Date(report.updatedAt).toLocaleTimeString()
			];
			for (const text of infos) {
				const span = document.createElement('span');
				span.textContent = text;
				meta.appendChild(span);
			}

			const batch = report.batchLossSamples || [];
			const epoch = report.epochLosses || [];
			chart.data.labels = batch.map((p) => p.globalBatch);
			chart.data.datasets[0].data = batch.map((p) => p.loss);
			chart.data.datasets[1].data = epoch.map((p) => ({ x: p.epoch * report.batchesPerEpoch, y: p.loss }));
			chart.update('none');

			updateDiagnostics(report);
		}

		async function refresh() {
			try {
				const res = await fetch('/metrics?ts=' + Date.now());
				if (!res.ok) {
					throw new Error('HTTP ' + res.status);
				}
				const report = await res.json();
				render(report);
			} catch (error) {
				diagnostics.innerHTML = '';
				addDiagnostic('Impossible de lire les métriques: ' + String(error));
			}
		}

		refresh();
		setInterval(refresh, 1500);
	</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
	const url = req.url || '/';
	if (url.startsWith('/metrics')) {
		if (!fs.existsSync(metricsPath)) {
			res.statusCode = 404;
			res.setHeader('content-type', 'application/json; charset=utf-8');
			res.end(JSON.stringify({ error: `Fichier introuvable: ${metricsPath}` }));
			return;
		}
		res.statusCode = 200;
		res.setHeader('cache-control', 'no-store');
		res.setHeader('content-type', 'application/json; charset=utf-8');
		res.end(fs.readFileSync(metricsPath, 'utf8'));
		return;
	}

	res.statusCode = 200;
	res.setHeader('content-type', 'text/html; charset=utf-8');
	res.end(renderHtml());
});

server.listen(port, () => {
	console.log(`Dashboard loss disponible sur http://localhost:${port}`);
	console.log(`Métriques lues depuis ${metricsPath}`);
});
