// Explorer (explorer_screen.dart) : toutes les collections VJOD, famille par
// famille, chacune tout le catalogue (ce que le serveur a d'abord, le reste à
// une demande près), puis les palmarès et sagas du serveur.
import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as seerrApi from '../../services/seerrApi';
import {STREAMING_NETWORKS, MOVIE_STUDIOS} from '../../utils/seerrHomeRows';
import {collectionById, VJOD_COLLECTIONS, FAMILIES, FAMILY_TITLES, inSeason, readyOnly, availableFirst, isPalmares, tileHue, REPLACED_SMARTLISTS} from '../../services/vjodCollections';
import {fetchBrowsePage} from '../../services/vjodCollectionService';
import {catalogueAvailability} from '../../services/maTvVod';
import {Card} from './Catalogue';

import css from './Explorer.module.less';
import cat from './Catalogue.module.less';

const SpottableDiv = Spottable('div');
const Row = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const PageContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

const COLUMNS = 5;
const SHORT_LIST = COLUMNS * 2 - 1;

const logoFor = (c) => {
	const list = c.query.studio ? MOVIE_STUDIOS : (c.query.network ? STREAMING_NETWORKS : null);
	const id = c.query.studio || c.query.network;
	const hit = list && list.find((e) => e.id === id);
	return hit && hit.logo ? seerrApi.getImageUrl('/' + hit.logo, 'w780_filter(duotone,ffffff,bababa)') : null;
};

const Tile = ({id, title, chip, logo, color, payload, onPick, first}) => {
	const [broken, setBroken] = useState(false);
	const handleError = useCallback(() => setBroken(true), []);
	const handleClick = useCallback(() => onPick(payload), [onPick, payload]);
	const showLogo = logo && !broken;
	return (
		<SpottableDiv className={css.tile} style={{background: color}} onClick={handleClick} spotlightId={first ? 'explorer-first' : undefined} data-id={id}>
			{showLogo ? <img className={css.logo} src={logo} alt={title} onError={handleError} /> : (
				<>
					{chip ? <span className={css.chip}>{chip}</span> : <span />}
					<span className={css.name}>{title}</span>
				</>
			)}
		</SpottableDiv>
	);
};

// Une collection ouverte : ses titres, ceux du serveur d'abord.
const CollectionPage = ({collection, onSelectSeerrItem}) => {
	const [items, setItems] = useState([]);
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(1);
	const [loading, setLoading] = useState(false);
	const [onlyReady, setOnlyReady] = useState(readyOnly(collection));
	const seen = useRef(new Set());
	const focused = useRef(false);
	const mediaType = collection.query.mediaType || 'movie';

	const load = useCallback(async (from, count) => {
		setLoading(true);
		const pages = [];
		for (let p = from; p < from + count; p++) pages.push(fetchBrowsePage(collection, p));
		const answers = await Promise.all(pages);
		const added = [];
		let last = 1;
		answers.forEach((a) => {
			if (!a) return;
			last = Math.max(last, a.totalPages || 1);
			(a.results || []).forEach((item) => {
				if (item.adult || seen.current.has(item.id)) return;
				seen.current.add(item.id);
				added.push(item);
			});
		});
		// Par lot lu : ce qu'on a, puis ce qui arrive, puis le reste.
		setItems((cur) => cur.concat(availableFirst(added)));
		setTotal(last);
		setPage(from + count);
		setLoading(false);
	}, [collection]);

	// Une collection s'ouvre sur quelques pages d'un coup (une quarantaine de titres).
	useEffect(() => {
		load(1, 2);
	}, [load]);

	const shown = onlyReady ? items.filter((i) => i.mediaInfo && (i.mediaInfo.status === 5 || i.mediaInfo.status === 4)) : items;

	useEffect(() => {
		if (shown.length && !focused.current) {
			focused.current = true;
			setTimeout(() => Spotlight.focus('explorer-collection-grid'), 0);
		}
	}, [shown.length]);

	const pick = useCallback((item) => onSelectSeerrItem && onSelectSeerrItem({...item, mediaType}), [onSelectSeerrItem, mediaType]);
	const more = useCallback(() => load(page, 2), [load, page]);
	const showAll = useCallback(() => setOnlyReady(false), []);
	const showReady = useCallback(() => setOnlyReady(true), []);

	return (
		<PageContainer spotlightId="explorer-collection" className={cat.page}>
			<Scroller direction="vertical" verticalScrollbar="hidden">
				<div className={cat.inner}>
					<Row className={cat.header}>
						<span className={cat.title}>{collection.title}</span>
						<div className={cat.segments}>
							<SpottableDiv className={`${cat.segment} ${!onlyReady ? cat.segmentOn : ''}`} onClick={showAll}>{$L('Tout')}</SpottableDiv>
							<SpottableDiv className={`${cat.segment} ${onlyReady ? cat.segmentOn : ''}`} onClick={showReady}>{$L('Disponible')}</SpottableDiv>
						</div>
					</Row>
					{collection.subtitle ? <div className={cat.hint}>{collection.subtitle}</div> : null}
					{!items.length && loading ? <div className={cat.center}><LoadingSpinner /></div> : null}
					{!loading && !shown.length ? <div className={cat.note}>{onlyReady ? $L('Rien de disponible parmi les titres chargés. Appuie sur « Voir plus » ou « Tout ».') : $L('Rien pour l’instant.')}</div> : null}
					<Row spotlightId="explorer-collection-grid" className={cat.grid}>
						{shown.map((item) => <Card key={item.id} item={item} availability={catalogueAvailability(item.mediaInfo && item.mediaInfo.status, false)} onPick={pick} />)}
					</Row>
					{page <= total ? (
						<div className={cat.moreRow}>
							{loading && items.length ? <LoadingSpinner /> : <SpottableDiv className={cat.button} onClick={more}>{$L('Voir plus')}</SpottableDiv>}
						</div>
					) : null}
				</div>
			</Scroller>
		</PageContainer>
	);
};

const Explorer = ({backHandlerRef, onSelectSeerrItem, onSelectItem, initialCollection}) => {
	const {api} = useAuth();
	const [palmares, setPalmares] = useState([]);
	const [sagas, setSagas] = useState([]);
	const [expanded, setExpanded] = useState({});
	// Ouvert depuis le « Tout voir » d'une rangée de l'accueil : la collection tout de suite.
	const [open, setOpen] = useState(() => (initialCollection ? collectionById(initialCollection) : null));
	const direct = useRef(Boolean(initialCollection));
	const lastFocus = useRef(null);

	useEffect(() => {
		let alive = true;
		if (!api) return undefined;
		api.getItems({IncludeItemTypes: 'BoxSet', Recursive: true, SortBy: 'SortName', Fields: 'PrimaryImageAspectRatio', Limit: 500}).then((res) => {
			if (!alive) return;
			const p = [];
			const s = [];
			((res && res.Items) || []).forEach((item) => {
				const name = item.Name || '';
				if (REPLACED_SMARTLISTS.has(name.toLowerCase().trim())) return;
				(isPalmares(name) ? p : s).push(item);
			});
			setPalmares(p);
			setSagas(s);
		}).catch(() => {});
		return () => {
			alive = false;
		};
	}, [api]);

	useEffect(() => {
		const t = setTimeout(() => Spotlight.focus('explorer-first'), 0);
		return () => clearTimeout(t);
	}, []);

	const pickCollection = useCallback((c) => {
		lastFocus.current = Spotlight.getCurrent();
		setOpen(c);
	}, []);
	const pickServer = useCallback((item) => onSelectItem && onSelectItem(item), [onSelectItem]);
	const expand = useCallback((title) => setExpanded((cur) => ({...cur, [title]: true})), []);

	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (!open || direct.current) return false;
			setOpen(null);
			const node = lastFocus.current;
			setTimeout(() => {
				if (node && document.body.contains(node)) Spotlight.focus(node);
				else Spotlight.focus('explorer-page');
			}, 0);
			return true;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, open]);

	const now = new Date();
	let first = true;
	const takeFirst = () => {
		const was = first;
		first = false;
		return was;
	};
	const sections = [];
	FAMILIES.forEach((family) => {
		const list = VJOD_COLLECTIONS.filter((c) => c.family === family && inSeason(c, now));
		if (!list.length) return;
		sections.push(
			<div key={family}>
				<div className={css.section}>{FAMILY_TITLES[family]}</div>
				<Row className={css.tiles}>
					{list.map((c) => {
						const logo = logoFor(c);
						return (
							<Tile
								key={c.id}
								id={c.id}
								title={c.title}
								chip={family === 'ready' ? FAMILY_TITLES.ready : null}
								logo={logo}
								color={logo ? '#1C1D22' : tileHue(c.id)}
								payload={c}
								onPick={pickCollection}
								first={takeFirst()}
							/>
						);
					})}
				</Row>
			</div>
		);
	});
	// Un serveur peut avoir des dizaines de sagas : deux lignes, puis « Tout voir ».
	[[$L('Palmarès'), palmares], [$L('Sagas & collections'), sagas]].forEach(([title, all]) => {
		if (!all.length) return;
		const isOpen = expanded[title] || all.length <= SHORT_LIST + 1;
		const list = isOpen ? all : all.slice(0, SHORT_LIST);
		sections.push(
			<div key={title}>
				<div className={css.section}>{title}</div>
				<Row className={css.tiles}>
					{list.map((item) => (
						<Tile key={item.Id} id={item.Id} title={item.Name} color={tileHue(item.Name || '')} payload={item} onPick={pickServer} first={takeFirst()} />
					))}
					{!isOpen ? <Tile id={`all-${title}`} title={`${$L('Tout voir')} (${all.length})`} color="#24252B" payload={title} onPick={expand} /> : null}
				</Row>
			</div>
		);
	});

	return (
		<div className={cat.catalogue}>
			<PageContainer spotlightId="explorer-page" className={cat.page} style={open ? {display: 'none'} : null} spotlightDisabled={!!open}>
				<Scroller direction="vertical" verticalScrollbar="hidden">
					<div className={cat.inner}>
						<div className={css.bigTitle}>EXPLORER</div>
						<div className={cat.hint}>{$L('Coche verte : disponible. + rouge : à demander, prêt en une dizaine de minutes.')}</div>
						{sections}
					</div>
				</Scroller>
			</PageContainer>
			{open ? <CollectionPage key={open.id} collection={open} onSelectSeerrItem={onSelectSeerrItem} /> : null}
		</div>
	);
};

export default Explorer;
