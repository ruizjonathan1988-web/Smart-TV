// Lecteur plein écran Ma TV : lit /tv/play/{id}.ts sur le lecteur natif de la
// TV (AVPlay sur Samsung, <video>/Starfish sur LG) sans passer par Jellyfin.
// Comportement repris de ma_tv_player_screen.dart : ▼ / CH+ chaîne suivante,
// ▲ / CH- chaîne précédente, chiffres pour taper un numéro, bandeau MaTvBanner.
import {useState, useEffect, useCallback, useRef} from 'react';
import $L from '@enact/i18n/$L';

import {getPlatform} from '../../platform';
import {KEYS} from '../../utils/keys';
import {formatClockTime} from '../../utils/clock';
import LoadingSpinner from '../../components/LoadingSpinner';
import {maTvColors as C} from './maTvTheme';
import {wrapIndex, appendDigit, indexOfNumber, programsAt, progressOf} from './maTvZap';

import css from './MaTvPlayer.module.less';

const BANNER_MS = 5000;
const NUMBER_MS = 1400;
const RETRY_MS = 1500;
const MAX_RETRIES = 2;

const loadEngine = () => (getPlatform() === 'tizen'
	? import('./maTvEngineTizen')
	: import('./maTvEngineWebos'));

const nowSeconds = () => Math.floor(Date.now() / 1000);
const clock = (sec) => (sec ? formatClockTime(new Date(sec * 1000)) : '');

const digitOf = (code) => {
	if (code >= 48 && code <= 57) return String(code - 48);
	if (code >= 96 && code <= 105) return String(code - 96);
	return null;
};

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

const Banner = ({channel, categoryLabel, status, nowSec}) => {
	const [logoFailed, setLogoFailed] = useState(false);
	const handleLogoError = useCallback(() => setLogoFailed(true), []);
	useEffect(() => setLogoFailed(false), [channel]);

	const {current, next} = programsAt(channel, nowSec);
	const progress = Math.round(progressOf(current, nowSec) * 1000) / 10;
	return (
		<div className={css.banner}>
			<div className={css.bannerNumber} style={{color: C.ink}}>{channel.num || ''}</div>
			<div className={css.bannerLogo} style={{background: C.row}}>
				{channel.logo && !logoFailed ? (
					<img src={channel.logo} alt="" onError={handleLogoError} />
				) : null}
			</div>
			<div className={css.bannerText}>
				<div className={css.bannerTitleRow}>
					<span className={css.bannerName} style={{color: C.ink}}>{channel.name}</span>
					{categoryLabel ? (
						<span className={css.bannerCategory} style={{color: C.faint}}>{categoryLabel}</span>
					) : null}
				</div>
				{current ? (
					<div>
						<div className={css.bannerProgram} style={{color: C.ink}}>{current.t}</div>
						<div className={css.bannerTimeline}>
							<span className={css.bannerTime} style={{color: C.mute}}>{clock(current.s)}</span>
							<div className={css.progressTrack} style={{background: 'rgba(237, 235, 230, 0.15)'}}>
								<div className={css.progressFill} style={{width: progress + '%', background: C.accent}} />
							</div>
							<span className={css.bannerTime} style={{color: C.mute}}>{clock(current.e)}</span>
						</div>
						{next ? (
							<div className={css.bannerNext} style={{color: C.mute}}>
								{$L('Ensuite')}  {clock(next.s)}  {next.t}
							</div>
						) : null}
					</div>
				) : (
					<div className={css.bannerEmpty} style={{color: C.faint}}>{$L('Pas de programme annoncé')}</div>
				)}
				{status ? (
					<div className={css.bannerStatus} style={{color: C.accent}}>{status}</div>
				) : null}
			</div>
			<div className={css.bannerSide}>
				<div className={css.bannerClock} style={{color: C.ink}}>{clock(nowSec)}</div>
				<div className={css.bannerHints} style={{color: C.faint}}>
					<span>▲▼ {$L('chaînes')}</span>
					<span>OK {$L('bandeau')}</span>
					<span>{$L('Retour')} {$L('liste')}</span>
				</div>
			</div>
		</div>
	);
};

const MaTvPlayer = ({client, channels, startIndex = 0, categoryLabel = '', onIndexChange}) => {
	const containerRef = useRef(null);
	const engineRef = useRef(null);
	const [index, setIndex] = useState(startIndex);
	const [phase, setPhase] = useState('buffering'); // buffering | playing | failed
	const [banner, setBanner] = useState(true);
	const [number, setNumber] = useState('');
	const [status, setStatus] = useState(null);
	const [paused, setPaused] = useState(false);
	const [nowSec, setNowSec] = useState(nowSeconds());

	const retriesRef = useRef(0);
	const retryTimer = useRef(null);
	const bannerTimer = useRef(null);
	const numberTimer = useRef(null);
	const urlRef = useRef(null);

	const channel = channels[index] || null;

	const showBanner = useCallback(() => {
		setBanner(true);
		clearTimeout(bannerTimer.current);
		bannerTimer.current = setTimeout(() => setBanner(false), BANNER_MS);
	}, []);

	// États remontés par le moteur natif.
	const handleState = useCallback((state) => {
		if (state === 'playing') {
			retriesRef.current = 0;
			setPhase('playing');
			setStatus(null);
			return;
		}
		if (state === 'buffering') {
			setPhase((p) => (p === 'failed' ? p : 'buffering'));
			return;
		}
		// Erreur ou flux coupé : on retente la même chaîne avant d'abandonner.
		clearTimeout(retryTimer.current);
		if (retriesRef.current < MAX_RETRIES && urlRef.current) {
			retriesRef.current += 1;
			setPhase('buffering');
			setStatus($L('Reconnexion…'));
			retryTimer.current = setTimeout(() => {
				if (engineRef.current && urlRef.current) engineRef.current.open(urlRef.current);
			}, RETRY_MS);
			return;
		}
		setPhase('failed');
		setStatus($L('Chaîne indisponible pour le moment'));
		setBanner(true);
		clearTimeout(bannerTimer.current);
	}, []);

	// Moteur natif chargé une fois, détruit en sortie.
	useEffect(() => {
		let alive = true;
		const node = containerRef.current;
		loadEngine().then((mod) => {
			if (!alive) return;
			const engine = mod.createEngine({container: node, onState: handleState});
			engineRef.current = engine;
			if (engine.needsTransparency) setAncestorsTransparent(node, true);
			if (urlRef.current) engine.open(urlRef.current);
		});
		return () => {
			alive = false;
			clearTimeout(retryTimer.current);
			clearTimeout(bannerTimer.current);
			clearTimeout(numberTimer.current);
			const engine = engineRef.current;
			engineRef.current = null;
			if (engine) {
				engine.destroy();
				if (engine.needsTransparency) setAncestorsTransparent(node, false);
			}
		};
	}, [handleState]);

	// Accord sur la chaîne courante (au montage et à chaque zapping).
	useEffect(() => {
		if (!channel || !client) return;
		const url = client.liveUrl(channel);
		urlRef.current = url;
		retriesRef.current = 0;
		clearTimeout(retryTimer.current);
		setPhase('buffering');
		setStatus(null);
		setPaused(false);
		showBanner();
		if (engineRef.current) engineRef.current.open(url);
		onIndexChange?.(index);
	}, [channel, client, index, onIndexChange, showBanner]);

	// Horloge du bandeau (avancement du programme).
	useEffect(() => {
		const t = setInterval(() => setNowSec(nowSeconds()), 15000);
		return () => clearInterval(t);
	}, []);

	const zap = useCallback((delta) => {
		if (channels.length < 2) return;
		setIndex((i) => wrapIndex(i, delta, channels.length));
	}, [channels.length]);

	const goNumber = useCallback((typed) => {
		setNumber('');
		const at = indexOfNumber(channels, typed);
		if (at >= 0) {
			setIndex(at);
		} else {
			setStatus(`${$L('Pas de chaîne')} ${typed} ${$L('ici')}`);
			showBanner();
		}
	}, [channels, showBanner]);

	const retry = useCallback(() => {
		if (!engineRef.current || !urlRef.current) return;
		retriesRef.current = 0;
		setPhase('buffering');
		setStatus(null);
		engineRef.current.open(urlRef.current);
	}, []);

	const togglePause = useCallback(() => {
		const engine = engineRef.current;
		if (!engine) return;
		setPaused((p) => {
			if (p) engine.resume();
			else engine.pause();
			return !p;
		});
		showBanner();
	}, [showBanner]);

	// Télécommande. Retour est géré par l'écran Ma TV (backHandlerRef).
	const numberRef = useRef('');
	numberRef.current = number;
	useEffect(() => {
		const onKey = (e) => {
			const code = e.keyCode || e.which;
			let handled = true;
			const digit = digitOf(code);
			if (digit !== null) {
				const typed = appendDigit(numberRef.current, digit);
				setNumber(typed);
				showBanner();
				clearTimeout(numberTimer.current);
				numberTimer.current = setTimeout(() => goNumber(typed), NUMBER_MS);
			} else if (code === KEYS.DOWN || code === KEYS.CHANNEL_UP) {
				zap(1);
			} else if (code === KEYS.UP || code === KEYS.CHANNEL_DOWN) {
				zap(-1);
			} else if (code === KEYS.ENTER) {
				if (numberRef.current) {
					clearTimeout(numberTimer.current);
					goNumber(numberRef.current);
				} else if (phase === 'failed') {
					retry();
				} else if (banner) {
					setBanner(false);
				} else {
					showBanner();
				}
			} else if (code === KEYS.PLAY || code === KEYS.PAUSE || code === KEYS.PLAY_PAUSE) {
				togglePause();
			} else if (code === 457 || e.key === 'Info') {
				showBanner();
			} else if (code === KEYS.LEFT || code === KEYS.RIGHT) {
				showBanner();
			} else {
				handled = false;
			}
			if (handled) {
				e.preventDefault();
				e.stopPropagation();
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [banner, phase, goNumber, retry, showBanner, togglePause, zap]);

	const engineTransparent = getPlatform() === 'tizen';
	return (
		<div
			ref={containerRef}
			className={css.player}
			style={{background: engineTransparent ? 'transparent' : '#000'}}
		>
			{phase === 'buffering' ? (
				<div className={css.center}><LoadingSpinner /></div>
			) : null}
			{phase === 'failed' ? (
				<div className={css.center}>
					<div className={css.failCard} style={{background: C.panel}}>
						<div className={css.failTitle} style={{color: C.ink}}>{status}</div>
						<div className={css.failHint} style={{color: C.mute}}>
							{$L('OK pour réessayer · ▲▼ pour changer de chaîne')}
						</div>
					</div>
				</div>
			) : null}
			{paused ? (
				<div className={css.pausedChip} style={{background: C.panel, color: C.ink}}>{$L('Pause')}</div>
			) : null}
			{number ? (
				<div className={css.numberChip} style={{background: C.panel, color: C.ink}}>{number}</div>
			) : null}
			{channel && (banner || number) ? (
				<Banner
					channel={channel}
					categoryLabel={categoryLabel}
					status={phase === 'failed' ? null : status}
					nowSec={nowSec}
				/>
			) : null}
		</div>
	);
};

export default MaTvPlayer;
export {MaTvPlayer};
