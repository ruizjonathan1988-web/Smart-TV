import {useCallback, useEffect, useState} from 'react';
import {onRequestsReady, readyNotification} from '../../services/myRequests';
import SeerrNotificationToast from '../SeerrNotificationToast';

// « Prêt à regarder » (VJOD, comme l'APK) : un titre demandé vient d'arriver
// dans la bibliothèque. Annoncé une fois, quand l'accueil relit « Mes demandes ».
const RequestsReadyToast = () => {
	const [notification, setNotification] = useState(null);
	useEffect(() => onRequestsReady((titles) => setNotification(readyNotification(titles))), []);
	const dismiss = useCallback(() => setNotification(null), []);
	return <SeerrNotificationToast notification={notification} onDismiss={dismiss} />;
};

export default RequestsReadyToast;
