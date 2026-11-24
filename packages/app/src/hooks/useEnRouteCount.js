import {useEffect, useState} from 'react';
import {useAuth} from '../context/AuthContext';
import * as seerrApi from '../services/seerrApi';
import {getMaTvClient} from '../services/maTvSession';
import {api as jellyfin} from '../services/jellyfinApi';
import {myRequestEntries, parseMaTvDownloads, applyLiveDownloads, waitingCount, withLibrary} from '../services/myRequests';

const EVERY = 45 * 1000;

// Combien de mes demandes sont encore en route, pour le badge de l'onglet
// (VJOD 5.9) ; relu toutes les 45 s.
const useEnRouteCount = (enabled) => {
	const {serverUrl, accessToken, user} = useAuth();
	const [count, setCount] = useState(0);
	useEffect(() => {
		if (!enabled) {
			setCount(0);
			return undefined;
		}
		let alive = true;
		let me = null;
		const load = async () => {
			try {
				if (!me) me = await seerrApi.getUser();
				const response = await seerrApi.getMyRequests(me.id, 50);
				// Ce que la bibliothèque a déjà n'est plus en route, même si Seerr traîne.
				let list = await withLibrary(jellyfin, myRequestEntries(response && response.results, Date.now(), 30));
				const maTv = await getMaTvClient({serverUrl, accessToken, user});
				if (maTv) {
					const json = await maTv.downloads();
					if (json) list = applyLiveDownloads(list, parseMaTvDownloads(json));
				}
				if (alive) setCount(waitingCount(list));
			} catch (err) {
				// Le badge garde sa dernière valeur.
			}
		};
		load();
		const timer = setInterval(load, EVERY);
		return () => {
			alive = false;
			clearInterval(timer);
		};
	}, [enabled, serverUrl, accessToken, user]);
	return count;
};

export default useEnRouteCount;
