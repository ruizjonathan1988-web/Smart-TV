import {seriesOf, watchMonthFromRows, hoursLabel, loadWatchMonth} from './watchMonth';

describe('watchMonth', () => {
	test('nom de série', () => {
		expect(seriesOf('Malcolm - s07e20 - Le grand jour')).toBe('Malcolm');
		expect(seriesOf('Lupin - Chapitre 3')).toBe('Lupin');
		expect(seriesOf('Dune')).toBe('Dune');
	});

	test('heures par personne, séries et films', () => {
		const m = watchMonthFromRows([
			['Jon', 'Episode', 'Malcolm - s01e01 - A', 1800],
			['Jon', 'Episode', 'Malcolm - s01e02 - B', 1800],
			['Pauline', 'Movie', 'Dune', 9000],
			['Jon', 'Movie', 'Dune', 0],
			['bad']
		]);
		expect(m.totalHours).toBe(3.5);
		expect(m.people[0]).toEqual(['Pauline', 2.5]);
		expect(m.series).toEqual([['Malcolm', 1]]);
		expect(m.films).toEqual([['Dune', 2.5]]);
	});

	test('libellés', () => {
		expect(hoursLabel(0.75)).toBe('45 min');
		expect(hoursLabel(12.5)).toBe('12 h 30');
	});

	test('erreurs de Jellyfin', async () => {
		expect((await loadWatchMonth({serverUrl: 'x', accessToken: 't', fetchImpl: () => Promise.resolve({status: 404})})).error).toMatch(/Playback Reporting/);
		const ok = await loadWatchMonth({serverUrl: 'x', accessToken: 't', fetchImpl: () => Promise.resolve({status: 200, json: () => Promise.resolve({results: [['a', 'Movie', 'F', 3600]]})})});
		expect(ok.month.totalHours).toBe(1);
	});
});
