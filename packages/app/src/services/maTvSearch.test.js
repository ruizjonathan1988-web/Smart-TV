import {normalizeChannelQuery, searchChannels} from './maTvSearch';

describe('maTvSearch', () => {
	const all = [
		{id: '1', num: 1, name: 'TF1 HD', now: {t: 'Journal'}},
		{id: '2', num: 12, name: 'France 2', next: {t: 'PSG – OM'}},
		{id: '3', num: 3, name: 'Télé Melody'}
	];

	test('normalisation', () => {
		expect(normalizeChannelQuery('TF-1 ')).toBe('tf1');
		expect(normalizeChannelQuery('Télé')).toBe('tele');
	});

	test('par nom, numéro ou programme', () => {
		expect(searchChannels(all, 'tf 1').map((c) => c.id)).toEqual(['1']);
		expect(searchChannels(all, '12').map((c) => c.id)).toEqual(['2']);
		expect(searchChannels(all, 'psg').map((c) => c.id)).toEqual(['2']);
		expect(searchChannels(all, 'tele').map((c) => c.id)).toEqual(['3']);
		expect(searchChannels(all, '  ')).toEqual([]);
	});
});
