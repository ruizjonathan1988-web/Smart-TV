/* eslint-disable no-console */
/**
 * Chaque texte de l'appli passé à $L doit avoir son français dans
 * packages/app/resources/fr/strings.json, sinon un Français le lit en anglais.
 *
 * Lus dans packages/app/src (hors tests) :
 *   $L('Texte')                  la clé est le texte lui-même ;
 *   $L({key: 'k', value: 'Texte'}) la clé est k.
 * Un texte compte comme anglais, donc à traduire, quand une autre langue
 * de resources/ le traduit (c'est une clé anglaise de l'appli) ou qu'il a
 * des mots anglais courants (« the », « your », « watched »…). Un texte
 * déjà écrit en français (accents, guillemets français, mots courants comme
 * « le », « pour »), sans lettres, ou un nom propre de ALLOWED, n'a pas
 * besoin d'entrée.
 *
 *   node scripts/check-fr-strings.js            vérifie
 *   node scripts/check-fr-strings.js --list     affiche les clés manquantes, une par ligne (JSON)
 */

const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'packages', 'app');
const SRC = path.join(APP, 'src');
const FR = path.join(APP, 'resources', 'fr', 'strings.json');

// Les mêmes dans les deux langues.
const ALLOWED = new Set([
	'OK', 'VJOD', 'Ma TV', 'Jellyfin', 'Seerr', 'Jellyseerr', 'Overseerr', 'Emby', 'Plex', 'Silo', 'Moonfin', 'Aura', 'Pop',
	'IMDb', 'TMDB', 'MDBList', 'Trakt', 'Rotten Tomatoes', 'Metacritic', 'Letterboxd', 'TVDB', 'AniList', 'MyAnimeList',
	'HDR', 'HDR10', 'HDR10+', 'Dolby Vision', 'Dolby Atmos', 'DTS', 'HEVC', 'AV1', 'H.264', 'AAC', 'AC3', 'EAC3', 'FLAC',
	'4K', 'HD', 'SD', 'SDR', 'IPTV', 'EPG', 'M3U', 'Xtream', 'Quick Connect', 'SyncPlay', 'Discord', 'GitHub', 'webOS', 'Tizen',
	'Fire TV', 'Xbox', 'Vega OS', 'Android TV', 'YouTube', 'Netflix', 'Prowlarr', 'Radarr', 'Sonarr', 'qBittorrent', 'Kodi', 'NFO',
	'Trickplay', 'Live TV', 'Normal', 'Stop', 'Menu', 'Info', 'Original', 'Auto', 'Code', 'Images', 'Photos', 'Collections', 'Documentaire'
]);

const FRENCH_WORDS = /(^|[\s'’(«])(le|la|les|des|du|un|une|pour|avec|sans|sur|dans|est|pas|et|ou|au|aux|de|ce|cette|ces|mes|tes|ta|ton|mon|ma|il|elle|plus|tout|tous|toutes|qui|que|quand|déjà|encore|rien|chaque|ici|jamais|aucun|aucune|leur|leurs|vos|votre|nos|notre|en|se|ne|on|tu|te|toi|moi|lui|ça|cela|voir|regarder|demander|garder|suivre|reprendre|lancer|chercher|choisir|ouvrir|fermer)(?=[\s,.:;!?'’)»…]|$)/i;

const ENGLISH_WORDS = /(^|[\s(])(the|a|an|to|of|in|is|are|was|be|been|no|not|your|you|this|that|these|with|for|on|at|and|or|from|by|it|its|all|any|new|now|today|watched|watching|loading|failed|unable|please|select|enter|click|press|item|items|show|shows|movie|movies|episode|episodes|season|seasons|settings|server|user|users|play|playing|delete|remove|add|save|cancel|close|back|next|previous|search|home|library|error|done|yes|none|off|on)(?=[\s,.:;!?)…]|$)/i;

const looksEnglish = (text) => ENGLISH_WORDS.test(text);

const isFrench = (text) => /[àâçéèêëîïôûùüÿœæÀÂÇÉÈÊËÎÏÔÛÙÜŸŒ«»’]/.test(text) || FRENCH_WORDS.test(text);

const walk = (dir) => fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
	const full = path.join(dir, e.name);
	if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(full);
	return /\.js$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [full] : [];
});

const unquote = (q, body) => body.replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16))).replace(new RegExp(`\\\\${q}`, 'g'), q).replace(/\\n/g, '\n').replace(/\\\\/g, '\\');

// [{key, text, file, line}] des appels à $L d'un fichier.
const callsOf = (source, file) => {
	const out = [];
	const lineOf = (index) => source.slice(0, index).split('\n').length;
	const literal = /\$L\(\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1\s*\)/g;
	const object = /\$L\(\s*\{\s*key:\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1\s*,\s*value:\s*(['"])((?:\\.|(?!\3)[^\\\n])*)\3\s*\}\s*\)/g;
	let m;
	while ((m = literal.exec(source))) {
		const text = unquote(m[1], m[2]);
		out.push({key: text, text, file, line: lineOf(m.index)});
	}
	while ((m = object.exec(source))) {
		out.push({key: unquote(m[1], m[2]), text: unquote(m[3], m[4]), file, line: lineOf(m.index), keyed: true});
	}
	return out;
};

// Les clés que d'autres langues de resources/ traduisent : des clés anglaises de l'appli.
const otherLocaleKeys = () => {
	const dir = path.join(APP, 'resources');
	const keys = new Set();
	fs.readdirSync(dir, {withFileTypes: true})
		.filter((e) => e.isDirectory() && e.name !== 'fr' && !e.name.startsWith('fr-'))
		.forEach((e) => {
			const file = path.join(dir, e.name, 'strings.json');
			if (!fs.existsSync(file)) return;
			try {
				Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))).forEach((k) => keys.add(k));
			} catch (err) {
				// Un fichier illisible est signalé par le workflow Check translations.
			}
		});
	return keys;
};

// Les appels sans français : clé absente du fichier français, texte à traduire (clé {key, value},
// clé anglaise d'une autre langue ou mots anglais) et pas déjà en français.
const missingFrench = (calls, fr, translatedElsewhere = new Set()) => calls.filter(({key, text, keyed}) => {
	if (Object.prototype.hasOwnProperty.call(fr, key)) return false;
	if (!/[A-Za-z]/.test(text) || ALLOWED.has(text.trim())) return false;
	if (isFrench(text)) return false;
	return Boolean(keyed) || translatedElsewhere.has(key) || looksEnglish(text);
});

const main = () => {
	const fr = JSON.parse(fs.readFileSync(FR, 'utf8'));
	const calls = walk(SRC).flatMap((file) => callsOf(fs.readFileSync(file, 'utf8'), path.relative(APP, file)));
	const missing = missingFrench(calls, fr, otherLocaleKeys());
	if (process.argv.includes('--list')) {
		const unique = [...new Map(missing.map((c) => [c.key, c])).values()];
		unique.forEach((c) => console.log(JSON.stringify({key: c.key, text: c.text, where: `${c.file}:${c.line}`})));
		return;
	}
	if (missing.length) {
		console.error(`check-fr-strings: ${new Set(missing.map((c) => c.key)).size} textes sans français dans resources/fr/strings.json :`);
		missing.forEach((c) => console.error(`  ${c.file}:${c.line}  ${JSON.stringify(c.key)}`));
		process.exit(1);
	}
	console.log(`check-fr-strings: OK (${calls.length} appels à $L)`);
};

if (require.main === module) main();

module.exports = {callsOf, missingFrench, isFrench, looksEnglish};
