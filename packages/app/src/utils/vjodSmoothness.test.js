import {addFrame, resetSmoothness, screenLabel, slowPercent, smoothnessLines} from './vjodSmoothness';

describe('vjodSmoothness', () => {
	beforeEach(() => resetSmoothness());

	test('part d\'images saccadées par écran', () => {
		for (let i = 0; i < 40; i++) addFrame('Fiche', i < 10 ? 120 : 16);
		for (let i = 0; i < 40; i++) addFrame('Accueil', 16);
		addFrame('Lecteur', 200);
		expect(slowPercent('Fiche')).toBe(25);
		expect(slowPercent('Lecteur')).toBeNull();
		expect(smoothnessLines()).toEqual([
			'Fiche : 25 % d’images saccadées, pire 120 ms (40 images)',
			'Accueil : 0 % d’images saccadées, pire 16 ms (40 images)'
		]);
	});

	test('ne garde que quatorze écrans', () => {
		for (let s = 0; s < 15; s++) addFrame(`É${s}`, 16);
		addFrame('É14', 16);
		for (let i = 0; i < 40; i++) addFrame('É14', 16);
		expect(slowPercent('É14')).toBe(0);
	});

	test('nomme les panneaux', () => {
		expect(screenLabel('DETAILS')).toBe('Fiche');
		expect(screenLabel(undefined)).toBe('Accueil');
	});
});
