import {isProviderStreamPath, isProviderStream} from './deadStream';

jest.mock('./seerrApi', () => ({__esModule: true, default: {}}));

describe('flux du fournisseur', () => {
	test('reconnu au chemin', () => {
		expect(isProviderStreamPath('/media/Films/Dune (2021)/Dune.strm')).toBe(true);
		expect(isProviderStreamPath('/media/Films IPTV/Dune/Dune.mkv')).toBe(true);
		expect(isProviderStreamPath('/media/Films/Dune/Dune.mkv')).toBe(false);
		expect(isProviderStreamPath('')).toBe(false);
		expect(isProviderStream({MediaSources: [{Path: '/x/Xtream/a.mp4'}]})).toBe(true);
	});
});
