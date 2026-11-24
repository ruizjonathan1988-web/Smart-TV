import {addFrame, check, noteChange, opened, openMs, resetSmoothness, screenLabel, settled, slowPercent, smoothnessLines} from './vjodSmoothness';

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

describe('temps d\'ouverture (VJOD 5.6)', () => {
	beforeEach(() => resetSmoothness());

	test('posé après 300 ms sans changement', () => {
		opened('Fiche', 1000);
		noteChange(1400);
		noteChange(2200);
		check(2300);
		expect(openMs('Fiche')).toBeNull();
		check(2550);
		expect(openMs('Fiche')).toBe(1200);
		expect(smoothnessLines()).toEqual(['Fiche : prêt en 1,2 s (1 ouvertures)']);
	});

	test('un écran qui bouge sans cesse n\'est pas mesuré', () => {
		opened('TV en direct', 0);
		for (let t = 100; t <= 15000; t += 100) noteChange(t);
		check(15100);
		expect(openMs('TV en direct')).toBeNull();
	});

	test('médiane des ouvertures, jointe à la fluidité', () => {
		[800, 400, 2000].forEach((ms) => settled('Accueil', ms));
		for (let i = 0; i < 40; i++) addFrame('Accueil', 16);
		expect(openMs('Accueil')).toBe(800);
		expect(smoothnessLines()).toEqual(['Accueil : 0 % d’images saccadées, pire 16 ms (40 images) · prêt en 0,8 s (3 ouvertures)']);
	});
});
