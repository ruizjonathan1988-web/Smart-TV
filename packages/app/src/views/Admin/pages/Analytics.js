// Analyses du contenu (admin_content_analytics_screen.dart) : toutes les
// bibliothèques ou une seule, tuiles de comptes, parts de chaque bibliothèque,
// années par décennie, durées, classifications, genres, auteurs ou artistes,
// conteneurs et codecs. Chaque tuile ou barre ouvre la liste de ses éléments.
import {useState, useCallback, useEffect, useRef} from 'react';

import {useAdmin} from '../adminContext';
import {PageHeader, Section, Row, Btn, Progress, Loading, ErrorBox, StatButton, Tabs, InfoRow, Group, css} from '../AdminUi';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';
import {
	metricsForCollectionType, skipsLibrary, libraryCounts, libraryItems, insightsOf, sumLibraries, libraryTotal,
	ranked, decades, runtimeSegments, topOf, yearSpan, percent, totalOf, forgetLibraryItems, queryItems
} from '../../../services/adminAnalytics';
import {metricLabel, libraryTypeLabel} from './adminLabels';

// Une barre d'une répartition : libellé, nombre, part ; OK ouvre ses éléments.
const ShareRow = ({seg, total, largest, onOpen}) => {
	const handleClick = useCallback(() => onOpen(seg), [onOpen, seg]);
	const label = seg.other ? t('other') : seg.label;
	return (
		<Row label={label} value={`${seg.count.toLocaleString('fr-FR')} · ${percent(seg.count, total)} %`} onClick={handleClick}>
			<Progress value={largest ? (seg.count / largest) * 100 : 0} />
		</Row>
	);
};

const ShareCard = ({title, segments, total, dimension, onOpen}) => {
	const largest = segments.reduce((m, s) => Math.max(m, s.count), 0);
	const sum = total || segments.reduce((s, x) => s + x.count, 0);
	const handleOpen = useCallback((seg) => onOpen(dimension, seg.values, seg.other ? t('other') : seg.label, seg), [onOpen, dimension]);
	if (!segments.length) return null;
	return (
		<Section title={title}>
			{segments.map((seg, i) => <ShareRow key={seg.label || 'other' + i} seg={seg} total={sum} largest={largest} onOpen={handleOpen} />)}
		</Section>
	);
};

const top8 = (counts) => Object.keys(counts || {}).map((k) => ({label: k, values: [k], count: counts[k]})).sort((a, b) => b.count - a.count).slice(0, 8);

const CodecCards = ({containersTitle, containers, videoCodecs, audioCodecs, onOpen}) => (
	<>
		<ShareCard title={containersTitle} segments={ranked(containers)} dimension="container" onOpen={onOpen} />
		<ShareCard title={t('analyticsVideoCodecs')} segments={ranked(videoCodecs)} dimension="videoCodec" onOpen={onOpen} />
		<ShareCard title={t('analyticsAudioCodecs')} segments={ranked(audioCodecs)} dimension="audioCodec" onOpen={onOpen} />
	</>
);

const LibraryShare = ({libraries, onSelect}) => {
	const total = libraries.reduce((s, l) => s + libraryTotal(l), 0);
	const largest = libraries.reduce((m, l) => Math.max(m, libraryTotal(l)), 0);
	const segs = libraries.map((l) => ({label: l.name, values: [l.itemId], count: libraryTotal(l)}));
	const handleOpen = useCallback((seg) => onSelect(seg.values[0]), [onSelect]);
	return (
		<Section title={t('analyticsLibraryShare')}>
			{segs.map((seg) => <ShareRow key={seg.values[0] || seg.label} seg={seg} total={total} largest={largest} onOpen={handleOpen} />)}
		</Section>
	);
};

const LoadingCard = ({progress}) => (
	<Section>
		<InfoRow label={t('adminAnalyticsLoadingProgress', {percentage: Math.round(progress * 100)})} />
		<Progress value={progress * 100} />
	</Section>
);

const AllDetail = ({libraries, progress, onOpen, onSelect}) => {
	const totals = {};
	metricsForCollectionType(null).forEach((m) => {
		totals[m.key] = libraries.reduce((s, l) => s + (l.counts[m.key] || 0), 0);
	});
	const tech = sumLibraries(libraries);
	return (
		<div>
			<Group className={css.statRow}>
				{Object.keys(totals).filter((k) => totals[k] > 0).map((k) => (
					<StatButton key={k} value={totals[k].toLocaleString('fr-FR')} label={metricLabel(k)} arg={k} onClick={onOpen.type} />
				))}
			</Group>
			{libraries.length ? <LibraryShare libraries={libraries} onSelect={onSelect} /> : null}
			{libraries.some((l) => l.pending) ? <LoadingCard progress={progress} /> : null}
			<CodecCards containersTitle={t('analyticsContainers')} containers={tech.containers} videoCodecs={tech.videoCodecs} audioCodecs={tech.audioCodecs} onOpen={onOpen.dim} />
		</div>
	);
};

const LibraryDetail = ({library, share, progress, onOpen}) => {
	const ins = library.insights;
	const total = libraryTotal(library);
	const span = yearSpan(ins.years);
	const topRating = topOf(ins.ratings);
	const topRuntime = topOf(ins.runtimes);
	const shareOf = (count, counts) => t('analyticsShareOfItems', {percent: Math.round((count / (totalOf(counts) || 1)) * 100)});
	const handleYears = useCallback(() => onOpen.dim('year', [], span), [onOpen, span]);
	const handleRating = useCallback(() => onOpen.dim('rating', [topRating.label], topRating.label), [onOpen, topRating]);
	const handleRuntime = useCallback(() => onOpen.dim('runtime', [topRuntime.label], topRuntime.label), [onOpen, topRuntime]);
	const type = String(library.collectionType || '').toLowerCase();
	const contribTitle = type === 'music' ? t('analyticsTopArtists') : type === 'books' ? t('analyticsTopAuthors') : t('analyticsTopContributors');
	return (
		<div>
			<div className={css.pageSubtitle}>{`${libraryTypeLabel(library.collectionType)} · ${t('analyticsShareOfItems', {percent: (share * 100).toFixed(1).replace('.', ',')})} · ${total.toLocaleString('fr-FR')}`}</div>
			<Group className={css.statRow}>
				{metricsForCollectionType(library.collectionType).filter((m) => library.counts[m.key] > 0).map((m) => (
					<StatButton key={m.key} value={library.counts[m.key].toLocaleString('fr-FR')} label={metricLabel(m.key)} arg={m.key} onClick={onOpen.type} />
				))}
				{span ? <StatButton value={span} label={t('analyticsReleaseYears')} onClick={handleYears} /> : null}
				{topRating ? <StatButton value={topRating.label} label={t('analyticsTopRating')} note={shareOf(topRating.count, ins.ratings)} onClick={handleRating} /> : null}
				{topRuntime ? <StatButton value={topRuntime.label} label={t('analyticsTypicalRuntime')} note={shareOf(topRuntime.count, ins.runtimes)} onClick={handleRuntime} /> : null}
			</Group>
			{library.pending ? <LoadingCard progress={progress} /> : null}
			<ShareCard title={t('analyticsReleaseYears')} segments={decades(ins.years)} dimension="year" onOpen={onOpen.dim} />
			<ShareCard title={t('analyticsRuntimeBuckets')} segments={runtimeSegments(ins.runtimes)} dimension="runtime" onOpen={onOpen.dim} />
			<ShareCard title={t('analyticsContentRatings')} segments={ranked(ins.ratings)} dimension="rating" onOpen={onOpen.dim} />
			<ShareCard title={t('analyticsTopGenres')} segments={top8(ins.genres)} total={total} dimension="genre" onOpen={onOpen.dim} />
			<ShareCard title={contribTitle} segments={top8(ins.contributors)} total={total} dimension="contributor" onOpen={onOpen.dim} />
			<CodecCards containersTitle={t('analyticsFileFormats')} containers={ins.containers} videoCodecs={ins.videoCodecs} audioCodecs={ins.audioCodecs} onOpen={onOpen.dim} />
		</div>
	);
};

// Les bibliothèques lues une fois par session de console (comme le cache de l'APK).
let cached = null;

const Analytics = () => {
	const {api, push} = useAdmin();
	const [state, setState] = useState(() => (cached ? {status: 'ready', libraries: cached, progress: 1} : {status: 'loading', libraries: [], progress: 0.05}));
	const [error, setError] = useState(null);
	const [selected, setSelected] = useState('all');
	const alive = useRef(true);
	useEffect(() => () => {
		alive.current = false;
	}, []);

	const load = useCallback(async (fresh) => {
		if (cached && !fresh) return;
		setError(null);
		setState({status: 'loading', libraries: [], progress: 0.05});
		try {
			const folders = (await api.getVirtualFolders()).filter((l) => !skipsLibrary(l.CollectionType));
			const libs = await Promise.all(folders.map((f) => libraryCounts(api, f)));
			if (!alive.current) return;
			const pending = libs.map((l, i) => i).filter((i) => libs[i].pending);
			setState({status: 'ready', libraries: libs.slice(), progress: pending.length ? 0.2 : 1});
			let done = 0;
			await Promise.all(pending.map(async (i) => {
				let insights;
				try {
					insights = insightsOf(await libraryItems(api, libs[i]));
				} catch {
					insights = libs[i].insights;
				}
				libs[i] = {...libs[i], insights, pending: false};
				done++;
				if (alive.current) setState({status: 'ready', libraries: libs.slice(), progress: 0.2 + (0.8 * done) / pending.length});
			}));
			libs.sort((a, b) => libraryTotal(b) - libraryTotal(a) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
			cached = libs;
			if (alive.current) setState({status: 'ready', libraries: libs.slice(), progress: 1});
		} catch (e) {
			if (alive.current) {
				setError(describeAdminError(e));
				setState({status: 'error', libraries: [], progress: 0});
			}
		}
	}, [api]);

	useEffect(() => {
		load(false);
	}, [load]);

	const handleRefresh = useCallback(() => {
		cached = null;
		forgetLibraryItems();
		load(true);
	}, [load]);

	const libraries = state.libraries;
	const library = selected === 'all' ? null : libraries.find((l) => l.itemId === selected);
	const openQuery = useCallback((dimension, values, title) => {
		const query = {libraryId: library ? library.itemId : null, dimension, values, title};
		push('analyticsItems', {query, libraries}, title);
	}, [push, library, libraries]);
	const openType = useCallback((key) => openQuery('type', [key], metricLabel(key)), [openQuery]);
	const onOpen = {dim: openQuery, type: openType};

	const tabs = [{id: 'all', label: t('allLibraries')}].concat(libraries.map((l) => ({id: l.itemId, label: l.name})));
	const grand = libraries.reduce((s, l) => s + libraryTotal(l), 0);

	return (
		<div>
			<PageHeader title={t('adminDrawerAnalytics')} subtitle={t('adminPageDescAnalytics')}>
				<Btn small icon="refresh" label={t('refresh')} onClick={handleRefresh} />
			</PageHeader>
			{state.status === 'loading' ? <Loading /> : null}
			{state.status === 'error' ? <ErrorBox title={t('adminMediaAnalyticsLoadFailed')} message={error} onRetry={handleRefresh} /> : null}
			{state.status === 'ready' ? (
				<>
					<Tabs tabs={tabs} value={library ? selected : 'all'} onChange={setSelected} />
					{library ? (
						<LibraryDetail library={library} share={grand ? libraryTotal(library) / grand : 0} progress={state.progress} onOpen={onOpen} />
					) : (
						<AllDetail libraries={libraries} progress={state.progress} onOpen={onOpen} onSelect={setSelected} />
					)}
				</>
			) : null}
		</div>
	);
};

// ----------------------------------------------------------------- les éléments d'une catégorie
const ItemRow = ({item, onOpen}) => {
	const {api} = useAdmin();
	const handleClick = useCallback(() => onOpen(item), [onOpen, item]);
	const img = item.imageItemId ? <img src={api.imageUrl(item.imageItemId, 'Primary', item.imageTag, 120)} alt="" /> : '';
	return (
		<Row
			avatar={img}
			label={item.name}
			help={[item.parentName, item.year].filter(Boolean).join(' · ')}
			value={item.type}
			onClick={handleClick}
		/>
	);
};

const PAGE = 100;

export const AnalyticsItems = ({query, libraries}) => {
	const {api, push} = useAdmin();
	const [state, setState] = useState({status: 'loading', items: [], error: null});
	const [shown, setShown] = useState(PAGE);
	useEffect(() => {
		let alive = true;
		queryItems(api, libraries || [], query).then((items) => {
			if (alive) setState({status: 'ready', items, error: null});
		}, (e) => {
			if (alive) setState({status: 'error', items: [], error: describeAdminError(e)});
		});
		return () => {
			alive = false;
		};
	}, [api, libraries, query]);
	const handleMore = useCallback(() => setShown((n) => n + PAGE), []);
	const handleOpen = useCallback((item) => push('metadataEdit', {itemId: item.id}, item.name), [push]);
	if (state.status === 'loading') return <Loading />;
	if (state.status === 'error') return <ErrorBox message={state.error} />;
	return (
		<div>
			<PageHeader title={query.title || t('adminDrawerAnalytics')} subtitle={`${state.items.length.toLocaleString('fr-FR')} ${t('tvItems')}`} />
			<Section>
				{state.items.length ? state.items.slice(0, shown).map((it) => <ItemRow key={it.id} item={it} onOpen={handleOpen} />) : <InfoRow label={t('tvNoItems')} />}
				{state.items.length > shown ? <Row label={t('tvShowMore')} chevron onClick={handleMore} /> : null}
			</Section>
		</div>
	);
};

export default Analytics;
