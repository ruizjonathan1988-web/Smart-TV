// Les services publics que l'APK interroge en plus de Seerr (Trakt, BetaSeries,
// Wikidata). Sur webOS la page est à file:// et Trakt ne répond qu'aux origines
// qu'on lui a déclarées : la requête passe par le service Node de l'appli, qui
// n'a pas d'origine. Ailleurs, le fetch ordinaire (ou le shell sur Fire TV).
import {corsFreeFetch, originFreeFetch} from './secureFetch';
import {isWebOS} from '../platform';

const TIMEOUT_MS = 8000;

export const fetchOutsideJson = async (url, {headers = {}, timeoutMs = TIMEOUT_MS} = {}) => {
	const options = {method: 'GET', headers};
	const res = await (isWebOS() ? originFreeFetch(url, options, timeoutMs) : corsFreeFetch(url, options, timeoutMs));
	if (!res || !res.ok) {
		const err = new Error(`HTTP ${res ? res.status : 0}`);
		err.status = res ? res.status : 0;
		throw err;
	}
	return res.json();
};

// Quelques appels à la fois, pour rester poli ; un appel qui échoue donne null.
export const mapBounded = async (list, limit, fn) => {
	const out = new Array(list.length);
	let next = 0;
	const worker = async () => {
		while (next < list.length) {
			const i = next++;
			try {
				out[i] = await fn(list[i], i);
			} catch (e) {
				out[i] = null;
			}
		}
	};
	await Promise.all(Array.from({length: Math.min(limit, list.length)}, worker));
	return out;
};

// La même voie pour un appel qui envoie quelque chose (POST) et dont le code
// de réponse compte : {status, json}, json null quand la réponse n'en est pas.
export const fetchOutside = async (url, {method = 'GET', headers = {}, body, timeoutMs = TIMEOUT_MS} = {}) => {
	const options = {method, headers};
	if (body !== undefined) options.body = typeof body === 'string' ? body : JSON.stringify(body);
	const res = await (isWebOS() ? originFreeFetch(url, options, timeoutMs) : corsFreeFetch(url, options, timeoutMs));
	if (!res) return {status: 0, json: null};
	let json = null;
	try {
		json = await res.json();
	} catch (e) {
		json = null;
	}
	return {status: res.status, json};
};
