import {releasesSince, compareVersions, whatsNewText} from './vjodTvChanges';

const releases = [
	{version: '1.2', changes: ['c']},
	{version: '1.1', changes: []},
	{version: '1.0', changes: ['a', 'b']}
];

describe('vjodTvChanges', () => {
	test('compare les versions chiffre par chiffre', () => {
		expect(compareVersions('1.10', '1.9')).toBe(1);
		expect(compareVersions('1.0', '1')).toBe(0);
	});
	test('montre ce qui a changé depuis la version vue, sans les versions vides', () => {
		expect(releasesSince('1.0', '1.2', releases).map((r) => r.version)).toEqual(['1.2']);
		expect(releasesSince(null, '1.0', releases).map((r) => r.version)).toEqual(['1.0']);
		expect(releasesSince('1.2', '1.2', releases)).toEqual([]);
	});
	test('le texte met la version devant chaque bloc quand il y en a plusieurs', () => {
		expect(whatsNewText([releases[0], releases[2]])).toBe('VJOD TV 1.2\n• c\nVJOD TV 1.0\n• a\n• b');
		expect(whatsNewText([releases[2]])).toBe('• a\n• b');
	});
});
