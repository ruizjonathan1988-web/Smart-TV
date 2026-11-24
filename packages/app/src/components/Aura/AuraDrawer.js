// Le tiroir d'Aura (aura_drawer.dart) : la course du mois contre Pop, les
// cartes du soir, ce qu'on te propose et l'aura de la maison. Tout se joue à
// la télécommande : chaque ligne prend le focus, Retour ferme.
import {useCallback, useEffect, useState} from 'react';
import Spotlight from '@enact/spotlight';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {isBackKey} from '../../utils/keys';
import {auraDrawer, cardsFor, raceLine, playCard, isSealed, opensLabel, BOARD_SIZE} from '../../services/aura';
import {AuraTile, AuraHeader, AuraLine, auraErrorDetail, keepInView} from './auraUi';
import css from './Aura.module.less';

const Container = SpotlightContainerDecorator({enterTo: 'default-element', restrict: 'self-only'}, 'div');

const yearOf = (y) => (y != null ? ` (${y})` : '');
const cap = (s) => (s ? s[0].toUpperCase() + s.substring(1) : s);

// Ce que la fiche doit ouvrir : le titre du serveur, sinon sa fiche Seerr.
export const auraTarget = ({jellyfinId, tmdbId, title, series = false}) => {
	if (jellyfinId) return {Id: jellyfinId, Type: series ? 'Series' : 'Movie'};
	if (tmdbId == null) return null;
	return {seerr: {id: tmdbId, mediaType: series ? 'tv' : 'movie', title}};
};

const AuraDrawer = ({onClose, onOpen}) => {
	const [data, setData] = useState(null);
	const [toast, setToast] = useState(null);

	useEffect(() => {
		let alive = true;
		auraDrawer().then((d) => {
			if (alive) setData(d);
		});
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		if (data) setTimeout(() => Spotlight.focus('aura-drawer'), 50);
	}, [data]);

	useEffect(() => {
		const onKey = (e) => {
			if (isBackKey(e)) {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [onClose]);

	useEffect(() => {
		if (!toast) return undefined;
		const t = setTimeout(() => setToast(null), 3500);
		return () => clearTimeout(t);
	}, [toast]);

	const handleClick = useCallback(async (e) => {
		const {kind, index} = e.currentTarget.dataset;
		const i = Number(index);
		if (kind === 'card') {
			const card = cardsFor(data.state, new Date())[i];
			try {
				await playCard(new Date(), i);
			} catch (err) {
				setToast('Impossible de prévenir Aura. La fiche s’ouvre quand même.');
			}
			onOpen(auraTarget({jellyfinId: card.onServer ? card.filmId : null, tmdbId: card.tmdbId, title: card.title}));
		} else if (kind === 'proposal') {
			const p = data.received[i];
			if (isSealed(p)) {
				setToast(`Pas avant le jour prévu : ${opensLabel(p)}.`);
				return;
			}
			onOpen(auraTarget({jellyfinId: p.jellyfinId, tmdbId: p.tmdbId, title: p.title, series: p.series}));
		}
	}, [data, onOpen]);

	const now = new Date();
	const state = data && data.state;
	const cards = state ? cardsFor(state, now) : [];
	return (
		<div className={css.overlay}>
			<div className={css.bar}>Aura, le jeu de cinéma</div>
			<Container className={css.body} spotlightId="aura-drawer" onFocus={keepInView}>
				{!data ? <div className={css.spinner}>Un instant…</div> : (
					<>
						<AuraHeader>La course du mois</AuraHeader>
						{!state ? (
							<AuraLine>Ouvre une fois l’appli Aura sur ce profil : elle prépare la course et tes cartes du soir pour VJOD.</AuraLine>
						) : (
							<>
								<AuraLine strong>{`Toi : case ${state.position} sur ${BOARD_SIZE} · Pop : case ${state.pop}`}</AuraLine>
								<AuraLine>{raceLine(state)}</AuraLine>
								{state.playingTitle ? <AuraLine>{`Séance en cours : ${state.playingTitle}. Aura la valide quand le film est vu.`}</AuraLine> : null}
								<AuraHeader>Ce soir avec Pop</AuraHeader>
								{cards.length === 0 ? <AuraLine>Pas de cartes pour ce soir : ouvre Aura, elle en tire pour la semaine.</AuraLine> : cards.map((c, i) => (
									<AuraTile
										key={`card-${i}`}
										data-kind="card"
										data-index={i}
										className={i === 0 ? 'spottable-default' : undefined}
										onClick={handleClick}
										title={c.challenge || `Carte ${c.type}`}
										subtitle={`${c.title}${yearOf(c.year)} · ${c.squares} case${c.squares > 1 ? 's' : ''}${c.level != null ? ` · niveau ${c.level}` : ''}`}
									/>
								))}
							</>
						)}
						<AuraHeader>On te propose</AuraHeader>
						{data.error ? <AuraLine>{auraErrorDetail(data.error) ? `Le serveur d’Aura ne répond pas pour l’instant (${auraErrorDetail(data.error)}).` : 'Le serveur d’Aura ne répond pas pour l’instant.'}</AuraLine>
							: data.received.length === 0 ? <AuraLine>Rien pour l’instant. Sur la fiche d’un film, « Proposer à… » l’envoie à quelqu’un de la maison.</AuraLine>
								: data.received.map((p, i) => (isSealed(p, now) ? (
									<AuraTile
										key={p.id}
										data-kind="proposal"
										data-index={i}
										onClick={handleClick}
										title={`Un film cacheté de ${p.fromName}`}
										subtitle={`${cap(opensLabel(p, now))}${p.note ? ` · « ${p.note} »` : ''}`}
									/>
								) : (
									<AuraTile
										key={p.id}
										data-kind="proposal"
										data-index={i}
										onClick={handleClick}
										title={`${p.title}${yearOf(p.year)}`}
										subtitle={`De ${p.fromName}${p.note ? ` · « ${p.note} »` : ''}`}
									/>
								)))}
						{!data.error ? (
							<>
								<AuraHeader>L’aura de la maison</AuraHeader>
								{data.ranking.length === 0
									? <AuraLine>Personne n’a encore d’aura. Propose un film : +1 quand il est vu, +2 quand il est aimé, +3 quand plusieurs l’aiment.</AuraLine>
									: data.ranking.map((r, i) => (
										<AuraLine key={r.who} strong={r.who === data.me}>{`${i + 1}. ${r.name}${r.who === data.me ? ' (toi)' : ''} : ${r.aura} d’aura`}</AuraLine>
									))}
							</>
						) : null}
					</>
				)}
			</Container>
			{toast ? <div className={css.toast}>{toast}</div> : null}
		</div>
	);
};

export default AuraDrawer;
