import {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import {formatClockTime} from '../../utils/clock';
import {getMaTvClient} from '../../services/maTvSession';
import {
	loadMaTvMemory, buildMaTvCategories, maTvStartCategory, maTvLastCategory,
	fetchMaTvChannels, isMaTvFavorite, toggleMaTvFavorite
} from '../../services/maTvMemory';
import {maTvColors as C, maTvLayout as L} from './maTvTheme';
import MaTvPlayer from './MaTvPlayer';
import MaTvGuide from './MaTvGuide';
import MaTvVodPlayer from './MaTvVodPlayer';
import {KEYS} from '../../utils/keys';

import css from './MaTv.module.less';

const SpottableDiv = Spottable('div');

const CAT_LABELS = () => ({fav: $L('Favoris'), recent: $L('Récentes')});
const Container = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');

// Identifiant Spotlight d'une ligne de chaîne (focus rendu au retour du lecteur).
const channelSpotId = (ch) => `matv-ch-${ch.id}`;

// Libellé « en cours » d'un programme embarqué dans la chaîne (clés courtes de
// l'APK : t = titre, s/e = début/fin en secondes).
const nowLabel = (prog) => {
	if (!prog || !prog.t) return '';
	const start = prog.s ? formatClockTime(new Date(prog.s * 1000)) : '';
	return start ? `${start} · ${prog.t}` : prog.t;
};

const CategoryItem = ({category, active, onFocus, onSelect}) => {
	const [focused, setFocused] = useState(false);
	const handleFocus = useCallback(() => {
		setFocused(true);
		onFocus(category);
	}, [category, onFocus]);
	const handleBlur = useCallback(() => setFocused(false), []);
	const handleClick = useCallback(() => onSelect(category), [category, onSelect]);

	const background = focused ? C.rowOn : (active ? C.rowSelected : 'transparent');
	return (
		<SpottableDiv
			className={css.railItem}
			style={{
				height: L.rowHeight / 16 + 'rem',
				background,
				color: focused || active ? C.ink : C.mute,
				boxShadow: focused ? `inset 0 0 0 0.12rem ${C.accent}` : 'none'
			}}
			onFocus={handleFocus}
			onBlur={handleBlur}
			onClick={handleClick}
		>
			{category.label}
		</SpottableDiv>
	);
};

const ChannelRow = ({channel, favorite, onFocus, onSelect}) => {
	const [focused, setFocused] = useState(false);
	const [logoFailed, setLogoFailed] = useState(false);
	const handleFocus = useCallback(() => {
		setFocused(true);
		onFocus(channel);
	}, [channel, onFocus]);
	const handleBlur = useCallback(() => setFocused(false), []);
	const handleClick = useCallback(() => onSelect(channel), [channel, onSelect]);
	const handleLogoError = useCallback(() => setLogoFailed(true), []);

	const now = nowLabel(channel.now);
	return (
		<SpottableDiv
			spotlightId={channelSpotId(channel)}
			className={css.channel}
			style={{
				height: L.channelCardCompactHeight / 16 + 'rem',
				background: focused ? C.rowOn : C.row,
				boxShadow: focused ? `inset 0 0 0 0.12rem ${C.accent}` : 'none'
			}}
			onFocus={handleFocus}
			onBlur={handleBlur}
			onClick={handleClick}
		>
			<div className={css.channelNumber} style={{color: focused ? C.accent : C.mute}}>
				{channel.num || ''}
			</div>
			<div className={css.channelLogo} style={{background: C.row}}>
				{channel.logo && !logoFailed ? (
					<img src={channel.logo} alt="" onError={handleLogoError} />
				) : null}
			</div>
			<div className={css.channelText}>
				<div className={css.channelName} style={{color: C.ink}}>
					{channel.name}
					{favorite ? <span className={css.favStar} style={{color: C.accent}}>★</span> : null}
				</div>
				{now ? <div className={css.channelNow} style={{color: C.mute}}>{now}</div> : null}
			</div>
		</SpottableDiv>
	);
};

const Preview = ({channel, favorite, onWatch, onToggleFavorite, onGuide}) => {
	const [logoFailed, setLogoFailed] = useState(false);
	const handleLogoError = useCallback(() => setLogoFailed(true), []);
	const handleWatchClick = useCallback(() => onWatch(channel), [onWatch, channel]);
	const handleFavClick = useCallback(() => onToggleFavorite(channel), [onToggleFavorite, channel]);
	const handleGuideClick = useCallback(() => onGuide(channel), [onGuide, channel]);
	if (!channel) {
		return (
			<div className={css.preview} style={{background: C.panelSoft}}>
				<div className={css.centered}>
					<div className={css.hint} style={{color: C.mute}}>{$L('Choisissez une chaîne')}</div>
				</div>
			</div>
		);
	}
	const now = channel.now;
	const next = channel.next;
	return (
		<div className={css.preview} style={{background: C.panelSoft}}>
			<div className={css.previewArt} style={{background: C.row}}>
				{channel.logo && !logoFailed ? (
					<img src={channel.logo} alt="" onError={handleLogoError} />
				) : null}
			</div>
			<div className={css.liveBadge} style={{background: 'rgba(229,72,77,0.18)', color: C.live}}>
				<span className={css.liveDot} style={{background: C.live}} />
				{$L('En direct')}
			</div>
			<div className={css.previewTitle} style={{color: C.ink}}>
				{channel.num ? `${channel.num} · ` : ''}{channel.name}
			</div>
			{now && now.t ? (
				<div className={css.previewNow} style={{color: C.ink}}>{nowLabel(now)}</div>
			) : null}
			{next && next.t ? (
				<div className={css.previewNow} style={{color: C.mute}}>
					{$L('Ensuite')} · {next.t}
				</div>
			) : null}
			<SpottableDiv
				className={css.watchButton}
				style={{background: C.accent, color: '#1A1205'}}
				onClick={handleWatchClick}
			>
				{$L('Regarder')}
			</SpottableDiv>
			<SpottableDiv
				className={css.favButton}
				style={{background: C.row, color: favorite ? C.accent : C.ink}}
				onClick={handleFavClick}
			>
				{favorite ? `★ ${$L('Retirer des favoris')}` : `☆ ${$L('Ajouter aux favoris')}`}
			</SpottableDiv>
			<SpottableDiv
				className={css.favButton}
				style={{background: C.row, color: C.ink}}
				onClick={handleGuideClick}
			>
				{$L('Grille des programmes')}
			</SpottableDiv>
		</div>
	);
};

const MaTv = ({backHandlerRef}) => {
	const {user, serverUrl, accessToken} = useAuth();
	const [status, setStatus] = useState('loading'); // loading | ready | nomatv | error
	const [client, setClient] = useState(null);
	const [serverCats, setServerCats] = useState([]);
	// Change à chaque modification de la mémoire locale (favoris, récentes).
	const [memVersion, setMemVersion] = useState(0);
	const [reloadKey, setReloadKey] = useState(0);
	const [activeCatId, setActiveCatId] = useState(null);
	const [channels, setChannels] = useState([]);
	const [channelsCat, setChannelsCat] = useState(null);
	const [focused, setFocused] = useState(null);
	// Lecture en cours : position dans la liste de la catégorie active.
	// Ce qui occupe l'écran : null (la liste), le direct, la grille ou un replay.
	//   {type: 'live', channels, index, catId}
	//   {type: 'guide', channels, index, label, back}  (back : le direct d'où l'on vient)
	//   {type: 'vod', channel, prog, back}  (back : la grille)
	const [mode, setMode] = useState(null);
	const playingIndex = mode ? 0 : null;
	// Dernière chaîne regardée (catégorie + id), pour rendre le focus au retour.
	const watchedRef = useRef(null);
	const playerBackRef = useRef(null);
	const loadToken = useRef(0);

	// Découverte du serveur Ma TV + catégories au montage.
	useEffect(() => {
		let alive = true;
		(async () => {
			setStatus('loading');
			const c = await getMaTvClient({serverUrl, accessToken, user});
			if (!alive) return;
			if (!c) {
				setStatus('nomatv');
				return;
			}
			const [res] = await Promise.all([c.cats(), loadMaTvMemory()]);
			if (!alive) return;
			const fromServer = Array.isArray(res && res.cats) ? res.cats : [];
			const list = buildMaTvCategories(fromServer, CAT_LABELS());
			setClient(c);
			setServerCats(fromServer);
			setActiveCatId(list.length ? list[maTvStartCategory(list, maTvLastCategory())].id : null);
			setStatus(list.length ? 'ready' : 'error');
		})();
		return () => {
			alive = false;
		};
	}, [serverUrl, accessToken, user]);

	const cats = useMemo(
		() => buildMaTvCategories(serverCats, CAT_LABELS()),
		[serverCats, memVersion] // eslint-disable-line react-hooks/exhaustive-deps
	);
	const catsRef = useRef(cats);
	catsRef.current = cats;

	// Chaînes de la catégorie active.
	useEffect(() => {
		if (!client || !activeCatId) return undefined;
		let alive = true;
		const mine = ++loadToken.current;
		setChannels([]);
		setFocused(null);
		(async () => {
			const category = catsRef.current.find((c) => c.id === activeCatId) || {id: activeCatId};
			const list = await fetchMaTvChannels(client, category);
			if (!alive || mine !== loadToken.current) return;
			setChannels(list);
			setChannelsCat(activeCatId);
			setFocused(list.length ? list[0] : null);
		})();
		return () => {
			alive = false;
		};
	}, [client, activeCatId, reloadKey]);

	const handleToggleFavorite = useCallback((ch) => {
		if (!ch) return;
		toggleMaTvFavorite(ch.id);
		setMemVersion((v) => v + 1);
		if (activeCatId === 'fav') setReloadKey((k) => k + 1);
	}, [activeCatId]);

	const handleCatFocus = useCallback((cat) => setActiveCatId((id) => (id === cat.id ? id : cat.id)), []);
	const handleCatSelect = useCallback((cat) => setActiveCatId(cat.id), []);
	const handleChannelFocus = useCallback((ch) => setFocused(ch), []);
	const handleWatch = useCallback((ch) => {
		if (!client || !ch) return;
		const at = channels.findIndex((c) => c.id === ch.id);
		if (at < 0) return;
		watchedRef.current = {catId: activeCatId, channelId: ch.id};
		setMode({type: 'live', channels, index: at, catId: activeCatId});
	}, [client, channels, activeCatId]);

	const activeLabel = useMemo(() => {
		const c = cats.find((x) => x.id === activeCatId);
		return c ? c.label : '';
	}, [cats, activeCatId]);

	const handleGuide = useCallback((ch) => {
		if (!client || !channels.length) return;
		const at = ch ? channels.findIndex((c) => c.id === ch.id) : 0;
		setMode({type: 'guide', channels, index: Math.max(0, at), label: activeLabel, catId: activeCatId, back: null});
	}, [client, channels, activeLabel, activeCatId]);

	// Depuis le lecteur (mini-guide ou touche Guide) : la grille de sa liste.
	const handlePlayerGuide = useCallback((g) => {
		setMode((m) => ({type: 'guide', channels: g.channels, index: g.index, label: g.label, catId: g.catId, back: m && m.type === 'live' ? {...m, channels: g.channels, index: g.index, catId: g.catId} : null}));
	}, []);

	const handleGuidePick = useCallback((pick) => {
		setMode((m) => {
			if (!m || m.type !== 'guide') return m;
			const ch = m.channels[pick.index];
			if (pick.replay && ch) return {type: 'vod', channel: ch, prog: pick.replay, back: m};
			return {type: 'live', channels: m.channels, index: pick.index, catId: m.catId};
		});
	}, []);

	// Touche Guide sur la liste : la grille à la chaîne sous le focus.
	useEffect(() => {
		if (mode || status !== 'ready') return undefined;
		const onKey = (e) => {
			if ((e.keyCode || e.which) !== KEYS.GUIDE) return;
			e.preventDefault();
			e.stopPropagation();
			handleGuide(focused);
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [mode, status, focused, handleGuide]);

	const handleWatching = useCallback((w) => {
		watchedRef.current = w;
	}, []);

	// Retour pendant la lecture : on revient à la liste, sur la dernière chaîne regardée.
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (!mode) return false;
			// Le lecteur (ou la grille) ferme d'abord ses panneaux et revient au direct.
			if (playerBackRef.current?.()) return true;
			if (mode.type === 'vod' || (mode.type === 'guide' && mode.back)) {
				setMode(mode.back);
				return true;
			}
			const w = watchedRef.current;
			if (w && w.catId && w.catId !== activeCatId) setActiveCatId(w.catId);
			setMemVersion((v) => v + 1);
			setMode(null);
			return true;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, mode, activeCatId]);

	// Au retour du lecteur, le focus reprend sur la chaîne quittée.
	const wasPlaying = useRef(false);
	useEffect(() => {
		if (playingIndex !== null) {
			wasPlaying.current = true;
			return undefined;
		}
		const w = watchedRef.current;
		if (!wasPlaying.current || !w || channelsCat !== w.catId) return undefined;
		wasPlaying.current = false;
		const last = w ? channels.find((c) => c.id === w.channelId) : null;
		if (!last) return undefined;
		setFocused(last);
		const t = setTimeout(() => Spotlight.focus(channelSpotId(last)), 0);
		return () => clearTimeout(t);
	}, [playingIndex, channels, channelsCat]);

	const railWidth = useMemo(() => L.categoryRailWidth / 16 + 'rem', []);
	const previewWidth = useMemo(() => L.previewPanelWidth / 16 + 'rem', []);

	const header = (
		<div className={css.header}>
			<div className={css.title} style={{color: C.ink}}>{$L('Ma TV')}</div>
		</div>
	);

	if (mode && client && mode.type === 'live') {
		return (
			<MaTvPlayer
				key={`live-${mode.catId}-${mode.index}`}
				client={client}
				categories={cats}
				catId={mode.catId}
				channels={mode.channels}
				startIndex={mode.index}
				backRef={playerBackRef}
				onWatching={handleWatching}
				onOpenGuide={handlePlayerGuide}
			/>
		);
	}
	if (mode && client && mode.type === 'guide') {
		return (
			<MaTvGuide
				client={client}
				channels={mode.channels}
				startIndex={mode.index}
				categoryLabel={mode.label}
				onPick={handleGuidePick}
				backRef={playerBackRef}
			/>
		);
	}
	if (mode && client && mode.type === 'vod') {
		return (
			<MaTvVodPlayer
				key={`vod-${mode.channel.id}-${mode.prog.s}`}
				id={`matv:${mode.channel.id}:${mode.prog.s}`}
				url={client.replayUrl(mode.channel, mode.prog.s * 1000, mode.prog.e * 1000)}
				title={mode.prog.t || mode.channel.name}
				subtitle={`${mode.channel.name} · ${formatClockTime(new Date(mode.prog.s * 1000))}`}
				startMs={0}
				adSkip
			/>
		);
	}

	if (status === 'loading') {
		return (
			<div className={css.maTv} style={{background: C.bg}}>
				{header}
				<div className={css.centered}><LoadingSpinner /></div>
			</div>
		);
	}

	if (status === 'nomatv') {
		return (
			<div className={css.maTv} style={{background: C.bg}}>
				{header}
				<div className={css.centered}>
					<div className={css.message} style={{color: C.ink}}>
						{$L('Ma TV n\'est pas configurée sur ce serveur.')}
					</div>
					<div className={css.hint} style={{color: C.mute}}>
						{$L('Ajoutez la collection « VJOD – TV » depuis IPTV Checker, puis revenez ici.')}
					</div>
				</div>
			</div>
		);
	}

	if (status === 'error') {
		return (
			<div className={css.maTv} style={{background: C.bg}}>
				{header}
				<div className={css.centered}>
					<div className={css.message} style={{color: C.ink}}>
						{$L('Impossible de joindre Ma TV pour le moment.')}
					</div>
				</div>
			</div>
		);
	}

	return (
		<Container className={css.maTv} style={{background: C.bg}}>
			{header}
			<div className={css.body}>
				<Container className={css.rail} style={{width: railWidth}}>
					<Scroller direction="vertical" verticalScrollbar="hidden">
						{cats.map((cat) => (
							<CategoryItem
								key={cat.id}
								category={cat}
								active={cat.id === activeCatId}
								onFocus={handleCatFocus}
								onSelect={handleCatSelect}
							/>
						))}
					</Scroller>
				</Container>

				<Container className={css.list}>
					<Scroller direction="vertical" verticalScrollbar="auto">
						{channels.map((ch) => (
							<ChannelRow
								key={ch.id}
								channel={ch}
								favorite={isMaTvFavorite(ch.id)}
								onFocus={handleChannelFocus}
								onSelect={handleWatch}
							/>
						))}
					</Scroller>
				</Container>

				<div style={{width: previewWidth, display: 'flex'}}>
					<Preview
						channel={focused}
						favorite={focused ? isMaTvFavorite(focused.id) : false}
						onWatch={handleWatch}
						onToggleFavorite={handleToggleFavorite}
						onGuide={handleGuide}
					/>
				</div>
			</div>
		</Container>
	);
};

export default MaTv;
export {MaTv};
