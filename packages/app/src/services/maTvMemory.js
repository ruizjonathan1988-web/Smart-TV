// Mémoire locale de Ma TV (MaTvMemory de l'APK) : favoris, chaînes récentes,
// dernière chaîne et dernière catégorie regardées. Gardée dans le stockage de
// l'app, sur la TV seulement.
import {getFromStorage, saveToStorage} from './storage';

const KEY = 'maTvMemory';
const RECENT_MAX = 50;

// Entrées de la liste qui ouvrent une page plutôt qu'une liste de chaînes.
export const isActionCategory = (c) => !!c && (c.kind === 'search' || c.kind === 'rec' || c.kind === 'sports');
export const isLocalCategory = (c) => !!c && (c.kind === 'fav' || c.kind === 'recent');

let memory = {fav: [], recent: [], lastChannel: '', lastCategory: ''};
let loaded = null;

const save = () => saveToStorage(KEY, memory).catch(() => {});

export const loadMaTvMemory = () => {
	if (!loaded) {
		loaded = getFromStorage(KEY)
			.then((stored) => {
				if (stored && typeof stored === 'object') {
					memory = {
						fav: Array.isArray(stored.fav) ? stored.fav : [],
						recent: Array.isArray(stored.recent) ? stored.recent : [],
						lastChannel: stored.lastChannel || '',
						lastCategory: stored.lastCategory || ''
					};
				}
				return memory;
			})
			.catch(() => memory);
	}
	return loaded;
};

export const maTvFavorites = () => memory.fav;
export const maTvRecent = () => memory.recent;
export const maTvLastCategory = () => memory.lastCategory;
export const maTvLastChannel = () => memory.lastChannel;
export const isMaTvFavorite = (id) => memory.fav.indexOf(id) >= 0;

// Ajoute ou retire un favori ; renvoie true s'il est désormais favori.
export const toggleMaTvFavorite = (id) => {
	const list = memory.fav.filter((x) => x !== id);
	const now = list.length === memory.fav.length;
	if (now) list.push(id);
	memory = {...memory, fav: list};
	save();
	return now;
};

// Chaîne regardée : en tête des récentes. Recherche, Sports et
// Enregistrements ne sont pas des listes où revenir.
export const maTvWatched = (id, category) => {
	const recent = [id].concat(memory.recent.filter((x) => x !== id)).slice(0, RECENT_MAX);
	memory = {...memory, recent, lastChannel: id};
	if (category && ['search', 'sports', 'rec'].indexOf(category) < 0) memory.lastCategory = category;
	save();
};

// Catégories affichées (comme l'APK) : Rechercher, Sports et Enregistrements
// en tête (elles ouvrent leur page), puis Favoris et Récentes (si non vides),
// puis celles du serveur (sans ses propres entrées « action »).
export const buildMaTvCategories = (serverCats, labels, fav = memory.fav, recent = memory.recent) => {
	const out = [];
	if (labels.search) out.push({id: 'search', label: labels.search, kind: 'search', n: 0});
	if (labels.sports) out.push({id: 'sports', label: labels.sports, kind: 'sports', n: 0});
	if (labels.rec) out.push({id: 'rec', label: labels.rec, kind: 'rec', n: 0});
	if (fav.length) out.push({id: 'fav', label: labels.fav, kind: 'fav', n: fav.length});
	if (recent.length) out.push({id: 'recent', label: labels.recent, kind: 'recent', n: recent.length});
	(serverCats || []).forEach((c) => {
		if (c && !isActionCategory(c)) out.push(c);
	});
	return out;
};

// Catégorie d'ouverture (maTvStartCategory) : la dernière regardée, sinon les
// favoris, la France, ou la première liste de chaînes.
export const maTvStartCategory = (cats, last) => {
	if (!cats || !cats.length) return 0;
	const find = (pred) => {
		for (let k = 0; k < cats.length; k++) if (pred(cats[k])) return k;
		return -1;
	};
	let i = find((c) => c.id === last && !isActionCategory(c));
	if (i >= 0) return i;
	i = find((c) => c.id === 'fav');
	if (i >= 0) return i;
	i = find((c) => c.id === 'c:FR');
	if (i >= 0) return i;
	i = find((c) => !isActionCategory(c));
	return i >= 0 ? i : 0;
};

// Chaînes d'une catégorie, locale (favoris/récentes, par identifiants) ou serveur.
export const fetchMaTvChannels = async (client, category) => {
	if (!client || !category || isActionCategory(category)) return [];
	let res;
	if (category.kind === 'fav') res = memory.fav.length ? await client.channelsByIds(memory.fav) : null;
	else if (category.kind === 'recent') res = memory.recent.length ? await client.channelsByIds(memory.recent) : null;
	else res = await client.channels(category.id);
	const list = res && Array.isArray(res.chans) ? res.chans : [];
	if (!isLocalCategory(category)) return list;
	// Garder l'ordre de la mémoire (récentes : la plus récente d'abord).
	const order = category.kind === 'fav' ? memory.fav : memory.recent;
	return list.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
};

// Réservé aux tests.
export const resetMaTvMemoryForTests = (m) => {
	memory = {fav: [], recent: [], lastChannel: '', lastCategory: '', ...(m || {})};
	loaded = Promise.resolve(memory);
};
