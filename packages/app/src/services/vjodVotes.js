// « J'ai aimé » ou « Bof » au générique de fin (vjod_votes.dart) : chaque vote
// pèse un peu sur les genres que VJOD propose ensuite, en s'effaçant avec le
// temps.
import {getFromStorage, saveToStorage} from './storage';
import {genresFromNames} from './tonight/tonightModels';

const KEY = 'vjod_votes';
export const MAX_VOTES = 300;
// Un vote garde la moitié de son poids au bout de 120 jours.
export const HALF_LIFE_DAYS = 120;

export const voteKey = (item) => {
	const ids = (item && item.ProviderIds) || {};
	const tmdb = ids.Tmdb || ids.tmdb || ids.TMDB;
	return tmdb ? `movie:${tmdb}` : `jellyfin:${item && item.Id}`;
};

export const decodeVotes = (raw) => {
	try {
		const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
		const list = j && Array.isArray(j.votes) ? j.votes : [];
		return {
			votes: list.filter((v) => v && typeof v.key === 'string' && !Number.isNaN(Date.parse(v.at)))
				.map((v) => ({key: v.key, title: v.title || '', genres: Array.isArray(v.genres) ? v.genres : [], liked: v.liked === true, at: v.at, source: v.source || null})),
			suggested: (j && j.suggested && typeof j.suggested === 'object') ? j.suggested : {}
		};
	} catch (e) {
		return {votes: [], suggested: {}};
	}
};

export const voteFor = (state, key) => {
	for (let i = state.votes.length - 1; i >= 0; i--) if (state.votes[i].key === key) return state.votes[i];
	return null;
};

export const recordVote = (state, vote) => {
	const withSource = vote.source || !state.suggested[vote.key] ? vote : {...vote, source: state.suggested[vote.key]};
	const list = state.votes.filter((v) => v.key !== vote.key).concat([withSource]);
	return {votes: list.length > MAX_VOTES ? list.slice(list.length - MAX_VOTES) : list, suggested: state.suggested};
};

// Ce que les votes disent de chaque genre, de -1 à 1, qui s'efface avec l'âge.
// Un genre voté une ou deux fois reste près du neutre.
export const genreBias = (state, now = Date.now()) => {
	const sum = {};
	const weight = {};
	state.votes.forEach((v) => {
		const days = (now - Date.parse(v.at)) / 86400000;
		const w = Math.pow(0.5, days / HALF_LIFE_DAYS);
		v.genres.forEach((g) => {
			sum[g] = (sum[g] || 0) + (v.liked ? w : -w);
			weight[g] = (weight[g] || 0) + w;
		});
	});
	const out = {};
	Object.keys(sum).forEach((g) => {
		out[g] = Math.max(-1, Math.min(1, sum[g] / (weight[g] + 2)));
	});
	return out;
};

// Un facteur pour un titre de ces genres : un peu plus pour ce qui a plu,
// un peu moins pour les « bof », jamais à zéro.
export const factorFor = (genres, bias) => {
	if (!genres || !genres.length || !bias || !Object.keys(bias).length) return 1;
	const mean = genres.reduce((s, g) => s + (bias[g] || 0), 0) / genres.length;
	return Math.max(0.7, Math.min(1.35, 1 + 0.35 * mean));
};

export const loadVotes = async () => decodeVotes(await getFromStorage(KEY).catch(() => null));

// Un vote de plus, gardé sur la télé.
export const saveVote = async (item, liked) => {
	const state = await loadVotes();
	const next = recordVote(state, {
		key: voteKey(item),
		title: (item && item.Name) || '',
		genres: genresFromNames((item && item.Genres) || []),
		liked,
		at: new Date().toISOString()
	});
	await saveToStorage(KEY, JSON.stringify(next));
	return next;
};

// Le générique a commencé : le segment de fin quand le serveur le connaît,
// sinon les dernières minutes d'un vrai film (40 min au moins).
const TICKS = 10000000;

export const creditsStarted = ({currentTime, duration, segments}) => {
	if (!(duration >= 40 * 60)) return false;
	const t = currentTime * TICKS;
	const list = (segments && segments.list) || [];
	const inOutro = list.some((s) => s.type === 'outro' && t >= s.start && (s.end == null || t < s.end));
	const nearEnd = currentTime >= duration * 0.95 && duration - currentTime <= 8 * 60;
	return inOutro || nearEnd;
};
