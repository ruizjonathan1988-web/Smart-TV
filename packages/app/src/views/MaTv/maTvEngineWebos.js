// Moteur de lecture Ma TV sur LG : élément <video> partagé, servi au pipeline
// natif Starfish qui lit le MPEG-TS progressif. On réutilise l'élément unique de
// l'app pour ne pas épuiser les décodeurs matériels des vieux webOS.
import {getSharedVideoElement, cleanupVideoElement, waitForDecoderRelease, keepScreenOn} from '../../services/video';

export const createEngine = ({container, onState}) => {
	let generation = 0;
	const video = getSharedVideoElement();
	video.onplaying = null;
	video.onended = null;
	video.onerror = null;
	video.className = '';
	video.muted = false;
	video.volume = 1;
	if (container && !container.contains(video)) container.appendChild(video);

	const emit = (gen, state) => {
		if (gen === generation) onState(state);
	};

	let listeners = {};
	const bind = (gen) => {
		Object.keys(listeners).forEach((name) => video.removeEventListener(name, listeners[name]));
		listeners = {
			waiting: () => emit(gen, 'buffering'),
			playing: () => emit(gen, 'playing'),
			timeupdate: () => emit(gen, 'playing'),
			ended: () => emit(gen, 'ended'),
			error: () => emit(gen, 'error')
		};
		Object.keys(listeners).forEach((name) => video.addEventListener(name, listeners[name]));
	};

	const open = async (url) => {
		const gen = ++generation;
		bind(gen);
		emit(gen, 'buffering');
		if (video.getAttribute('src')) await cleanupVideoElement(video);
		await waitForDecoderRelease();
		if (gen !== generation) return;
		video.autoplay = true;
		video.src = url;
		// Indice de type pour Starfish (même usage que le lecteur webOS).
		video.type = 'video/mp2t';
		video.load();
		const started = video.play();
		if (started && typeof started.catch === 'function') started.catch(() => {});
		keepScreenOn(true);
	};

	return {
		open,
		pause: () => video.pause(),
		resume: () => {
			const p = video.play();
			if (p && typeof p.catch === 'function') p.catch(() => {});
		},
		destroy: () => {
			generation++;
			Object.keys(listeners).forEach((name) => video.removeEventListener(name, listeners[name]));
			listeners = {};
			cleanupVideoElement(video);
			if (container && container.contains(video)) container.removeChild(video);
			keepScreenOn(false);
		},
		needsTransparency: false
	};
};

export default createEngine;
