import {chosenStyle, currentStyle, INTRO_STYLES} from './introStyles';
import {CURVES, seg, torrentLine} from './introPainter';

describe('ouvertures de VJOD', () => {
	test('Le drop par défaut, rien pour « Aucune »', () => {
		expect(chosenStyle({}).id).toBe('drop');
		expect(chosenStyle({vjodIntro: 'lame'}).id).toBe('lame');
		expect(chosenStyle({vjodIntro: 'none'})).toBe(null);
		expect(currentStyle({vjodIntro: 'none', vjodIntroRotation: 'eachLaunch'})).toBe(null);
	});
	test('chaque jour, une autre ; à chaque lancement, au hasard', () => {
		const day1 = currentStyle({vjodIntroRotation: 'eachDay'}, new Date(2026, 10, 23));
		const day2 = currentStyle({vjodIntroRotation: 'eachDay'}, new Date(2026, 10, 24));
		expect(day1.id).not.toBe(day2.id);
		expect(currentStyle({vjodIntroRotation: 'eachLaunch'}, new Date(), () => 0.99).id).toBe(INTRO_STYLES[INTRO_STYLES.length - 1].id);
	});
	test('les courbes partent de 0 et arrivent à 1, comme dans Flutter', () => {
		for (const c of Object.values(CURVES)) {
			expect(c(0)).toBe(0);
			expect(c(1)).toBe(1);
		}
		expect(CURVES.oc(0.5)).toBeGreaterThan(0.7);
		expect(seg(0.5, 0, 1)).toBe(0.5);
		expect(seg(2, 0, 1)).toBe(1);
	});
	test('le torrent de données redonne la même ligne', () => {
		expect(torrentLine(6, 4)).toBe(torrentLine(6, 4));
		expect(torrentLine(0, 11)).toMatch(/^\[ OK \] source 01\/30/);
	});
});
