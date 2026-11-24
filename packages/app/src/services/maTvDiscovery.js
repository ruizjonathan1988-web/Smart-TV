// Découverte du serveur Ma TV à partir de la session Jellyfin courante.
//
// IPTV Checker écrit l'adresse et la clé dans la description de la collection
// « VJOD – TV » (marqueur VJOD-TV:<base64url>). On interroge donc les
// collections (BoxSet) du serveur et on lit la première qui porte le marqueur.

import {createApiForServer} from './jellyfinApi';
import {findMaTvServer} from './maTvApi';

// Cherche le serveur Ma TV sur la session donnée. Renvoie {url, key} ou null.
export const discoverMaTvServer = async ({serverUrl, accessToken, userId, serverType = 'jellyfin'} = {}) => {
	if (!serverUrl || !accessToken || !userId) return null;
	try {
		const api = createApiForServer(serverUrl, accessToken, userId, serverType);
		const res = await api.getItems({
			IncludeItemTypes: 'BoxSet',
			Recursive: true,
			Fields: 'Overview',
			SearchTerm: 'VJOD'
		});
		const found = findMaTvServer(res && res.Items);
		if (found) return found;

		// Repli : certaines versions n'indexent pas la description sur une
		// recherche ; on relit toutes les collections sans terme.
		const all = await api.getItems({IncludeItemTypes: 'BoxSet', Recursive: true, Fields: 'Overview'});
		return findMaTvServer(all && all.Items);
	} catch (e) {
		return null;
	}
};
