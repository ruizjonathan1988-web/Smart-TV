// Client Ma TV partagé entre les écrans (Ma TV, Replay, Sports…) : la
// découverte du serveur dans Jellyfin n'est faite qu'une fois par compte.
import {createMaTvClient} from './maTvApi';
import {discoverMaTvServer} from './maTvDiscovery';

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
	}).then((server) => (server
		? createMaTvClient({server, user: (user && (user.Name || user.Id)) || null})
		: null))
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
