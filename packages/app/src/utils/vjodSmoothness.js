// VJOD 5.3 (comme lib/util/vjod_smoothness.dart) : la fluidité réelle de chaque écran sur cette TV.
// Chaque image dessinée est chronométrée (requestAnimationFrame) ; une image de plus de 32 ms en
// rate deux à 60 images par seconde, l'œil la voit comme un à-coup. Gardé par écran, montré dans
// « À propos ».

export const SLOW_MS = 32;
const KEEP_SCREENS = 14;
const MIN_FRAMES = 30;
// Au-delà, la TV était en veille ou l'onglet caché : ce n'est pas une image ratée.
const PAUSE_MS = 1000;

const frames = new Map();
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
		slow.delete(least);
		worst.delete(least);
	}
	frames.set(name, (frames.get(name) || 0) + 1);
	if (ms > SLOW_MS) slow.set(name, (slow.get(name) || 0) + 1);
	if (ms > (worst.get(name) || 0)) worst.set(name, Math.round(ms));
};

// L'écran affiché change : les images suivantes comptent pour lui.
export const setScreen = (key) => {
	screen = screenLabel(key);
	last = 0;
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
};

// La part d'images saccadées (0 à 100), ou null quand l'écran a trop peu été dessiné.
export const slowPercent = (name) => {
	const n = frames.get(name) || 0;
	if (n < MIN_FRAMES) return null;
	return Math.round((slow.get(name) || 0) * 100 / n);
};

// « Fiche : 18 % d'images saccadées, pire 240 ms (530 images) », le plus saccadé d'abord.
export const smoothnessLines = () => [...frames.keys()]
	.filter((name) => slowPercent(name) !== null)
	.sort((a, b) => slowPercent(b) - slowPercent(a))
	.map((name) => `${name} : ${slowPercent(name)} % d’images saccadées, pire ${worst.get(name)} ms (${frames.get(name)} images)`);

export const resetSmoothness = () => {
	frames.clear();
	slow.clear();
	worst.clear();
	screen = 'Accueil';
	last = 0;
};
