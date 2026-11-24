// POST JSON vers Ma TV (seerr/cancel, delete, replay/keep…) : renvoie {status, json}, jamais
// d'exception vers l'appelant (status 0 quand Ma TV ne répond pas).
import {maTvEndpoint} from './maTvApi';
import {platformFetch} from './secureFetch';

export const postMaTv = async (server, path, body, timeoutMs = 30000) => {
	if (!server) return {status: 0, json: null};
	try {
		const res = await platformFetch(maTvEndpoint(server, path), {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(body || {})
		}, timeoutMs);
		if (!res) return {status: 0, json: null};
		let json = null;
		try {
			json = await res.json();
		} catch (err) {
			json = null;
		}
		return {status: res.status, json};
	} catch (err) {
		return {status: 0, json: null};
	}
};
