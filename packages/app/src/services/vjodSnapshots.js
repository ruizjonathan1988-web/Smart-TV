// VJOD 4.20 : des listes gardées sur la télé (les catégories et les chaînes de
// Ma TV), pour qu'un écran montre tout de suite la dernière liste connue, même
// juste après le lancement, et mette la fraîche à sa place quand elle arrive
// (vjod_snapshots.dart).
import {getFromStorage, saveToStorage} from './storage';

const KEY = 'vjod_snapshots';
// Peu de listes, et pas trop longues : la place de stockage d'une télé est comptée.
const MAX_ENTRIES = 12;
const MAX_ITEMS = 300;
const MAX_AGE = 14 * 24 * 3600 * 1000;

let memory = null;
let loading = null;

const load = () => {
	if (memory) return Promise.resolve(memory);
	if (!loading) {
		loading = getFromStorage(KEY)
			.then((s) => {
				memory = s && typeof s === 'object' ? s : {};
				return memory;
			})
			.catch(() => {
				memory = {};
				return memory;
			});
	}
	return loading;
};

// La dernière liste connue pour key (pour ce profil), ou null.
export const readSnapshot = async (key, now = Date.now()) => {
	const all = await load();
	const e = all[key];
	if (!e || !Array.isArray(e.list) || now - e.at > MAX_AGE) return null;
	return e.list;
};

// La liste fraîche remplace l'ancienne ; les plus vieilles partent.
export const writeSnapshot = async (key, list, now = Date.now()) => {
	if (!Array.isArray(list) || !list.length) return;
	const all = {...(await load()), [key]: {at: now, list: list.slice(0, MAX_ITEMS)}};
	const keys = Object.keys(all);
	if (keys.length > MAX_ENTRIES) {
		keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete all[k]);
	}
	memory = all;
	saveToStorage(KEY, all).catch(() => {});
};

export const resetSnapshotsForTests = () => {
	memory = null;
	loading = null;
};
