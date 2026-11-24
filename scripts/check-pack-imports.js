/* eslint-disable no-console */
/**
 * Fait échouer la CI quand le pack signale une importation cassée.
 *
 * webpack ne fait qu'avertir quand un module importe un nom que l'autre
 * n'exporte pas (« Attempted import error: 'x' is not exported from '…' »,
 * ou « export 'x' (imported as 'y') was not found in '…' ») : enact pack
 * finit quand même avec le code 0, et l'appli plante à l'exécution sur un
 * undefined. C'est ce qui a laissé passer la casse de replayKeep.
 *
 *   node scripts/check-pack-imports.js              lance enact pack dans packages/app et vérifie
 *   node scripts/check-pack-imports.js --log FILE   vérifie la sortie d'un pack déjà lancé
 */

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const APP = path.join(__dirname, '..', 'packages', 'app');

const PATTERNS = [
	/Attempted import error/i,
	/export\s+'?[^'\s]*'?(?:\s+\(imported as [^)]*\))?\s+was not found/i
];

// Les lignes de la sortie qui signalent une importation cassée.
const brokenImports = (output) => String(output || '')
	.split(/\r?\n/)
	.filter((line) => PATTERNS.some((re) => re.test(line)))
	.map((line) => line.trim());

const runPack = () => {
	const result = spawnSync('npx', ['enact', 'pack'], {cwd: APP, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024});
	const output = `${result.stdout || ''}\n${result.stderr || ''}`;
	return {output, status: result.status === null ? 1 : result.status};
};

const main = () => {
	const logIndex = process.argv.indexOf('--log');
	let output;
	let status = 0;
	if (logIndex >= 0) {
		output = fs.readFileSync(process.argv[logIndex + 1], 'utf8');
	} else {
		({output, status} = runPack());
		if (status !== 0) {
			console.log(output);
			console.error(`check-pack-imports: enact pack a échoué (code ${status}).`);
			process.exit(status);
		}
	}
	const broken = brokenImports(output);
	if (broken.length) {
		console.error('check-pack-imports: importations cassées dans le pack :');
		broken.forEach((line) => console.error(`  ${line}`));
		process.exit(1);
	}
	console.log('check-pack-imports: OK');
};

if (require.main === module) main();

module.exports = {brokenImports, PATTERNS};
