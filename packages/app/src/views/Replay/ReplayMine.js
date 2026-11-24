// « Mes émissions » seul (MaTvReplayMineScreen de l'APK), ouvert depuis la rangée Replay de
// l'accueil : les nouveaux épisodes de ce qu'on suit ; rien de suivi, « Suis tes émissions en un
// appui » avec ce qu'on a regardé en direct ou ce que les chaînes mettent à la une.
import {useCallback, useState} from 'react';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import $L from '@enact/i18n/$L';
import LoadingSpinner from '../../components/LoadingSpinner';
import {dayLabel} from '../../services/maTvReplay';
import {startShows, whyOf} from '../../services/maTvReplayHome';
import {R, ReplayTile, Chip, Button} from './ReplayParts';

import css from './Replay.module.less';

const Line = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

const StartLine = ({item, chanName, followed, first, onPlay, onToggle}) => {
	const handlePlay = useCallback(() => onPlay(item), [onPlay, item]);
	const handleToggle = useCallback(() => onToggle(item.show), [onToggle, item]);
	return (
		<Line className={css.mineLine}>
			<Chip text={chanName} bg="#2A2724" />
			<div className={css.mineShow}>
				<div className={css.mineShowName} style={{color: R.ink}}>{item.show}</div>
				<div className={css.mineWhy} style={{color: R.mute}}>{whyOf(item, dayLabel(item))}</div>
			</div>
			<Button onClick={handlePlay}>{$L('Regarder')}</Button>
			<Button primary={!followed} className={followed ? css.mineFollowed : ''} onClick={handleToggle} spotlightId={first ? 'replay-mine-first' : undefined}>
				{followed ? `✓ ${$L('Suivi')}` : `+ ${$L('Suivre')}`}
			</Button>
		</Line>
	);
};

const ReplayMine = ({home, chanName, onPlay, onInfo, onFollow, onReload}) => {
	const [followed, setFollowed] = useState(() => new Set());
	const toggle = useCallback(async (show) => {
		const on = followed.has(show);
		if (await onFollow(show, !on)) {
			setFollowed((cur) => {
				const next = new Set(cur);
				if (on) next.delete(show);
				else next.add(show);
				return next;
			});
		}
	}, [followed, onFollow]);

	const mine = home ? home.mine : [];
	let body;
	if (home === undefined) {
		body = <div className={css.centered}><LoadingSpinner /></div>;
	} else if (home === null) {
		body = <div className={css.empty} style={{color: R.mute}}>{$L('Le replay ne répond pas (Ma TV 3.62 ou plus nécessaire).')}</div>;
	} else if (mine.length) {
		body = (
			<div className={css.grid}>
				{mine.map((e, i) => (
					<ReplayTile key={e.id} item={e} chanName={chanName(e.chan)} showDay onPlay={onPlay} onInfo={onInfo} spotlightId={i === 0 ? 'replay-mine-first' : undefined} />
				))}
			</div>
		);
	} else {
		const shows = startShows(home);
		body = (
			<div>
				<div className={css.mineStartTitle} style={{color: R.ink}}>{$L('Suis tes émissions en un appui')}</div>
				<div className={css.mineStartHint} style={{color: R.mute}}>
					{home.suggest.length
						? $L('Ce que tu as regardé en direct ces derniers jours. Une émission suivie remonte ici à chaque nouvel épisode.')
						: $L('Ce que les chaînes mettent à la une. Une émission suivie remonte ici à chaque nouvel épisode.')}
				</div>
				{shows.map((e, i) => (
					<StartLine key={e.show} item={e} chanName={chanName(e.chan)} followed={followed.has(e.show)} first={i === 0} onPlay={onPlay} onToggle={toggle} />
				))}
				{followed.size ? <div className={css.mineMore}><Button onClick={onReload}>{$L('Voir mes émissions')}</Button></div> : null}
			</div>
		);
	}

	return (
		<div>
			<div className={css.pageTitle} style={{color: R.ink}}>{$L('Mes émissions')}</div>
			{mine.length ? (
				<div className={css.pageSubtitle} style={{color: R.mute}}>
					{$L('Les nouveaux épisodes de ce que tu suis · un appui : ça joue · « Infos » : la fiche')}
				</div>
			) : null}
			{body}
		</div>
	);
};

export default ReplayMine;
