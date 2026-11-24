// Client Ma TV partagé entre les écrans (Ma TV, Replay, Sports…) : la
// découverte du serveur dans Jellyfin n'est faite qu'une fois par compte.
import {createMaTvClient} from './maTvApi';
import {discoverMaTvServer} from './maTvDiscovery';
import {enrollMaTv, withPersonalKey} from './maTvEnroll';

let cache = {key: null, promise: null};

// Résout le client Ma TV du compte courant, ou null si aucun serveur Ma TV.
export const getMaTvClient = ({serverUrl, accessToken, user}) => {
	const key = `${serverUrl}|${user ? user.Id : ''}`;
	if (cache.key === key && cache.promise) return cache.promise;
	const promise = discoverMaTvServer({
		serverUrl,
		accessToken,
		userId: user ? user.Id : undefined,
		serverType: (user && user._serverType) || 'jellyfin'
	}).then(async (server) => {
		if (!server) return null;
		const userId = user ? user.Id : null;
		// La clé personnelle du profil (Ma TV 3.60), sinon la clé partagée.
		await enrollMaTv({server, userId, accessToken});
		// Le profil Jellyfin par son identifiant, comme l'APK (activeUserId) : les
		// choix de sources, le replay suivi et la reprise sont rangés sous lui.
		return createMaTvClient({server: withPersonalKey(server, userId), user: userId || (user && user.Name) || null});
	})
		.catch(() => null);
	cache = {key, promise};
	// Un échec ne reste pas en cache : on réessaiera à la prochaine ouverture.
	promise.then((client) => {
		if (!client && cache.promise === promise) cache = {key: null, promise: null};
	});
	return promise;
};

export const resetMaTvSessionForTests = () => {
	cache = {key: null, promise: null};
};
