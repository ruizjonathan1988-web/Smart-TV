// Le compte Trakt du profil sur cette télé (trakt_account.dart et
// trakt_client.dart de l'APK) : relié par un code à taper sur trakt.tv, ses
// jetons tenus à jour, ce qu'il recommande pour « Pour vous », et les films ou
// épisodes IPTV vus jusqu'au bout envoyés à son historique.
import {TRAKT_CLIENT_ID, parseTraktTitles} from './trakt';
import {fetchOutside} from './outsideFetch';

const BASE = 'https://api.trakt.tv';
const HEADERS = {'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': TRAKT_CLIENT_ID};
const RENEW_AHEAD_MS = 24 * 3600 * 1000;
const STORE = (userId) => `vjod_trakt_${userId || ''}`;

let profileId = '';
let call = fetchOutside;
let renewing = null;
const listeners = new Set();

export const setTraktProfile = (userId) => {
	profileId = userId || '';
};

const read = () => {
	try {
		const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORE(profileId));
		const j = raw ? JSON.parse(raw) : null;
		return j && typeof j === 'object' ? j : {};
	} catch (e) {
		return {};
	}
};

const write = (value) => {
	try {
		if (typeof localStorage === 'undefined') return;
		if (value) localStorage.setItem(STORE(profileId), JSON.stringify(value));
		else localStorage.removeItem(STORE(profileId));
	} catch (e) {
		// Stockage refusé : le compte ne sera pas gardé.
	}
	listeners.forEach((fn) => fn());
};

export const onTraktChange = (fn) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};

export const isTraktConnected = () => Boolean(read().refreshToken);
export const traktUsername = () => read().username || '';

const tokensFrom = (j) => ({
	accessToken: String(j.access_token),
	refreshToken: String(j.refresh_token),
	expiresAt: ((j.created_at || Math.floor(Date.now() / 1000)) + (j.expires_in || 0)) * 1000
});

// Le code à montrer : {deviceCode, userCode, url, intervalMs, expiresMs}.
export const startTraktConnecting = async () => {
	const {status, json} = await call(`${BASE}/oauth/device/code`, {method: 'POST', headers: HEADERS, body: {client_id: TRAKT_CLIENT_ID}});
	if (status !== 200 || !json || !json.device_code) throw new Error('refused');
	return {
		deviceCode: json.device_code,
		userCode: json.user_code,
		url: json.verification_url || 'https://trakt.tv/activate',
		intervalMs: (json.interval || 5) * 1000,
		expiresMs: (json.expires_in || 600) * 1000
	};
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Attend que le code soit validé sur trakt.tv. true : relié ; false : annulé.
// Rejette 'expired', 'denied' ou 'refused' (deviceToken de l'APK).
export const finishTraktConnecting = async (code, isCancelled) => {
	const deadline = Date.now() + code.expiresMs;
	while (Date.now() < deadline) {
		await wait(code.intervalMs); // eslint-disable-line no-await-in-loop
		if (isCancelled()) return false;
		let res;
		try {
			res = await call(`${BASE}/oauth/device/token`, {method: 'POST', headers: HEADERS, body: {code: code.deviceCode, client_id: TRAKT_CLIENT_ID}}); // eslint-disable-line no-await-in-loop
		} catch (e) {
			continue; // Connexion coupée : la prochaine vérification passera peut-être.
		}
		if (res.status === 400 || res.status === 429 || res.status === 0) continue;
		if (res.status === 410) throw new Error('expired');
		if (res.status === 418) throw new Error('denied');
		if (res.status !== 200 || !res.json || !res.json.access_token) throw new Error('refused');
		if (isCancelled()) return false;
		const tokens = tokensFrom(res.json);
		let username = '';
		try {
			const me = await call(`${BASE}/users/settings`, {headers: {...HEADERS, Authorization: `Bearer ${tokens.accessToken}`}}); // eslint-disable-line no-await-in-loop
			username = (me.json && me.json.user && me.json.user.username) || '';
		} catch (e) {
			// Le nom n'est qu'affiché.
		}
		write({...tokens, username});
		return true;
	}
	throw new Error('expired');
};

export const disconnectTrakt = () => write(null);

const renew = async () => {
	const saved = read();
	try {
		const {status, json} = await call(`${BASE}/oauth/token`, {method: 'POST', headers: HEADERS, body: {refresh_token: saved.refreshToken, client_id: TRAKT_CLIENT_ID, grant_type: 'refresh_token'}});
		if (status === 200 && json && json.access_token) {
			const tokens = tokensFrom(json);
			write({...saved, ...tokens});
			return tokens.accessToken;
		}
		if (status === 400 || status === 401) {
			// Trakt ne l'accepte plus : les réglages proposeront de le relier.
			disconnectTrakt();
			return null;
		}
	} catch (e) {
		// Trakt injoignable : l'ancien jeton peut encore servir.
	}
	return saved.expiresAt && Date.now() < saved.expiresAt ? saved.accessToken : null;
};

const accessToken = () => {
	const saved = read();
	if (!saved.refreshToken) return Promise.resolve(null);
	if (saved.expiresAt && Date.now() + RENEW_AHEAD_MS < saved.expiresAt) return Promise.resolve(saved.accessToken);
	if (!renewing) {
		renewing = renew().finally(() => {
			renewing = null;
		});
	}
	return renewing;
};

const kind = (mediaType) => (mediaType === 'tv' ? 'shows' : 'movies');

// Les ids TMDB que Trakt recommande au compte, rien sans compte.
export const traktRecommendations = async (mediaType, limit = 20) => {
	const token = await accessToken();
	if (!token) return [];
	const {status, json} = await call(`${BASE}/recommendations/${kind(mediaType)}?limit=${limit}&ignore_collected=true`, {headers: {...HEADERS, Authorization: `Bearer ${token}`}});
	if (status !== 200 || !Array.isArray(json)) return [];
	return parseTraktTitles(json, mediaType);
};

// Un film ou un épisode vu ailleurs que dans la bibliothèque (IPTV) entre à
// l'historique du compte. Ne fait rien sans compte, n'échoue jamais.
export const traktMarkWatched = async ({mediaType, tmdbId, season = null, episode = null, at = Date.now()}) => {
	try {
		const token = await accessToken();
		if (!token || !tmdbId) return;
		const when = new Date(at).toISOString();
		let body;
		if (mediaType === 'tv') {
			if (!season || !episode) return;
			body = {shows: [{ids: {tmdb: tmdbId}, seasons: [{number: season, episodes: [{number: episode, watched_at: when}]}]}]};
		} else {
			body = {movies: [{ids: {tmdb: tmdbId}, watched_at: when}]};
		}
		await call(`${BASE}/sync/history`, {method: 'POST', headers: {...HEADERS, Authorization: `Bearer ${token}`}, body});
	} catch (e) {
		// L'historique Trakt est un plus.
	}
};

export const setTraktCallForTests = (fn) => {
	call = fn || fetchOutside;
	renewing = null;
};
