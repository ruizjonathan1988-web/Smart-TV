import {addTiming, callKind, formatMs, registerJellyfinServer, resetTimings, serviceOf, timeRequest, timingLines, timingSummary} from './vjodTimings';

describe('vjodTimings', () => {
	beforeEach(() => resetTimings());

	test('reconnaît chaque service', () => {
		registerJellyfinServer('https://seed.example.com/jellyfin');
		expect(serviceOf('https://seed.example.com/Users/abc/Items?Limit=5')).toBe('Jellyfin');
		expect(serviceOf('https://seed.example.com/tv/api/chans?cat=all')).toBe('Ma TV');
		expect(serviceOf('https://seed.example.com/tv/api/vod/find?q=x')).toBe('Ma TV (VOD)');
		expect(serviceOf('https://seerr.example.com/api/v1/request')).toBe('Seerr');
		expect(serviceOf('https://seed.example.com/Items/abc/Images/Primary')).toBeNull();
		expect(serviceOf('https://seed.example.com/Sessions/Playing/Progress')).toBeNull();
		expect(serviceOf('https://seed.example.com/tv/play/12.ts')).toBeNull();
		expect(serviceOf('https://ailleurs.example.com/x')).toBeNull();
	});

	test('nomme l\'appel sans ses identifiants', () => {
		expect(callKind('https://h/Users/0123456789abcdef0123/Items/42?x=1')).toBe('/Users/…/Items/…');
	});

	test('médiane, lent et plus lent appel', () => {
		[100, 200, 300, 400, 500, 600, 700, 800, 900, 2000].forEach((ms, i) => addTiming('Jellyfin', ms, `/appel${i}`));
		addTiming('Seerr', 50);
		expect(timingSummary().Jellyfin).toEqual({median: 600, p90: 900, count: 10, slowest: '/appel9'});
		expect(timingLines()[0]).toBe('Jellyfin : 600 ms d’habitude, 900 ms quand c’est lent (10 réponses)');
		expect(timingLines()).toHaveLength(2);
		expect(formatMs(1234)).toBe('1,2 s');
	});

	test('garde les 60 dernières réponses', () => {
		for (let i = 0; i < 70; i++) addTiming('Ma TV', i);
		expect(timingSummary()['Ma TV'].count).toBe(60);
	});

	test('chronomètre aussi les échecs', async () => {
		await timeRequest('https://s/tv/api/cats', () => Promise.resolve('ok'));
		await expect(timeRequest('https://s/tv/api/cats', () => Promise.reject(new Error('non')))).rejects.toThrow('non');
		expect(timingSummary()['Ma TV'].count).toBe(2);
		expect(await timeRequest('https://s/autre', () => Promise.resolve(1))).toBe(1);
	});
});
