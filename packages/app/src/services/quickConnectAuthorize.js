// Quick Connect depuis le menu du compte : on garde les chiffres du code et on traduit la réponse
// du serveur en message, comme le fait l'APK (user_menu_dialog.dart).

export const QUICK_CONNECT_CODE_MAX = 8;

export const normalizeQuickConnectCode = (value) =>
	String(value || '').replace(/\D/g, '').slice(0, QUICK_CONNECT_CODE_MAX);

export const supportsQuickConnectAuthorize = (serverType) =>
	!serverType || serverType === 'jellyfin';

// Le texte que le serveur a renvoyé, s'il y en a un lisible.
export const serverMessageOf = (error) => {
	const body = error?.body;
	if (!body) return null;
	try {
		const parsed = JSON.parse(body);
		if (typeof parsed === 'string') return parsed || null;
		const message = parsed?.message ?? parsed?.Message;
		return message ? String(message) : null;
	} catch {
		return String(body);
	}
};

// Renvoie {key, message?} : key désigne le texte à afficher.
export const describeQuickConnectError = (error) => {
	if (error?.unsupported) return {key: 'notSupported'};
	const status = error?.status;
	const message = serverMessageOf(error);
	if (status === 401) return {key: 'disabled'};
	if (status === 403) return message ? {key: 'raw', message} : {key: 'forbidden'};
	if (status === 404) return {key: 'notFound'};
	if (message) return {key: 'failedWithMessage', message};
	return {key: 'failed'};
};
