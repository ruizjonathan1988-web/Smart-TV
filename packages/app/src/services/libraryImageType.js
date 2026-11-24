// Le type d'image d'une bibliothèque (affiche, vignette, bannière) suit le
// profil d'un appareil à l'autre, rangé dans Jellyfin comme le fait l'APK
// (library_browse_view_model.dart) : DisplayPreferences de la bibliothèque,
// client « moonfin », clé imageType. L'APK dit « thumb », la TV « thumbnail ».
const CLIENT = 'moonfin';
const KEY = 'imageType';
const TO_SERVER = {poster: 'poster', thumbnail: 'thumb', banner: 'banner'};
const FROM_SERVER = {poster: 'poster', thumb: 'thumbnail', banner: 'banner'};

export const fromServerImageType = (value) => FROM_SERVER[String(value || '').toLowerCase()] || null;
export const toServerImageType = (key) => TO_SERVER[key] || null;

// Seules les vraies bibliothèques ont des préférences sur le serveur.
const syncable = (api, libraryId) => Boolean(api && api.getDisplayPreferences && libraryId &&
	!/^(genre|studio)-/.test(libraryId) && libraryId !== 'default');

export const readLibraryImageType = async (api, libraryId) => {
	if (!syncable(api, libraryId)) return null;
	try {
		const prefs = await api.getDisplayPreferences(libraryId, CLIENT);
		return fromServerImageType(prefs && prefs.CustomPrefs && prefs.CustomPrefs[KEY]);
	} catch (e) {
		return null;
	}
};

export const writeLibraryImageType = async (api, libraryId, key) => {
	const value = toServerImageType(key);
	if (!value || !syncable(api, libraryId)) return;
	let current = null;
	try {
		current = await api.getDisplayPreferences(libraryId, CLIENT);
	} catch (e) {
		current = null;
	}
	const prefs = current || {Id: libraryId, CustomPrefs: {}};
	try {
		await api.saveDisplayPreferences(libraryId, CLIENT, {...prefs, Id: prefs.Id || libraryId, CustomPrefs: {...(prefs.CustomPrefs || {}), [KEY]: value}});
	} catch (e) {
		// Le choix reste au moins sur cette télé.
	}
};
