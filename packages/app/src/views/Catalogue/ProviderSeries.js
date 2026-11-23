// Les saisons et épisodes d'une série chez le fournisseur IPTV (Ma TV) :
// une rangée de saisons, puis la liste des épisodes de la saison choisie.
import {useState, useEffect, useCallback} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import LoadingSpinner from '../../components/LoadingSpinner';

import css from './Catalogue.module.less';

const SpottableDiv = Spottable('div');
const Container = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

const SeasonTab = ({season, on, onPick}) => {
	const handleClick = useCallback(() => onPick(season), [onPick, season]);
	return <SpottableDiv className={`${css.segment} ${on ? css.segmentOn : ''}`} onClick={handleClick}>{`${$L('Saison')} ${season}`}</SpottableDiv>;
};

const Episode = ({ep, title, onPlay, first}) => {
	const handleClick = useCallback(() => onPlay(ep, title), [onPlay, ep, title]);
	return (
		<SpottableDiv className={css.episode} onClick={handleClick} spotlightId={first ? 'catalogue-episode-first' : undefined}>
			<span className={css.episodeNum}>{ep.number}</span>
			<span className={css.episodeText}>
				<span className={css.episodeTitle}>{ep.title}</span>
				{ep.plot ? <span className={css.episodePlot}>{ep.plot}</span> : null}
			</span>
		</SpottableDiv>
	);
};

const ProviderSeries = ({vod, copy, title, onPlay}) => {
	const [info, setInfo] = useState(null);
	const [season, setSeason] = useState(null);

	useEffect(() => {
		let alive = true;
		vod.seriesInfo(copy.id).then((i) => {
			if (!alive) return;
			setInfo(i);
			const keys = Object.keys(i.seasons).map(Number).sort((a, b) => a - b);
			setSeason(keys.length ? keys[0] : null);
		});
		return () => {
			alive = false;
		};
	}, [vod, copy]);

	useEffect(() => {
		if (season === null) return undefined;
		const t = setTimeout(() => Spotlight.focus('catalogue-series'), 0);
		return () => clearTimeout(t);
	}, [info]); // eslint-disable-line react-hooks/exhaustive-deps

	const seasons = info ? Object.keys(info.seasons).map(Number).sort((a, b) => a - b) : [];
	const episodes = info && season !== null ? info.seasons[season] || [] : [];

	return (
		<Container spotlightId="catalogue-series" className={css.page}>
			<Scroller direction="vertical" verticalScrollbar="hidden">
				<div className={css.inner}>
					<div className={css.title}>{title}</div>
					<div className={css.hint}>{copy.tag ? `IPTV · ${copy.tag}` : 'IPTV'}</div>
					{!info ? <div className={css.center}><LoadingSpinner /></div> : null}
					{info && !seasons.length ? <div className={css.note}>{$L('Le fournisseur ne donne aucun épisode pour cette série.')}</div> : null}
					{info && info.plot ? <div className={css.plot}>{info.plot}</div> : null}
					{seasons.length > 1 ? (
						<Container className={css.segments}>
							{seasons.map((s) => <SeasonTab key={s} season={s} on={s === season} onPick={setSeason} />)}
						</Container>
					) : null}
					<Container className={css.episodes}>
						{episodes.map((ep, i) => <Episode key={ep.id} ep={ep} title={title} onPlay={onPlay} first={i === 0} />)}
					</Container>
				</div>
			</Scroller>
		</Container>
	);
};

export default ProviderSeries;
