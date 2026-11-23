// Lecteur plein écran des replays (vidéo de la chaîne ou enregistrement du
// fournisseur) sur le lecteur natif de la TV. La place est gardée sur la TV
// et reprise à la réouverture.
//   OK / Lecture-Pause : pause, ◀ −10 s, ▶ +30 s (les appuis s'additionnent),
//   ◀◀ / ▶▶ : −2 min / +2 min (« Passer la pub » sur un enregistrement),
//   ▼ : épisode suivant quand il y en a un. Retour est géré par l'écran hôte.
import {useState, useEffect, useCallback, useRef} from 'react';
import $L from '@enact/i18n/$L';

import {KEYS} from '../../utils/keys';
import LoadingSpinner from '../../components/LoadingSpinner';
import {saveReplayPlace} from '../../services/maTvProgress';
import {maTvColors as C} from './maTvTheme';
import {loadEngine, playerBackground, setAncestorsTransparent} from './maTvPlayerShared';

import css from './MaTvPlayer.module.less';

const OSD_MS = 4000;
const SEEK_SETTLE_MS = 700;
const SAVE_EVERY_MS = 15000;

const fmtTime = (ms) => {
	const s = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const r = s % 60;
	const two = (n) => (n < 10 ? '0' + n : String(n));
	return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
};

const MaTvVodPlayer = ({id, url, title, subtitle = '', startMs = 0, adSkip = false, notice = '', nextLabel = '', onNext, onFinished}) => {
	const containerRef = useRef(null);
	const engineRef = useRef(null);
	const [phase, setPhase] = useState('buffering'); // buffering | playing | failed
	const [paused, setPaused] = useState(false);
	const [osd, setOsd] = useState(true);
	const [status, setStatus] = useState(notice || null);
	const [pos, setPos] = useState(startMs);
	const [dur, setDur] = useState(0);
	const pendingSeek = useRef(null);
	const timers = useRef({});

	const later = useCallback((name, ms, fn) => {
		clearTimeout(timers.current[name]);
		timers.current[name] = setTimeout(fn, ms);
	}, []);

	const showOsd = useCallback((ms = OSD_MS) => {
		setOsd(true);
		later('osd', ms, () => setOsd(false));
	}, [later]);

	const save = useCallback(() => {
		const e = engineRef.current;
		if (!e) return;
		const p = e.position();
		const d = e.duration();
		if (d > 0 && p > 0) saveReplayPlace(id, p, d);
	}, [id]);

	const handleState = useCallback((state) => {
		if (state === 'playing') {
			setPhase('playing');
			return;
		}
		if (state === 'buffering') {
			setPhase((p) => (p === 'failed' ? p : 'buffering'));
			return;
		}
		if (state === 'ended') {
			save();
			setPhase('playing');
			if (onFinished) onFinished();
			return;
		}
		setPhase('failed');
		setStatus($L('La vidéo ne se lit pas sur cette TV.'));
		setOsd(true);
	}, [save, onFinished]);

	useEffect(() => {
		let alive = true;
		const node = containerRef.current;
		const pending = timers.current;
		loadEngine().then((mod) => {
			if (!alive) return;
			const engine = mod.createEngine({container: node, onState: handleState});
			engineRef.current = engine;
			if (engine.needsTransparency) setAncestorsTransparent(node, true);
			engine.open(url, {startMs});
		});
		return () => {
			alive = false;
			Object.keys(pending).forEach((k) => clearTimeout(pending[k]));
			const engine = engineRef.current;
			if (engine) {
				const p = engine.position();
				const d = engine.duration();
				if (d > 0 && p > 0) saveReplayPlace(id, p, d);
				engineRef.current = null;
				engine.destroy();
				if (engine.needsTransparency) setAncestorsTransparent(node, false);
			}
		};
	}, [url]); // eslint-disable-line react-hooks/exhaustive-deps

	// Position affichée et sauvegarde régulière de la place.
	useEffect(() => {
		let ticks = 0;
		const t = setInterval(() => {
			const e = engineRef.current;
			if (!e) return;
			if (pendingSeek.current === null) setPos(e.position());
			setDur(e.duration());
			ticks += 1;
			if (ticks * 1000 >= SAVE_EVERY_MS) {
				ticks = 0;
				save();
			}
		}, 1000);
		return () => clearInterval(t);
	}, [save]);

	const seekBy = useCallback((deltaMs) => {
		const e = engineRef.current;
		if (!e) return;
		const base = pendingSeek.current !== null ? pendingSeek.current : e.position();
		const d = e.duration();
		let target = Math.max(0, base + deltaMs);
		if (d > 0) target = Math.min(target, d - 5000);
		pendingSeek.current = target;
		setPos(target);
		showOsd();
		later('seek', SEEK_SETTLE_MS, () => {
			const to = pendingSeek.current;
			pendingSeek.current = null;
			if (engineRef.current && to !== null) engineRef.current.seek(to);
		});
	}, [later, showOsd]);

	const togglePause = useCallback(() => {
		const e = engineRef.current;
		if (!e) return;
		if (paused) {
			e.resume();
			setPaused(false);
			showOsd();
		} else {
			e.pause();
			setPaused(true);
			save();
			clearTimeout(timers.current.osd);
			setOsd(true);
		}
	}, [paused, save, showOsd]);

	const keysRef = useRef(null);
	keysRef.current = {phase, onNext, seekBy, togglePause, showOsd, adSkip};

	useEffect(() => {
		const onKey = (e) => {
			const code = e.keyCode || e.which;
			const k = keysRef.current;
			let handled = true;
			if (code === KEYS.ENTER || code === KEYS.PLAY || code === KEYS.PAUSE || code === KEYS.PLAY_PAUSE) {
				if (k.phase !== 'failed') k.togglePause();
			} else if (code === KEYS.LEFT) {
				k.seekBy(-10000);
			} else if (code === KEYS.RIGHT) {
				k.seekBy(30000);
			} else if (code === KEYS.REWIND) {
				k.seekBy(-120000);
			} else if (code === KEYS.FAST_FORWARD) {
				k.seekBy(120000);
			} else if (code === KEYS.DOWN && k.onNext) {
				k.onNext();
			} else if (code === KEYS.UP || code === KEYS.DOWN || code === 457) {
				k.showOsd();
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
	}, []);

	const progress = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
	return (
		<div ref={containerRef} className={css.player} style={{background: playerBackground()}}>
			{phase === 'buffering' ? <div className={css.center}><LoadingSpinner /></div> : null}
			{phase === 'failed' ? (
				<div className={css.center}>
					<div className={css.failCard} style={{background: C.panel}}>
						<div className={css.failTitle} style={{color: C.ink}}>{status}</div>
						<div className={css.failHint} style={{color: C.mute}}>{$L('Retour pour revenir au replay')}</div>
					</div>
				</div>
			) : null}
			{paused ? (
				<div className={css.delayChip} style={{background: C.panel, color: C.ink}}>{$L('Pause')}</div>
			) : null}
			{osd && phase !== 'failed' ? (
				<div className={css.vodOsd}>
					<div className={css.vodTitle} style={{color: C.ink}}>{title}</div>
					{subtitle ? <div className={css.vodSubtitle} style={{color: C.mute}}>{subtitle}</div> : null}
					{status ? <div className={css.bannerStatus} style={{color: C.accent}}>{status}</div> : null}
					<div className={css.bannerTimeline}>
						<span className={css.bannerTime} style={{color: C.mute}}>{fmtTime(pos)}</span>
						<div className={css.progressTrack} style={{background: 'rgba(237, 235, 230, 0.15)'}}>
							<div className={css.progressFill} style={{width: progress + '%', background: C.accent}} />
						</div>
						<span className={css.bannerTime} style={{color: C.mute}}>{dur ? fmtTime(dur) : '--:--'}</span>
					</div>
					<div className={css.bannerHints} style={{color: C.faint}}>
						<span>OK {paused ? $L('lecture') : $L('pause')}</span>
						<span>◀ −10 s</span>
						<span>▶ +30 s</span>
						<span>{adSkip ? `▶▶ ${$L('passer la pub')}` : '◀◀ ▶▶ 2 min'}</span>
						{nextLabel ? <span>▼ {nextLabel}</span> : null}
					</div>
				</div>
			) : null}
		</div>
	);
};

export default MaTvVodPlayer;
