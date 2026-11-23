// Où chaque épisode de replay a été laissé, sur cette TV (la barre sous
// l'image et la reprise). 200 épisodes au plus, les plus anciens partent.
import {getFromStorage, saveToStorage} from './storage';

const KEY = 'maTvReplayProgress';
const MAX = 200;

let places = {};
let loaded = null;

export const loadReplayProgress = () => {
	if (!loaded) {
		loaded = getFromStorage(KEY)
			.then((stored) => {
				if (stored && typeof stored === 'object') places = stored;
				return places;
			})
			.catch(() => places);
	}
	return loaded;
};

// Avancement 0..100, null si jamais commencé.
export const replayPercent = (id) => {
	const p = places[id];
	if (!p || !p.dur) return null;
	if (p.done) return 100;
	return Math.max(0, Math.min(100, (p.pos / p.dur) * 100));
};

// Position de reprise (ms) : seulement après une minute et avant la fin.
export const resumePosition = (id) => {
	const p = places[id];
	if (!p || p.done || !p.dur || p.pos < 60000 || p.pos > p.dur * 0.95) return 0;
	return p.pos;
};

export const saveReplayPlace = (id, posMs, durMs, meta = null) => {
	if (!id || !durMs) return;
	const done = posMs >= durMs * 0.95;
	const before = places[id] && places[id].meta;
	places = {...places, [id]: {pos: Math.round(posMs), dur: Math.round(durMs), done, at: Date.now(), meta: meta || before || null}};
	const ids = Object.keys(places);
	if (ids.length > MAX) {
		ids.sort((a, b) => places[a].at - places[b].at)
			.slice(0, ids.length - MAX)
			.forEach((k) => delete places[k]);
	}
	saveToStorage(KEY, places).catch(() => {});
};

// Ce qui est en cours sur Ma TV (replay, films et séries IPTV) pour le
// « Continuer » de l'accueil (continue_merge.dart de l'APK) : commencé depuis
// plus d'une minute, pas fini, regardé ces 30 derniers jours.
export const continueOnMaTv = (now = Date.now()) => Object.keys(places)
	.map((id) => ({id, ...places[id]}))
	.filter((p) => p.meta && p.meta.url && !p.done && p.dur > 0 && p.pos >= 60000 && p.pos <= p.dur * 0.95 && now - p.at < 30 * 86400000)
	.sort((a, b) => b.at - a.at)
	.map((p) => ({
		Id: `matv-${p.id}`,
		Name: p.meta.title || '',
		Overview: p.meta.subtitle || '',
		Type: 'Video',
		_externalBackdropUrl: p.meta.image || null,
		_externalPosterUrl: p.meta.image || null,
		UserData: {PlayedPercentage: (p.pos / p.dur) * 100, LastPlayedDate: new Date(p.at).toISOString(), PlaybackPositionTicks: p.pos * 10000},
		RunTimeTicks: p.dur * 10000,
		_maTvResume: {id: p.id, url: p.meta.url, title: p.meta.title, subtitle: p.meta.subtitle, startMs: p.pos}
	}));

// Glisse ce qui est en cours sur Ma TV dans « Continuer », chacun avant le
// premier titre de la bibliothèque regardé plus tôt.
export const mergeByLastWatched = (library, extra) => {
	if (!extra.length) return library;
	const ms = (i) => {
		const t = Date.parse(i && i.UserData && i.UserData.LastPlayedDate);
		return isNaN(t) ? 0 : t;
	};
	const pending = extra.slice().sort((a, b) => ms(b) - ms(a));
	const out = [];
	let p = 0;
	library.forEach((item) => {
		while (p < pending.length && ms(pending[p]) > ms(item)) out.push(pending[p++]);
		out.push(item);
	});
	return out.concat(pending.slice(p));
};

export const resetReplayProgressForTests = (p) => {
	places = p || {};
	loaded = Promise.resolve(places);
};
