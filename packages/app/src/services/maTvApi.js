// Client « Ma TV » (IPTV Checker) pour l'app native TV.
//
// Reproduit à l'identique le contrat de l'APK VJOD (lib/data/services/vjod/
// tv_sources.dart + ma_tv.dart) : un serveur Ma TV est une paire {url, key}.
// Chaque appel ajoute `k=<key>` à la query. L'adresse et la clé viennent de la
// collection Jellyfin « VJOD – TV » (marqueur `VJOD-TV:<base64url JSON>` dans
// sa description) ou d'un code collé à la main `https://hôte/chemin#clé`.
//
// Les routes JSON (/tv/api/...) renvoient un objet ou null en cas d'échec. Les
// adresses de lecture (/tv/play|shift|replay/{id}.ts) sont des URLs passées
// telles quelles au lecteur natif (AVPlay sur Samsung, pipeline média sur LG),
// qui décode le MPEG-TS en matériel — donc aucune lecture vidéo via <video>.

import {platformFetch} from './secureFetch';

const MARKER = /VJOD-TV:([A-Za-z0-9_\-+/=]+)/;

// Nettoie une adresse de portail comme l'APK (_cleanUrl) : retire les `/`
// finaux, exige un hôte en http/https. Renvoie null si invalide.
export const cleanPortalUrl = (raw) => {
	let url = String(raw || '').trim();
	while (url.endsWith('/')) url = url.slice(0, -1);
	let parsed;
	try {
		parsed = new URL(url);
	} catch (e) {
		return null;
	}
	if (!parsed.host) return null;
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
	return url;
};

const decodeMarker = (raw) => {
	// base64url -> JSON {url, key}
	const norm = raw.replace(/-/g, '+').replace(/_/g, '/');
	const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
	return JSON.parse(atob(padded));
};

// Serveur Ma TV depuis un objet {url, key} (quelle qu'en soit la source).
export const maTvServerFromJson = (json) => {
	if (!json || typeof json !== 'object') return null;
	const url = cleanPortalUrl(json.url);
	const key = String(json.key || '').trim();
	if (!url || !key) return null;
	return {url, key};
};

// Serveur Ma TV depuis la description d'une collection Jellyfin.
export const maTvServerFromOverview = (overview) => {
	const match = MARKER.exec(overview || '');
	if (!match) return null;
	try {
		return maTvServerFromJson(decodeMarker(match[1]));
	} catch (e) {
		return null;
	}
};

// Serveur Ma TV depuis un code collé à la main : `https://hôte/chemin#clé`.
export const maTvServerFromCode = (code) => {
	const text = String(code || '').trim();
	const hash = text.lastIndexOf('#');
	if (hash <= 0) return null;
	return maTvServerFromJson({url: text.slice(0, hash), key: text.slice(hash + 1)});
};

// Cherche le serveur Ma TV dans une liste de collections Jellyfin déjà
// chargées (on lit leur champ Overview). Renvoie le premier trouvé, ou null.
export const findMaTvServer = (items) => {
	if (!Array.isArray(items)) return null;
	for (const item of items) {
		const server = maTvServerFromOverview(item && item.Overview);
		if (server) return server;
	}
	return null;
};

// Construit l'URL d'une route Ma TV : {url}{path}?{query}&k={key}.
export const maTvEndpoint = (server, path, query = {}) => {
	const url = new URL(`${server.url}${path}`);
	for (const [name, value] of Object.entries(query)) {
		if (value !== undefined && value !== null && value !== '') {
			url.searchParams.set(name, String(value));
		}
	}
	url.searchParams.set('k', server.key);
	return url.toString();
};

const toEpoch = (date) => Math.floor((date instanceof Date ? date.getTime() : date) / 1000);

const DEFAULT_TIMEOUT = 12000;
const LIST_TIMEOUT = 25000;

// fetchJson par défaut : platformFetch (compatible vieilles TV), renvoie
// l'objet décodé ou null (jamais d'exception vers l'appelant), comme _get.
const defaultFetchJson = async (url, timeoutMs) => {
	try {
		const res = await platformFetch(url, {method: 'GET'}, timeoutMs);
		if (!res || res.status !== 200) return null;
		return await res.json();
	} catch (e) {
		return null;
	}
};

// Crée un client Ma TV. `fetchJson` est injectable pour les tests.
export const createMaTvClient = ({server, user = null, caps = null, fetchJson = defaultFetchJson} = {}) => {
	if (!server) throw new Error('maTvApi: serveur Ma TV manquant');

	// Identité client ajoutée aux adresses de lecture (_who de l'APK).
	const who = () => {
		const q = {};
		if (user) q.u = user;
		if (caps) q.caps = caps;
		return q;
	};

	const get = (path, query, timeoutMs = DEFAULT_TIMEOUT) =>
		fetchJson(maTvEndpoint(server, path, query), timeoutMs);

	return {
		server,
		user,
		caps,

		// Catégories (thèmes et pays).
		cats: () => get('/tv/api/cats'),

		// Toute la grille (allChannels de l'APK).
		allChannels: () => get('/tv/api/chans', {cat: 'all'}, LIST_TIMEOUT),

		// Chaînes d'une catégorie.
		channels: (category) => get('/tv/api/chans', {cat: category}, LIST_TIMEOUT),

		// Chaînes par identifiants (≤300, comme l'APK).
		channelsByIds: (ids) =>
			get('/tv/api/chans', {ids: (ids || []).slice(0, 300).join(',')}, LIST_TIMEOUT),

		// Programmes (EPG) de ≤100 chaînes entre `from` et `to`.
		// Renvoie {channelId: [programme...]} ou null.
		programs: async (ids, from, to) => {
			if (!ids || ids.length === 0) return {};
			const json = await get('/tv/api/epg', {
				ids: ids.slice(0, 100).join(','),
				from: toEpoch(from),
				to: toEpoch(to)
			});
			if (!json || typeof json.progs !== 'object' || json.progs === null) return null;
			return json.progs;
		},

		// Matchs du jour (sports() de l'APK) : sports=a,b · teams=x|y (30 au
		// plus, d'abord) · chan= pour une seule chaîne · limit.
		sports: (opts = {}) => {
			const {kinds = [], teams = [], channel = null, limit = 80} = opts;
			return get('/tv/api/sports', {
				sports: kinds.join(','),
				teams: teams.slice(0, 30).join('|'),
				chan: channel || '',
				limit
			}, LIST_TIMEOUT);
		},

		// Téléchargements / replay disponibles.
		downloads: () => get('/tv/api/downloads'),

		// Alertes.
		alerts: () => get('/tv/api/alerts'),

		// Fenêtre de timeshift d'une chaîne.
		shift: (channelId) => get('/tv/api/shift', {id: channelId}),

		// Test de débit seedbox -> appareil (kb/s).
		speed: (kb) => get('/tv/api/speed', {kb}),

		// Adresse de lecture directe d'une chaîne (MPEG-TS).
		liveUrl: (channel) => maTvEndpoint(server, `/tv/play/${channel.id}.ts`, who()),

		// Lecture depuis un instant passé (timeshift), rattrape le direct.
		shiftUrl: (channel, at) =>
			maTvEndpoint(server, `/tv/shift/${channel.id}.ts`, {...who(), at: toEpoch(at)}),

		// Lecture d'un enregistrement du fournisseur (replayUri de l'APK) : début
		// 2 min avant le programme, durée + 7 min (guides rarement à la minute).
		replayUrl: (channel, start, end) => {
			const from = toEpoch(start);
			const to = end ? toEpoch(end) : from + 3600;
			const minutes = Math.max(5, Math.min(600, Math.round((to - from) / 60) + 7));
			return maTvEndpoint(server, `/tv/replay/${channel.id}.ts`, {...who(), start: from - 120, dur: minutes});
		}
	};
};
