const test = require('node:test');
const assert = require('node:assert');
const {callsOf, missingFrench, isFrench, looksEnglish} = require('./check-fr-strings.js');

test('lit les deux formes de $L', () => {
	const src = "a = $L('Delete Item?');\nb = $L({key: 'quickConnectAuthorize', value: 'Authorize'});\nc = $L('Ma liste \\u00b7 suite');";
	assert.deepStrictEqual(callsOf(src, 'x.js').map((c) => [c.key, c.text, c.line, Boolean(c.keyed)]), [
		['Delete Item?', 'Delete Item?', 1, false],
		['Ma liste · suite', 'Ma liste · suite', 3, false],
		['quickConnectAuthorize', 'Authorize', 2, true]
	]);
});

test('français ou anglais', () => {
	assert.ok(isFrench('Garder les prochains épisodes'));
	assert.ok(isFrench('Pas pour nous'));
	assert.ok(!isFrench('Delete Item?'));
	assert.ok(looksEnglish('{users} watched today'));
	assert.ok(!looksEnglish('Favoris'));
});

test('signale seulement ce qui manque vraiment', () => {
	const calls = [
		{key: 'Delete Item?', text: 'Delete Item?'},
		{key: 'Sign Out', text: 'Sign Out'},
		{key: 'Favoris', text: 'Favoris'},
		{key: 'Grille', text: 'Grille'},
		{key: 'quickConnectX', text: 'Authorize', keyed: true},
		{key: 'Seerr', text: 'Seerr'},
		{key: '4K · HDR', text: '4K · HDR'},
		{key: '{n} / {m}', text: '{n} / {m}'}
	];
	const fr = {'Delete Item?': 'Supprimer ?'};
	const elsewhere = new Set(['Sign Out']);
	assert.deepStrictEqual(missingFrench(calls, fr, elsewhere).map((c) => c.key), ['Sign Out', 'quickConnectX']);
});
