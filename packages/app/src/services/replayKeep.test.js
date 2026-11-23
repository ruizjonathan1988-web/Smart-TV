import {seerrMatch, requestSeerrSeason} from './replayKeep';

jest.mock('./seerrApi', () => ({}));

const api = (over = {}) => ({
	search: jest.fn(async () => ({results: [{id: 1, mediaType: 'movie', title: 'Fort Boyard'}, {id: 7, mediaType: 'tv', name: 'Fort Boyard'}]})),
	getTv: jest.fn(async () => ({numberOfSeasons: 35})),
	requestTv: jest.fn(async () => ({})),
	...over
});

describe('garder une émission par Seerr', () => {
	test('la série du même nom, et la saison de l’épisode ou la dernière', async () => {
		expect(await seerrMatch({show: 'Fort boyard', season: 2}, api())).toEqual({tmdb: 7, name: 'Fort Boyard', season: 2});
		expect(await seerrMatch({show: 'Fort Boyard'}, api())).toEqual({tmdb: 7, name: 'Fort Boyard', season: 35});
		expect(await seerrMatch({show: 'Inconnue'}, api())).toBe(null);
	});
	test('la réponse dite en français, déjà demandée comprise', async () => {
		const m = {tmdb: 7, name: 'Fort Boyard', season: 35};
		expect(await requestSeerrSeason(m, api())).toBe('« Fort Boyard » saison 35 demandée : elle arrivera dans ta bibliothèque.');
		expect(await requestSeerrSeason(m, api({requestTv: jest.fn(async () => {
			throw new Error('409 Conflict');
		})}))).toBe('« Fort Boyard » saison 35 est déjà demandée.');
	});
});
