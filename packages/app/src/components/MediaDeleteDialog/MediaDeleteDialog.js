import {useCallback, useEffect, useMemo, useState} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import {useAuth} from '../../context/AuthContext';
import {getMaTvClient} from '../../services/maTvSession';
import {confirmMessage, deleteChoices, deleteMedia, deleteSummary, pickName} from '../../services/mediaDelete';
import {CoreAlertDialog} from '../CoreDialog';

import css from './MediaDeleteDialog.module.less';

const SpottableButton = Spottable('button');

const ChoiceButton = ({index, label, onPick}) => {
	const handleClick = useCallback(() => onPick(index), [index, onPick]);
	return (
		<SpottableButton className={css.choice} data-spotlight-id={`media-delete-choice-${index}`} onClick={handleClick}>
			{label}
		</SpottableButton>
	);
};

// « Supprimer » sur la fiche (item_detail_screen.dart) : que supprimer, puis confirmation, puis
// Ma TV efface fichiers, surveillance de Sonarr / Radarr et torrent. [sameServer] : la fiche vient
// du serveur du compte, celui de Ma TV ; sinon Jellyfin seul.
const MediaDeleteDialog = ({open, item, seasons, api, sameServer, onClose, onDeleted, onRefresh}) => {
	const {serverUrl, accessToken, user} = useAuth();
	const choices = useMemo(() => (item ? deleteChoices(item, seasons) : []), [item, seasons]);
	const [step, setStep] = useState('choose');
	const [pick, setPick] = useState(null);
	const [result, setResult] = useState(null);

	useEffect(() => {
		if (!open) return;
		setResult(null);
		if (choices.length > 1) {
			setPick(null);
			setStep('choose');
		} else {
			setPick(choices[0] || null);
			setStep('confirm');
		}
	}, [open, choices]);

	useEffect(() => {
		if (!open) return undefined;
		const target = step === 'choose' ? 'media-delete-choice-0' : step === 'confirm' ? 'media-delete-cancel' : 'media-delete-close';
		const timer = setTimeout(() => Spotlight.focus(target), 80);
		return () => clearTimeout(timer);
	}, [open, step]);

	const handlePick = useCallback((index) => {
		setPick(choices[index]);
		setStep('confirm');
	}, [choices]);

	const handleDelete = useCallback(async () => {
		if (!pick) return;
		setStep('running');
		const maTv = sameServer ? await getMaTvClient({serverUrl, accessToken, user}).catch(() => null) : null;
		const outcome = await deleteMedia({
			server: maTv ? maTv.server : null,
			itemId: pick.id,
			token: accessToken,
			jellyfinDelete: () => api.deleteItem(pick.id)
		});
		setResult({ok: !outcome.error, text: deleteSummary(outcome, pickName(pick)), leaves: pick.leaves});
		setStep('done');
	}, [pick, sameServer, serverUrl, accessToken, user, api]);

	// Fermé après une suppression réussie : la fiche s'en va, ou se recharge (une saison seule).
	const handleClose = useCallback(() => {
		if (step === 'running') return;
		onClose();
		if (result && result.ok) {
			if (result.leaves) onDeleted?.();
			else onRefresh?.();
		}
	}, [step, result, onClose, onDeleted, onRefresh]);

	if (!item) return null;

	let title = 'Supprimer du serveur ?';
	let actions = [];
	let body = null;
	if (step === 'choose') {
		title = 'Que supprimer ?';
		body = (
			<>
				<p className={css.text}>Effacé du serveur pour de bon : fichiers, surveillance de Sonarr et torrent.</p>
				<div className={css.choices}>
					{choices.map((c, i) => <ChoiceButton key={c.id} index={i} label={c.label} onPick={handlePick} />)}
				</div>
			</>
		);
		actions = [{label: 'Annuler', onClick: handleClose, spotlightId: 'media-delete-cancel'}];
	} else if (step === 'confirm' && pick) {
		body = <p className={css.text}>{confirmMessage(item, pick)}</p>;
		actions = [
			{label: 'Annuler', onClick: handleClose, spotlightId: 'media-delete-cancel'},
			{label: 'Supprimer', onClick: handleDelete, spotlightId: 'media-delete-confirm', destructive: true}
		];
	} else if (step === 'running') {
		title = 'Suppression en cours…';
		body = <p className={css.text}>Ma TV efface les fichiers et prévient Sonarr / Radarr.</p>;
	} else if (result) {
		title = result.ok ? 'Supprimé' : 'Rien n’a été supprimé';
		body = <p className={result.ok ? css.text : css.error}>{result.text}</p>;
		actions = [{label: 'OK', onClick: handleClose, spotlightId: 'media-delete-close'}];
	}

	return (
		<CoreAlertDialog open={open} onClose={handleClose} title={title} spotlightId="media-delete-dialog" actions={actions}>
			{body}
		</CoreAlertDialog>
	);
};

export default MediaDeleteDialog;
