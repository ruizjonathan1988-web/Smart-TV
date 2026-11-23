/* global __dirname */
// Chaque clé de texte de la console (pages, services admin*) a son français dans adminStrings.js :
// une clé absente s'afficherait telle quelle (« adminActivityMinutesShort »).
import STRINGS from './adminStrings';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..');

const walk = (dir) => fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
	const full = path.join(dir, e.name);
	return e.isDirectory() ? walk(full) : [full];
});

const files = [
	...walk(__dirname),
	...fs.readdirSync(path.join(SRC, 'services')).filter((f) => /^admin.*\.js$/.test(f)).map((f) => path.join(SRC, 'services', f))
].filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && !f.endsWith('adminStrings.js'));

const keysOf = (source) => {
	const keys = new Set();
	const add = (re) => {
		let m;
		while ((m = re.exec(source))) keys.add(m[1]);
	};
	add(/\bt\('([A-Za-z0-9_]+)'/g);
	add(/'((?:admin|tv)[A-Z][A-Za-z0-9_]*)'/g);
	return keys;
};

describe('textes de la console', () => {
	test('aucune clé sans français', () => {
		const missing = [];
		files.forEach((file) => {
			keysOf(fs.readFileSync(file, 'utf8')).forEach((key) => {
				if (STRINGS[key] === undefined) missing.push(`${path.relative(SRC, file)}: ${key}`);
			});
		});
		expect(missing).toEqual([]);
	});

	test('les corrections des traductions de l\'APK', () => {
		expect(STRINGS.adminActivityDaysShort).toBe('il y a {days} j');
		expect(STRINGS.sessions).toBe('Sessions');
		expect(STRINGS.actions).toBe('Actions');
		Object.entries(STRINGS).forEach(([key, text]) => {
			expect({key, text: /\{\w+\}[a-z] il y a/.test(text) || /^(Séances|Actes)$/.test(text)}).toEqual({key, text: false});
		});
	});
});
