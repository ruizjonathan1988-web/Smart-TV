import {parseChannelSources, currentSource, sourceDetails, sourceBadges, visibleSources, pickAfterStalls, resolutionLabel} from './maTvSources';

const raw = {
	id: 'tf1', num: 1, name: 'TF1',
	sources: [
		{k: 'a', n: 1, h: 1080, fps: 50, kbps: 6200, ms: 800, ok: true, playing: true, flu: 97},
		{k: 'b', n: 2, h: 720, kbps: 3000, ok: true, pref: true},
		{k: 'c', n: 3, h: 1080, kbps: 6000, ok: true, dup: true},
		{k: 'd', n: 4, quality: 'SD', ok: false},
		{k: 'e', n: 5, h: 2160, kbps: 15000, taken: true}
	]
};

describe('maTvSources', () => {
	const data = parseChannelSources(raw);

	test('lit la réponse de /tv/api/channel comme l’APK', () => {
		expect(data).toMatchObject({id: 'tf1', number: 1, name: 'TF1'});
		expect(data.sources).toHaveLength(5);
		expect(data.sources[1]).toMatchObject({key: 'b', rank: 2, chosen: true, sticky: false});
		expect(parseChannelSources(null)).toBeNull();
	});

	test('la source en lecture, et les mesures en français', () => {
		expect(currentSource(data).key).toBe('a');
		expect(sourceDetails(data.sources[0])).toBe('1080p · 50 i/s · 6,2 Mb/s · 0,8 s · fluidité 97');
		expect(resolutionLabel(data.sources[4])).toBe('4K');
		expect(resolutionLabel({quality: 'ND'})).toBe('');
	});

	test('les pastilles et le rangement des doublons', () => {
		expect(sourceBadges(null, data)).toEqual([]);
		expect(sourceBadges(data.sources[0], data).map((b) => b.label)).toEqual(['en lecture']);
		expect(sourceBadges(data.sources[3], data).map((b) => b.label)).toEqual(['en panne']);
		expect(visibleSources(data, false).map((s) => s.key)).toEqual(['a', 'b', 'd', 'e']);
		expect(visibleSources(data, true)).toHaveLength(5);
	});

	test('après des saccades : même image ou plus légère, jamais en panne, doublon ou occupée', () => {
		expect(pickAfterStalls(data).key).toBe('b');
		expect(pickAfterStalls(data, ['b'])).toBeNull();
	});
});
