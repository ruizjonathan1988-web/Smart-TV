// Onglet Replay (MaTvReplayPageScreen de l'APK), à la façon de l'appli
// France TV : la « une », Mes émissions, Notre sélection, En direct, À la une
// numérotée, les catégories, une rangée par catégorie, nos chaînes. Une
// chaîne ouvre sa page (la soirée, une rangée par émission, jour par jour) ;
// une catégorie, la grille de ses émissions. Tout se lit sur le lecteur de la TV.
import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import Spotlight from '@enact/spotlight';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import {api as jellyfin} from '../../services/jellyfinApi';
import {getMaTvClient} from '../../services/maTvSession';
import {
	createReplayClient, resolveReplay, replayLogos, liveForReplay, nextEpisode,
	rowLabel, titleOf, subtitleOf, dayGroupLabel
} from '../../services/maTvReplay';
import {loadReplayProgress, resumePosition} from '../../services/maTvProgress';
import {createVodClient} from '../../services/maTvVod';
import {findProviderSeries, loadReplaySources} from '../../services/replaySources';
import ProviderSeries from '../Catalogue/ProviderSeries';
import MaTvPlayer from '../MaTv/MaTvPlayer';
import MaTvVodPlayer from '../MaTv/MaTvVodPlayer';
import {R, ReplayTile, Strip, Section, Hero, LiveRow, GenrePills, ChannelGrid, Sheet, Button} from './ReplayParts';
import TrackerSheet from './TrackerSheet';
import ReplayMine from './ReplayMine';
import {fetchReplayHome, savedReplayHome} from '../../services/maTvReplayHome';
import {ChoiceDialog} from '../MaTv/MaTvPageParts';
import {useSeerr} from '../../context/SeerrContext';
import {seerrMatch, requestSeerrSeason} from '../../services/replayKeepSeerr';

import css from './Replay.module.less';

const PageContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const HERO_MS = 8000;
const TOAST_MS = 4000;

const pad2 = (n) => (n < 10 ? '0' + n : String(n));

// « CE SOIR · 21:10 », « HIER SOIR », « LUN. 2 NOV. SOIR ».
const primeLabel = (item) => {
	if (!item.aired) return 'LA SOIRÉE';
	const d = new Date(item.aired * 1000);
	const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
	const label = dayGroupLabel(iso);
	const when = label === 'Aujourd’hui' ? 'CE SOIR' : label === 'Hier' ? 'HIER SOIR' : `${label.toUpperCase()} SOIR`;
	return `${when} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// ---------------------------------------------------------------- page d'une chaîne
const ChannelPage = ({page, onPlay, onInfo}) => {
	const [day, setDay] = useState(0);
	const all = useMemo(() => (page ? [].concat(...page.shows.map((s) => s.items)) : []), [page]);
	const handlePrimePlay = useCallback(() => onPlay(page.prime, all), [onPlay, page, all]);
	const handlePrimeInfo = useCallback(() => onInfo(page.prime, all), [onInfo, page, all]);
	const handlePlay = useCallback((item) => onPlay(item, all), [onPlay, all]);
	const handleInfo = useCallback((item) => onInfo(item, all), [onInfo, all]);
	if (!page) return <div className={css.centered}><LoadingSpinner /></div>;
	const prime = page.prime;
	if (!prime && !page.shows.length) {
		return <div className={css.empty} style={{color: R.mute}}>{$L('Rien en replay pour l’instant sur cette chaîne.')}</div>;
	}
	const current = page.days[Math.min(day, Math.max(0, page.days.length - 1))];
	return (
		<div>
			{prime ? (
				<div className={css.prime}>
					<ReplayTile item={prime} width={28.75} onPlay={handlePlay} onInfo={handleInfo} spotlightId="replay-prime" />
					<div className={css.primeText}>
						<div className={css.primeWhen} style={{color: R.mute}}>{primeLabel(prime)}</div>
						<div className={css.primeShow} style={{color: R.ink}}>{prime.show.toUpperCase()}</div>
						{prime.desc ? <div className={css.primeDesc} style={{color: R.ink}}>{prime.desc}</div> : null}
						<div className={css.heroButtons}>
							<Button primary onClick={handlePrimePlay}>▶ {$L('Regarder')}</Button>
							<Button onClick={handlePrimeInfo}>{$L('Infos')}</Button>
						</div>
					</div>
				</div>
			) : null}
			{page.shows.map((s) => (
				<Section
					key={s.show}
					title={s.show}
					count={`${s.items.length} ${s.items.length > 1 ? $L('épisodes') : $L('épisode')}`}
					followed={s.followed}
				>
					<Strip>
						{s.items.map((e) => (
							<ReplayTile key={e.id} item={e} showDay onPlay={handlePlay} onInfo={handleInfo} />
						))}
					</Strip>
				</Section>
			))}
			{page.days.length ? (
				<Section title={$L('Jour par jour')}>
					<Strip>
						{page.days.map((d, i) => (
							<DayButton key={d.day} index={i} label={dayGroupLabel(d.day)} on={i === day} onPick={setDay} />
						))}
					</Strip>
					{current ? (
						<Strip>
							{current.items.map((e) => (
								<ReplayTile key={e.id} item={e} showDay onPlay={handlePlay} onInfo={handleInfo} />
							))}
						</Strip>
					) : null}
				</Section>
			) : null}
		</div>
	);
};

const DayButton = ({index, label, on, onPick}) => {
	const handleClick = useCallback(() => onPick(index), [onPick, index]);
	return <Button primary={on} onClick={handleClick}>{label}</Button>;
};

// ---------------------------------------------------------------- écran
const Replay = ({backHandlerRef, onSelectItem, startWith}) => {
	const {user, serverUrl, accessToken} = useAuth();
	const [maTv, setMaTv] = useState(null);
	const [status, setStatus] = useState('loading'); // loading | ready | nomatv | empty
	const [page, setPage] = useState(null);
	const [logos, setLogos] = useState({});
	const [liveChans, setLiveChans] = useState([]);
	const [hero, setHero] = useState(0);
	// Pile des sous-pages : chaîne ou catégorie.
	const [stack, setStack] = useState([]);
	const [subData, setSubData] = useState(null);
	const [sheet, setSheet] = useState(null); // {item, siblings, followed, kept}
	const [playing, setPlaying] = useState(null); // {kind: 'vod'|'live', ...}
	const [toast, setToast] = useState(null);
	const [, setProgressLoaded] = useState(false);
	const toastTimer = useRef(null);
	const stackRef = useRef([]);
	// Où était le focus avant chaque ouverture (fiche, sous-page, lecteur).
	const focusStack = useRef([]);
	const remember = useCallback(() => {
		focusStack.current.push(Spotlight.getCurrent());
	}, []);

	// Le focus revient où il était (tuile, chaîne, catégorie).
	const refocus = useCallback(() => {
		const node = focusStack.current.pop();
		setTimeout(() => {
			if (node && document.body.contains(node)) Spotlight.focus(node);
			else Spotlight.focus(stackRef.current.length ? 'replay-sub' : 'replay-page');
		}, 0);
	}, []);
	const playerBackRef = useRef(null);

	const replay = useMemo(() => (maTv ? createReplayClient(maTv) : null), [maTv]);
	const vod = useMemo(() => (maTv ? createVodClient(maTv) : null), [maTv]);
	// La série de la VOD du fournisseur ouverte par-dessus (épisode à choisir).
	const [vodSeries, setVodSeries] = useState(null); // {copy, title}

	const say = useCallback((text) => {
		setToast(text);
		clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
	}, []);

	const load = useCallback(async (client, replayClient) => {
		const p = await replayClient.page(false);
		if (!p || !p.rows.some((r) => r.items.length)) {
			setStatus(p ? 'empty' : 'nomatv');
			return;
		}
		setPage(p);
		setStatus('ready');
		const all = await client.allChannels();
		const live = all && Array.isArray(all.chans) ? all.chans : [];
		setLogos(replayLogos(p.channels, live));
		setLiveChans(liveForReplay(p.channels, live));
	}, []);

	useEffect(() => {
		let alive = true;
		loadReplayProgress().then(() => alive && setProgressLoaded(true));
		(async () => {
			const c = await getMaTvClient({serverUrl, accessToken, user});
			if (!alive) return;
			if (!c) {
				setStatus('nomatv');
				return;
			}
			setMaTv(c);
			await load(c, createReplayClient(c));
		})();
		return () => {
			alive = false;
			clearTimeout(toastTimer.current);
		};
	}, [serverUrl, accessToken, user, load]);

	const reload = useCallback(() => {
		if (maTv && replay) load(maTv, replay);
	}, [maTv, replay, load]);

	// La « une » tourne toutes les 8 s.
	useEffect(() => {
		const n = page ? page.hero.length : 0;
		if (n < 2) return undefined;
		const t = setInterval(() => setHero((h) => (h + 1) % n), HERO_MS);
		return () => clearInterval(t);
	}, [page]);

	const chanName = useCallback((chan) => {
		const list = page ? page.channels : [];
		for (let i = 0; i < list.length; i++) if (list[i].chan === chan) return list[i].name;
		return chan;
	}, [page]);

	// ------------------------------------------------------------ lecture
	const play = useCallback(async (item, siblings = []) => {
		if (!replay || !item) return;
		// Depuis la fiche, on garde la place mémorisée à son ouverture.
		const fromSheet = !!sheet;
		if (!fromSheet && !playing) remember();
		setSheet(null);
		say($L('Ouverture…'));
		const res = await resolveReplay(item, {replay, maTv, jellyfin});
		if (res.type === 'library') {
			setToast(null);
			refocus();
			onSelectItem?.(res.item);
			return;
		}
		if (res.type === 'stream') {
			setToast(null);
			const next = nextEpisode(item, siblings);
			setPlaying({
				kind: 'vod', item, siblings, next,
				url: res.url, adSkip: !!res.adSkip, notice: res.notice || '',
				startMs: resumePosition(item.id)
			});
			return;
		}
		// Un épisode IPTV dont l'enregistrement n'est plus gardé : la VOD du fournisseur prend
		// le relais (playReplay de l'APK, VJOD 5.12).
		if (item.kind === 'iptv' && vod) {
			const series = await findProviderSeries(item, vod);
			if (series) {
				say($L('Plus en replay chez ton fournisseur : sa VOD prend le relais, l’épisode y est peut-être pas encore.'));
				setVodSeries({copy: series, title: series.name});
				return;
			}
		}
		if (!playing) refocus();
		say(res.message);
	}, [replay, maTv, vod, sheet, playing, remember, refocus, say, onSelectItem]);

	// Un épisode de la VOD du fournisseur, choisi dans la série.
	const playVodEpisode = useCallback((ep, title) => {
		const id = `vod:ep:${ep.id}`;
		setPlaying({
			kind: 'vod', item: {id, show: title, title: ep.title || '', season: ep.season || 0, episode: ep.number || 0, chan: ''},
			siblings: [], next: null, url: vod.episodeUrl(ep), adSkip: false, notice: '', startMs: resumePosition(id)
		});
	}, [vod]);

	const handlePlay = useCallback((item, siblings) => play(item, siblings), [play]);
	const handleNext = useCallback(() => {
		if (playing && playing.next) play(playing.next, playing.siblings);
	}, [playing, play]);

	const openLive = useCallback((index) => {
		remember();
		setPlaying({kind: 'live', index});
	}, [remember]);

	// ------------------------------------------------------------ fiche
	const openSheet = useCallback((item, siblings = []) => {
		remember();
		setSheet({item, siblings, followed: item.followed, kept: item.kept});
	}, [remember]);

	useEffect(() => {
		if (!sheet) return undefined;
		const t = setTimeout(() => Spotlight.focus('replay-sheet-play'), 0);
		return () => clearTimeout(t);
	}, [sheet && sheet.item]); // eslint-disable-line react-hooks/exhaustive-deps

	const sheetFollow = useCallback(async () => {
		if (!sheet || !replay) return;
		const ok = await replay.setPref({show: sheet.item.show, follow: !sheet.followed});
		if (ok) {
			setSheet((s) => (s ? {...s, followed: !s.followed} : s));
			reload();
		}
	}, [sheet, replay, reload]);

	const sheetKeep = useCallback(async () => {
		if (!sheet || !replay) return;
		const why = await replay.setKeep(sheet.item.show, !sheet.kept);
		if (why) {
			say(why);
			return;
		}
		const nowKept = !sheet.kept;
		setSheet((s) => (s ? {...s, kept: nowKept, followed: nowKept ? true : s.followed} : s));
		if (nowKept) say($L('Les prochains épisodes arriveront dans ta bibliothèque, sans pub. Rien du passé n’est téléchargé.'));
		reload();
	}, [sheet, replay, say, reload]);

	// « Garder dans ma bibliothèque » (VJOD 4.25, la voie Seerr) : la série
	// retrouvée dans Seerr, sa saison demandée après un oui.
	const {isEnabled: seerrOn, isAuthenticated: seerrAuthed} = useSeerr();
	const [seerrAsk, setSeerrAsk] = useState(null);
	const sheetSeerr = useCallback(async () => {
		if (!sheet) return;
		say($L('Recherche dans Seerr…'));
		const m = await seerrMatch(sheet.item);
		if (!m) {
			say($L('Seerr ne la connaît pas sous ce nom.'));
			return;
		}
		setSeerrAsk(m);
	}, [sheet, say]);
	const pickSeerr = useCallback(async (id) => {
		const m = seerrAsk;
		setSeerrAsk(null);
		setTimeout(() => Spotlight.focus('replay-sheet-play'), 0);
		if (id === 'ask' && m) say(await requestSeerrSeason(m));
	}, [seerrAsk, say]);
	useEffect(() => {
		if (!sheet) setSeerrAsk(null);
	}, [sheet]);

	// « Chercher sur mes trackers » (VJOD 4.25) : par-dessus la fiche, qui reste derrière.
	const [trackersFor, setTrackersFor] = useState(null);
	useEffect(() => {
		if (!sheet) setTrackersFor(null);
	}, [sheet]);
	const closeTrackers = useCallback(() => {
		setTrackersFor(null);
		setTimeout(() => Spotlight.focus('replay-sheet-play'), 0);
	}, []);

	const sheetHide = useCallback(async () => {
		if (!sheet || !replay) return;
		await replay.setPref({show: sheet.item.show, hide: true});
		setSheet(null);
		refocus();
		reload();
	}, [sheet, replay, reload, refocus]);

	// « Autres sources » : cherchées à l'ouverture de la fiche.
	const sheetItem = sheet && sheet.item;
	useEffect(() => {
		if (!sheetItem) return undefined;
		let alive = true;
		loadReplaySources(sheetItem, {chanName: chanName(sheetItem.chan), jellyfin, vod, maTv}).then((sources) => {
			if (alive) setSheet((s) => (s && s.item === sheetItem ? {...s, sources} : s));
		});
		return () => {
			alive = false;
		};
	}, [sheetItem, chanName, vod, maTv]);

	// Une source choisie à la main (_useSource de l'APK).
	const sheetSource = useCallback(async (source) => {
		if (!sheet) return;
		const item = sheet.item;
		if (source.kind === 'tracker') {
			setTrackersFor(item);
			return;
		}
		setSheet(null);
		if (source.kind === 'library') {
			refocus();
			onSelectItem?.(source.target);
			return;
		}
		if (source.kind === 'vod') {
			setVodSeries({copy: source.target, title: source.target.name});
			return;
		}
		if (source.kind === 'iptv') {
			setPlaying({kind: 'vod', item, siblings: sheet.siblings, next: nextEpisode(item, sheet.siblings), url: source.target, adSkip: true, notice: '', startMs: resumePosition(item.id)});
			return;
		}
		// Le replay de la chaîne seul, sans passer par la bibliothèque ni l'enregistrement.
		say($L('Ouverture…'));
		const res = await resolveReplay(item, {replay, maTv, jellyfin: null});
		if (res.type === 'stream' && !res.adSkip) {
			setToast(null);
			setPlaying({kind: 'vod', item, siblings: sheet.siblings, next: nextEpisode(item, sheet.siblings), url: res.url, adSkip: false, notice: '', startMs: resumePosition(item.id)});
			return;
		}
		refocus();
		say(res.message && /protégé/.test(res.message) ? $L('Le replay de la chaîne est protégé pour cet épisode.') : $L('Le replay de la chaîne ne répond pas pour cet épisode.'));
	}, [sheet, replay, maTv, refocus, say, onSelectItem]);

	const sheetPlay = useCallback((item) => play(item, sheet ? sheet.siblings : []), [play, sheet]);
	const sheetNext = useCallback((item) => play(item, sheet ? sheet.siblings : []), [play, sheet]);

	// ------------------------------------------------------------ sous-pages
	const openChannel = useCallback((c) => {
		remember();
		setSubData(null);
		setStack((s) => s.concat([{type: 'channel', chan: c.chan, name: c.name}]));
	}, [remember]);

	const openCategory = useCallback((genre) => {
		remember();
		setSubData(null);
		setStack((s) => s.concat([{type: 'category', genre}]));
	}, [remember]);

	// Une carte de la rangée Replay de l'accueil : « Mes émissions » ou la page d'une chaîne,
	// ouverte seule ; Retour revient à l'accueil.
	const startedWith = useRef(null);
	useEffect(() => {
		if (!startWith || startedWith.current === startWith) return;
		startedWith.current = startWith;
		setSubData(null);
		setStack([startWith.kind === 'chan'
			? {type: 'channel', chan: startWith.chan, name: startWith.name, external: true}
			: {type: 'mine', external: true}]);
	}, [startWith]);

	// « Mes émissions » : la dernière réponse gardée d'abord, puis la fraîche ; vus une fois à l'écran.
	const [mineHome, setMineHome] = useState(undefined);
	const loadMine = useCallback(async (markSeen) => {
		const fresh = await fetchReplayHome(maTv);
		setMineHome((cur) => fresh || (cur === undefined ? null : cur));
		if (markSeen && fresh && replay) replay.setPref({seen: true});
	}, [maTv, replay]);
	const mineOpen = Boolean(stack.length && stack[stack.length - 1].type === 'mine');
	useEffect(() => {
		if (!mineOpen || !maTv) return undefined;
		let alive = true;
		setMineHome(undefined);
		savedReplayHome(maTv).then((saved) => {
			if (alive && saved) setMineHome((cur) => (cur === undefined ? saved : cur));
		});
		loadMine(true);
		return () => {
			alive = false;
		};
	}, [mineOpen, maTv, loadMine]);
	const reloadMine = useCallback(() => loadMine(false), [loadMine]);
	const mineChanName = useCallback((chan) => {
		const c = mineHome && mineHome.channels.find((x) => x.chan === chan);
		return c ? c.name : chanName(chan);
	}, [mineHome, chanName]);
	const followShow = useCallback(async (show, on) => (replay ? replay.setPref({show, follow: on}) : false), [replay]);
	useEffect(() => {
		if (!mineOpen || mineHome === undefined) return undefined;
		const t = setTimeout(() => {
			if (!Spotlight.focus('replay-mine-first')) Spotlight.focus('replay-sub');
		}, 0);
		return () => clearTimeout(t);
	}, [mineOpen, mineHome]);

	stackRef.current = stack;
	const top = stack.length ? stack[stack.length - 1] : null;
	useEffect(() => {
		if (!top || !replay || top.type === 'mine') return undefined;
		let alive = true;
		(async () => {
			const data = top.type === 'channel' ? await replay.channel(top.chan) : await replay.category(top.genre);
			if (alive) setSubData(data || (top.type === 'channel' ? {shows: [], days: [], prime: null} : []));
		})();
		return () => {
			alive = false;
		};
	}, [top, replay]);

	// ------------------------------------------------------------ Retour
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (playing) {
				if (playing.kind === 'live' && playerBackRef.current?.()) return true;
				setPlaying(null);
				// Un épisode de la VOD du fournisseur : retour à sa série, ouverte dessous.
				if (vodSeries) {
					setTimeout(() => Spotlight.focus('catalogue-series'), 0);
					return true;
				}
				reload();
				refocus();
				return true;
			}
			if (seerrAsk) {
				pickSeerr('none');
				return true;
			}
			if (trackersFor) {
				closeTrackers();
				return true;
			}
			if (vodSeries) {
				setVodSeries(null);
				refocus();
				return true;
			}
			if (sheet) {
				setSheet(null);
				refocus();
				return true;
			}
			if (stack.length) {
				// Ouverte depuis l'accueil : Retour y revient.
				if (stack.length === 1 && stack[0].external) {
					setStack([]);
					setSubData(null);
					return false;
				}
				setStack((s) => s.slice(0, -1));
				setSubData(null);
				refocus();
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, playing, sheet, trackersFor, closeTrackers, vodSeries, seerrAsk, pickSeerr, stack, reload, refocus]);

	// Premier focus sur la « une » une fois la page prête.
	useEffect(() => {
		if (status !== 'ready') return undefined;
		const t = setTimeout(() => {
			if (!Spotlight.getCurrent() || !document.querySelector('[data-replay-root]').contains(Spotlight.getCurrent())) {
				Spotlight.focus('replay-page');
			}
		}, 0);
		return () => clearTimeout(t);
	}, [status]);

	// ------------------------------------------------------------ rendu
	let player = null;
	if (playing && playing.kind === 'vod') {
		player = (
			<MaTvVodPlayer
				key={playing.item.id}
				id={playing.item.id}
				url={playing.url}
				title={titleOf(playing.item)}
				image={playing.item.img || playing.item.poster || null}
				subtitle={[chanName(playing.item.chan), subtitleOf(playing.item)].filter(Boolean).join(' · ')}
				startMs={playing.startMs}
				adSkip={playing.adSkip}
				notice={playing.notice}
				nextLabel={playing.next ? $L('épisode suivant') : ''}
				onNext={playing.next ? handleNext : null}
				onFinished={playing.next ? handleNext : null}
			/>
		);
	} else if (playing && playing.kind === 'live') {
		player = (
			<MaTvPlayer
				client={maTv}
				categories={[]}
				catId="replay"
				channels={liveChans}
				startIndex={playing.index}
				backRef={playerBackRef}
			/>
		);
	}

	let body = null;
	let sub = null;
	if (status === 'loading') {
		body = <div className={css.centered}><LoadingSpinner /></div>;
	} else if (status !== 'ready') {
		body = (
			<div className={css.empty} style={{color: R.mute}}>
				{status === 'nomatv'
					? $L('Le replay arrive avec Ma TV 3.70 sur la seedbox.')
					: $L('Rien en replay pour l’instant.')}
			</div>
		);
	}
	if (status === 'ready' && top && top.type === 'channel') {
		sub = (
			<div>
				<div className={css.pageTitle} style={{color: R.ink}}>{`Replay ${top.name}`}</div>
				<div className={css.pageSubtitle} style={{color: R.mute}}>
					{$L('Jusqu’à 3 semaines · météo, journaux et jeux masqués')}
				</div>
				<ChannelPage page={subData} onPlay={handlePlay} onInfo={openSheet} />
			</div>
		);
	} else if (top && top.type === 'mine') {
		sub = <ReplayMine home={mineHome} chanName={mineChanName} onPlay={handlePlay} onInfo={openSheet} onFollow={followShow} onReload={reloadMine} />;
	} else if (status === 'ready' && top && top.type === 'category') {
		sub = (
			<div>
				<div className={css.pageTitle} style={{color: R.ink}}>{top.genre}</div>
				{subData ? (
					<div className={css.pageSubtitle} style={{color: R.mute}}>{`${subData.length} ${$L('émissions')}`}</div>
				) : null}
				{subData ? (
					<div className={css.grid}>
						{subData.map((e) => (
							<ReplayTile key={e.id} item={e} chanName={chanName(e.chan)} onPlay={handlePlay} onInfo={openSheet} />
						))}
					</div>
				) : <div className={css.centered}><LoadingSpinner /></div>}
			</div>
		);
	}
	if (status === 'ready') {
		const heroItem = page.hero.length ? page.hero[hero % page.hero.length] : null;
		const top10 = page.rows.find((r) => r.kind === 'top');
		const rest = page.rows.filter((r) => r.kind !== 'top' && r.items.length);
		const mine = rest.filter((r) => r.id === 'mine' || r.id === 'live');
		const others = rest.filter((r) => r.id !== 'mine' && r.id !== 'live');
		const tiles = (list, opts = {}) => list.map((e, i) => (
			<ReplayTile
				key={e.id}
				item={e}
				chanName={chanName(e.chan)}
				portrait={opts.portrait}
				width={opts.width}
				rank={opts.numbered ? i + 1 : undefined}
				words={opts.words ? e.desc.split(/[.!?]\s/)[0] : undefined}
				onPlay={handlePlay}
				onInfo={openSheet}
			/>
		));
		body = (
			<div>
				{heroItem ? <Hero item={heroItem} chanName={chanName(heroItem.chan)} onPlay={handlePlay} onInfo={openSheet} /> : null}
				{mine.map((r) => <Section key={r.id} title={r.title}><Strip>{tiles(r.items)}</Strip></Section>)}
				{page.selection.length ? (
					<Section title={$L('Notre sélection')}><Strip>{tiles(page.selection, {width: 20, words: true})}</Strip></Section>
				) : null}
				{liveChans.length ? (
					<Section title={$L('En direct')} dot><LiveRow channels={liveChans} onOpen={openLive} /></Section>
				) : null}
				{top10 && top10.items.length ? (
					<Section title={$L('À la une')}><Strip>{tiles(top10.items, {numbered: true, width: 13.75})}</Strip></Section>
				) : null}
				{page.categories.length ? (
					<Section title={$L('Catégories')}><GenrePills genres={page.categories} onOpen={openCategory} /></Section>
				) : null}
				{others.map((r) => (
					<Section key={r.id} title={r.kind === 'poster' ? rowLabel(r.genre || r.title) : r.title}>
						<Strip>{tiles(r.items, {portrait: r.kind === 'poster', width: r.kind === 'poster' ? 12.5 : 16.25})}</Strip>
					</Section>
				))}
				{page.channels.length ? (
					<Section title={$L('Nos chaînes')}><ChannelGrid channels={page.channels} logos={logos} onOpen={openChannel} /></Section>
				) : null}
			</div>
		);
	}

	// La page d'accueil reste montée sous les sous-pages et le lecteur (masquée),
	// pour retrouver sa position et son focus au retour.
	const hidden = {display: 'none'};
	return (
		<div className={css.replay} style={{background: player ? 'transparent' : R.bg}} data-replay-root>
			{player}
			<PageContainer
				spotlightId="replay-page"
				className={css.page}
				style={player || sub || vodSeries ? hidden : null}
				spotlightDisabled={!!sheet || !!player || !!sub || !!vodSeries}
			>
				<Scroller direction="vertical" verticalScrollbar="hidden">
					<div className={css.pageInner}>{body}</div>
				</Scroller>
			</PageContainer>
			{sub ? (
				<PageContainer
					spotlightId="replay-sub"
					className={css.page}
					style={player || vodSeries ? hidden : null}
					spotlightDisabled={!!sheet || !!player || !!vodSeries}
				>
					<Scroller direction="vertical" verticalScrollbar="hidden" key={`${top.type}:${top.chan || top.genre}`}>
						<div className={css.pageInner}>{sub}</div>
					</Scroller>
				</PageContainer>
			) : null}
			{vodSeries && vod && !player ? (
				<ProviderSeries vod={vod} copy={vodSeries.copy} title={vodSeries.title} onPlay={playVodEpisode} />
			) : null}
			{sheet ? (
				<Sheet
					item={sheet.item}
					chanName={chanName(sheet.item.chan)}
					next={nextEpisode(sheet.item, sheet.siblings)}
					followed={sheet.followed}
					kept={sheet.kept}
					sources={sheet.sources || null}
					onPlay={sheetPlay}
					onNext={sheetNext}
					onFollow={sheetFollow}
					onKeep={sheetKeep}
					onSeerr={seerrOn && seerrAuthed ? sheetSeerr : null}
					onSource={maTv ? sheetSource : null}
					onHide={sheetHide}
				/>
			) : null}
			{sheet && seerrAsk ? (
				<ChoiceDialog
					title={`Garder « ${seerrAsk.name} » ?`}
					subtitle={`Seerr demande la saison ${seerrAsk.season} à Sonarr. Elle arrivera dans ta bibliothèque, sans pub.`}
					choices={[{id: 'ask', icon: '✓', label: 'Demander', strong: true}, {id: 'none', icon: '←', label: 'Annuler'}]}
					onPick={pickSeerr}
				/>
			) : null}
			{sheet && trackersFor ? (
				<TrackerSheet item={trackersFor} server={maTv && maTv.server} onDone={closeTrackers} onSay={say} />
			) : null}
			{toast ? <div className={css.toast} style={{background: R.card, color: R.ink}}>{toast}</div> : null}
		</div>
	);
};

export default Replay;
