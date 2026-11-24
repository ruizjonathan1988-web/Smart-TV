// Le contrôle d'âge des titres Seerr (seerr_age_gate.dart de l'APK). Les
// cartes Seerr n'ont pas de classification : quand le profil en bloque, celle
// de chaque titre est cherchée une fois sur sa fiche, et le titre reste caché
// tant qu'elle n'est pas connue. Sans classification, seuls l'animation, la
// famille et les séries pour enfants passent.
import seerrApi from './seerrApi';

// Les pays lus, le premier trouvé gagne : la France, puis les plus remplis.
const COUNTRIES = ['FR', 'US', 'GB', 'DE'];
const CHILD_GENRES = [16, 10751, 10762];
const CONCURRENCY = 4;
const SETTLE_MS = 250;

export const parseAgeInfo = (details) => {
	const byCountry = {};
	const note = (country, rating) => {
		const value = rating == null ? '' : String(rating).trim();
		if (typeof country === 'string' && value && !(country in byCountry)) byCountry[country] = value;
	};
	const releases = details && details.releases && details.releases.results;
	(Array.isArray(releases) ? releases : []).forEach((c) => {
		(c && Array.isArray(c.release_dates) ? c.release_dates : []).forEach((r) => note(c.iso_3166_1, r && r.certification));
	});
	const ratings = details && details.contentRatings && details.contentRatings.results;
	(Array.isArray(ratings) ? ratings : []).forEach((e) => note(e && e.iso_3166_1, e && e.rating));
	const found = COUNTRIES.map((c) => byCountry[c]).filter(Boolean);
	return {
		certification: found.length ? found[0] : null,
		genres: ((details && details.genres) || []).map((g) => g && g.id).filter((id) => typeof id === 'number')
	};
};

export const ageAllows = (filter, info) => {
	if (!info.certification) return info.genres.some((g) => CHILD_GENRES.indexOf(g) >= 0);
	return !filter.isBlockedRating(info.certification);
};

const lookupAge = async (mediaType, tmdbId) => parseAgeInfo(await (mediaType === 'tv' ? seerrApi.getTv(tmdbId) : seerrApi.getMovie(tmdbId)));

export const createAgeGate = (lookup = lookupAge) => {
	const known = {};
	const pending = new Set();
	const queue = [];
	const listeners = new Set();
	let running = 0;
	let timer = null;
	let version = 0;

	const settled = () => {
		clearTimeout(timer);
		// Un seul nouveau rendu pour une salve de réponses.
		timer = setTimeout(() => {
			version++;
			listeners.forEach((fn) => fn(version));
		}, SETTLE_MS);
	};
	const drain = () => {
		while (running < CONCURRENCY && queue.length) {
			const [mediaType, id] = queue.shift();
			const key = `${mediaType}:${id}`;
			running++;
			lookup(mediaType, id).then((info) => {
				known[key] = info;
			}, () => {
				// Laissé caché pour la session plutôt que redemandé sans fin.
				known[key] = {certification: null, genres: []};
			}).then(() => {
				running--;
				settled();
				drain();
			});
		}
	};

	// true ou false, ou null tant que la classification est cherchée.
	const allows = (mediaType, tmdbId, filter) => {
		if (!filter || !filter.isActive) return true;
		const key = `${mediaType}:${tmdbId}`;
		if (known[key]) return ageAllows(filter, known[key]);
		if (!pending.has(key)) {
			pending.add(key);
			queue.push([mediaType, tmdbId]);
			drain();
		}
		return null;
	};
	const subscribe = (fn) => {
		listeners.add(fn);
		return () => listeners.delete(fn);
	};
	return {allows, subscribe};
};

export const seerrAgeGate = createAgeGate();

// Une tuile qui ouvre une page de VJOD (chaînes du replay, « Mes émissions »)
// ou une catégorie n'a pas de classification à attendre.
const isTitle = (item) => item && item._seerr && item._seerrType === 'item' && !item._vjodReplay &&
	item._seerrRaw && /^\d+$/.test(String(item._seerrRaw.mediaId));

// Les rangées sans les titres Seerr que le contrôle ne laisse pas passer ou
// sur lesquels il hésite encore. Une rangée vidée disparaît.
export const withAgeGate = (rows, allows) => {
	const out = [];
	rows.forEach((row) => {
		if (!Array.isArray(row.items)) {
			out.push(row);
			return;
		}
		const items = row.items.filter((item) => !isTitle(item) ||
			allows(item._seerrRaw.mediaType === 'tv' ? 'tv' : 'movie', Number(item._seerrRaw.mediaId)) === true);
		if (items.length === row.items.length) out.push(row);
		else if (items.length) out.push({...row, items});
	});
	return out;
};
