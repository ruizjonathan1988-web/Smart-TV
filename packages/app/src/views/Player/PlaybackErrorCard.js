// L'erreur de lecture ; pour un titre lu chez le fournisseur IPTV, l'écran
// « Ce flux ne répond plus » de l'APK, qui propose de le demander.
import {useState, useCallback} from 'react';
import Button from '@enact/sandstone/Button';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import {useSeerr} from '../../context/SeerrContext';
import {isProviderStream, requestDeadStreamTitle} from '../../services/deadStream';

const PlaybackErrorCard = ({className, item, error, onBack}) => {
	const {api} = useAuth();
	const {isEnabled, isAuthenticated} = useSeerr();
	const [answer, setAnswer] = useState(null);
	const [busy, setBusy] = useState(false);
	const dead = isProviderStream(item) && isEnabled && isAuthenticated;
	const isEpisode = item && item.Type === 'Episode';
	const ask = useCallback(async () => {
		if (busy) return;
		setBusy(true);
		setAnswer(await requestDeadStreamTitle(api, item));
		setBusy(false);
	}, [busy, api, item]);

	if (!dead) {
		return (
			<div className={className}>
				<h2>{$L('Playback Error')}</h2>
				<p>{error}</p>
				<Button onClick={onBack}>{$L('Go Back')}</Button>
			</div>
		);
	}
	const title = isEpisode ? item.SeriesName || item.Name : item.Name;
	return (
		<div className={className}>
			<h2>Ce flux ne répond plus</h2>
			<p>{`Le fournisseur ne diffuse plus « ${title} » ou ne répond pas pour l’instant. Demandez-le pour l’avoir en fichier sur le serveur.`}</p>
			{answer ? <p>{answer.message}</p> : null}
			{!answer || !answer.ok ? <Button onClick={ask}>{busy ? '…' : (isEpisode ? 'Demander la saison' : 'Demander ce titre')}</Button> : null}
			<Button onClick={onBack}>Fermer</Button>
		</div>
	);
};

export default PlaybackErrorCard;
