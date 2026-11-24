import {iptvFinished, recordIptvSitting} from './iptvLearning';
import {recordIptvTonightSitting as recordSitting} from './tonight/tonightService';

jest.mock('./seerrApi', () => ({getMovie: jest.fn(async () => ({genres: [{name: 'Science Fiction'}], releaseDate: '2021-09-15', voteAverage: 7.8})), getTv: jest.fn()}));
jest.mock('./tonight/tonightService', () => ({loadTonight: jest.fn(async () => ({})), recordIptvTonightSitting: jest.fn()}));

const seerr = jest.requireMock('./seerrApi');
const tonight = jest.requireMock('./tonight/tonightService');

beforeEach(() => {
	seerr.getMovie.mockImplementation(async () => ({genres: [{name: 'Science Fiction'}], releaseDate: '2021-09-15', voteAverage: 7.8}));
	tonight.loadTonight.mockImplementation(async () => ({}));
});

describe('journal du soir pour l’IPTV', () => {
	test('vu jusqu’au générique : 90 % d’un film, 85 % d’un épisode', () => {
		expect(iptvFinished(false, 5400000, 6000000)).toBe(true);
		expect(iptvFinished(false, 3000000, 6000000)).toBe(false);
		expect(iptvFinished(true, 2250000, 2600000)).toBe(true);
	});
	test('un film du fournisseur entre au journal avec la clé TMDB, comme un film du serveur', async () => {
		await recordIptvSitting({watch: {kind: 'movie', id: '42', name: 'Dune', tmdb: '438631'}, startedAt: 1000, posMs: 9000000, durMs: 9300000, watchedMs: 8000000});
		expect(recordSitting).toHaveBeenCalledWith(expect.objectContaining({itemId: 'tmdb:movie:438631', mediaType: 'movie', year: 2021, finished: true, watchedMinutes: 133}));
	});
	test('moins d’une minute ne compte pas', async () => {
		recordSitting.mockClear();
		await recordIptvSitting({watch: {kind: 'movie', id: '1'}, startedAt: 1, posMs: 1, durMs: 2, watchedMs: 30000});
		expect(recordSitting).not.toHaveBeenCalled();
	});
});
