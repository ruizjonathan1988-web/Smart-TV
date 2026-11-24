import {useCallback, useEffect, useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {getMaTvClient} from '../../services/maTvSession';
import {isAdministrator, takeNewMaTvAlerts} from '../../services/maTvAlerts';
import SeerrNotificationToast from '../SeerrNotificationToast';

// Comme l'APK : une première vérification une fois l'accueil posé, puis toutes les heures.
const FIRST_CHECK_MS = 40 * 1000;
const EVERY_MS = 60 * 60 * 1000;

// Les alertes de Ma TV en bandeau, une à la fois, pour un administrateur seulement.
const MaTvAlertsToast = () => {
	const {serverUrl, accessToken, user} = useAuth();
	const admin = isAdministrator(user);
	const [queue, setQueue] = useState([]);

	useEffect(() => {
		if (!admin || !serverUrl) return undefined;
		let alive = true;
		const check = async () => {
			const client = await getMaTvClient({serverUrl, accessToken, user});
			const fresh = await takeNewMaTvAlerts(client);
			if (alive && fresh.length) {
				setQueue((current) => [...current, ...fresh.map((a) => ({key: `matv-alert-${a.id}`, title: a.title, body: a.text}))]);
			}
		};
		const first = setTimeout(check, FIRST_CHECK_MS);
		const timer = setInterval(check, EVERY_MS);
		return () => {
			alive = false;
			clearTimeout(first);
			clearInterval(timer);
		};
	}, [admin, serverUrl, accessToken, user]);

	const showNext = useCallback(() => setQueue((current) => current.slice(1)), []);

	return <SeerrNotificationToast notification={queue[0] || null} onDismiss={showNext} />;
};

export default MaTvAlertsToast;
