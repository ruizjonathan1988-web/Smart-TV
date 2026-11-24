import {useCallback, useEffect, useRef, useState} from 'react';
import Spotlight from '@enact/spotlight';

import {drawQrCode} from '../../utils/qrCanvas';
import {isTraktConnected, traktUsername, startTraktConnecting, finishTraktConnecting, disconnectTrakt, onTraktChange} from '../../services/traktAccount';
import {SpottableButton} from './settingsSpottables';
import {InfoRow} from './settingsRows';

import css from './Settings.module.less';

const BUTTONS = {idle: 'trakt-link', pending: 'trakt-cancel', linked: 'trakt-unlink'};

const ERRORS = {
	expired: 'Le code a expiré. Relie à nouveau pour en avoir un autre.',
	denied: 'Le lien a été refusé sur Trakt.',
	refused: 'Trakt n’a pas accepté la demande. Réessaie dans un moment.',
	unreachable: 'Trakt ne répond pas. Réessaie dans un moment.'
};

// Le compte Trakt du profil (trakt_account.dart de l'APK) : la TV montre un
// code et un QR code, on valide sur le téléphone, et la TV attend la réponse.
// Relié, il ajoute ses recommandations à « Pour vous » et reçoit les films et
// épisodes IPTV vus jusqu'au bout.
const TraktAccountPanel = () => {
	const canvasRef = useRef(null);
	const cancelled = useRef(false);
	const [linked, setLinked] = useState(isTraktConnected());
	const [username, setUsername] = useState(traktUsername());
	const [pending, setPending] = useState(null);
	const [error, setError] = useState(null);
	const mode = linked ? 'linked' : pending ? 'pending' : 'idle';

	useEffect(() => onTraktChange(() => {
		setLinked(isTraktConnected());
		setUsername(traktUsername());
	}), []);
	useEffect(() => () => {
		cancelled.current = true;
	}, []);

	useEffect(() => {
		if (pending) drawQrCode(canvasRef.current, pending.url);
	}, [pending]);

	const shownMode = useRef(mode);
	useEffect(() => {
		if (shownMode.current === mode) return;
		shownMode.current = mode;
		Spotlight.focus(BUTTONS[mode]);
	}, [mode]);

	const link = useCallback(async () => {
		setError(null);
		cancelled.current = false;
		let code;
		try {
			code = await startTraktConnecting();
		} catch (e) {
			setError('unreachable');
			return;
		}
		setPending(code);
		try {
			await finishTraktConnecting(code, () => cancelled.current);
		} catch (e) {
			setError(ERRORS[e.message] ? e.message : 'refused');
		}
		setPending(null);
	}, []);

	const cancel = useCallback(() => {
		cancelled.current = true;
		setPending(null);
	}, []);

	const unlink = useCallback(() => disconnectTrakt(), []);

	return (
		<>
			{mode === 'idle' && (
				<>
					<div className={css.viewDescription}>
						Relie ton compte Trakt : ses recommandations rejoignent « Pour vous », et les films et épisodes IPTV vus jusqu{'’'}au bout entrent dans ton historique Trakt.
					</div>
					<div className={css.actionBarInline}>
						<SpottableButton className={css.actionButton} onClick={link} spotlightId={BUTTONS.idle}>
							Relier mon compte Trakt
						</SpottableButton>
					</div>
				</>
			)}
			{mode === 'pending' && (
				<>
					<div className={css.viewDescription}>
						Scanne le QR code avec ton téléphone, ou ouvre l{'’'}adresse ci-dessous et tape le code. Valide ensuite VJOD sur Trakt.
					</div>
					<div className={css.rommCode}>{pending.userCode}</div>
					<div className={css.qrContainer}>
						<canvas ref={canvasRef} className={css.qrCanvas} />
					</div>
					<div className={css.viewDescription}>{pending.url}</div>
					<div className={css.actionBarInline}>
						<SpottableButton className={css.actionButton} onClick={cancel} spotlightId={BUTTONS.pending}>
							Annuler
						</SpottableButton>
					</div>
				</>
			)}
			{mode === 'linked' && (
				<>
					<InfoRow id="traktUser" label="Trakt" value={username ? `Relié à ${username}` : 'Relié'} />
					<div className={css.actionBarInline}>
						<SpottableButton className={`${css.actionButton} ${css.dangerButton}`} onClick={unlink} spotlightId={BUTTONS.linked}>
							Délier
						</SpottableButton>
					</div>
				</>
			)}
			{error && <div className={`${css.statusMessage} ${css.statusError}`}>{ERRORS[error]}</div>}
		</>
	);
};

export default TraktAccountPanel;
