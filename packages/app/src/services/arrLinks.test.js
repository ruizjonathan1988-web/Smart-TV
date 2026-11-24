import {buildArrUrl, arrUrlForRequest, resetArrLinksForTests} from './arrLinks';

describe('liens Radarr et Sonarr', () => {
	test('l\'adresse externe d\'abord, sinon hôte, port et chemin', () => {
		const servers = [
			{id: 1, externalUrl: 'https://radarr.example.org/'},
			{id: 2, hostname: '10.0.0.5', port: 8989, baseUrl: '/sonarr', useSsl: false}
		];
		expect(buildArrUrl(servers, {serviceId: 1, slug: 'dune-2021', isMovie: true})).toBe('https://radarr.example.org/movie/dune-2021');
		expect(buildArrUrl(servers, {serviceId: 2, slug: 'the-office', isMovie: false})).toBe('http://10.0.0.5:8989/sonarr/series/the-office');
		expect(buildArrUrl(servers, {serviceId: 9, slug: 'x', isMovie: true})).toBe('https://radarr.example.org/movie/x');
		expect(buildArrUrl(servers, {serviceId: 1, slug: '  ', isMovie: true})).toBe(null);
		expect(buildArrUrl([{id: 3, hostname: ''}], {serviceId: 3, slug: 'x', isMovie: true})).toBe(null);
	});

	test('une demande : son serveur, la 4K à part, listes lues une fois', async () => {
		resetArrLinksForTests();
		const seerr = {getSonarrSettings: jest.fn().mockResolvedValue([{id: 4, hostname: 'h', useSsl: true}]), getRadarrSettings: jest.fn()};
		const request = {type: 'tv', is4k: true, media: {serviceId4k: 4, externalServiceSlug4k: 'slug-4k', externalServiceSlug: 'slug'}};
		expect(await arrUrlForRequest(seerr, request)).toBe('https://h/series/slug-4k');
		await arrUrlForRequest(seerr, request);
		expect(seerr.getSonarrSettings).toHaveBeenCalledTimes(1);
		expect(seerr.getRadarrSettings).not.toHaveBeenCalled();
		const refused = {getRadarrSettings: jest.fn().mockRejectedValue(new Error('403'))};
		expect(await arrUrlForRequest(refused, {type: 'movie', media: {externalServiceSlug: 'x'}})).toBe(null);
	});
});
