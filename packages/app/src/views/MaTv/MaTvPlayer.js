// Lecteur plein écran Ma TV : lit le MPEG-TS de Ma TV (direct, différé) sur le
// lecteur natif de la TV (AVPlay sur Samsung, <video>/Starfish sur LG), sans
// passer par Jellyfin. Télécommande reprise de ma_tv_player_screen.dart :
//   ▼ / CH+ chaîne suivante, ▲ / CH- précédente, chiffres = numéro,
//   OK = liste des chaînes, OK long / Menu = mini-guide,
//   ◀ / ▶ = −30 s / +30 s dans le différé, Lecture/Pause,
//   Retour = ferme le panneau, puis revient au direct, puis quitte.
import {useState, useEffect, useCallback, useRef} from 'react';
import $L from '@enact/i18n/$L';

import {getPlatform} from '../../platform';
import {KEYS} from '../../utils/keys';
import LoadingSpinner from '../../components/LoadingSpinner';
import {maTvColors as C} from './maTvTheme';
import {
	wrapIndex, appendDigit, indexOfNumber, fmtDelay, shiftFrom, clampDelay, guideAt
} from './maTvZap';
import {Banner, ChannelListPanel, MiniGuide} from './MaTvPlayerOverlays';

import css from './MaTvPlayer.module.less';

const BANNER_MS = 5000;
const NUMBER_MS = 1400;
const RETRY_MS = 1500;
const MAX_RETRIES = 2;
const SEEK_SETTLE_MS = 600;
const LONG_PRESS_MS = 550;
const PAGE = 8;

const loadEngine = () => (getPlatform() === 'tizen'
	? import('./maTvEngineTizen')
	: import('./maTvEngineWebos'));

const nowSeconds = () => Math.floor(Date.now() / 1000);

const digitOf = (code) => {
	if (code >= 48 && code <= 57) return String(code - 48);
	if (code >= 96 && code <= 105) return String(code - 96);
	return null;
};

const clampIndex = (i, length) => (length ? Math.max(0, Math.min(length - 1, i)) : 0);

// Rend transparents les ancêtres du lecteur : AVPlay dessine sous la page.
const setAncestorsTransparent = (node, on) => {
	document.body.style.background = on ? 'transparent' : '';
	document.documentElement.style.background = on ? 'transparent' : '';
	let el = node ? node.parentElement : null;
	while (el && el !== document.documentElement) {
		el.style.background = on ? 'transparent' : '';
		el.style.backgroundColor = on ? 'transparent' : '';
		el = el.parentElement;
	}
};

const MaTvPlayer = ({client, categories = [], catId: startCatId, channels: startChannels, startIndex = 0, backRef, onWatching}) => {
	const containerRef = useRef(null);
	const engineRef = useRef(null);

	// Liste jouée (zapping) : celle de la catégorie ouverte, changeable depuis la liste.
	const [list, setList] = useState(startChannels);
	const [catId, setCatId] = useState(startCatId);
	const [index, setIndex] = useState(startIndex);

	const [phase, setPhase] = useState('buffering'); // buffering | playing | failed
	const [status, setStatus] = useState(null);
	const [banner, setBanner] = useState(true);
	const [number, setNumber] = useState('');
	const [delay, setDelay] = useState(0); // secondes derrière le direct
	const [pausedAt, setPausedAt] = useState(null); // secondes epoch
	const [nowSec, setNowSec] = useState(nowSeconds());

	// Panneaux par-dessus l'image.
	const [overlay, setOverlay] = useState('none'); // none | list | guide
	const [listColumn, setListColumn] = useState(1);
	const [listCat, setListCat] = useState(0);
	const [listCatId, setListCatId] = useState(startCatId);
	const [listChans, setListChans] = useState(startChannels);
	const [listChan, setListChan] = useState(startIndex);
	const [listLoading, setListLoading] = useState(false);
	const [guidePrograms, setGuidePrograms] = useState([]);
	const [guideAction, setGuideAction] = useState(0);

	const retriesRef = useRef(0);
	const urlRef = useRef(null);
	const pendingDelayRef = useRef(null);
	const timers = useRef({});
	const enterDownAt = useRef(0);
	const enterLongFired = useRef(false);
	const lastEnterAt = useRef(0);
	const listRequest = useRef(0);

	const channel = list[index] || null;
	const category = categories.find((c) => c.id === catId) || null;

	const later = useCallback((name, ms, fn) => {
		clearTimeout(timers.current[name]);
		timers.current[name] = setTimeout(fn, ms);
	}, []);

	const showBanner = useCallback((ms = BANNER_MS) => {
		setBanner(true);
		clearTimeout(timers.current.banner);
		timers.current.banner = setTimeout(() => setBanner(false), ms);
	}, []);

	const openUrl = useCallback((url) => {
		urlRef.current = url;
		retriesRef.current = 0;
		clearTimeout(timers.current.retry);
		setPhase('buffering');
		if (engineRef.current) engineRef.current.open(url);
	}, []);

	// États remontés par le moteur natif.
	const handleState = useCallback((state) => {
		if (state === 'playing') {
			retriesRef.current = 0;
			setPhase('playing');
			return;
		}
		if (state === 'buffering') {
			setPhase((p) => (p === 'failed' ? p : 'buffering'));
			return;
		}
		// Erreur ou flux coupé : on retente la même adresse avant d'abandonner.
		clearTimeout(timers.current.retry);
		if (retriesRef.current < MAX_RETRIES && urlRef.current) {
			retriesRef.current += 1;
			setPhase('buffering');
			setStatus($L('Reconnexion…'));
			timers.current.retry = setTimeout(() => {
				if (engineRef.current && urlRef.current) engineRef.current.open(urlRef.current);
			}, RETRY_MS);
			return;
		}
		setPhase('failed');
		setStatus($L('Chaîne indisponible pour le moment'));
		clearTimeout(timers.current.banner);
		setBanner(true);
	}, []);

	// Moteur natif chargé une fois, détruit en sortie.
	useEffect(() => {
		let alive = true;
		const node = containerRef.current;
		const pending = timers.current;
		loadEngine().then((mod) => {
			if (!alive) return;
			const engine = mod.createEngine({container: node, onState: handleState});
			engineRef.current = engine;
			if (engine.needsTransparency) setAncestorsTransparent(node, true);
			if (urlRef.current) engine.open(urlRef.current);
		});
		return () => {
			alive = false;
			Object.keys(pending).forEach((k) => clearTimeout(pending[k]));
			const engine = engineRef.current;
			engineRef.current = null;
			if (engine) {
				engine.destroy();
				if (engine.needsTransparency) setAncestorsTransparent(node, false);
			}
		};
	}, [handleState]);

	// Direct de la chaîne courante.
	const tuneLive = useCallback(() => {
		if (!channel || !client) return;
		pendingDelayRef.current = null;
		clearTimeout(timers.current.seek);
		setDelay(0);
		setPausedAt(null);
		setStatus(null);
		openUrl(client.liveUrl(channel));
	}, [channel, client, openUrl]);

	// Nouvelle chaîne (ouverture, zapping, liste) : direct + bandeau.
	useEffect(() => {
		if (!channel) return;
		tuneLive();
		showBanner();
		onWatching?.({catId, channelId: channel.id});
	}, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

	// Horloge du bandeau (avancement du programme, retard).
	useEffect(() => {
		const t = setInterval(() => setNowSec(nowSeconds()), 15000);
		return () => clearInterval(t);
	}, []);

	const goLive = useCallback(() => {
		tuneLive();
		setStatus($L('Retour au direct'));
		showBanner();
	}, [tuneLive, showBanner]);

	// Joue la chaîne `wanted` secondes derrière le direct, depuis le tampon de
	// la seedbox (pas plus loin qu'il ne remonte). Zéro = retour au direct.
	const applyDelay = useCallback(async (wanted, {resume = false} = {}) => {
		const ch = channel;
		if (!ch || !client) return;
		if (wanted <= 0) {
			if (delay > 0 || resume) goLive();
			return;
		}
		const from = shiftFrom(await client.shift(ch.id));
		const now = nowSeconds();
		if (from === null) {
			setStatus($L('Retour en arrière indisponible'));
			showBanner();
			if (resume && engineRef.current) engineRef.current.resume();
			return;
		}
		const d = clampDelay(from, wanted, now);
		if (d <= 0) {
			setStatus($L('Pas encore assez d\'images gardées pour reculer'));
			showBanner();
			if (resume && engineRef.current) engineRef.current.resume();
			return;
		}
		setDelay(d);
		setPausedAt(null);
		setStatus(`${$L('Différé')} ${fmtDelay(d)}`);
		showBanner(4000);
		openUrl(client.shiftUrl(ch, new Date((now - d) * 1000)));
	}, [channel, client, delay, goLive, openUrl, showBanner]);

	// ◀ / ▶ : les appuis s'additionnent, le flux ne se rouvre qu'une fois.
	const seekBy = useCallback((seconds) => {
		const base = pendingDelayRef.current !== null ? pendingDelayRef.current : delay;
		const next = Math.max(0, base - seconds);
		pendingDelayRef.current = next;
		setStatus(next === 0 ? $L('Direct') : `${$L('Différé')} ${fmtDelay(next)}`);
		showBanner();
		later('seek', SEEK_SETTLE_MS, () => {
			const wanted = pendingDelayRef.current;
			pendingDelayRef.current = null;
			applyDelay(wanted);
		});
	}, [delay, applyDelay, showBanner, later]);

	// Pause : l'image s'arrête et repart d'où elle était, depuis le tampon.
	const playPause = useCallback(() => {
		const engine = engineRef.current;
		if (!engine) return;
		if (pausedAt === null) {
			setPausedAt(nowSeconds());
			engine.pause();
			clearTimeout(timers.current.banner);
			setBanner(true);
			setStatus($L('Pause · ▶ pour reprendre'));
			return;
		}
		const shownAt = pausedAt - delay;
		setPausedAt(null);
		applyDelay(nowSeconds() - shownAt, {resume: true});
	}, [pausedAt, delay, applyDelay]);

	const zap = useCallback((d) => {
		if (list.length < 2) return;
		setIndex((i) => wrapIndex(i, d, list.length));
	}, [list.length]);

	const goNumber = useCallback((typed) => {
		setNumber('');
		const at = indexOfNumber(list, typed);
		if (at >= 0) {
			setIndex(at);
		} else {
			setStatus(`${$L('Pas de chaîne')} ${typed} ${$L('ici')}`);
			showBanner();
		}
	}, [list, showBanner]);

	const retry = useCallback(() => {
		if (!urlRef.current) return;
		setStatus(null);
		openUrl(urlRef.current);
	}, [openUrl]);

	// ---------------------------------------------------------------- liste
	const openList = useCallback(() => {
		const at = categories.findIndex((c) => c.id === catId);
		setListColumn(1);
		setListCat(at >= 0 ? at : 0);
		setListCatId(catId);
		setListChans(list);
		setListChan(index);
		setListLoading(false);
		setOverlay('list');
	}, [categories, catId, list, index]);

	const listOpenCategory = useCallback(async (i) => {
		const c = categories[i];
		if (!c || !client) return;
		const mine = ++listRequest.current;
		setListCat(i);
		setListLoading(true);
		const res = await client.channels(c.id);
		if (mine !== listRequest.current) return;
		const chans = res && Array.isArray(res.chans) ? res.chans : [];
		setListCatId(c.id);
		setListChans(chans);
		const here = channel ? chans.findIndex((x) => x.id === channel.id) : -1;
		setListChan(here >= 0 ? here : 0);
		setListLoading(false);
	}, [categories, client, channel]);

	const listPlay = useCallback((i) => {
		if (i < 0 || i >= listChans.length) return;
		setOverlay('none');
		if (listChans === list && i === index) return;
		setList(listChans);
		setCatId(listCatId);
		setIndex(i);
	}, [listChans, listCatId, list, index]);

	// ---------------------------------------------------------------- mini-guide
	const guide = guideAt(guidePrograms, channel, nowSec);
	const guideActions = [];
	if (delay > 0 || pausedAt !== null) guideActions.push({id: 'live', label: $L('Revenir au direct')});
	if (guide.current && guide.current.s) guideActions.push({id: 'start', label: $L('Revoir depuis le début')});
	guideActions.push({id: 'list', label: $L('Liste des chaînes')});

	const openGuide = useCallback(async () => {
		if (!channel || !client) return;
		setGuideAction(0);
		setGuidePrograms([]);
		setOverlay('guide');
		const now = Date.now();
		const progs = await client.programs([channel.id], new Date(now - 3600000), new Date(now + 36000000));
		const mine = progs && Array.isArray(progs[channel.id]) ? progs[channel.id] : [];
		setGuidePrograms(mine);
	}, [channel, client]);

	const fromStart = useCallback(async (prog) => {
		setOverlay('none');
		const from = shiftFrom(await client.shift(channel.id));
		if (from !== null && from <= prog.s) {
			applyDelay(nowSeconds() - prog.s);
			return;
		}
		setStatus($L('Le début n\'est plus gardé'));
		showBanner();
	}, [client, channel, applyDelay, showBanner]);

	const guideDo = (i) => {
		const a = guideActions[i];
		if (!a) return;
		if (a.id === 'live') {
			setOverlay('none');
			goLive();
		} else if (a.id === 'start') {
			fromStart(guide.current);
		} else if (a.id === 'list') {
			openList();
		}
	};

	// ---------------------------------------------------------------- Retour
	// Appelé par l'écran Ma TV (backHandlerRef) : true si le lecteur l'a consommé.
	const back = useCallback(() => {
		if (overlay !== 'none') {
			setOverlay('none');
			return true;
		}
		if (delay > 0 || pausedAt !== null) {
			goLive();
			return true;
		}
		return false;
	}, [overlay, delay, pausedAt, goLive]);

	useEffect(() => {
		if (!backRef) return undefined;
		backRef.current = back;
		return () => {
			if (backRef.current === back) backRef.current = null;
		};
	}, [backRef, back]);

	// ---------------------------------------------------------------- télécommande
	const onEnterShort = () => {
		if (number) {
			clearTimeout(timers.current.number);
			goNumber(number);
		} else if (phase === 'failed') {
			retry();
		} else {
			openList();
		}
	};

	const listKey = (code) => {
		const page = code === KEYS.CHANNEL_UP || code === KEYS.CHANNEL_DOWN;
		if (code === KEYS.UP || code === KEYS.DOWN || page) {
			const step = page ? PAGE : 1;
			const d = (code === KEYS.DOWN || code === KEYS.CHANNEL_DOWN) ? step : -step;
			if (listColumn === 0) {
				const next = clampIndex(listCat + d, categories.length);
				if (next !== listCat) listOpenCategory(next);
			} else {
				setListChan((c) => clampIndex(c + d, listChans.length));
			}
		} else if (code === KEYS.LEFT) {
			if (listColumn === 1 && categories.length) setListColumn(0);
			else setOverlay('none');
		} else if (code === KEYS.RIGHT) {
			if (listColumn === 0) setListColumn(1);
			else setOverlay('none');
		} else if (code === KEYS.ENTER) {
			if (listColumn === 0) setListColumn(1);
			else listPlay(listChan);
		}
	};

	const guideKey = (code) => {
		if (code === KEYS.LEFT) setGuideAction((a) => clampIndex(a - 1, guideActions.length));
		else if (code === KEYS.RIGHT) setGuideAction((a) => clampIndex(a + 1, guideActions.length));
		else if (code === KEYS.ENTER) guideDo(guideAction);
	};

	const playerKey = (code, e) => {
		const digit = digitOf(code);
		if (digit !== null) {
			const typed = appendDigit(number, digit);
			setNumber(typed);
			showBanner();
			later('number', NUMBER_MS, () => goNumber(typed));
		} else if (code === KEYS.DOWN || code === KEYS.CHANNEL_UP) {
			zap(1);
		} else if (code === KEYS.UP || code === KEYS.CHANNEL_DOWN) {
			zap(-1);
		} else if (code === KEYS.LEFT || code === KEYS.REWIND) {
			seekBy(-30);
		} else if (code === KEYS.RIGHT || code === KEYS.FAST_FORWARD) {
			seekBy(30);
		} else if (code === KEYS.PLAY || code === KEYS.PAUSE || code === KEYS.PLAY_PAUSE) {
			playPause();
		} else if (code === 457 || e.key === 'Info') {
			showBanner();
		} else if ((KEYS.MENU !== undefined && code === KEYS.MENU) || code === 10135 || e.key === 'ContextMenu') {
			openGuide();
		} else {
			return false;
		}
		return true;
	};

	// Les gestionnaires changent à chaque rendu ; l'écouteur clavier, posé une
	// fois, passe toujours par les derniers.
	const keysRef = useRef(null);
	keysRef.current = {overlay, listKey, guideKey, playerKey, onEnterShort, openGuide};

	useEffect(() => {
		const onKeyDown = (e) => {
			const code = e.keyCode || e.which;
			const k = keysRef.current;
			if (code === KEYS.ENTER) {
				e.preventDefault();
				e.stopPropagation();
				const t = Date.now();
				// Une répétition arrive en rafale ; un long silence = relâché perdu.
				const repeat = enterDownAt.current && t - lastEnterAt.current < 700;
				lastEnterAt.current = t;
				if (repeat) {
					// Répétition d'une touche maintenue : OK long = mini-guide.
					if (k.overlay === 'none' && !enterLongFired.current && Date.now() - enterDownAt.current > LONG_PRESS_MS) {
						enterLongFired.current = true;
						k.openGuide();
					}
					return;
				}
				enterDownAt.current = t;
				enterLongFired.current = false;
				// Dans un panneau, OK agit tout de suite ; sur l'image on attend le relâché.
				if (k.overlay !== 'none') {
					enterLongFired.current = true;
					if (k.overlay === 'list') k.listKey(code);
					else k.guideKey(code);
				}
				return;
			}
			let handled = true;
			if (k.overlay === 'list') k.listKey(code);
			else if (k.overlay === 'guide') k.guideKey(code);
			else handled = k.playerKey(code, e);
			if (handled) {
				e.preventDefault();
				e.stopPropagation();
			}
		};
		const onKeyUp = (e) => {
			const code = e.keyCode || e.which;
			if (code !== KEYS.ENTER || !enterDownAt.current) return;
			const held = Date.now() - enterDownAt.current;
			const fired = enterLongFired.current;
			enterDownAt.current = 0;
			enterLongFired.current = false;
			e.preventDefault();
			e.stopPropagation();
			if (fired) return;
			// Télécommande qui ne répète pas : la durée de l'appui tranche.
			if (held > LONG_PRESS_MS) keysRef.current.openGuide();
			else keysRef.current.onEnterShort();
		};
		window.addEventListener('keydown', onKeyDown, true);
		window.addEventListener('keyup', onKeyUp, true);
		return () => {
			window.removeEventListener('keydown', onKeyDown, true);
			window.removeEventListener('keyup', onKeyUp, true);
		};
	}, []);

	const delayLabel = delay > 0
		? `${$L('Différé')} ${fmtDelay(delay)} · ${$L('Retour pour revenir au direct')}`
		: null;
	const transparent = getPlatform() === 'tizen';

	return (
		<div
			ref={containerRef}
			className={css.player}
			style={{background: transparent ? 'transparent' : '#000'}}
		>
			{phase === 'buffering' && overlay === 'none' ? (
				<div className={css.center}><LoadingSpinner /></div>
			) : null}
			{phase === 'failed' && overlay === 'none' ? (
				<div className={css.center}>
					<div className={css.failCard} style={{background: C.panel}}>
						<div className={css.failTitle} style={{color: C.ink}}>{status}</div>
						<div className={css.failHint} style={{color: C.mute}}>
							{$L('OK pour réessayer · ▲▼ pour changer de chaîne')}
						</div>
					</div>
				</div>
			) : null}
			{delay > 0 && !banner && overlay === 'none' ? (
				<div className={css.delayChip} style={{background: C.panel, color: C.ink}}>
					{$L('Différé')} {fmtDelay(delay)}
				</div>
			) : null}
			{number ? (
				<div className={css.numberChip} style={{background: C.panel, color: C.ink}}>{number}</div>
			) : null}
			{channel && (banner || number) && overlay === 'none' ? (
				<Banner
					channel={channel}
					categoryLabel={category ? category.label : ''}
					status={phase === 'failed' ? null : status}
					delayLabel={delayLabel}
					nowSec={nowSec}
				/>
			) : null}
			{overlay === 'list' ? (
				<ChannelListPanel
					cats={categories}
					catIndex={listCat}
					channels={listChans}
					chanIndex={listChan}
					column={listColumn}
					playingId={channel ? channel.id : null}
					nowSec={nowSec}
					loading={listLoading}
				/>
			) : null}
			{overlay === 'guide' && channel ? (
				<MiniGuide
					channel={channel}
					current={guide.current}
					later={guide.later}
					actions={guideActions}
					selected={clampIndex(guideAction, guideActions.length)}
					nowSec={nowSec}
				/>
			) : null}
		</div>
	);
};

export default MaTvPlayer;
export {MaTvPlayer};
