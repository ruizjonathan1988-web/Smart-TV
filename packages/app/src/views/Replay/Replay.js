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
import MaTvPlayer from '../MaTv/MaTvPlayer';
import MaTvVodPlayer from '../MaTv/MaTvVodPlayer';
import {R, ReplayTile, Strip, Section, Hero, LiveRow, GenrePills, ChannelGrid, Sheet, Button} from './ReplayParts';

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
const Replay = ({backHandlerRef, onSelectItem}) => {
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
		if (!playing) refocus();
		say(res.message);
	}, [replay, maTv, sheet, playing, remember, refocus, say, onSelectItem]);

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

	const sheetHide = useCallback(async () => {
		if (!sheet || !replay) return;
		await replay.setPref({show: sheet.item.show, hide: true});
		setSheet(null);
		refocus();
		reload();
	}, [sheet, replay, reload, refocus]);

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

	stackRef.current = stack;
	const top = stack.length ? stack[stack.length - 1] : null;
	useEffect(() => {
		if (!top || !replay) return undefined;
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
				reload();
				refocus();
				return true;
			}
			if (sheet) {
				setSheet(null);
				refocus();
				return true;
			}
			if (stack.length) {
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
	}, [backHandlerRef, playing, sheet, stack, reload, refocus]);

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
				style={player || sub ? hidden : null}
				spotlightDisabled={!!sheet || !!player || !!sub}
			>
				<Scroller direction="vertical" verticalScrollbar="hidden">
					<div className={css.pageInner}>{body}</div>
				</Scroller>
			</PageContainer>
			{sub ? (
				<PageContainer
					spotlightId="replay-sub"
					className={css.page}
					style={player ? hidden : null}
					spotlightDisabled={!!sheet || !!player}
				>
					<Scroller direction="vertical" verticalScrollbar="hidden" key={`${top.type}:${top.chan || top.genre}`}>
						<div className={css.pageInner}>{sub}</div>
					</Scroller>
				</PageContainer>
			) : null}
			{sheet ? (
				<Sheet
					item={sheet.item}
					chanName={chanName(sheet.item.chan)}
					next={nextEpisode(sheet.item, sheet.siblings)}
					followed={sheet.followed}
					kept={sheet.kept}
					onPlay={sheetPlay}
					onNext={sheetNext}
					onFollow={sheetFollow}
					onKeep={sheetKeep}
					onHide={sheetHide}
				/>
			) : null}
			{toast ? <div className={css.toast} style={{background: R.card, color: R.ink}}>{toast}</div> : null}
		</div>
	);
};

export default Replay;
