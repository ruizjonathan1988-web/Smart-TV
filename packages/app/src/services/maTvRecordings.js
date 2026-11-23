// Enregistrements de Ma TV sur la seedbox (ma_tv_recordings.dart de l'APK) :
// elle enregistre seule, la TV peut être éteinte. Un programme de la grille,
// toutes les diffusions d'un titre sur une chaîne, ou un créneau. Gardés
// 7 jours sauf si on les garde.
import {maTvEndpoint} from './maTvApi';
import {platformFetch} from './secureFetch';

const TIMEOUT = 10000;
const num = (v) => {
	const n = typeof v === 'number' ? v : parseFloat(v);
	return isNaN(n) ? 0 : n;
};
const str = (v) => (v === undefined || v === null ? '' : String(v));

// MaTvRecording.fromJson ; start / end en secondes epoch.
export const parseRecording = (j) => {
	if (!j || typeof j !== 'object' || !str(j.id)) return null;
	return {
		id: str(j.id),
		channelId: str(j.chan),
		channelName: str(j.chan_name),
		number: typeof j.num === 'number' ? j.num : null,
		title: str(j.title),
		subtitle: str(j.sub),
		start: Math.round(num(j.start)),
		end: Math.round(num(j.end)),
		status: str(j.status) || 'scheduled',
		rule: str(j.rule),
		keep: j.keep === true,
		size: typeof j.size === 'number' ? j.size : 0,
		message: str(j.msg)
	};
};

export const parseRecordings = (j) => {
	if (!j || typeof j !== 'object') return null;
	const list = (v) => (Array.isArray(v) ? v : []);
	return {
		items: list(j.items).map(parseRecording).filter(Boolean),
		rules: list(j.rules)
			.filter((r) => r && typeof r === 'object' && str(r.id))
			.map((r) => ({id: str(r.id), channelId: str(r.chan), channelName: str(r.chan_name), title: str(r.title)})),
		used: typeof j.used === 'number' ? j.used : 0,
		free: typeof j.free === 'number' ? j.free : null,
		keepDays: typeof j.keep_days === 'number' ? j.keep_days : 7
	};
};

export const isScheduled = (r) => r.status === 'scheduled';
export const isRecording = (r) => r.status === 'recording';
export const isFailed = (r) => r.status === 'failed';
export const isPlayable = (r) => r.size > 0 && (r.status === 'done' || r.status === 'partial' || r.status === 'recording');

// L'enregistrement prévu ou en cours du programme qui commence à `start` sur `channelId`.
export const recordingOf = (recs, channelId, start) => {
	if (!recs) return null;
	for (let i = 0; i < recs.items.length; i++) {
		const r = recs.items[i];
		if ((isScheduled(r) || isRecording(r)) && r.channelId === channelId && start >= r.start && start < r.end) return r;
	}
	return null;
};

// Le dernier relevé, pour que la grille marque tout de suite ce qui est prévu.
let last = null;
export const lastRecordings = () => last;

const post = async (server, path, body) => {
	try {
		const res = await platformFetch(maTvEndpoint(server, path), {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(body)
		}, TIMEOUT);
		if (!res) return null;
		let json = null;
		try {
			json = await res.json();
		} catch (e) {
			json = null;
		}
		return {status: res.status, json};
	} catch (e) {
		return null;
	}
};

export const createRecorder = (maTvClient) => {
	const server = maTvClient.server;
	return {
		list: async () => {
			try {
				const res = await platformFetch(maTvEndpoint(server, '/tv/api/rec'), {method: 'GET'}, TIMEOUT);
				if (!res || res.status !== 200) return null;
				const out = parseRecordings(await res.json());
				if (out) last = out;
				return out;
			} catch (e) {
				return null;
			}
		},
		// Programme start–end (secondes) ; avec series, toutes les diffusions du
		// titre sur la chaîne. null si c'est fait, sinon ce qui n'a pas marché.
		add: async ({channelId, start, end, title = '', subtitle = '', series = false}) => {
			const r = await post(server, '/tv/api/rec/add', {chan: channelId, start, end, title, sub: subtitle, series});
			if (!r) return 'Ma TV ne répond pas';
			if (r.status === 200) return null;
			return r.json && r.json.error ? str(r.json.error) : 'L’enregistrement n’a pas pu être programmé';
		},
		remove: async (id) => {
			const r = await post(server, '/tv/api/rec/delete', {id});
			return !!r && r.status === 200;
		},
		keep: async (id, keep) => {
			const r = await post(server, '/tv/api/rec/keep', {id, keep});
			return !!r && r.status === 200;
		},
		removeRule: async (id) => {
			const r = await post(server, '/tv/api/rec/rule/delete', {id});
			return !!r && r.status === 200;
		},
		// Le fichier d'un enregistrement, avec avance et recul.
		playUrl: (rec) => maTvEndpoint(server, `/tv/rec/${rec.id}.ts`)
	};
};

export const resetRecordingsForTests = () => {
	last = null;
};
