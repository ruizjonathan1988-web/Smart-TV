// La clé personnelle de chaque profil pour Ma TV (Ma TV 3.60, enrollMaTv de
// l'APK, tv_sources.dart). Le profil montre son jeton Jellyfin, que Ma TV fait
// vérifier par Jellyfin, et reçoit sa propre clé : la seedbox sait qui regarde
// quoi, et l'admin peut couper un profil seul. Redemandé au plus toutes les
// 30 minutes pour suivre une nouvelle clé ou une coupure. Un Ma TV plus ancien
// répond 404 : la clé partagée reste en service, comme avant.
import {maTvEndpoint} from './maTvApi';
import {platformFetch} from './secureFetch';

const STORE = (userId) => `vjod_matv_personal_${userId || ''}`;
const EVERY_MS = 30 * 60 * 1000;
const asked = {};

const read = (userId) => {
	try {
		const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORE(userId));
		const j = raw ? JSON.parse(raw) : null;
		return j && typeof j === 'object' ? j : null;
	} catch (e) {
		return null;
	}
};

const write = (userId, value) => {
	try {
		if (typeof localStorage !== 'undefined') localStorage.setItem(STORE(userId), JSON.stringify(value));
	} catch (e) {
		// Stockage plein ou refusé : la clé partagée reste en service.
	}
};

// La clé du profil pour ce serveur Ma TV, ou null.
export const personalMaTvKey = (userId, url) => {
	const j = read(userId);
	return j && j.url === url && typeof j.key === 'string' && j.key ? j.key : null;
};

// L'admin a coupé ce profil de Ma TV (Ma TV l'a dit).
export const maTvAccessCut = (userId, url) => {
	const j = read(userId);
	return Boolean(j && j.cut === true && (!url || j.url === url));
};

// Le serveur avec la clé du profil quand Ma TV en a donné une.
export const withPersonalKey = (server, userId) => {
	if (!server) return server;
	const own = personalMaTvKey(userId, server.url);
	return own ? {...server, key: own} : server;
};

// Demande sa clé à Ma TV. Renvoie true si la clé en service a changé.
export const enrollMaTv = async ({server, userId, accessToken, force = false}) => {
	if (!server || !userId || !accessToken) return false;
	const now = Date.now();
	if (!force && asked[userId] && now - asked[userId] < EVERY_MS) return false;
	asked[userId] = now;
	try {
		const res = await platformFetch(maTvEndpoint(server, '/tv/api/enroll'), {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({token: accessToken})
		}, 15000);
		if (!res) return false;
		let next;
		if (res.status === 200) {
			const j = await res.json();
			const key = j && typeof j === 'object' && j.key ? String(j.key) : '';
			if (!key) return false;
			next = {url: server.url, key};
		} else if (res.status === 403) {
			next = {url: server.url, cut: true};
		} else {
			// 404 (Ma TV avant 3.60), Jellyfin injoignable… : rien ne change.
			return false;
		}
		const before = read(userId);
		if (before && JSON.stringify(before) === JSON.stringify(next)) return false;
		write(userId, next);
		return true;
	} catch (e) {
		return false;
	}
};

export const resetMaTvEnrollForTests = () => {
	Object.keys(asked).forEach((k) => delete asked[k]);
};
