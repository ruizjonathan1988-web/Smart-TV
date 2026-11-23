// Films et Séries, tout le catalogue (catalogue_screen.dart de l'APK) : ce
// qui est populaire, chaque affiche disant comment le regarder (sur le
// serveur, tout de suite chez le fournisseur IPTV via Ma TV, ou à demander),
// un filtre en haut, une loupe pour chercher n'importe quel titre du genre, et
// « Toute ma bibliothèque » à une pression.
import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import {useSeerr} from '../../context/SeerrContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import SpottableInput from '../../components/SpottableInput/SpottableInput';
import * as seerrApi from '../../services/seerrApi';
import {getMaTvClient} from '../../services/maTvSession';
import {createVodClient, catalogueAvailability, catalogueFilterKeeps} from '../../services/maTvVod';
import {ChoiceDialog} from '../MaTv/MaTvPageParts';
import MaTvVodPlayer from '../MaTv/MaTvVodPlayer';
import ProviderSeries from './ProviderSeries';

import css from './Catalogue.module.less';

const SpottableDiv = Spottable('div');
const Row = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const PageContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

const FIRST_PAGES = 3;
const MORE_PAGES = 2;

const BADGE = {
	server: {label: () => $L('Sur le serveur'), color: '#7FD6A8'},
	iptv: {label: () => 'IPTV', color: '#5BD18B'},
	requested: {label: () => $L('Demandé'), color: '#E3C07E'},
	toRequest: {label: () => $L('À demander'), color: '#C9403F'}
};

export const Card = ({item, availability, onPick}) => {
	const [failed, setFailed] = useState(false);
	const handleError = useCallback(() => setFailed(true), []);
	const handleClick = useCallback(() => onPick(item, availability), [onPick, item, availability]);
	const title = item.title || item.name || '';
	const poster = item.posterPath ? seerrApi.getImageUrl(item.posterPath, 'w342') : null;
	const badge = BADGE[availability];
	const date = item.releaseDate || item.firstAirDate || '';
	return (
		<SpottableDiv className={css.card} onClick={handleClick}>
			<div className={css.poster}>
				{poster && !failed ? <img src={poster} alt="" onError={handleError} /> : <span className={css.posterTitle}>{title}</span>}
				<span className={css.badge} style={{background: badge.color}}>{badge.label()}</span>
			</div>
			<div className={css.cardTitle}>{title}</div>
			{date ? <div className={css.cardYear}>{date.slice(0, 4)}</div> : null}
		</SpottableDiv>
	);
};

const Segment = ({index, label, on, onPick}) => {
	const handleClick = useCallback(() => onPick(index), [onPick, index]);
	return <SpottableDiv className={`${css.segment} ${on ? css.segmentOn : ''}`} onClick={handleClick}>{label}</SpottableDiv>;
};

const Catalogue = ({kind = 'movie', backHandlerRef, onSelectSeerrItem, onOpenLibrary}) => {
	const isTv = kind === 'tv';
	const {user, serverUrl, accessToken, api} = useAuth();
	const {isEnabled: seerrEnabled, isAuthenticated: seerrAuthenticated} = useSeerr();
	const seerrReady = seerrEnabled && seerrAuthenticated;
	const [items, setItems] = useState([]);
	const [nextPage, setNextPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [end, setEnd] = useState(false);
	const [failed, setFailed] = useState(false);
	const [filter, setFilter] = useState(0);
	const [iptv, setIptv] = useState({}); // tmdb → copies
	const [vod, setVod] = useState(null);
	const [searching, setSearching] = useState(false);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState(null);
	const [dialog, setDialog] = useState(null);
	const [playing, setPlaying] = useState(null);
	const [series, setSeries] = useState(null);
	const seen = useRef(new Set());
	const lastFocus = useRef(null);
	const searchTimer = useRef(null);

	useEffect(() => {
		let alive = true;
		getMaTvClient({serverUrl, accessToken, user}).then((c) => {
			if (alive && c) setVod(createVodClient(c));
		});
		return () => {
			alive = false;
		};
	}, [serverUrl, accessToken, user]);

	// Ma TV répond « aussi en IPTV » par lots d'affiches.
	const askIptv = useCallback(async (list) => {
		if (!vod || !list.length) return;
		const ids = list.map((i) => String(i.id));
		const found = await vod.copiesByTmdb(isTv ? 'series' : 'movie', ids);
		setIptv((cur) => ({...cur, ...found}));
	}, [vod, isTv]);

	const load = useCallback(async (pages) => {
		if (loading || end || !seerrReady) return;
		setLoading(true);
		try {
			const from = nextPage;
			const calls = [];
			for (let p = from; p < from + pages; p++) calls.push(isTv ? seerrApi.discoverTv(p) : seerrApi.discover(p));
			const answers = await Promise.all(calls);
			const added = [];
			answers.forEach((page) => ((page && page.results) || []).forEach((item) => {
				if (item.adult || seen.current.has(item.id)) return;
				seen.current.add(item.id);
				added.push(item);
			}));
			setItems((cur) => cur.concat(added));
			setNextPage(from + pages);
			setEnd(added.length === 0);
			askIptv(added);
		} catch (e) {
			setFailed(true);
		}
		setLoading(false);
	}, [loading, end, seerrReady, nextPage, isTv, askIptv]);

	// Changement d'onglet (Films ↔ Séries) : on repart de zéro.
	useEffect(() => {
		seen.current = new Set();
		setItems([]);
		setNextPage(1);
		setEnd(false);
		setFailed(false);
		setFilter(0);
		setIptv({});
		setSearching(false);
		setResults(null);
		setQuery('');
	}, [kind]);

	useEffect(() => {
		if (!items.length && nextPage === 1 && seerrReady) load(FIRST_PAGES);
	}, [items.length, nextPage, seerrReady, load]);

	useEffect(() => {
		if (vod && items.length) askIptv(items);
	}, [vod]); // eslint-disable-line react-hooks/exhaustive-deps

	const availabilityOf = useCallback((item) => {
		const copies = iptv[String(item.id)];
		return catalogueAvailability(item.mediaInfo && item.mediaInfo.status, !!(copies && copies.length));
	}, [iptv]);

	// La loupe : n'importe quel titre de ce genre, pas seulement les populaires.
	const handleQuery = useCallback((e) => {
		const value = e && e.target ? e.target.value : e;
		setQuery(value);
		clearTimeout(searchTimer.current);
		searchTimer.current = setTimeout(async () => {
			const q = String(value || '').trim();
			if (q.length < 2) {
				setResults(null);
				return;
			}
			try {
				const res = await seerrApi.search(q, 1);
				const list = ((res && res.results) || []).filter((r) => r.mediaType === kind);
				setResults(list);
				askIptv(list);
			} catch (err) {
				setResults([]);
			}
		}, 400);
	}, [kind, askIptv]);

	const toggleSearch = useCallback(() => {
		setSearching((s) => !s);
		setResults(null);
		setQuery('');
		setTimeout(() => Spotlight.focus('catalogue-search'), 50);
	}, []);

	const openPage = useCallback((item) => onSelectSeerrItem && onSelectSeerrItem({...item, mediaType: kind}), [onSelectSeerrItem, kind]);

	const pick = useCallback((item, availability) => {
		lastFocus.current = Spotlight.getCurrent();
		if (availability !== 'iptv') {
			openPage(item);
			return;
		}
		const copies = iptv[String(item.id)] || [];
		setDialog({
			item,
			copies,
			choices: [
				{id: 'play', icon: '▶', label: isTv ? $L('Voir les épisodes (IPTV)') : $L('Regarder maintenant (IPTV)'), strong: true},
				{id: 'page', icon: 'ⓘ', label: $L('La fiche')},
				{id: 'none', icon: '←', label: $L('Retour')}
			]
		});
	}, [iptv, isTv, openPage]);

	const refocus = useCallback(() => {
		const node = lastFocus.current;
		setTimeout(() => {
			if (node && document.body.contains(node)) Spotlight.focus(node);
			else Spotlight.focus('catalogue-page');
		}, 0);
	}, []);

	const choose = useCallback((id) => {
		const d = dialog;
		setDialog(null);
		if (!d || id === 'none') {
			refocus();
			return;
		}
		if (id === 'page') {
			openPage(d.item);
			return;
		}
		const copy = d.copies[0];
		if (!copy || !vod) return;
		const title = d.item.title || d.item.name || copy.name;
		if (isTv) setSeries({copy, title});
		else setPlaying({url: vod.movieUrl(copy), title, subtitle: copy.tag ? `IPTV · ${copy.tag}` : 'IPTV', id: `vod:movie:${copy.id}`});
	}, [dialog, vod, isTv, openPage, refocus]);

	const playEpisode = useCallback((ep, title) => {
		setPlaying({url: vod.episodeUrl(ep), title, subtitle: `S${ep.season} · É${ep.number} · ${ep.title}`, id: `vod:ep:${ep.id}`});
	}, [vod]);

	const openLibrary = useCallback(async () => {
		if (!onOpenLibrary || !api) return;
		try {
			const libs = await api.getLibraries();
			const want = isTv ? 'tvshows' : 'movies';
			const lib = ((libs && libs.Items) || []).find((l) => l.CollectionType === want);
			if (lib) onOpenLibrary(lib);
		} catch (e) {
			// La bibliothèque reste accessible depuis l'Accueil.
		}
	}, [onOpenLibrary, api, isTv]);

	const more = useCallback(() => load(MORE_PAGES), [load]);

	// Retour : lecteur, épisodes, choix, recherche, puis on quitte.
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (playing) {
				setPlaying(null);
				return true;
			}
			if (series) {
				setSeries(null);
				refocus();
				return true;
			}
			if (dialog) {
				setDialog(null);
				refocus();
				return true;
			}
			if (searching) {
				setSearching(false);
				setResults(null);
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, playing, series, dialog, searching, refocus]);

	if (playing) {
		return (
			<MaTvVodPlayer key={playing.id} id={playing.id} url={playing.url} title={playing.title} subtitle={playing.subtitle} />
		);
	}

	const grid = (list) => (
		<Row className={css.grid}>
			{list.map(([item, a]) => <Card key={`${item.id}`} item={item} availability={a} onPick={pick} />)}
		</Row>
	);
	const section = (title) => <div className={css.section}>{title}</div>;

	let content;
	if (!seerrReady) {
		content = <div className={css.note}>{$L('Le catalogue passe par Seerr : connecte-le dans les réglages.')}</div>;
	} else if (searching && results) {
		const tagged = results.map((i) => [i, availabilityOf(i)]).filter(([, a]) => catalogueFilterKeeps(filter, a));
		content = tagged.length ? grid(tagged) : <div className={css.note}>{`${$L('Rien trouvé pour')} « ${query} ».`}</div>;
	} else if (!items.length) {
		content = failed ? <div className={css.note}>{$L('Le catalogue ne répond pas, réessaie dans un instant.')}</div> : <div className={css.center}><LoadingSpinner /></div>;
	} else {
		const tagged = items.map((i) => [i, availabilityOf(i)]);
		const shown = tagged.filter(([, a]) => catalogueFilterKeeps(filter, a));
		const blocks = [];
		if (filter === 0) {
			const server = shown.filter(([, a]) => a === 'server');
			const rest = shown.filter(([, a]) => a !== 'server');
			if (server.length) blocks.push(section($L('Sur le serveur')), grid(server));
			if (rest.length) blocks.push(section($L('À découvrir')), grid(rest));
		} else if (!shown.length) {
			blocks.push(<div className={css.note}>{$L('Rien de ce genre parmi les titres chargés. Appuie sur « Voir plus ».')}</div>);
		} else {
			blocks.push(grid(shown));
		}
		content = (
			<div>
				{blocks.map((b, i) => <div key={i}>{b}</div>)}
				{!end ? (
					<div className={css.moreRow}>
						{loading ? <LoadingSpinner /> : <SpottableDiv className={css.button} onClick={more}>{$L('Voir plus')}</SpottableDiv>}
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div className={css.catalogue}>
			<PageContainer spotlightId="catalogue-page" className={css.page} style={series ? {display: 'none'} : null} spotlightDisabled={!!series || !!dialog}>
				<Scroller direction="vertical" verticalScrollbar="hidden">
					<div className={css.inner}>
						<Row className={css.header}>
							<span className={css.title}>{isTv ? $L('SÉRIES') : $L('FILMS')}</span>
							<SpottableDiv className={`${css.round} ${searching ? css.roundOn : ''}`} onClick={toggleSearch}>{searching ? '✕' : '⌕'}</SpottableDiv>
							{searching ? (
								<div className={css.searchBox}>
									<SpottableInput
										type="text"
										purpose="search"
										spotlightId="catalogue-search"
										placeholder={isTv ? $L('Une série, un acteur…') : $L('Un film, un acteur…')}
										value={query}
										onChange={handleQuery}
										autoComplete="off"
									/>
								</div>
							) : null}
							<div className={css.segments}>
								{[$L('Tout'), $L('Sur le serveur'), $L('À regarder (IPTV)'), $L('À demander')].map((label, i) => (
									<Segment key={label} index={i} label={label} on={filter === i} onPick={setFilter} />
								))}
							</div>
							{onOpenLibrary ? <SpottableDiv className={css.button} onClick={openLibrary}>{$L('Toute ma bibliothèque')}</SpottableDiv> : null}
						</Row>
						{!searching ? <div className={css.hint}>{$L('Tout le catalogue : ce qu’on a, ce qu’on regarde tout de suite, ce qu’on peut demander.')}</div> : null}
						{content}
					</div>
				</Scroller>
			</PageContainer>
			{series && vod ? <ProviderSeries vod={vod} copy={series.copy} title={series.title} onPlay={playEpisode} /> : null}
			{dialog ? (
				<ChoiceDialog
					title={dialog.item.title || dialog.item.name}
					subtitle={dialog.copies[0] && dialog.copies[0].tag ? `IPTV · ${dialog.copies[0].tag}` : 'IPTV'}
					choices={dialog.choices}
					onPick={choose}
				/>
			) : null}
		</div>
	);
};

export default Catalogue;
