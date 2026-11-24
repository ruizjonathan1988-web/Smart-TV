// Aura, le jeu de cinéma, dans VJOD (aura.dart, aura_cloud.dart et
// aura_service.dart de l'APK, VJOD 4.37).
//
// Le pont avec l'appli Aura passe par les préférences d'affichage Jellyfin de
// l'utilisateur (identifiant « aura », client « aura ») : Aura y dépose son
// état (la course, les cartes des soirs à venir), VJOD y écrit la carte jouée.
// L'aura : on se propose des films et des séries entre les profils de la
// maison. Celui qui propose gagne +1 quand l'autre regarde, +2 quand il aime,
// +3 de plus quand plusieurs aiment le même film.
import {api, getUserId, resolveItemsByProviderIds} from './jellyfinApi';
import {platformFetch} from './secureFetch';
import {getFromStorage, saveToStorage} from './storage';

// ---------------------------------------------------------------- les règles

export const AURA_MODES = ['off', 'button'];
export const auraModeOf = (id) => (AURA_MODES.includes(id) ? id : 'off');

// Rangé avec le mode simple, dans les préférences « vjod » du profil.
export const VJOD_PREFS_ID = 'vjod';
export const VJOD_PREFS_CLIENT = 'vjod';
export const AURA_MODE_KEY = 'auraMode';

export const BRIDGE = {prefsId: 'aura', client: 'aura', stateKey: 'etat', playedKey: 'joue'};
export const BOARD_SIZE = 30;

const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// La carte jouée, au format qu'Aura lit.
export const playedValue = (day, index, at) => JSON.stringify({jour: day, index, quand: at.toISOString()});

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null);

export const cardFromJson = (j) => {
	if (!j || typeof j !== 'object') return null;
	const f = j.film;
	if (!f || typeof f.id !== 'string' || typeof f.titre !== 'string') return null;
	return {
		type: String(j.type ?? ''),
		challenge: String(j.defi ?? ''),
		squares: num(j.cases) ?? 1,
		level: num(j.niveau),
		filmId: f.id,
		title: f.titre,
		year: num(f.annee),
		tmdbId: num(f.tmdb),
		onServer: f.jellyfin === true
	};
};

// L'état d'Aura lu dans ses préférences ; null quand Aura n'a rien publié.
export const stateFromPrefs = (customPrefs) => {
	const raw = customPrefs && customPrefs[BRIDGE.stateKey];
	if (!raw) return null;
	let j;
	try {
		j = JSON.parse(raw);
	} catch (e) {
		return null;
	}
	if (!j || j.v !== 1) return null;
	const cards = {};
	if (j.cartes && typeof j.cartes === 'object') {
		for (const [k, v] of Object.entries(j.cartes)) {
			if (Array.isArray(v)) cards[k] = v.map(cardFromJson).filter(Boolean);
		}
	}
	return {
		position: num(j.position) ?? 0,
		pop: num(j.pop) ?? 0,
		level: num(j.niveau),
		cards,
		playingTitle: j.seance && typeof j.seance.titre === 'string' ? j.seance.titre : null
	};
};

export const cardsFor = (state, d) => (state && state.cards[dayKey(d)]) || [];

// « Tu as 3 cases d'avance sur Pop », pour le haut du tiroir.
export const raceLine = (state) => {
	const gap = state.position - state.pop;
	if (gap > 0) return `Tu as ${gap} case${gap > 1 ? 's' : ''} d’avance sur Pop.`;
	if (gap < 0) return `Pop a ${-gap} case${gap < -1 ? 's' : ''} d’avance sur toi.`;
	return 'Tu es à égalité avec Pop.';
};

export const filmKey = ({tmdb, jellyfin}) => (tmdb != null ? `tmdb:${tmdb}` : `jf:${jellyfin || ''}`);
export const person = (serverId, userId) => `${serverId}:${userId}`;

const dateOrNull = (v) => {
	if (v == null) return null;
	const d = new Date(String(v));
	return Number.isNaN(d.getTime()) ? null : d;
};

export const proposalFromJson = (raw) => {
	if (!raw || typeof raw !== 'object') return null;
	const film = raw.film;
	if (typeof raw.id !== 'string' || typeof raw.de !== 'string' || !film || typeof film.titre !== 'string') return null;
	const opens = film.ouvrir_le ? dateOrNull(film.ouvrir_le) : null;
	return {
		id: raw.id,
		from: raw.de,
		fromPerson: typeof raw.de_personne === 'string' ? raw.de_personne : null,
		fromName: raw.de_nom || '?',
		toPerson: typeof raw.pour_personne === 'string' ? raw.pour_personne : null,
		toPlayer: typeof raw.pour_joueur === 'string' ? raw.pour_joueur : null,
		toName: raw.pour_nom || '?',
		filmKey: raw.film_cle || '',
		title: film.titre,
		year: num(film.annee),
		tmdbId: num(film.tmdb),
		jellyfinId: typeof film.jellyfin === 'string' ? film.jellyfin : null,
		series: film.type === 'series',
		note: typeof raw.mot === 'string' ? raw.mot : null,
		seenAt: dateOrNull(raw.vu_le),
		liked: raw.aime === true,
		rating: num(raw.note),
		createdAt: dateOrNull(raw.cree_le) || new Date(0),
		opensOn: opens ? new Date(opens.getFullYear(), opens.getMonth(), opens.getDate()) : null
	};
};

export const author = (p) => p.fromPerson || p.from;
export const recipient = (p) => p.toPerson || p.toPlayer || '';
export const isSeen = (p) => p.seenAt != null;
export const isLoved = (p) => p.liked || (p.rating || 0) >= 4;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Un film cacheté : le titre reste caché jusqu'au jour prévu.
export const isSealed = (p, now = new Date()) => p.opensOn != null && startOfDay(now) < p.opensOn;

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const opensLabel = (p, now = new Date()) => {
	const o = p.opensOn;
	if (!o) return '';
	const gap = Math.round((o - startOfDay(now)) / 86400000);
	if (gap <= 0) return 'à ouvrir dès maintenant';
	if (gap === 1) return 'à ouvrir demain';
	if (gap < 7) return `à ouvrir ${WEEKDAYS[o.getDay()]}`;
	return `à ouvrir le ${o.getDate()}`;
};

// Un nom accepté par le serveur : de 1 à 40 caractères.
export const auraName = (name) => {
	const n = String(name || '').trim();
	if (!n) return '?';
	return n.length > 40 ? n.substring(0, 40) : n;
};

// Un pseudo accepté par le serveur : de 2 à 24 caractères.
export const auraPseudo = (name) => {
	let n = String(name || '').trim();
	if (n.length > 24) n = n.substring(0, 24);
	if (n.length < 2) n = n ? `${n}.` : 'VJOD';
	return n;
};

export const newInHouse = ({fromPerson, fromName, toPerson, toName, house: home, title, year, tmdbId, jellyfinId, series = false, note}) => {
	const film = {titre: title, type: series ? 'series' : 'movie'};
	if (year != null) film.annee = year;
	if (tmdbId != null) film.tmdb = tmdbId;
	if (jellyfinId != null) film.jellyfin = jellyfinId;
	const body = {
		de_personne: fromPerson,
		de_nom: auraName(fromName),
		pour_personne: toPerson,
		pour_nom: auraName(toName),
		maison: home,
		film_cle: filmKey({tmdb: tmdbId, jellyfin: jellyfinId}),
		film
	};
	const mot = note ? note.trim() : '';
	if (mot) body.mot = mot.length > 140 ? mot.substring(0, 140) : mot;
	return body;
};

export const SCORE = {seen: 1, loved: 2, lovedByMany: 3};

export const scores = (proposals) => {
	const points = {};
	const lovers = {};
	for (const p of proposals) {
		let n = 0;
		if (isSeen(p)) n += SCORE.seen;
		if (isLoved(p)) {
			n += SCORE.loved;
			const k = `${author(p)}|${p.filmKey}`;
			(lovers[k] = lovers[k] || new Set()).add(recipient(p));
		}
		points[author(p)] = (points[author(p)] || 0) + n;
	}
	for (const [k, set] of Object.entries(lovers)) {
		if (set.size >= 2) {
			const who = k.substring(0, k.lastIndexOf('|'));
			points[who] = (points[who] || 0) + SCORE.lovedByMany;
		}
	}
	return points;
};

// De la plus forte aura à la plus faible, puis par nom.
export const ranking = (proposals) => {
	const s = scores(proposals);
	const names = {};
	for (const p of proposals) names[author(p)] = p.fromName;
	return Object.entries(s)
		.map(([who, aura]) => ({who, name: names[who] || '?', aura}))
		.sort((a, b) => (b.aura !== a.aura ? b.aura - a.aura : a.name.localeCompare(b.name)));
};

// Ce que Jellyfin dit d'un titre proposé, pour celui qui l'a reçu.
export const watchFromUserData = (u) => {
	if (!u) return {played: false, favorite: false, rating: null, likes: null};
	const count = num(u.PlayCount) || 0;
	const unplayed = num(u.UnplayedItemCount);
	const percent = typeof u.PlayedPercentage === 'number' ? u.PlayedPercentage : 0;
	return {
		played: u.Played === true || count > 0 || (unplayed != null && percent > 0),
		favorite: u.IsFavorite === true,
		rating: typeof u.Rating === 'number' ? u.Rating : null,
		likes: typeof u.Likes === 'boolean' ? u.Likes : null
	};
};

const watchLoved = (w) => w.favorite || w.likes === true || (w.rating || 0) >= 8;

// Ce qu'il faut écrire sur la proposition, ou null. On n'enlève jamais rien.
export const patchFor = (w, p, now = new Date()) => {
	const patch = {};
	if ((w.played || watchLoved(w)) && !isSeen(p)) patch.vu_le = now.toISOString();
	if (watchLoved(w) && !p.liked) patch.aime = true;
	return Object.keys(patch).length ? patch : null;
};

// Les mots qu'on peut joindre, sans clavier (la télécommande n'en a pas).
export const AURA_NOTES = [null, 'Tu vas adorer.', 'Fais-moi confiance.', 'Pour un soir de pluie.', 'On en parle après ?'];

// ---------------------------------------------------------------- le serveur d'Aura

// La clé « anon » est faite pour être dans les applis : ce sont les règles
// d'accès du serveur qui protègent.
export const AURA_SERVER = {
	url: 'https://trjocwmslkxtluuhsvgx.supabase.co',
	anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyam9jd21zbGt4dGx1dWhzdmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MTE2MzksImV4cCI6MjEwOTQ4NzYzOX0.dIR1DCJAY9C1tQn_--oPw3m9eebTNMT6M7E6K7OmQOc'
};

export class AuraCloudError extends Error {}

const sessionFromAuth = (j, now) => {
	if (!j || !j.user || typeof j.user.id !== 'string' || typeof j.access_token !== 'string' || typeof j.refresh_token !== 'string') return null;
	return {u: j.user.id, a: j.access_token, r: j.refresh_token, e: now + (num(j.expires_in) || 3600) * 1000};
};

// Les appels au serveur d'Aura ; la session anonyme reste sur la télé.
export const createAuraCloud = ({load, save, fetcher = platformFetch, clock = Date.now, server = AURA_SERVER}) => {
	let session = null;
	const headers = (token) => ({apikey: server.anonKey, Authorization: `Bearer ${token || server.anonKey}`, 'Content-Type': 'application/json'});
	const call = async (path, {method = 'GET', body, token, prefer} = {}) => {
		const h = headers(token);
		if (prefer) h.Prefer = prefer;
		const res = await fetcher(`${server.url}${path}`, {method, headers: h, body: body === undefined ? undefined : JSON.stringify(body)}, 15000);
		const status = res ? res.status : 0;
		let json = null;
		try {
			const text = res && res.text ? await res.text() : '';
			json = text ? JSON.parse(text) : null;
		} catch (e) {
			json = null;
		}
		return {status, json};
	};
	const keep = async (s) => {
		session = s;
		await save(JSON.stringify(s));
		return s;
	};
	const getSession = async () => {
		const now = clock();
		let s = session;
		if (!s) {
			try {
				const raw = await load();
				s = raw ? JSON.parse(raw) : null;
			} catch (e) {
				s = null;
			}
		}
		if (s && now < s.e - 120000) {
			session = s;
			return s;
		}
		if (s) {
			const refreshed = await call('/auth/v1/token?grant_type=refresh_token', {method: 'POST', body: {refresh_token: s.r}});
			const renewed = refreshed.status === 200 ? sessionFromAuth(refreshed.json, now) : null;
			if (renewed) return keep(renewed);
		}
		const r = await call('/auth/v1/signup', {method: 'POST', body: {data: {}}});
		const fresh = r.status === 200 ? sessionFromAuth(r.json, now) : null;
		if (!fresh) {
			throw new AuraCloudError(r.status === 422 || r.status === 400
				? 'Le serveur d’Aura refuse les comptes anonymes.'
				: 'Le serveur d’Aura ne répond pas.');
		}
		return keep(fresh);
	};
	const check = (r) => {
		if (r.status >= 200 && r.status < 300) return;
		if (r.status === 409) throw new AuraCloudError('Déjà proposé.');
		throw new AuraCloudError(`Le serveur d’Aura a répondu ${r.status}.`);
	};
	const q = (params) => Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
	return {
		session: getSession,
		register: async ({pseudo, house: home, person: who}) => {
			const s = await getSession();
			check(await call('/rest/v1/joueurs?on_conflict=id', {method: 'POST', token: s.a, prefer: 'resolution=merge-duplicates,return=minimal', body: {id: s.u, pseudo: auraPseudo(pseudo), maison: home, personne: who}}));
		},
		housemates: async ({house: home, me: self}) => {
			const s = await getSession();
			const r = await call(`/rest/v1/joueurs?${q({select: 'pseudo,personne', maison: `eq.${home}`, personne: 'not.is.null'})}`, {token: s.a});
			check(r);
			const seen = new Set([self]);
			const out = [];
			for (const j of Array.isArray(r.json) ? r.json : []) {
				if (!j || typeof j.personne !== 'string' || seen.has(j.personne)) continue;
				seen.add(j.personne);
				out.push({person: j.personne, name: String(j.pseudo || '?')});
			}
			return out.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
		},
		proposals: async () => {
			const s = await getSession();
			const r = await call(`/rest/v1/propositions?${q({select: '*', order: 'cree_le.desc', limit: '300'})}`, {token: s.a});
			check(r);
			return (Array.isArray(r.json) ? r.json : []).map(proposalFromJson).filter(Boolean);
		},
		propose: async (body) => {
			const s = await getSession();
			check(await call('/rest/v1/propositions', {method: 'POST', token: s.a, prefer: 'return=minimal', body}));
		},
		mark: async (id, patch) => {
			const s = await getSession();
			check(await call(`/rest/v1/propositions?id=eq.${encodeURIComponent(id)}`, {method: 'PATCH', token: s.a, prefer: 'return=minimal', body: patch}));
		}
	};
};

// ---------------------------------------------------------------- le profil en cours

let cloud = null;
let cloudFor = null;
let houseId = null;
let registeredFor = null;
let userName = 'VJOD';

export const setAuraUserName = (name) => {
	userName = name || 'VJOD';
};

const auraCloud = () => {
	const user = getUserId() || '';
	if (!cloud || cloudFor !== user) {
		const key = `vjod_aura_session_${user}`;
		cloud = createAuraCloud({load: () => getFromStorage(key), save: (v) => saveToStorage(key, v)});
		cloudFor = user;
		registeredFor = null;
	}
	return cloud;
};

// L'identifiant Jellyfin du serveur : c'est la maison.
const getHouse = async () => {
	if (houseId) return houseId;
	const info = await api.getPublicInfo();
	const id = info && info.Id ? String(info.Id) : '';
	if (!id) throw new AuraCloudError('Le serveur Jellyfin ne dit pas qui il est.');
	houseId = id;
	return id;
};

const me = async () => person(await getHouse(), getUserId() || '');

const readPrefs = async (id, client) => {
	try {
		return (await api.getDisplayPreferences(id, client)) || {Id: id, CustomPrefs: {}};
	} catch (e) {
		return {Id: id, CustomPrefs: {}};
	}
};

// Le réglage du profil, lu dans Jellyfin (il suit le profil sur ses appareils).
export const readAuraMode = async () => {
	const prefs = await api.getDisplayPreferences(VJOD_PREFS_ID, VJOD_PREFS_CLIENT);
	return auraModeOf(prefs && prefs.CustomPrefs ? prefs.CustomPrefs[AURA_MODE_KEY] : null);
};

export const writeAuraMode = async (mode) => {
	const current = await readPrefs(VJOD_PREFS_ID, VJOD_PREFS_CLIENT);
	await api.saveDisplayPreferences(VJOD_PREFS_ID, VJOD_PREFS_CLIENT, {
		...current,
		Id: current.Id || VJOD_PREFS_ID,
		CustomPrefs: {...(current.CustomPrefs || {}), [AURA_MODE_KEY]: mode}
	});
};

// Le joueur de cette télé, relié à la maison et à la personne : une fois par
// profil et par lancement.
export const registerAura = async () => {
	const user = getUserId() || '';
	if (!user || registeredFor === user) return;
	try {
		await auraCloud().register({pseudo: userName, house: await getHouse(), person: await me()});
		registeredFor = user;
	} catch (e) {
		// On réessaiera à la prochaine ouverture.
	}
};

export const auraState = async () => {
	try {
		const prefs = await api.getDisplayPreferences(BRIDGE.prefsId, BRIDGE.client);
		return stateFromPrefs(prefs && prefs.CustomPrefs);
	} catch (e) {
		return null;
	}
};

// Joue une carte du soir : Aura en fait une séance à sa prochaine ouverture.
export const playCard = async (day, index) => {
	const current = await readPrefs(BRIDGE.prefsId, BRIDGE.client);
	await api.saveDisplayPreferences(BRIDGE.prefsId, BRIDGE.client, {
		...current,
		Id: current.Id || BRIDGE.prefsId,
		CustomPrefs: {...(current.CustomPrefs || {}), [BRIDGE.playedKey]: playedValue(dayKey(day), index, new Date())}
	});
};

const watchOf = async (p) => {
	try {
		if (p.jellyfinId) {
			const own = await api.getItem(p.jellyfinId);
			return watchFromUserData(own && own.UserData);
		}
		if (p.tmdbId == null) return null;
		// Retrouvé par l'index de la bibliothèque (Jellyfin ignore le filtre TMDB).
		const [found] = await resolveItemsByProviderIds([{Id: `tmdb-${p.tmdbId}`, Type: p.series ? 'Series' : 'Movie', ProviderIds: {Tmdb: String(p.tmdbId)}}]);
		if (!found || !found._resolvedFromExternal) return null;
		const item = await api.getItem(found.Id);
		return watchFromUserData(item && item.UserData);
	} catch (e) {
		return null;
	}
};

const reportWatched = async (all, mine) => {
	let any = false;
	for (const p of all) {
		if (recipient(p) !== mine || (isSeen(p) && p.liked)) continue;
		const w = await watchOf(p); // eslint-disable-line no-await-in-loop
		const patch = w && patchFor(w, p);
		if (!patch) continue;
		try {
			await auraCloud().mark(p.id, patch); // eslint-disable-line no-await-in-loop
			any = true;
		} catch (e) {
			// Le « vu » repartira à la prochaine ouverture.
		}
	}
	return any;
};

// Tout le tiroir : la course, les cartes, ce qu'on m'a proposé, l'aura de la
// maison. Ce que Jellyfin dit avoir été vu ou aimé part au serveur.
export const auraDrawer = async () => {
	const state = await auraState();
	try {
		await registerAura();
		const mine = await me();
		let all = await auraCloud().proposals();
		if (await reportWatched(all, mine)) all = await auraCloud().proposals();
		const prefix = `${houseId || ''}:`;
		return {
			state,
			me: mine,
			received: all.filter((p) => recipient(p) === mine && !isSeen(p)),
			ranking: ranking(all.filter((p) => p.fromPerson && p.fromPerson.startsWith(prefix))),
			error: null
		};
	} catch (e) {
		return {state, me: '', received: [], ranking: [], error: e.message || String(e)};
	}
};

export const auraHousemates = async () => {
	await registerAura();
	return auraCloud().housemates({house: await getHouse(), me: await me()});
};

export const auraPropose = async ({to, title, year, tmdbId, jellyfinId, series, note}) => {
	await registerAura();
	await auraCloud().propose(newInHouse({
		fromPerson: await me(), fromName: userName, toPerson: to.person, toName: to.name,
		house: await getHouse(), title, year, tmdbId, jellyfinId, series, note
	}));
};

export const resetAuraForTests = () => {
	cloud = null;
	cloudFor = null;
	houseId = null;
	registeredFor = null;
	userName = 'VJOD';
};
