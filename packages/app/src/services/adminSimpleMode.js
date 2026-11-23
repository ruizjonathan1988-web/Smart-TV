// Le « profil simple » de VJOD (simple_mode.dart de l'APK), côté administrateur seulement : le
// réglage est rangé dans Jellyfin même, dans les préférences d'affichage de l'utilisateur
// (enregistrement « vjod », client « vjod », clé simpleMode), et chaque appareil qui se connecte
// sous ce profil le suit. Le mode lui-même, côté interface, est fait ailleurs.

export const SIMPLE_MODE_PREFS_ID = 'vjod';
export const SIMPLE_MODE_CLIENT = 'vjod';
export const SIMPLE_MODE_KEY = 'simpleMode';

export const simpleModeFromPrefs = (prefs) => Boolean(prefs && prefs.CustomPrefs && prefs.CustomPrefs[SIMPLE_MODE_KEY] === 'true');

// Les préférences d'affichage avec le drapeau posé ou retiré, le reste gardé.
export const withSimpleMode = (prefs, on) => ({
	...(prefs || {}),
	Id: (prefs && prefs.Id) || SIMPLE_MODE_PREFS_ID,
	Client: (prefs && prefs.Client) || SIMPLE_MODE_CLIENT,
	CustomPrefs: {...((prefs && prefs.CustomPrefs) || {}), [SIMPLE_MODE_KEY]: on ? 'true' : 'false'}
});

const path = `/DisplayPreferences/${SIMPLE_MODE_PREFS_ID}`;
const query = (userId) => ({userId, client: SIMPLE_MODE_CLIENT});

// Le drapeau d'un utilisateur, ou null s'il ne se lit pas.
export const readSimpleMode = async (api, userId) => {
	try {
		return simpleModeFromPrefs(await api.call('GET', path, {query: query(userId)}));
	} catch (err) {
		return null;
	}
};

// Pose le drapeau d'un utilisateur ; lève une erreur si le serveur refuse.
export const writeSimpleMode = async (api, userId, on) => {
	let current = null;
	try {
		current = await api.call('GET', path, {query: query(userId)});
	} catch (err) {
		current = null;
	}
	await api.call('POST', path, {query: query(userId), body: withSimpleMode(current, on)});
};
