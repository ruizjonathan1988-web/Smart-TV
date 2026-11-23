// Bientôt (bientot_screen.dart) : ce qui sort dans les mois qui viennent,
// mois par mois, chaque affiche avec sa date, pour le demander avant sa sortie.
import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import LoadingSpinner from '../../components/LoadingSpinner';
import * as seerrApi from '../../services/seerrApi';

import css from './Catalogue.module.less';

const SpottableDiv = Spottable('div');
const Row = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const PageContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const SHORT = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];

const STATUS = (status) => {
	if (status === 5 || status === 4) return [$L('Prêt'), '#7FD6A8'];
	if (status === 2 || status === 3) return [$L('Demandé'), '#E3C07E'];
	return [$L('Le demander'), '#C9403F'];
};

// Les sorties à venir, sans doublon ni date passée, triées par date.
export const upcomingFrom = (pages, today = new Date()) => {
	const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
	const seen = new Set();
	const all = [];
	pages.forEach(([page, isTv]) => ((page && page.results) || []).forEach((item) => {
		if (item.adult) return;
		const raw = isTv ? item.firstAirDate : item.releaseDate;
		const parts = raw ? String(raw).split('-').map(Number) : [];
		if (parts.length < 3 || parts.some(isNaN)) return;
		const date = new Date(parts[0], parts[1] - 1, parts[2]);
		if (date.getTime() < start) return;
		const key = `${isTv ? 'tv' : 'movie'}:${item.id}`;
		if (seen.has(key)) return;
		seen.add(key);
		all.push({item, isTv, date});
	}));
	return all.sort((a, b) => a.date - b.date);
};

const Card = ({coming, onPick, first}) => {
	const handleClick = useCallback(() => onPick(coming), [onPick, coming]);
	const {item, date} = coming;
	const [label, color] = STATUS(item.mediaInfo && item.mediaInfo.status);
	return (
		<SpottableDiv className={css.card} onClick={handleClick} spotlightId={first ? 'bientot-first' : undefined}>
			<div className={css.poster}>
				{item.posterPath ? <img src={seerrApi.getImageUrl(item.posterPath, 'w342')} alt="" /> : <span className={css.posterTitle}>{item.title || item.name}</span>}
				<span className={css.dateBadge}>{`${date.getDate()} ${SHORT[date.getMonth()]}`}</span>
			</div>
			<div className={css.cardTitle}>{item.title || item.name}</div>
			<div className={css.status}><span className={css.dot} style={{background: color}} />{label}</div>
		</SpottableDiv>
	);
};

const Segment = ({index, label, on, onPick}) => {
	const handleClick = useCallback(() => onPick(index), [onPick, index]);
	return <SpottableDiv className={`${css.segment} ${on ? css.segmentOn : ''}`} onClick={handleClick}>{label}</SpottableDiv>;
};

const Bientot = ({onSelectSeerrItem}) => {
	const [all, setAll] = useState(null);
	const [failed, setFailed] = useState(false);
	const [filter, setFilter] = useState(0);
	const focused = useRef(false);

	useEffect(() => {
		let alive = true;
		const calls = [];
		for (let p = 1; p <= 3; p++) {
			calls.push(seerrApi.upcomingMovies(p).then((r) => [r, false]));
			calls.push(seerrApi.upcomingTv(p).then((r) => [r, true]));
		}
		Promise.all(calls).then((pages) => {
			if (alive) setAll(upcomingFrom(pages));
		}).catch(() => {
			if (alive) setFailed(true);
		});
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		if (all && !focused.current) {
			focused.current = true;
			setTimeout(() => Spotlight.focus('bientot-first') || Spotlight.focus('bientot-page'), 0);
		}
	}, [all]);

	const pick = useCallback((c) => onSelectSeerrItem && onSelectSeerrItem({...c.item, mediaType: c.isTv ? 'tv' : 'movie'}), [onSelectSeerrItem]);

	const months = [];
	(all || []).filter((c) => filter === 0 || (filter === 2) === c.isTv).forEach((c) => {
		const key = `${MONTHS[c.date.getMonth()]} ${c.date.getFullYear()}`;
		const last = months[months.length - 1];
		if (last && last.key === key) last.list.push(c);
		else months.push({key, list: [c]});
	});

	let content;
	if (!all) content = failed ? <div className={css.note}>{$L('Impossible de joindre Seerr pour le moment.')}</div> : <div className={css.center}><LoadingSpinner /></div>;
	else if (!months.length) content = <div className={css.note}>{$L('Rien d’annoncé pour l’instant.')}</div>;
	else {
		const firstKey = `${months[0].list[0].isTv ? 't' : 'm'}${months[0].list[0].item.id}`;
		content = months.map((m) => (
			<div key={m.key}>
				<div className={css.month}>{m.key.charAt(0).toUpperCase() + m.key.slice(1)}</div>
				<Row className={css.grid}>
					{m.list.map((c) => <Card key={`${c.isTv ? 't' : 'm'}${c.item.id}`} coming={c} onPick={pick} first={`${c.isTv ? 't' : 'm'}${c.item.id}` === firstKey} />)}
				</Row>
			</div>
		));
	}

	return (
		<div className={css.catalogue}>
			<PageContainer spotlightId="bientot-page" className={css.page}>
				<Scroller direction="vertical" verticalScrollbar="hidden">
					<div className={css.inner}>
						<Row className={css.header}>
							<span className={css.title}>{$L('BIENTÔT')}</span>
							<div className={css.segments}>
								{[$L('Tout'), $L('Films'), $L('Séries')].map((label, i) => (
									<Segment key={label} index={i} label={label} on={filter === i} onPick={setFilter} />
								))}
							</div>
							<span className={css.hint}>{$L('Demandé à l’avance, il arrive tout seul le jour J')}</span>
						</Row>
						{content}
					</div>
				</Scroller>
			</PageContainer>
		</div>
	);
};

export default Bientot;
