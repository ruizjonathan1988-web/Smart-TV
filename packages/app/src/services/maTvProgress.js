// Où chaque épisode de replay a été laissé, sur cette TV (la barre sous
// l'image et la reprise). 200 épisodes au plus, les plus anciens partent.
import {getFromStorage, saveToStorage} from './storage';
import {maTvEndpoint} from './maTvApi';
import {platformFetch} from './secureFetch';

const KEY = 'maTvReplayProgress';
const MAX = 200;

let places = {};
let loaded = null;

// Les films et séries IPTV vont aussi sur la seedbox, par profil Jellyfin
// (iptv_progress.dart) : un film commencé sur la télé reprend sur le
// téléphone, et l'inverse. Chaque appel échoue sans bruit.
let seedbox = null;
const lastPost = {};
const POST_EVERY = 30000;

const postPlace = (watch, posMs, durMs, force) => {
	if (!seedbox || !watch || !watch.id) return;
	const key = `${watch.kind}:${watch.id}:${watch.ep || ''}`;
	const now = Date.now();
	if (!force && lastPost[key] && now - lastPost[key] < POST_EVERY) return;
	lastPost[key] = now;
	const body = {
		kind: watch.kind, id: watch.id, name: watch.name || '', tmdb: watch.tmdb || '', poster: watch.poster || '',
		pos: Math.round(posMs / 1000), dur: Math.round(durMs / 1000), ext: watch.ext || '', user: seedbox.user
	};
	if (watch.kind === 'series') Object.assign(body, {ep: watch.ep || '', season: watch.season || 0, episode: watch.episode || 0, ep_name: watch.epName || ''});
	platformFetch(maTvEndpoint(seedbox.server, '/tv/api/vod/progress'), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}, 8000)
		.catch(() => {});
};

// Une place lue sur la seedbox, au format de cette télé.
export const placeFromSeedbox = (p, urls) => {
	if (!p || !p.id || (p.kind !== 'movie' && p.kind !== 'series')) return null;
	const series = p.kind === 'series';
	if (series && !p.ep) return null;
	const id = series ? `vod:ep:${p.ep}` : `vod:movie:${p.id}`;
	const url = series ? urls.episodeUrl({id: p.ep, extension: p.ext || 'mkv'}) : urls.movieUrl({id: p.id, extension: p.ext || 'mp4'});
	const posMs = (Number(p.pos) || 0) * 1000;
	const durMs = (Number(p.dur) || 0) * 1000;
	return {
		id,
		place: {
			pos: posMs, dur: durMs, done: p.done === true || (durMs > 0 && posMs >= durMs * 0.95), at: Math.round((Number(p.at) || 0) * 1000),
			meta: {
				url,
				title: p.name || '',
				subtitle: series ? `S${p.season || 0} · É${p.episode || 0}${p.ep_name ? ` · ${p.ep_name}` : ''}` : 'IPTV',
				image: p.poster || null,
				watch: series
					? {kind: 'series', id: String(p.id), name: p.name || '', tmdb: p.tmdb || '', poster: p.poster || '', ep: String(p.ep), ext: p.ext || '', season: p.season || 0, episode: p.episode || 0, epName: p.ep_name || ''}
					: {kind: 'movie', id: String(p.id), name: p.name || '', tmdb: p.tmdb || '', poster: p.poster || '', ext: p.ext || ''}
			}
		}
	};
};

// Ce que le profil a en cours sur la seedbox rejoint les places de la télé ;
// la plus récente gagne.
export const mergeSeedboxPlaces = (list, urls) => {
	let changed = false;
	(list || []).forEach((raw) => {
		const got = placeFromSeedbox(raw, urls);
		if (!got) return;
		const here = places[got.id];
		if (here && here.at >= got.place.at) return;
		places = {...places, [got.id]: got.place};
		changed = true;
	});
	if (changed) saveToStorage(KEY, places).catch(() => {});
	return changed;
};


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
	const watch = (meta && meta.watch) || (before && before.watch);
	if (watch) postPlace(watch, posMs, durMs, done);
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
	seedbox = null;
	Object.keys(lastPost).forEach((k) => delete lastPost[k]);
	loaded = Promise.resolve(places);
};

// L'appli dit où est la seedbox et quel profil regarde, puis on relit ce qu'il
// a en cours.
export const setProgressSeedbox = async (server, user, urls) => {
	seedbox = server && user ? {server, user} : null;
	if (!seedbox || !urls) return false;
	await loadReplayProgress();
	try {
		const res = await platformFetch(maTvEndpoint(server, '/tv/api/vod/progress', {u: user}), {method: 'GET'}, 8000);
		if (!res || res.status !== 200) return false;
		const j = await res.json();
		return mergeSeedboxPlaces(j && Array.isArray(j.items) ? j.items : [], urls);
	} catch (e) {
		return false;
	}
};
