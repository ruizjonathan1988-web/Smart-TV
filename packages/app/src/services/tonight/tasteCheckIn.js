// Le point du mois (taste_check_in.dart de l'APK) : une minute pour garder
// les suggestions justes — un verdict sur le dernier titre vu jusqu'au bout,
// pourquoi le dernier a été lâché, un duel sur l'axe le moins connu, et si
// une ancienne limite tient toujours.
import {pickKey} from './tasteProfile';

const DAY = 86400000;
export const REMINDER_INTERVAL_MS = 30 * DAY;

export const checkInKey = (e) => `${e.itemId}@${new Date(e.at).toISOString()}`;

const droppedEarly = (e) => {
	if ((e.episodes || 1) > 1) return false;
	const runtime = e.runtimeMinutes;
	if (!runtime || runtime <= 0) return (e.watchedMinutes || 0) < 25;
	return (e.watchedMinutes || 0) / runtime < 0.3;
};

const seenKeys = (p) => new Set([].concat(p.favorites, p.pivots, p.meh, p.disliked).map(pickKey));

export const checkInSittings = ({journal, profile, asked = new Set(), now = Date.now()}) => {
	const seen = seenKeys(profile);
	let finished = null;
	let dropped = null;
	for (let i = journal.length - 1; i >= 0; i--) {
		const e = journal[i];
		const key = e.tmdbId ? `${e.mediaType}:${e.tmdbId}` : null;
		if (e.backfilled || !key) continue;
		if (now - e.at > 45 * DAY) break;
		if (asked.has(checkInKey(e)) || seen.has(key)) continue;
		if (!finished && e.finished) finished = e;
		else if (!dropped && !e.finished && droppedEarly(e)) dropped = e;
		if (finished && dropped) break;
	}
	return {finished, dropped};
};

export const stillTrueQuestion = (p) => {
	if (p.avoided.length) return {kind: 'avoided', genre: p.avoided[0]};
	if (p.subtitles === 'never') return {kind: 'subtitles'};
	if (p.violence === 'none') return {kind: 'violence'};
	return null;
};

const pickOf = (e) => ({id: e.tmdbId, type: e.mediaType, title: e.title || '', poster: null, genres: e.genres || []});

export const applyVerdict = (p, e, verdict) => {
	const pick = pickOf(e);
	const key = pickKey(pick);
	const without = (list) => list.filter((x) => pickKey(x) !== key);
	switch (verdict) {
		case 'loved': {
			const pivots = without(p.pivots).concat([pick]);
			return {...p, pivots: pivots.slice(-5)};
		}
		case 'good': return {...p, favorites: without(p.favorites).concat([pick])};
		case 'meh': return {...p, meh: without(p.meh).concat([pick])};
		case 'disliked': return {...p, disliked: without(p.disliked).concat([pick])};
		default: return p;
	}
};

export const applyDropReason = (p, e, reason) => {
	switch (reason) {
		case 'tooSlow':
			return {...p, axes: {...p.axes, slowFast: Math.max(-2, Math.min(2, (p.axes.slowFast || 0) + 0.5))}};
		case 'tooDark':
			return {...p, violence: p.violence === 'fine' ? 'justified' : 'none'};
		case 'notMyGenre':
			return applyVerdict(p, e, 'disliked');
		default:
			return p;
	}
};

export const releaseChoice = (p, q) => {
	if (q.kind === 'avoided') return {...p, avoided: p.avoided.filter((g) => g !== q.genre)};
	if (q.kind === 'subtitles') return {...p, subtitles: 'depends'};
	if (q.kind === 'violence') return {...p, violence: 'justified'};
	return p;
};

// La première fois le questionnaire, puis le point du mois tous les 30 jours.
export const tastePromptDue = ({profile, promptedAt, now = Date.now()}) => {
	if (!promptedAt) return profile.updatedAt ? null : 'questionnaire';
	if (now - promptedAt < REMINDER_INTERVAL_MS) return null;
	const updated = profile.updatedAt ? Date.parse(profile.updatedAt) : NaN;
	if (!isNaN(updated) && now - updated < REMINDER_INTERVAL_MS) return null;
	return 'checkIn';
};
