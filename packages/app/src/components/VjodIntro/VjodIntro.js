// L'ouverture de VJOD au lancement (vjod_intro.dart) : une animation plein
// écran avec son son. N'importe quelle touche la passe.
import {useCallback, useEffect, useRef} from 'react';
import {loadKit} from './introKit';
import {IntroPainter} from './introPainter';
import {styleById} from './introStyles';

import drop from './sounds/intro_drop.mp3';
import terminal from './sounds/intro_terminal.mp3';
import hacker from './sounds/intro_hacker.mp3';
import plateforme from './sounds/intro_plateforme.mp3';
import signal from './sounds/intro_signal.mp3';
import lame from './sounds/intro_lame.mp3';
import ruban from './sounds/intro_ruban.mp3';
import battement from './sounds/intro_battement.mp3';

const SOUNDS = {drop, terminal, hacker, plateforme, signal, lame, ruban, battement};

const overlay = {position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', background: '#040404', zIndex: 10000};

// Une seule fois par lancement (pas à chaque changement de profil).
export const introState = {played: false};

const VjodIntro = ({styleId, onDone, muted = false}) => {
	const canvasRef = useRef(null);
	const doneRef = useRef(false);
	const audioRef = useRef(null);
	const onDoneRef = useRef(onDone);
	onDoneRef.current = onDone;

	const finish = useCallback(() => {
		if (doneRef.current) return;
		doneRef.current = true;
		onDoneRef.current?.();
	}, []);

	useEffect(() => {
		introState.played = true;
		const style = styleById(styleId);
		if (!style) {
			finish();
			return undefined;
		}
		let frame = 0;
		let alive = true;
		const timeout = setTimeout(() => {
			if (alive && !frame) finish();
		}, 4000);
		loadKit().then((kit) => {
			if (!alive || doneRef.current) return;
			const cv = canvasRef.current;
			if (!cv) return finish();
			const W = window.innerWidth || 1920, H = window.innerHeight || 1080;
			cv.width = W;
			cv.height = H;
			const ctx = cv.getContext('2d');
			const painter = new IntroPainter(kit);
			if (!muted) {
				try {
					const a = new window.Audio(SOUNDS[style.id]);
					audioRef.current = a;
					const p = a.play();
					if (p && p.catch) p.catch(() => {});
				} catch (e) {
					// Sans son, l'ouverture joue quand même.
				}
			}
			const start = window.performance.now();
			const tick = (now) => {
				if (!alive || doneRef.current) return;
				const t = (now - start) / 1000;
				if (t >= style.seconds) {
					painter.paint(ctx, style.id, style.seconds, W, H);
					finish();
					return;
				}
				painter.paint(ctx, style.id, t, W, H);
				frame = window.requestAnimationFrame(tick);
			};
			frame = window.requestAnimationFrame(tick);
		}).catch(finish);
		return () => {
			alive = false;
			clearTimeout(timeout);
			if (frame) window.cancelAnimationFrame(frame);
			// La queue du son continue sur l'accueil, puis s'arrête.
			const a = audioRef.current;
			if (a) setTimeout(() => a.pause(), 4000);
		};
	}, [styleId, muted, finish]);

	useEffect(() => {
		const skip = (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (audioRef.current) audioRef.current.pause();
			finish();
		};
		window.addEventListener('keydown', skip, true);
		return () => window.removeEventListener('keydown', skip, true);
	}, [finish]);

	return (
		<div style={overlay} onClick={finish}>
			<canvas ref={canvasRef} style={{width: '100%', height: '100%', display: 'block'}} />
		</div>
	);
};

export default VjodIntro;
