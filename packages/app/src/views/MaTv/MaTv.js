import {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import {formatClockTime} from '../../utils/clock';
import {createMaTvClient} from '../../services/maTvApi';
import {discoverMaTvServer} from '../../services/maTvDiscovery';
import {maTvColors as C, maTvLayout as L} from './maTvTheme';
import MaTvPlayer from './MaTvPlayer';

import css from './MaTv.module.less';

const SpottableDiv = Spottable('div');
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

const ChannelRow = ({channel, onFocus, onSelect}) => {
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
				<div className={css.channelName} style={{color: C.ink}}>{channel.name}</div>
				{now ? <div className={css.channelNow} style={{color: C.mute}}>{now}</div> : null}
			</div>
		</SpottableDiv>
	);
};

const Preview = ({channel, onWatch}) => {
	const [logoFailed, setLogoFailed] = useState(false);
	const handleLogoError = useCallback(() => setLogoFailed(true), []);
	const handleWatchClick = useCallback(() => onWatch(channel), [onWatch, channel]);
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
		</div>
	);
};

const MaTv = ({backHandlerRef}) => {
	const {user, serverUrl, accessToken} = useAuth();
	const [status, setStatus] = useState('loading'); // loading | ready | nomatv | error
	const [client, setClient] = useState(null);
	const [cats, setCats] = useState([]);
	const [activeCatId, setActiveCatId] = useState(null);
	const [channels, setChannels] = useState([]);
	const [channelsCat, setChannelsCat] = useState(null);
	const [focused, setFocused] = useState(null);
	// Lecture en cours : position dans la liste de la catégorie active.
	const [playingIndex, setPlayingIndex] = useState(null);
	// Dernière chaîne regardée (catégorie + id), pour rendre le focus au retour.
	const watchedRef = useRef(null);
	const playerBackRef = useRef(null);
	const loadToken = useRef(0);

	// Découverte du serveur Ma TV + catégories au montage.
	useEffect(() => {
		let alive = true;
		(async () => {
			setStatus('loading');
			const server = await discoverMaTvServer({
				serverUrl,
				accessToken,
				userId: user?.Id,
				serverType: user?._serverType || 'jellyfin'
			});
			if (!alive) return;
			if (!server) {
				setStatus('nomatv');
				return;
			}
			const c = createMaTvClient({server, user: user?.Name || user?.Id || null});
			const res = await c.cats();
			if (!alive) return;
			const list = Array.isArray(res && res.cats) ? res.cats : [];
			setClient(c);
			setCats(list);
			setActiveCatId(list.length ? list[0].id : null);
			setStatus(list.length ? 'ready' : 'error');
		})();
		return () => {
			alive = false;
		};
	}, [serverUrl, accessToken, user]);

	// Chaînes de la catégorie active.
	useEffect(() => {
		if (!client || !activeCatId) return undefined;
		let alive = true;
		const mine = ++loadToken.current;
		setChannels([]);
		setFocused(null);
		(async () => {
			const res = await client.channels(activeCatId);
			if (!alive || mine !== loadToken.current) return;
			const list = Array.isArray(res && res.chans) ? res.chans : [];
			setChannels(list);
			setChannelsCat(activeCatId);
			setFocused(list.length ? list[0] : null);
		})();
		return () => {
			alive = false;
		};
	}, [client, activeCatId]);

	const handleCatFocus = useCallback((cat) => setActiveCatId((id) => (id === cat.id ? id : cat.id)), []);
	const handleCatSelect = useCallback((cat) => setActiveCatId(cat.id), []);
	const handleChannelFocus = useCallback((ch) => setFocused(ch), []);
	const handleWatch = useCallback((ch) => {
		if (!client || !ch) return;
		const at = channels.findIndex((c) => c.id === ch.id);
		if (at < 0) return;
		watchedRef.current = {catId: activeCatId, channelId: ch.id};
		setPlayingIndex(at);
	}, [client, channels, activeCatId]);

	const handleWatching = useCallback((w) => {
		watchedRef.current = w;
	}, []);

	// Retour pendant la lecture : on revient à la liste, sur la dernière chaîne regardée.
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (playingIndex === null) return false;
			// Le lecteur ferme d'abord ses panneaux et revient au direct.
			if (playerBackRef.current?.()) return true;
			const w = watchedRef.current;
			if (w && w.catId && w.catId !== activeCatId) setActiveCatId(w.catId);
			setPlayingIndex(null);
			return true;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, playingIndex, activeCatId]);

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

	if (playingIndex !== null && client && channels.length) {
		return (
			<MaTvPlayer
				client={client}
				categories={cats}
				catId={activeCatId}
				channels={channels}
				startIndex={playingIndex}
				backRef={playerBackRef}
				onWatching={handleWatching}
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
								onFocus={handleChannelFocus}
								onSelect={handleWatch}
							/>
						))}
					</Scroller>
				</Container>

				<div style={{width: previewWidth, display: 'flex'}}>
					<Preview channel={focused} onWatch={handleWatch} />
				</div>
			</div>
		</Container>
	);
};

export default MaTv;
export {MaTv};
