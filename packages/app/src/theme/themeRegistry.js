import {parseThemeSpec} from './themeSpec';

// VJOD (vjod_theme_spec.dart de l'APK) : presque noir plutôt que noir pur, qui
// fatigue l'œil sur une TV, un halo ivoire sur ce qui est sélectionné, des
// statuts en teintes douces. L'accent est le rouge du logo, adouci : un rouge
// saturé éblouit sur une TV, et l'app pose du texte blanc dessus.
const vjodTheme = parseThemeSpec({
	schemaVersion: 1,
	id: 'vjod',
	displayName: 'VJOD',
	semantic: {
		statusAvailable: '#FF7FD6A8',
		statusRequested: '#FFE3C07E',
		statusPending: '#FFE3C07E',
		statusDownloading: '#FF8DB8F2',
		statusError: '#FFE07A7A',
		mediaTypeBadgeMovie: '#FF8DB8F2',
		mediaTypeBadgeShow: '#FFC9A7E8'
	},
	colors: {
		background: '#FF0B0B0D',
		onBackground: '#FFEDEBE6',
		surface: '#FF16171B',
		onSurface: '#FFEDEBE6',
		surfaceVariant: '#FF1F2026',
		scrim: '#D90B0B0D',
		accent: '#FFC9403F',
		onAccent: '#FFFFFFFF',
		buttonNormal: '#FF24252B',
		buttonFocused: '#FFEDEBE6',
		buttonDisabled: '#FF1A1B1F',
		buttonActive: '#FF34363D',
		onButtonNormal: '#FFEDEBE6',
		onButtonFocused: '#FF0B0B0D',
		onButtonDisabled: '#80EDEBE6',
		inputBackground: '#FF1F2026',
		inputFocused: '#FF2A2B31',
		inputBorder: '#FF34363D',
		inputBorderFocused: '#FFEDEBE6',
		rangeTrack: '#40EDEBE6',
		rangeProgress: '#FFEDEBE6',
		rangeThumb: '#FFEDEBE6',
		seekbarBuffered: '#66EDEBE6',
		badgeBackground: '#FFC9403F',
		onBadge: '#FFFFFFFF',
		badgeUnplayed: '#FFC9403F',
		badgeWatched: '#FF7FD6A8',
		recordingActive: '#FFC93A3A',
		recordingScheduled: '#FFE3C07E',
		error: '#FFE07A7A'
	},
	borders: {
		cardBorder: {color: '#00000000', width: 1},
		chipBorder: {color: '#33EDEBE6', width: 1},
		focusBorder: {color: '#FFEDEBE6', width: 3},
		// À peine arrondi, comme une affiche de film.
		cardRadius: 6,
		chipRadius: 999,
		chipBackground: '#1FEDEBE6',
		focusGlow: [{color: '#40EDEBE6', blurRadius: 18, spreadRadius: 1, offsetX: 0, offsetY: 0}]
	}
});

// Écrin (ecrin_theme_spec.dart) : l'alternative calme à VJOD. Graphite chaud,
// arrondis généreux, ombres douces plutôt que halos, accent terre cuite.
const ecrinTheme = parseThemeSpec({
	schemaVersion: 1,
	id: 'ecrin',
	displayName: 'Écrin',
	semantic: {
		statusAvailable: '#FF8FD4A8',
		statusRequested: '#FFE6C48A',
		statusPending: '#FFE6C48A',
		statusDownloading: '#FF9DBFEA',
		statusError: '#FFE08A80',
		mediaTypeBadgeMovie: '#FF9DBFEA',
		mediaTypeBadgeShow: '#FFD1B3E0'
	},
	colors: {
		background: '#FF0F0E0D',
		onBackground: '#FFF5F2EE',
		surface: '#FF1A1816',
		onSurface: '#FFF5F2EE',
		surfaceVariant: '#FF24211E',
		scrim: '#D90F0E0D',
		accent: '#FFB4553A',
		onAccent: '#FFFFFFFF',
		buttonNormal: '#FF2A2724',
		buttonFocused: '#FFF5F2EE',
		buttonDisabled: '#FF1E1C1A',
		buttonActive: '#FF38342F',
		onButtonNormal: '#FFF5F2EE',
		onButtonFocused: '#FF0F0E0D',
		onButtonDisabled: '#80F5F2EE',
		inputBackground: '#FF24211E',
		inputFocused: '#FF2E2A26',
		inputBorder: '#FF3A3530',
		inputBorderFocused: '#FFF5F2EE',
		rangeTrack: '#40F5F2EE',
		rangeProgress: '#FFF5F2EE',
		rangeThumb: '#FFF5F2EE',
		seekbarBuffered: '#66F5F2EE',
		badgeBackground: '#FFB4553A',
		onBadge: '#FFFFFFFF',
		badgeUnplayed: '#FFB4553A',
		badgeWatched: '#FF8FD4A8',
		recordingActive: '#FFC95A4A',
		recordingScheduled: '#FFE6C48A',
		error: '#FFE08A80'
	},
	borders: {
		cardBorder: {color: '#00000000', width: 1},
		chipBorder: {color: '#29F5F2EE', width: 1},
		focusBorder: {color: '#E6F5F2EE', width: 2.5},
		cardRadius: 12,
		chipRadius: 999,
		chipBackground: '#1AF5F2EE',
		focusGlow: [{color: '#99000000', blurRadius: 30, spreadRadius: 0, offsetX: 0, offsetY: 14}]
	}
});

const moonfinTheme = parseThemeSpec({
	schemaVersion: 1,
	id: 'moonfin',
	displayName: 'Moonfin',
	colors: {
		background: '#FF101010',
		onBackground: '#FFFFFFFF',
		surface: '#FF1A1A1A',
		onSurface: '#FFFFFFFF',
		surfaceVariant: '#FF252525',
		scrim: '#CC000000',
		accent: '#FF00A4DC',
		onAccent: '#FFFFFFFF',
		buttonNormal: '#FF2A2A2A',
		buttonFocused: '#FFFFFFFF',
		buttonDisabled: '#FF1E1E1E',
		buttonActive: '#FF3A3A3A',
		onButtonNormal: '#FFFFFFFF',
		onButtonFocused: '#FF00A4DC',
		onButtonDisabled: '#FF666666',
		inputBackground: '#FF2A2A2A',
		inputFocused: '#FF3A3A3A',
		inputBorder: '#FF404040',
		inputBorderFocused: '#FF00A4DC',
		rangeTrack: '#FF404040',
		rangeProgress: '#FF00A4DC',
		rangeThumb: '#FF00A4DC',
		seekbarBuffered: '#80FFFFFF',
		badgeBackground: '#FF00A4DC',
		onBadge: '#FFFFFFFF',
		badgeUnplayed: '#FF00A4DC',
		badgeWatched: '#FF22C55E',
		recordingActive: '#FFEF4444',
		recordingScheduled: '#FFF59E0B'
	},
	borders: {
		cardBorder: {color: '#00000000', width: 1},
		chipBorder: {color: '#558EC8F0', width: 1},
		focusBorder: {color: '#FF00A4DC', width: 2},
		cardRadius: 8,
		chipRadius: 999,
		chipBackground: '#1F8EC8F0',
		focusGlow: []
	}
});

const neonPulseTheme = parseThemeSpec({
	schemaVersion: 1,
	id: 'neon_pulse',
	displayName: 'Neon Pulse',
	fontFamily: 'NeonPulseDisplay',
	textGlow: [{color: '#6600E5FF', blurRadius: 8, spreadRadius: 0, offsetX: 0, offsetY: 0}],
	navColorCycle: ['#FFFF2E92', '#FF00E5FF'],
	transparentNavbarSurface: true,
	colors: {
		background: '#FF0B0420',
		onBackground: '#FF00E5FF',
		surface: '#CC1E0A3F',
		onSurface: '#FF00E5FF',
		surfaceVariant: '#CC1E0A3F',
		scrim: '#CC0B0420',
		accent: '#FFFF2E92',
		onAccent: '#FFFFFFFF',
		buttonNormal: '#00000000',
		buttonFocused: '#FF00E5FF',
		buttonDisabled: '#22FFFFFF',
		buttonActive: '#33FF2E92',
		onButtonNormal: '#FFFF2E92',
		onButtonFocused: '#FFFFFFFF',
		onButtonDisabled: '#AAFFFFFF',
		inputBackground: '#331E0A3F',
		inputFocused: '#441E0A3F',
		inputBorder: '#66FF2E92',
		inputBorderFocused: '#FFFF2E92',
		rangeTrack: '#66201840',
		rangeProgress: '#FFFF2E92',
		rangeThumb: '#FFFF2E92',
		seekbarBuffered: '#66FFFFFF',
		badgeBackground: '#FFFF2E92',
		onBadge: '#FFFFFFFF',
		badgeUnplayed: '#FFFF2E92',
		badgeWatched: '#FFFF2E92',
		recordingActive: '#FFFF2E92',
		recordingScheduled: '#FF00E5FF',
		error: '#FFFF003C'
	},
	borders: {
		cardBorder: {color: '#66FF2E92', width: 1},
		chipBorder: {color: '#CCFF2E92', width: 1.2},
		focusBorder: {color: '#FFFF2E92', width: 1.4},
		cardRadius: 10,
		chipRadius: 8,
		chipBackground: '#00000000',
		focusGlow: [
			{color: '#99FF2E92', blurRadius: 8, spreadRadius: 0.5, offsetX: 0, offsetY: 0},
			{color: '#6600E5FF', blurRadius: 5, spreadRadius: 0, offsetX: 0, offsetY: 0}
		],
		navBorder: {color: '#CCFF2E92', width: 1}
	}
});

// Frosted translucent theme over whatever sits behind it, matching the other
// clients token for token. The frosted blur itself is stylesheet work scoped to
// this theme id, so engines without backdrop-filter keep the translucent look.
const glassTheme = parseThemeSpec({
	schemaVersion: 1,
	id: 'glass',
	displayName: 'Glass',
	isGlass: true,
	transparentNavbarSurface: true,
	semantic: {
		statusAvailable: '#FF30D158',
		statusRequested: '#FFBF5AF2',
		statusPending: '#FFFFD60A',
		statusDownloading: '#FF0A84FF',
		statusError: '#FFFF453A',
		mediaTypeBadgeMovie: '#FF0A84FF',
		mediaTypeBadgeShow: '#FFBF5AF2'
	},
	colors: {
		background: '#CC07090F',
		onBackground: '#FFFFFFFF',
		surface: '#D90E1117',
		onSurface: '#FFFFFFFF',
		surfaceVariant: '#29FFFFFF',
		scrim: '#99060810',
		accent: '#FF0A84FF',
		onAccent: '#FFFFFFFF',
		buttonNormal: '#1FFFFFFF',
		buttonFocused: '#F2FFFFFF',
		buttonDisabled: '#14FFFFFF',
		buttonActive: '#3DFFFFFF',
		onButtonNormal: '#FFFFFFFF',
		onButtonFocused: '#FF0A0A12',
		onButtonDisabled: '#66FFFFFF',
		inputBackground: '#1FFFFFFF',
		inputFocused: '#33FFFFFF',
		inputBorder: '#33FFFFFF',
		inputBorderFocused: '#FF0A84FF',
		rangeTrack: '#33FFFFFF',
		rangeProgress: '#FF0A84FF',
		rangeThumb: '#FFFFFFFF',
		seekbarBuffered: '#80FFFFFF',
		badgeBackground: '#CC0A84FF',
		onBadge: '#FFFFFFFF',
		badgeUnplayed: '#FF0A84FF',
		badgeWatched: '#FF30D158',
		recordingActive: '#FFFF453A',
		recordingScheduled: '#FFFF9F0A'
	},
	borders: {
		cardBorder: {color: '#29FFFFFF', width: 1},
		chipBorder: {color: '#3DFFFFFF', width: 1},
		focusBorder: {color: '#FFFFFFFF', width: 2},
		navBorder: {color: '#1FFFFFFF', width: 1},
		cardRadius: 14,
		chipRadius: 999,
		chipBackground: '#1FFFFFFF',
		focusGlow: [
			{color: '#40FFFFFF', blurRadius: 12, spreadRadius: 0, offsetX: 0, offsetY: 0},
			{color: '#330A84FF', blurRadius: 22, spreadRadius: 1, offsetX: 0, offsetY: 0}
		]
	}
});

// Retro 8-bit theme on the "Sweetie 16" pixel-art palette, matching the other
// clients token for token.
const eightbitHeroTheme = parseThemeSpec({
	schemaVersion: 1,
	id: '8bit_hero',
	displayName: '8-bit Hero',
	fontFamily: 'EightBitHero',
	isPixel: true,
	navColorCycle: ['#FFEF7D57', '#FFFFCD75', '#FFA7F070', '#FF41A6F6'],
	semantic: {
		statusAvailable: '#FF38B764',
		statusRequested: '#FF5D275D',
		statusPending: '#FFFFCD75',
		statusDownloading: '#FF41A6F6',
		statusError: '#FFB13E53',
		mediaTypeBadgeMovie: '#FF3B5DC9',
		mediaTypeBadgeShow: '#FFB13E53'
	},
	colors: {
		background: '#FF1A1C2C',
		onBackground: '#FFF4F4F4',
		surface: '#FF333C57',
		onSurface: '#FFF4F4F4',
		surfaceVariant: '#FF566C86',
		scrim: '#CC1A1C2C',
		accent: '#FFEF7D57',
		onAccent: '#FF1A1C2C',
		buttonNormal: '#FF29366F',
		buttonFocused: '#FFFFCD75',
		buttonDisabled: '#FF333C57',
		buttonActive: '#FF41A6F6',
		onButtonNormal: '#FFF4F4F4',
		onButtonFocused: '#FF1A1C2C',
		onButtonDisabled: '#FF566C86',
		inputBackground: '#FF333C57',
		inputFocused: '#FF3B5DC9',
		inputBorder: '#FF566C86',
		inputBorderFocused: '#FFFFCD75',
		rangeTrack: '#FF333C57',
		rangeProgress: '#FFA7F070',
		rangeThumb: '#FFFFCD75',
		seekbarBuffered: '#FF566C86',
		badgeBackground: '#FFB13E53',
		onBadge: '#FFF4F4F4',
		badgeUnplayed: '#FF41A6F6',
		badgeWatched: '#FF38B764',
		recordingActive: '#FFB13E53',
		recordingScheduled: '#FFFFCD75'
	},
	borders: {
		cardBorder: {color: '#FF566C86', width: 2},
		chipBorder: {color: '#FFF4F4F4', width: 2},
		focusBorder: {color: '#FFFFCD75', width: 3},
		cardRadius: 0,
		chipRadius: 0,
		chipBackground: '#FF29366F',
		navBorder: {color: '#FF566C86', width: 2},
		focusGlow: [
			{color: '#99FFCD75', blurRadius: 0, spreadRadius: 0, offsetX: 4, offsetY: 4}
		]
	}
});

// VJOD d'abord, comme dans l'APK (c'est le thème par défaut).
const builtInThemes = Object.freeze({
	vjod: vjodTheme,
	ecrin: ecrinTheme,
	moonfin: moonfinTheme,
	neon_pulse: neonPulseTheme,
	glass: glassTheme,
	'8bit_hero': eightbitHeroTheme
});

const builtInThemeIds = new Set(Object.keys(builtInThemes));
let customThemes = {};
// Themes saved from the Theme Store. Kept separate from customThemes so server
// syncs (replaceCustomThemes) never clear them.
let storeThemes = {};

export const builtInThemeIdsList = Object.freeze(Array.from(builtInThemeIds));
export const isBuiltInThemeId = (id) => builtInThemeIds.has(id);

export const getAvailableThemes = () => ({
	...builtInThemes,
	...storeThemes,
	...customThemes
});

export const getAvailableThemeList = () => {
	const builtIns = Object.values(builtInThemes);
	const merged = {...storeThemes, ...customThemes};
	const customs = Object.values(merged).sort((left, right) => left.displayName.localeCompare(right.displayName));
	return [...builtIns, ...customs];
};

export const DEFAULT_THEME_ID = 'vjod';
export const resolveThemeById = (id) => getAvailableThemes()[id] || builtInThemes[DEFAULT_THEME_ID];

export const replaceCustomThemes = (specs) => {
	const next = {};
	for (const spec of specs) {
		if (!spec || !spec.id || isBuiltInThemeId(spec.id)) continue;
		next[spec.id] = spec;
	}
	customThemes = next;
	return getAvailableThemes();
};

export const registerCustomTheme = (spec) => {
	if (!spec || !spec.id || isBuiltInThemeId(spec.id)) {
		throw new Error(`Cannot register theme with reserved id "${spec?.id || ''}".`);
	}
	customThemes = {...customThemes, [spec.id]: spec};
	return customThemes[spec.id];
};

export const registerStoreTheme = (spec) => {
	if (!spec || !spec.id || isBuiltInThemeId(spec.id)) {
		throw new Error(`Cannot register store theme with reserved id "${spec?.id || ''}".`);
	}
	storeThemes = {...storeThemes, [spec.id]: spec};
	return storeThemes[spec.id];
};

export const removeStoreTheme = (id) => {
	if (!storeThemes[id]) return;
	const next = {...storeThemes};
	delete next[id];
	storeThemes = next;
};