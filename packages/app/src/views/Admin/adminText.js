// Les textes de la console, en français, sous les clés de l'APK
// (lib/l10n/app_fr.arb) : adminStrings.js reprend les traductions de l'APK et
// complète celles qui n'y étaient qu'en anglais.
import STRINGS from './adminStrings';

// « {count, plural, one{…} other{…}} » : le seul pluriel que l'APK utilise ici.
const plural = (text, params) => text.replace(/\{(\w+), plural, ((?:[^{}]*\{[^{}]*\})+)\}/g, (all, name, forms) => {
	const n = Number(params[name]);
	const map = {};
	forms.replace(/(=?\w+)\{([^{}]*)\}/g, (m, k, v) => {
		map[k] = v;
		return m;
	});
	const chosen = map['=' + n] !== undefined ? map['=' + n] : (n === 0 || n === 1) && map.one !== undefined ? map.one : map.other;
	return chosen === undefined ? all : chosen;
});

export const format = (text, params) => {
	if (!params) return text;
	const withPlural = text.indexOf('plural,') >= 0 ? plural(text, params) : text;
	return withPlural.replace(/\{(\w+)\}/g, (all, name) => (params[name] === undefined || params[name] === null ? all : String(params[name])));
};

export const t = (key, params) => {
	const text = STRINGS[key];
	if (text === undefined) return key;
	return format(text, params);
};

export const hasText = (key) => STRINGS[key] !== undefined;
