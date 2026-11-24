import {relayRequestFromUrl, relaySourceFromAnswer, relayStopUrl} from './maTvRelay';

describe('maTvRelay', () => {
	test('un film du fournisseur via Ma TV', () => {
		expect(relayRequestFromUrl('https://box.example/matv/tv/xc/movie/vjod/CLE/123.mkv?q=1080&src=2')).toEqual({
			server: {url: 'https://box.example/matv', key: 'CLE'},
			query: {kind: 'movie', id: '123', ext: 'mkv', q: '1080', src: '2'}
		});
	});

	test('un replay et un enregistrement', () => {
		expect(relayRequestFromUrl('https://b/tv/replay/tf1.ts?start=100&dur=3600&k=K')).toEqual({
			server: {url: 'https://b', key: 'K'},
			query: {kind: 'replay', id: 'tf1', ext: 'ts', at: '100', dur: '3600'}
		});
		expect(relayRequestFromUrl('https://b/tv/rec/42.ts?k=K').query).toEqual({kind: 'rec', id: '42', ext: 'ts'});
		expect(relayRequestFromUrl('https://b/tv/replay/tf1.ts?k=K')).toBeNull();
		expect(relayRequestFromUrl('https://autre/video.mkv')).toBeNull();
	});

	test('la réponse de /tv/api/cast', () => {
		expect(relaySourceFromAnswer(200, {url: 'https://b/tv/cast/t/index.m3u8', offset: 1795})).toEqual({url: 'https://b/tv/cast/t/index.m3u8', offsetMs: 1795000});
		expect(relaySourceFromAnswer(500, {error: 'source injoignable'})).toEqual({error: 'Ma TV : Source injoignable.'});
		expect(relaySourceFromAnswer(200, {url: 'http://pas-https'})).toBeNull();
	});

	test('l’adresse qui arrête la préparation', () => {
		expect(relayStopUrl('https://b/tv/cast/t/index.m3u8?x=1')).toBe('https://b/tv/cast/t/stop');
		expect(relayStopUrl('https://b/tv/xc/movie/1.mkv')).toBeNull();
	});
});
