// VJOD 4.25, la voie Seerr pour garder une émission du replay
// (replay_keep.dart) : l'émission retrouvée dans Seerr (TMDB), sa saison
// demandée à Sonarr après un oui ; elle arrive dans la bibliothèque, sans pub.
import * as seerrApi from './seerrApi';

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// La série dans Seerr et la saison à demander : celle de l'épisode, sinon la dernière.
export const seerrMatch = async (item, api = seerrApi) => {
	if (!item || !item.show) return null;
	try {
		const page = await api.search(item.show);
		const want = fold(item.show);
		for (const t of (page && page.results) || []) {
			if (t.mediaType && t.mediaType !== 'tv') continue;
			const names = [t.name, t.originalName, t.title].filter(Boolean).map(fold);
			if (!names.includes(want)) continue;
			let season = Number(item.season) || 0;
			if (season <= 0) {
				const d = await api.getTv(t.id); // eslint-disable-line no-await-in-loop
				season = (d && d.numberOfSeasons) || 1;
			}
			return {tmdb: t.id, name: t.name || t.title || item.show, season: Math.max(1, season)};
		}
	} catch (e) {
		// Rien de trouvé.
	}
	return null;
};

// La réponse à montrer, en français.
export const requestSeerrSeason = async (m, api = seerrApi) => {
	try {
		await api.requestTv(m.tmdb, {seasons: [m.season]});
		return `« ${m.name} » saison ${m.season} demandée : elle arrivera dans ta bibliothèque.`;
	} catch (e) {
		const s = String((e && e.message) || e);
		if (s.includes('409') || s.toLowerCase().includes('already')) return `« ${m.name} » saison ${m.season} est déjà demandée.`;
		return `Seerr a refusé la demande : ${s}`;
	}
};
