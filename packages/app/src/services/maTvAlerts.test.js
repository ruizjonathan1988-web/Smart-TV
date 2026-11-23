import {isAdministrator, newMaTvAlerts, parseMaTvAlerts} from './maTvAlerts';

describe('maTvAlerts', () => {
	test('lit les alertes et ignore ce qui est mal formé', () => {
		expect(parseMaTvAlerts({alerts: [
			{id: 'n1', kind: 'night', title: 'Nuit ratée', text: 'Tests de 3 h en échec'},
			{id: 7, title: 'Compte'},
			{id: '', title: 'Sans id'},
			{id: 'x'},
			null
		]})).toEqual([
			{id: 'n1', kind: 'night', title: 'Nuit ratée', text: 'Tests de 3 h en échec'},
			{id: '7', kind: '', title: 'Compte', text: ''}
		]);
		expect(parseMaTvAlerts(null)).toEqual([]);
		expect(parseMaTvAlerts({alerts: 'non'})).toEqual([]);
	});

	test('chaque alerte une seule fois', () => {
		const alerts = parseMaTvAlerts({alerts: [{id: 'a', title: 'A'}, {id: 'b', title: 'B'}]});
		expect(newMaTvAlerts(alerts, ['a'])).toEqual({fresh: [alerts[1]], shown: ['a', 'b']});
		expect(newMaTvAlerts(alerts, ['a', 'b']).fresh).toEqual([]);
	});

	test('garde les derniers identifiants vus', () => {
		const shown = Array.from({length: 60}, (_, i) => `old${i}`);
		const next = newMaTvAlerts([{id: 'neuf', title: 'N'}], shown);
		expect(next.shown).toHaveLength(60);
		expect(next.shown[59]).toBe('neuf');
		expect(next.shown[0]).toBe('old1');
	});

	test('administrateur seulement', () => {
		expect(isAdministrator({Policy: {IsAdministrator: true}})).toBe(true);
		expect(isAdministrator({Policy: {}})).toBe(false);
		expect(isAdministrator(null)).toBe(false);
	});
});
