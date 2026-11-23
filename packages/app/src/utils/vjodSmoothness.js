// VJOD 5.3 (comme lib/util/vjod_smoothness.dart) : la fluidité réelle de chaque écran sur cette TV.
// Chaque image dessinée est chronométrée (requestAnimationFrame) ; une image de plus de 32 ms en
// rate deux à 60 images par seconde, l'œil la voit comme un à-coup. Gardé par écran, montré dans
// « À propos ».
//
// VJOD 5.6 : et le temps que met chaque écran à se poser une fois ouvert, du moment où il
// s'affiche au dernier changement avant qu'il ne bouge plus (plus rien à charger, plus de roue
// qui tourne). Sur la TV, ce sont les changements de la page (MutationObserver) qui comptent, le
// navigateur dessinant des images même quand rien ne bouge. Un écran qui ne s'arrête jamais (bande
// annonce, chaîne en direct) n'est pas mesuré.

export const SLOW_MS = 32;
const KEEP_SCREENS = 14;
const MIN_FRAMES = 30;
// Au-delà, la TV était en veille ou l'onglet caché : ce n'est pas une image ratée.
const PAUSE_MS = 1000;

// L'écran est posé après ce temps sans changement.
export const STILL_MS = 300;
// Au-delà, l'écran est animé plutôt qu'en chargement : pas de mesure.
export const MAX_OPEN_MS = 15000;
const KEEP_OPENS = 30;

const frames = new Map();
const opens = new Map();
let openName = null;
let openAt = 0;
let lastChangeAt = 0;
let watch = null;
let observer = null;
const slow = new Map();
const worst = new Map();
let screen = 'Accueil';
let started = false;
let last = 0;

// Les panneaux de l'appli sous un nom lisible.
const SCREEN_NAMES = {
	LOGIN: 'Connexion', BROWSE: 'Accueil', DETAILS: 'Fiche', LIBRARY: 'Bibliothèque', SEARCH: 'Recherche',
	SETTINGS: 'Réglages', PLAYER: 'Lecteur', FAVORITES: 'Favoris', GENRES: 'Genres', LIVETV: 'TV en direct',
	SEERR_DISCOVER: 'Découvrir', SEERR_REQUESTS: 'Demandes', GENRE_BROWSE: 'Genre', RECORDINGS: 'Enregistrements',
	SEERR_BROWSE: 'Seerr', SEERR_PERSON: 'Personne', ADD_SERVER: 'Ajout de serveur', ADD_USER: 'Ajout d’utilisateur',
	GAMES: 'Jeux', GAME_DETAILS: 'Fiche du jeu', GAME_PLAYER: 'Jeu', SEERR_COLLECTION: 'Collection',
	GAME_SYSTEM: 'Console', CALENDAR: 'Calendrier', CALENDAR_MONTH: 'Calendrier du mois', MATV: 'Ma TV',
	REPLAY: 'Replay', CATALOGUE: 'Catalogue', BIENTOT: 'Bientôt', EN_ROUTE: 'En route', EXPLORER: 'Explorer',
	TASTE: 'Goûts', TONIGHT: 'Ce soir', ADMIN: 'Administration'
};

export const screenLabel = (key) => SCREEN_NAMES[key] || (key ? String(key).toLowerCase() : 'Accueil');

export const addFrame = (name, ms) => {
	if (!frames.has(name) && frames.size >= KEEP_SCREENS) {
		// L'écran le moins vu s'en va, pour que la liste reste courte.
		let least = null;
		frames.forEach((count, key) => {
			if (least === null || count <= frames.get(least)) least = key;
		});
		frames.delete(least);
		opens.delete(least);
		slow.delete(least);
		worst.delete(least);
	}
	frames.set(name, (frames.get(name) || 0) + 1);
	if (ms > SLOW_MS) slow.set(name, (slow.get(name) || 0) + 1);
	if (ms > (worst.get(name) || 0)) worst.set(name, Math.round(ms));
};

// [name] a mis [ms] à se poser.
export const settled = (name, ms) => {
	const list = opens.get(name) || [];
	list.push(ms < 0 ? 0 : Math.round(ms));
	if (list.length > KEEP_OPENS) list.shift();
	opens.set(name, list);
};

const stopWatch = () => {
	if (watch) clearInterval(watch);
	watch = null;
	if (observer) observer.disconnect();
	observer = null;
	openAt = 0;
};

// La page a changé : l'écran en cours d'ouverture n'est pas encore posé.
export const noteChange = (now = Date.now()) => {
	lastChangeAt = now;
};

// L'écran en cours d'ouverture est-il posé à [now] ?
export const check = (now = Date.now()) => {
	if (!openName || !openAt) return;
	if (now - openAt > MAX_OPEN_MS) {
		stopWatch();
		return;
	}
	if (now - lastChangeAt < STILL_MS) return;
	settled(openName, lastChangeAt - openAt);
	stopWatch();
};

// [name] vient de s'afficher, à [at] : son temps d'ouverture démarre.
export const opened = (name, at = Date.now()) => {
	if (name === openName && openAt) return;
	stopWatch();
	openName = name;
	openAt = at;
	lastChangeAt = at;
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (typeof window.MutationObserver === 'function' && document.body) {
		observer = new window.MutationObserver(() => noteChange());
		observer.observe(document.body, {childList: true, subtree: true, attributes: true, characterData: true});
	}
	watch = setInterval(() => check(), 100);
};

// L'écran affiché change : les images suivantes comptent pour lui.
export const setScreen = (key) => {
	screen = screenLabel(key);
	last = 0;
	if (started) opened(screen);
};

const tick = (now) => {
	if (last && typeof document !== 'undefined' && !document.hidden) {
		const ms = now - last;
		if (ms > 0 && ms < PAUSE_MS) addFrame(screen, ms);
	}
	last = now;
	window.requestAnimationFrame(tick);
};

// Lancé une fois, au démarrage de l'appli.
export const startSmoothness = () => {
	if (started || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
	started = true;
	window.requestAnimationFrame(tick);
	opened(screen);
};

// La part d'images saccadées (0 à 100), ou null quand l'écran a trop peu été dessiné.
export const slowPercent = (name) => {
	const n = frames.get(name) || 0;
	if (n < MIN_FRAMES) return null;
	return Math.round((slow.get(name) || 0) * 100 / n);
};

// Le temps habituel (la médiane) que met [name] à se poser, en ms, ou null.
export const openMs = (name) => {
	const list = [...(opens.get(name) || [])].sort((a, b) => a - b);
	return list.length ? list[Math.floor(list.length / 2)] : null;
};

const seconds = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

// « Fiche : 18 % d'images saccadées, pire 240 ms (530 images) · prêt en 1,2 s (4 ouvertures) »,
// le plus saccadé d'abord.
export const smoothnessLines = () => [...new Set([...frames.keys(), ...opens.keys()])]
	.filter((name) => slowPercent(name) !== null || openMs(name) !== null)
	.sort((a, b) => (slowPercent(b) || 0) - (slowPercent(a) || 0))
	.map((name) => {
		const parts = [];
		if (slowPercent(name) !== null) parts.push(`${slowPercent(name)} % d’images saccadées, pire ${worst.get(name)} ms (${frames.get(name)} images)`);
		if (openMs(name) !== null) parts.push(`prêt en ${seconds(openMs(name))} (${opens.get(name).length} ouvertures)`);
		return `${name} : ${parts.join(' · ')}`;
	});

export const resetSmoothness = () => {
	frames.clear();
	slow.clear();
	worst.clear();
	opens.clear();
	stopWatch();
	openName = null;
	screen = 'Accueil';
	last = 0;
};
