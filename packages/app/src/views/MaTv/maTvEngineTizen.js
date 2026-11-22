// Moteur de lecture Ma TV sur Samsung : AVPlay natif, qui lit le MPEG-TS brut
// de /tv/play/{id}.ts directement. L'image est rendue SOUS le moteur web : le
// lecteur rend son conteneur (et ses ancêtres) transparents.
import {
	initTizenAPI, keepScreenOn,
	avplayOpen, avplayPrepare, avplayPlay, avplayPause, avplayStop, avplayClose,
	avplaySetListener, avplaySetDisplayMethod, avplaySetBufferingParams, avplaySetStreamingProperty,
	setDisplayWindow
} from '@moonfin/platform-tizen/video';

const FULL_SCREEN = {x: 0, y: 0, width: 1920, height: 1080};
const PREPARE_TIMEOUT_MS = 20000;

export const createEngine = ({onState}) => {
	// Chaque ouverture a sa génération : un rappel d'une chaîne quittée
	// (zapping rapide) ne remonte jamais sur la suivante.
	let generation = 0;
	let ready = false;

	const emit = (gen, state) => {
		if (gen === generation) onState(state);
	};

	const release = () => {
		ready = false;
		avplayStop();
		avplayClose();
	};

	const open = async (url) => {
		const gen = ++generation;
		release();
		await initTizenAPI();
		if (gen !== generation) return;
		emit(gen, 'buffering');
		try {
			avplayOpen(url);
			avplaySetDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
			setDisplayWindow(FULL_SCREEN);
			avplaySetBufferingParams({initialSeconds: 4, resumeSeconds: 4, timeoutSeconds: 10});
			avplaySetStreamingProperty('USER_AGENT', 'VJOD-TV');
			avplaySetListener({
				onbufferingstart: () => emit(gen, 'buffering'),
				onbufferingcomplete: () => emit(gen, 'playing'),
				oncurrentplaytime: () => emit(gen, 'playing'),
				onstreamcompleted: () => emit(gen, 'ended'),
				onerror: () => emit(gen, 'error'),
				onevent: () => {},
				onsubtitlechange: () => {},
				ondrmevent: () => {}
			});
			let timer;
			try {
				await Promise.race([
					avplayPrepare(),
					new Promise((resolve, reject) => {
						timer = setTimeout(() => reject(new Error('préparation trop longue')), PREPARE_TIMEOUT_MS);
					})
				]);
			} finally {
				clearTimeout(timer);
			}
			if (gen !== generation) return;
			ready = true;
			avplayPlay();
			keepScreenOn(true);
		} catch (e) {
			console.warn('[MaTv] AVPlay :', e && e.message);
			emit(gen, 'error');
		}
	};

	return {
		open,
		pause: () => {
			if (ready) avplayPause();
		},
		resume: () => {
			if (ready) avplayPlay();
		},
		destroy: () => {
			generation++;
			release();
			keepScreenOn(false);
		},
		// AVPlay dessine derrière la page : il faut des fonds transparents.
		needsTransparency: true
	};
};

export default createEngine;
