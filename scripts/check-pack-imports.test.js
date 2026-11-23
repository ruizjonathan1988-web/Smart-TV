const test = require('node:test');
const assert = require('node:assert');
const {brokenImports} = require('./check-pack-imports.js');

test('repère les importations cassées que webpack ne fait qu\'avertir', () => {
	const log = [
		'Creating an optimized production build...',
		'Compiled with warnings:',
		'',
		"Attempted import error: 'nopeMissing' is not exported from '../../services/replayKeep' (imported as 'nopeMissing').",
		"export 'seerrMatch' (imported as 'seerrMatch') was not found in '../../services/replayKeep' (possible exports: queryFor)",
		"export 'default' (imported as 'X') was not found in './X'",
		'File sizes after gzip:'
	].join('\n');
	assert.deepStrictEqual(brokenImports(log), [
		"Attempted import error: 'nopeMissing' is not exported from '../../services/replayKeep' (imported as 'nopeMissing').",
		"export 'seerrMatch' (imported as 'seerrMatch') was not found in '../../services/replayKeep' (possible exports: queryFor)",
		"export 'default' (imported as 'X') was not found in './X'"
	]);
});

test('une sortie propre passe', () => {
	assert.deepStrictEqual(brokenImports('Compiled successfully.\nFile sizes after gzip:'), []);
	assert.deepStrictEqual(brokenImports(''), []);
});
