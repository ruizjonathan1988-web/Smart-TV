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

export const saveReplayPlace = (id, posMs, durMs) => {
	if (!id || !durMs) return;
	const done = posMs >= durMs * 0.95;
	places = {...places, [id]: {pos: Math.round(posMs), dur: Math.round(durMs), done, at: Date.now()}};
	const ids = Object.keys(places);
	if (ids.length > MAX) {
		ids.sort((a, b) => places[a].at - places[b].at)
			.slice(0, ids.length - MAX)
			.forEach((k) => delete places[k]);
	}
	saveToStorage(KEY, places).catch(() => {});
};

export const resetReplayProgressForTests = (p) => {
	places = p || {};
	loaded = Promise.resolve(places);
};
