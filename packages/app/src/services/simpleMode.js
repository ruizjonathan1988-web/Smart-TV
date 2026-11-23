// Le mode simple de VJOD (simple_mode.dart) : la même appli, avec moins à
// parcourir. Quatre onglets (Accueil, Films, Séries, Ma TV), un bouton
// principal par titre avec la bande-annonce et la liste à côté, le reste
// derrière « + », et un texte un peu plus grand.
//
// Il appartient à un profil : l'admin l'allume pour un utilisateur Jellyfin
// (console admin › utilisateur › Profil simple), et chaque appareil où ce
// profil se connecte suit. Il est gardé dans Jellyfin, dans les préférences
// d'affichage de l'utilisateur.
import {api} from './jellyfinApi';

export const SIMPLE_PREFS_ID = 'vjod';
export const SIMPLE_PREFS_CLIENT = 'vjod';
export const SIMPLE_KEY = 'simpleMode';
export const SIMPLE_TEXT_SCALE = 1.1;

// Sur la fiche, à côté du bouton principal.
export const SIMPLE_FICHE_BUTTONS = ['trailer', 'favorite', 'seerrWatchlist', 'auraPropose', 'seerrRequest'];

export const simpleModeFromPrefs = (customPrefs) => Boolean(customPrefs && customPrefs[SIMPLE_KEY] === 'true');

// Le drapeau de l'utilisateur connecté ; null quand on ne peut pas le lire.
export const readSimpleMode = async () => {
	try {
		const prefs = await api.getDisplayPreferences(SIMPLE_PREFS_ID, SIMPLE_PREFS_CLIENT);
		return simpleModeFromPrefs(prefs && prefs.CustomPrefs);
	} catch (e) {
		return null;
	}
};

// Le bouton principal et ceux d'à côté en ligne, tout le reste derrière « + ».
export const simpleRow = (buttons) => {
	const keep = [];
	const rest = [];
	buttons.forEach((b) => (SIMPLE_FICHE_BUTTONS.includes(b.id) ? keep : rest).push(b));
	keep.sort((a, b) => SIMPLE_FICHE_BUTTONS.indexOf(a.id) - SIMPLE_FICHE_BUTTONS.indexOf(b.id));
	return {inline: keep, menu: rest};
};
