import {fuseCharts, takeTurns, chartPicks, isOutAtHome, nextInSagas, isComing} from './chartRowBuilders';

jest.mock('../../services/storage', () => ({getFromStorage: () => Promise.resolve(null), saveToStorage: () => Promise.resolve()}));

const NOW = Date.parse('2026-11-23T20:00:00Z');
const DAY = 86400000;
const mk = (id, over = {}) => ({id, posterPath: '/p', ...over});

describe('classements et suites', () => {
	test('fusion des classements', () => {
		const fused = fuseCharts([[mk(1), mk(2), mk(3)], [mk(2), mk(4)]]);
		expect(fused.map((i) => i.id)).toEqual([2, 1, 4, 3]);
		expect(chartPicks([mk(1), mk(1), {id: 2}, mk(3)]).map((i) => i.id)).toEqual([1, 3]);
		expect(takeTurns([[mk(1), mk(2)], [mk(3), mk(1)]]).map((i) => i.id)).toEqual([1, 3, 2]);
	});

	test('sorti à la maison', () => {
		const rel = (type, days) => ({releases: {results: [{release_dates: [{type, release_date: new Date(NOW - days * DAY).toISOString()}]}]}});
		expect(isOutAtHome(rel(4, 1), NOW)).toBe(true);
		expect(isOutAtHome(rel(3, 30), NOW)).toBe(false);
		expect(isOutAtHome(rel(3, 200), NOW)).toBe(true);
		expect(isOutAtHome({}, NOW)).toBe(true);
	});

	test('la suite d\'une saga', () => {
		const parts = [mk(1, {releaseDate: '2001-01-01', title: 'Un'}), mk(2, {releaseDate: '2003-01-01'}), mk(3, {releaseDate: '2005-01-01'})];
		const picks = nextInSagas({watched: [{tmdbId: 1, title: 'Un'}], collectionOfFilm: {1: 9}, collections: {9: {name: 'S', parts}}, now: NOW});
		expect(picks).toHaveLength(1);
		expect(picks[0].item.id).toBe(2);
		expect(picks[0].afterTitle).toBe('Un');
	});

	test('à venir dans l\'année', () => {
		expect(isComing(mk(1, {releaseDate: new Date(NOW + 30 * DAY).toISOString()}), NOW)).toBe(true);
		expect(isComing(mk(1, {releaseDate: new Date(NOW - DAY).toISOString()}), NOW)).toBe(false);
		expect(isComing(mk(1, {releaseDate: new Date(NOW + 400 * DAY).toISOString()}), NOW)).toBe(false);
	});
});
