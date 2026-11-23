// « Proposer à… » (aura_drawer.dart) : à qui, puis un mot si on veut, sans
// clavier. Retour revient en arrière, puis ferme.
import {useCallback, useEffect, useState} from 'react';
import Spotlight from '@enact/spotlight';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {isBackKey} from '../../utils/keys';
import {auraHousemates, auraPropose, AURA_NOTES} from '../../services/aura';
import {AuraTile, AuraLine, keepInView} from './auraUi';
import css from './Aura.module.less';

const Container = SpotlightContainerDecorator({enterTo: 'default-element', restrict: 'self-only'}, 'div');

const AuraPropose = ({film, onClose}) => {
	const [people, setPeople] = useState(null);
	const [error, setError] = useState(null);
	const [to, setTo] = useState(null);
	const [sending, setSending] = useState(false);

	useEffect(() => {
		let alive = true;
		auraHousemates().then((p) => {
			if (alive) setPeople(p);
		}).catch((e) => {
			if (alive) setError(e.message || String(e));
		});
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		setTimeout(() => Spotlight.focus('aura-propose'), 50);
	}, [people, to, error]);

	useEffect(() => {
		const onKey = (e) => {
			if (isBackKey(e)) {
				e.preventDefault();
				e.stopPropagation();
				if (to) setTo(null);
				else onClose(null);
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [to, onClose]);

	const pick = useCallback((e) => {
		setTo(people[Number(e.currentTarget.dataset.index)]);
	}, [people]);

	const send = useCallback(async (e) => {
		if (!to || sending) return;
		const note = AURA_NOTES[Number(e.currentTarget.dataset.index)];
		setSending(true);
		try {
			await auraPropose({...film, to, note});
			onClose(`Proposé à ${to.name}. Ton aura grandit s’il le regarde.`);
		} catch (err) {
			if (err.message === 'Déjà proposé.') {
				onClose(`Tu l’avais déjà proposé à ${to.name}.`);
			} else {
				setSending(false);
				setError(err.message || String(err));
			}
		}
	}, [to, sending, film, onClose]);

	return (
		<div className={css.overlay}>
			<div className={css.bar}>{to ? `Un mot pour ${to.name} ?` : `Proposer « ${film.title} » à…`}</div>
			<Container className={css.body} spotlightId="aura-propose" onFocus={keepInView}>
				{error ? <AuraLine>{`Impossible pour l’instant : ${error}`}</AuraLine> : null}
				{!people && !error ? <div className={css.spinner}>Un instant…</div> : null}
				{people && people.length === 0 ? (
					<AuraLine>Personne d’autre ne joue encore à Aura dans la maison. Chacun l’active dans ses réglages VJOD : Réglages › Général › Aura, le jeu de cinéma.</AuraLine>
				) : null}
				{people && !to ? people.map((p, i) => (
					<AuraTile key={p.person} data-index={i} className={i === 0 ? 'spottable-default' : undefined} onClick={pick} title={p.name} />
				)) : null}
				{to ? AURA_NOTES.map((n, i) => (
					<AuraTile key={n || 'none'} data-index={i} className={i === 0 ? 'spottable-default' : undefined} onClick={send} title={sending && i === 0 ? '…' : (n || 'Envoyer sans mot')} />
				)) : null}
			</Container>
		</div>
	);
};

export default AuraPropose;
