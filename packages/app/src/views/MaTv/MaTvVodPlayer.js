// Lecteur plein écran des replays (vidéo de la chaîne ou enregistrement du
// fournisseur) sur le lecteur natif de la TV. La place est gardée sur la TV
// et reprise à la réouverture.
//   OK / Lecture-Pause : pause, ◀ −10 s, ▶ +30 s (les appuis s'additionnent),
//   ◀◀ / ▶▶ : −2 min / +2 min (« Passer la pub » sur un enregistrement),
//   ▼ : épisode suivant quand il y en a un. Retour est géré par l'écran hôte.
//   Une série du fournisseur (iptv_next.dart) : ▲ passe le générique dans les
//   6 premières minutes, et « Épisode suivant » arrive dans les 40 dernières
//   secondes avec son compte à rebours (OK le lance, ▲ l'écarte).
import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import $L from '@enact/i18n/$L';

import {KEYS} from '../../utils/keys';
import LoadingSpinner from '../../components/LoadingSpinner';
import {saveReplayPlace} from '../../services/maTvProgress';
import {introLengthFor, correctedIntro, rememberIntro} from '../../services/iptvNext';
import {recordIptvSitting} from '../../services/iptvLearning';
import {relayRequestFromUrl, askMaTvRelay, stopMaTvRelay} from '../../services/maTvRelay';
import VjodVotePrompt, {useVjodVote} from '../Player/VjodVotePrompt';
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

const MaTvVodPlayer = ({id, url, title, subtitle = '', image = null, startMs = 0, watch = null, adSkip = false, notice = '', nextLabel = '', onNext, onFinished, nextEpisode = null, onNextEpisode, nextUp = null}) => {
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
	const series = Boolean(watch && watch.kind === 'series');
	const introLen = useRef(85000);
	const skipped = useRef(null); // {from, at} après « Passer le générique »
	const [skipDone, setSkipDone] = useState(false);
	const [nextCard, setNextCard] = useState(null); // {count} quand affichée
	const nextGone = useRef(false);
	// Pour le journal du soir : quand la lecture a commencé, combien a été vu.
	const startedAt = useRef(Date.now());
	const watchedMs = useRef(0);
	const playingRef = useRef(false);
	playingRef.current = phase === 'playing' && !paused;
	const watchRef = useRef(watch);
	watchRef.current = watch;
	useEffect(() => {
		if (!series) return;
		introLengthFor(watch.id).then((ms) => {
			introLen.current = ms;
		});
	}, [series, watch]);

	// La version « qui passe partout » préparée par Ma TV (/tv/api/cast) quand ce
	// lecteur refuse le fichier : le flux peut commencer au point de reprise,
	// d'où le décalage ajouté aux positions.
	const relay = useRef({tried: false, hls: null, offsetMs: 0});
	const openRelayRef = useRef(null);
	const posOf = (e) => e.position() + relay.current.offsetMs;
	const durOf = (e) => (e.duration() > 0 ? e.duration() + relay.current.offsetMs : 0);

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
		const p = posOf(e);
		const d = durOf(e);
		if (d > 0 && p > 0) saveReplayPlace(id, p, d, {url, title, subtitle, image, watch});
	}, [id, url, title, subtitle, image, watch]);

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
		// Le fichier ne passe pas tel quel : une fois, on demande à Ma TV sa
		// version H.264 et AAC, depuis là où on en était.
		const request = relay.current.tried ? null : relayRequestFromUrl(url);
		if (request) {
			relay.current.tried = true;
			setPhase('buffering');
			setStatus($L('Ce fichier ne se lit pas tel quel sur cette TV : Ma TV en prépare une version lisible…'));
			setOsd(true);
			const e = engineRef.current;
			openRelayRef.current(e && e.position() > 0 ? posOf(e) : startMs);
			return;
		}
		setPhase('failed');
		setStatus((s) => (relay.current.tried && s && s.indexOf('Ma TV') === 0 ? s : $L('La vidéo ne se lit pas sur cette TV.')));
		setOsd(true);
	}, [save, onFinished, url, startMs]); // eslint-disable-line react-hooks/exhaustive-deps

	// Ouvre (ou rouvre, après un saut) le flux du relais à `fromMs`.
	openRelayRef.current = async (fromMs) => {
		const request = relayRequestFromUrl(url);
		const previous = relay.current.hls;
		const source = await askMaTvRelay(request, {startMs: fromMs, title});
		stopMaTvRelay(previous);
		const e = engineRef.current;
		if (!e) return;
		if (!source || source.error) {
			relay.current.hls = null;
			setPhase('failed');
			setStatus(source ? source.error : $L('Ce fichier ne se lit pas sur cette TV. Mets Ma TV à jour (version 3.53 ou plus) pour qu\u2019elle en prépare une version lisible.'));
			setOsd(true);
			return;
		}
		relay.current.hls = source.url;
		relay.current.offsetMs = source.offsetMs;
		setStatus(null);
		e.open(source.url, {startMs: source.offsetMs > 0 ? 0 : fromMs});
	};

	useEffect(() => {
		let alive = true;
		const node = containerRef.current;
		const pending = timers.current;
		const started = startedAt.current;
		const relayState = relay.current;
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
				const p = engine.position() + relayState.offsetMs;
				const d = engine.duration() > 0 ? engine.duration() + relayState.offsetMs : 0;
				stopMaTvRelay(relayState.hls);
				if (d > 0 && p > 0) saveReplayPlace(id, p, d, {url, title, subtitle, image, watch});
				recordIptvSitting({watch: watchRef.current, startedAt: started, posMs: p, durMs: d, watchedMs: watchedMs.current});
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
			if (playingRef.current) watchedMs.current += 1000;
			if (pendingSeek.current === null) setPos(posOf(e));
			setDur(durOf(e));
			ticks += 1;
			if (ticks * 1000 >= SAVE_EVERY_MS) {
				ticks = 0;
				save();
			}
		}, 1000);
		return () => clearInterval(t);
	}, [save]);

	const seekBy = useCallback((deltaMs, isSkip = false) => {
		const e = engineRef.current;
		if (!e) return;
		const base = pendingSeek.current !== null ? pendingSeek.current : posOf(e);
		const d = durOf(e);
		let target = Math.max(0, base + deltaMs);
		if (d > 0) target = Math.min(target, d - 5000);
		// Une correction juste après « Passer le générique » : la bonne durée est gardée.
		const sk = skipped.current;
		if (!isSkip && sk && Date.now() - sk.at < 25000 && watch) {
			const len = correctedIntro(sk.from, target);
			if (len) {
				introLen.current = len;
				rememberIntro(watch.id, len);
			}
		}
		pendingSeek.current = target;
		setPos(target);
		showOsd();
		later('seek', SEEK_SETTLE_MS, () => {
			const to = pendingSeek.current;
			pendingSeek.current = null;
			if (!engineRef.current || to === null) return;
			// Dans le flux du relais, un saut redemande à Ma TV de partir de là.
			if (relay.current.hls) openRelayRef.current(to);
			else engineRef.current.seek(to);
		});
	}, [later, showOsd, watch]);

	const skipIntro = useCallback(() => {
		const e = engineRef.current;
		if (!e) return;
		const from = posOf(e);
		skipped.current = {from, at: Date.now()};
		setSkipDone(true);
		seekBy(introLen.current, true);
	}, [seekBy]);

	const goNext = useCallback(() => {
		clearTimeout(timers.current.next);
		setNextCard(null);
		nextGone.current = true;
		save();
		if (onNextEpisode) onNextEpisode();
	}, [onNextEpisode, save]);

	const dismissNext = useCallback(() => {
		clearTimeout(timers.current.next);
		setNextCard(null);
		nextGone.current = true;
	}, []);

	// Les 40 dernières secondes d'un épisode : « Épisode suivant », avec le compte
	// à rebours des réglages de lecture (Réglages › Lecture).
	useEffect(() => {
		if (!nextEpisode || !onNextEpisode || nextCard || nextGone.current || dur < 5 * 60000) return;
		const left = dur - pos;
		if (left > 40000 || left <= 0) return;
		if (nextUp && nextUp.show === false) {
			nextGone.current = true;
			return;
		}
		setNextCard({count: (nextUp && nextUp.seconds) || 10});
	}, [pos, dur, nextEpisode, onNextEpisode, nextCard, nextUp]);
	const counting = nextCard ? nextCard.count : null;
	useEffect(() => {
		if (counting === null) return undefined;
		if (counting <= 0) {
			goNext();
			return undefined;
		}
		const t = setTimeout(() => setNextCard({count: counting - 1}), 1000);
		timers.current.next = t;
		return () => clearTimeout(t);
	}, [counting, goNext]);

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
	const canSkipIntro = series && !skipDone && pos > 2000 && pos < 6 * 60000;
	// Un film du fournisseur : « Alors, ce film ? » dans ses dernières minutes.
	const voteItem = useMemo(() => (watch && watch.kind === 'movie'
		? {Id: `iptv:movie:${watch.id}`, Type: 'Movie', Name: watch.name, ProviderIds: watch.tmdb ? {Tmdb: watch.tmdb} : {}}
		: null), [watch]);
	const vjodVote = useVjodVote({item: voteItem, currentTime: pos / 1000, duration: dur / 1000, segments: null, enabled: Boolean(voteItem)});
	keysRef.current = {phase, onNext, seekBy, togglePause, showOsd, adSkip, canSkipIntro, skipIntro, nextCard, goNext, dismissNext};

	useEffect(() => {
		const onKey = (e) => {
			const code = e.keyCode || e.which;
			const k = keysRef.current;
			let handled = true;
			if (k.nextCard && (code === KEYS.ENTER || code === KEYS.UP)) {
				if (code === KEYS.ENTER) k.goNext();
				else k.dismissNext();
			} else if (code === KEYS.UP && k.canSkipIntro) {
				k.skipIntro();
			} else if (code === KEYS.ENTER || code === KEYS.PLAY || code === KEYS.PAUSE || code === KEYS.PLAY_PAUSE) {
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
			<VjodVotePrompt visible={vjodVote.visible} onVote={vjodVote.vote} />
			{nextCard && nextEpisode ? (
				<div style={{position: 'absolute', right: 48, bottom: 160, padding: '18px 22px', borderRadius: 14, background: 'rgba(11,11,13,0.9)', color: '#fff', zIndex: 5}}>
					<div style={{fontSize: '1.3rem', fontWeight: 700}}>{`Épisode suivant : S${nextEpisode.season} É${nextEpisode.number}`}</div>
					{nextEpisode.title ? <div style={{fontSize: '1rem', opacity: 0.7, marginTop: 2}}>{nextEpisode.title}</div> : null}
					<div style={{fontSize: '1rem', marginTop: 12}}>{`OK lire (${nextCard.count} s) · ▲ annuler`}</div>
				</div>
			) : null}
			{canSkipIntro && phase === 'playing' ? (
				<div className={css.delayChip} style={{background: C.panel, color: C.ink, top: 'auto', bottom: 160}}>{$L('▲ Passer le générique')}</div>
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
