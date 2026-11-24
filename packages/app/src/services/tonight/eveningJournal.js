// Journal des soirées (evening_journal.dart de l'APK) : une séance par titre,
// quand, quoi, combien regardé, avec qui. Plusieurs épisodes d'affilée d'une
// série font une seule séance. Les dates sont en millisecondes epoch.
import {slotOf} from './tonightModels';

export const MAX_ENTRIES = 400;
const SITTING_GAP_MS = 4 * 3600000;

// Comment s'est passée la séance, de −1 (lâché tôt) à 1 (vu jusqu'au bout).
export const outcomeOf = (e) => {
	if (e.finished || e.backfilled) return 1;
	if ((e.watchedMinutes || 0) < 15) return -1;
	if ((e.episodes || 1) >= 2 || e.watchedMinutes >= 45) return 0.6;
	return 0.1;
};

export const tmdbKeyOf = (e) => (e.tmdbId ? `${e.mediaType}:${e.tmdbId}` : null);
export const entrySlot = (e) => slotOf(e.at);

const byDate = (a, b) => a.at - b.at;
const capped = (list) => (list.length > MAX_ENTRIES ? list.slice(list.length - MAX_ENTRIES) : list);

// Ajoute une séance, ou la fond dans celle qu'elle prolonge (la même série
// reprise dans les quelques heures).
export const recordEntry = (entries, entry) => {
	const list = entries.slice();
	if (entry.mediaType === 'tv') {
		for (let i = list.length - 1; i >= 0; i--) {
			const prev = list[i];
			if (entry.at - prev.at > SITTING_GAP_MS) break;
			if (prev.itemId !== entry.itemId || prev.backfilled) continue;
			list[i] = {
				...prev,
				watchedMinutes: (prev.watchedMinutes || 0) + (entry.watchedMinutes || 0),
				episodes: (prev.episodes || 1) + 1,
				finished: prev.finished || entry.finished,
				company: prev.company || entry.company,
				fromTonight: prev.fromTonight || entry.fromTonight
			};
			return list;
		}
	}
	list.push(entry);
	list.sort(byDate);
	return capped(list);
};

// Ajoute les lectures reconstruites depuis l'historique du serveur, sans
// doublon (le même élément le même jour).
export const backfillEntries = (entries, past) => {
	const dayKey = (e) => {
		const d = new Date(e.at);
		return `${e.itemId}@${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
	};
	const known = new Set(entries.map(dayKey));
	const list = entries.slice();
	past.forEach((e) => {
		const k = dayKey(e);
		if (known.has(k)) return;
		known.add(k);
		list.push(e);
	});
	list.sort(byDate);
	return capped(list);
};

// Clés TMDB de tout ce qui a été vu, pour ne pas le reproposer.
export const watchedTmdbKeys = (entries) => {
	const out = new Set();
	entries.forEach((e) => {
		const k = tmdbKeyOf(e);
		if (k && (e.finished || e.backfilled)) out.add(k);
	});
	return out;
};

export const decodeJournal = (raw) => {
	const list = Array.isArray(raw) ? raw : [];
	return list
		.filter((e) => e && typeof e.at === 'number' && typeof e.itemId === 'string' && (e.mediaType === 'movie' || e.mediaType === 'tv'))
		.sort(byDate);
};
