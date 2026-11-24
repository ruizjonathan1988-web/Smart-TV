// En route (en_route_screen.dart) : ce que j'ai demandé, de la demande au
// moment où c'est prêt, avec l'avancement du téléchargement entre les deux.
// Rafraîchi toutes les 8 secondes ; un titre arrivé quitte la liste.
import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as seerrApi from '../../services/seerrApi';
import {getMaTvClient} from '../../services/maTvSession';
import {STATE, myRequestEntries, parseMaTvDownloads, applyLiveDownloads, etaLabel, journey} from '../../services/myRequests';

import css from './Catalogue.module.less';

const SpottableDiv = Spottable('div');
const PageContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

const REFRESH = 8000;
const FRESHEN_EVERY = 60000;
let lastFreshen = 0;

const statusOf = (e) => {
	switch (e.state) {
		case STATE.ready: return [$L('Prêt'), '#7FD6A8'];
		case STATE.downloading: {
			if (e.stalled) return [$L('Téléchargement bloqué'), '#E07A7A'];
			const parts = [e.progress === null ? $L('Téléchargement') : `${$L('Téléchargement')} ${Math.round(e.progress * 100)} %`];
			if (e.eta) parts.push(etaLabel(e.eta));
			return [parts.filter(Boolean).join(' · '), '#8DB8F2'];
		}
		case STATE.approved: return [$L('Validé'), '#E3C07E'];
		case STATE.pending: return [$L('En attente'), '#E3C07E'];
		default: return [$L('Échec'), '#E07A7A'];
	}
};

const runtimeLabel = (minutes) => {
	if (!minutes) return null;
	const h = Math.floor(minutes / 60);
	return h > 0 ? `${h} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
};

const Tile = ({entry, info, onOpen, first}) => {
	const handleClick = useCallback(() => onOpen(entry, info), [onOpen, entry, info]);
	const isTv = entry.request.type === 'tv';
	const [label, color] = statusOf(entry);
	const meta = [info && info.year, isTv ? $L('Série') : $L('Film'), info && runtimeLabel(info.runtime)].filter(Boolean).join(' · ');
	const title = (info && info.title) || entry.request.media.title || entry.request.media.name || '';
	return (
		<SpottableDiv className={css.tile} onClick={handleClick} spotlightId={first ? 'enroute-first' : undefined}>
			<div className={css.tilePoster}>{info && info.poster ? <img src={info.poster} alt="" /> : null}</div>
			<div className={css.tileBody}>
				<div className={css.tileTitle}>{title}</div>
				<div className={css.tileMeta}>{meta}</div>
				<div className={css.bar}><div className={css.barFill} style={{width: `${Math.round(journey(entry) * 100)}%`, background: color}} /></div>
				<div className={css.status}><span className={css.dot} style={{background: color}} />{label}</div>
			</div>
		</SpottableDiv>
	);
};

const EnRoute = ({onSelectSeerrItem}) => {
	const {user, serverUrl, accessToken} = useAuth();
	const [entries, setEntries] = useState(null);
	const [failed, setFailed] = useState(false);
	const [infos, setInfos] = useState({});
	const asked = useRef({});
	const focused = useRef(false);

	// Titre, affiche, année et durée viennent de la fiche, qu'une demande ne porte pas.
	const enrich = useCallback((list) => {
		list.forEach((e) => {
			const tmdb = e.request.media.tmdbId;
			if (!tmdb || asked.current[e.key]) return;
			asked.current[e.key] = true;
			const isTv = e.request.type === 'tv';
			(isTv ? seerrApi.getTv(tmdb) : seerrApi.getMovie(tmdb)).then((d) => {
				if (!d) return;
				const date = isTv ? d.firstAirDate : d.releaseDate;
				setInfos((cur) => ({...cur, [e.key]: {
					title: isTv ? d.name || d.title : d.title,
					poster: d.posterPath ? seerrApi.getImageUrl(d.posterPath, 'w342') : null,
					year: date && date.length >= 4 ? date.slice(0, 4) : null,
					runtime: isTv ? null : d.runtime
				}}));
			}).catch(() => {});
		});
	}, []);

	useEffect(() => {
		let alive = true;
		let me = null;
		const load = async () => {
			try {
				if (!me) me = await seerrApi.getUser();
				const response = await seerrApi.getMyRequests(me.id, 50);
				let list = myRequestEntries(response && response.results, Date.now(), 30);
				const maTv = await getMaTvClient({serverUrl, accessToken, user});
				if (maTv) {
					const json = await maTv.downloads();
					if (json) list = applyLiveDownloads(list, parseMaTvDownloads(json));
				}
				list = list.filter((e) => e.state !== STATE.ready);
				if (!alive) return;
				setEntries(list);
				setFailed(false);
				enrich(list);
			} catch (err) {
				if (alive) setFailed(true);
			}
		};
		// Un administrateur fait relire tout de suite téléchargements et bibliothèque à Seerr.
		const freshen = async () => {
			try {
				const me0 = me || await seerrApi.getUser();
				// eslint-disable-next-line no-bitwise
				const admin = me0 && (me0.permissions & 2) === 2;
				if (!admin || Date.now() - lastFreshen < FRESHEN_EVERY) return;
				lastFreshen = Date.now();
				await seerrApi.runJob('download-sync');
				await seerrApi.runJob('jellyfin-recently-added-scan');
				if (alive) load();
			} catch (err) {
				// Seerr relira de lui-même à son rythme.
			}
		};
		load();
		freshen();
		const timer = setInterval(load, REFRESH);
		return () => {
			alive = false;
			clearInterval(timer);
		};
	}, [serverUrl, accessToken, user, enrich]);

	useEffect(() => {
		if (entries && entries.length && !focused.current) {
			focused.current = true;
			setTimeout(() => Spotlight.focus('enroute-first'), 0);
		}
	}, [entries]);

	const open = useCallback((e, info) => {
		const media = e.request.media;
		if (!media.tmdbId || !onSelectSeerrItem) return;
		onSelectSeerrItem({id: media.tmdbId, mediaType: e.request.type === 'tv' ? 'tv' : 'movie', title: info && info.title, name: info && info.title, mediaInfo: media});
	}, [onSelectSeerrItem]);

	let content;
	if (!entries) content = failed ? <div className={css.note}>{$L('Impossible de joindre Seerr pour le moment.')}</div> : <div className={css.center}><LoadingSpinner /></div>;
	else if (!entries.length) content = <div className={css.note}>{$L('Rien en route pour l’instant. Ce que vous demandez apparaîtra ici jusqu’à ce que ce soit prêt.')}</div>;
	else content = entries.map((e, i) => <Tile key={e.key} entry={e} info={infos[e.key]} onOpen={open} first={i === 0} />);

	return (
		<div className={css.catalogue}>
			<PageContainer spotlightId="enroute-page" className={css.page}>
				<Scroller direction="vertical" verticalScrollbar="hidden">
					<div className={css.inner}>
						<div className={css.header}>
							<span className={css.title}>{$L('EN ROUTE')}</span>
							<span className={css.hint}>{$L('Ce que vous avez demandé, jusqu’à ce que ce soit prêt')}</span>
						</div>
						{content}
					</div>
				</Scroller>
			</PageContainer>
		</div>
	);
};

export default EnRoute;
