import {parseAgeInfo, ageAllows, createAgeGate, withAgeGate} from './seerrAgeGate';
import {parentalFilterFromRatings, NO_PARENTAL_FILTER} from '../utils/parentalFilter';

jest.mock('./seerrApi', () => ({__esModule: true, default: {}}));

const card = (id, type = 'movie', extra = {}) => ({Id: `seerr-${type}-${id}`, _seerr: true, _seerrType: 'item', _seerrRaw: {mediaId: id, mediaType: type}, ...extra});

describe('contrôle d\'âge des titres Seerr', () => {
	test('la classification : la France d\'abord, puis les autres pays', () => {
		const film = {releases: {results: [
			{iso_3166_1: 'US', release_dates: [{certification: 'R'}]},
			{iso_3166_1: 'FR', release_dates: [{certification: ''}, {certification: '16'}]}
		]}, genres: [{id: 18}]};
		expect(parseAgeInfo(film)).toEqual({certification: '16', genres: [18]});
		expect(parseAgeInfo({contentRatings: {results: [{iso_3166_1: 'GB', rating: '15'}]}}).certification).toBe('15');
		expect(parseAgeInfo({}).certification).toBe(null);
	});

	test('sans classification, seuls les genres pour enfants passent', () => {
		const filter = parentalFilterFromRatings(['R']);
		expect(ageAllows(filter, {certification: null, genres: [16]})).toBe(true);
		expect(ageAllows(filter, {certification: null, genres: [18]})).toBe(false);
		expect(ageAllows(filter, {certification: 'R', genres: [16]})).toBe(false);
		expect(ageAllows(filter, {certification: 'PG', genres: []})).toBe(true);
	});

	test('caché tant que la classification n\'est pas connue, puis rangées refiltrées', async () => {
		jest.useFakeTimers();
		const lookup = jest.fn((type, id) => Promise.resolve(id === 1 ? {certification: 'PG', genres: []} : {certification: 'R', genres: []}));
		const gate = createAgeGate(lookup);
		const filter = parentalFilterFromRatings(['R']);
		const heard = jest.fn();
		gate.subscribe(heard);
		const allows = (type, id) => gate.allows(type, id, filter);
		const rows = [
			{id: 'a', items: [card(1), card(2), {Id: 'lib', Type: 'Movie'}, card(3, 'movie', {_vjodReplay: {kind: 'mine'}})]},
			{id: 'b', items: [card(2)]}
		];
		expect(withAgeGate(rows, allows).map((r) => r.items.length)).toEqual([2]);
		expect(gate.allows('movie', 9, NO_PARENTAL_FILTER)).toBe(true);
		await Promise.resolve();
		await Promise.resolve();
		jest.advanceTimersByTime(300);
		expect(heard).toHaveBeenCalled();
		const after = withAgeGate(rows, allows);
		expect(after).toHaveLength(1);
		expect(after[0].items.map((i) => i.Id)).toEqual(['seerr-movie-1', 'lib', 'seerr-movie-3']);
		expect(lookup).toHaveBeenCalledTimes(2);
		jest.useRealTimers();
	});
});
