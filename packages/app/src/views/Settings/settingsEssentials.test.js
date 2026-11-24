import {fireEvent, render, screen} from '@testing-library/react';

// Le CLI apporte une seconde copie de React : le JSX des composants passe par celle des tests.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {
		Fragment: React.Fragment,
		jsxDEV: (type, {children, ...props}, key, isStaticChildren) => {
			const config = key === undefined ? props : {...props, key};
			if (children === undefined) return React.createElement(type, config);
			return isStaticChildren ? React.createElement(type, config, ...children) : React.createElement(type, config, children);
		}
	};
});
jest.mock('@enact/spotlight/Spottable', () => (type) => {
	const React = require('react');
	return ({spotlightId, spotlightDisabled, children, ...props}) => React.createElement(type, {...props, 'data-spotlight-id': props['data-spotlight-id'] || spotlightId}, children); // eslint-disable-line no-unused-vars
});
jest.mock('@enact/spotlight/SpotlightContainerDecorator', () => (config, type) => {
	const React = require('react');
	return ({spotlightId, spotlightDisabled, children, ...props}) => React.createElement(type, props, children); // eslint-disable-line no-unused-vars
});
jest.mock('@enact/spotlight', () => ({focus: jest.fn(), getCurrent: jest.fn()}));
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (text) => text}));

import {SETTINGS_SCHEMA} from './settingsSchema';
import renderDescriptorRow from './settingsDescriptorRow';

const ctxFor = (settings = {}) => {
	const actions = {openScreen: jest.fn(), openParentalControls: jest.fn(), setSetting: jest.fn()};
	return {settings: {uiLanguage: 'fr', auraMode: 'off', ...settings}, actions, isAdmin: false};
};

const visible = (ctx) => SETTINGS_SCHEMA.filter((cat) => !cat.when || cat.when(ctx));

describe('Paramètres : « L\'essentiel » comme la box', () => {
	test('c\'est la première catégorie', () => {
		const ctx = ctxFor();
		expect(visible(ctx)[0].id).toBe('essentials');
		expect(visible(ctx)[0].label()).toBe('L’essentiel');
	});

	test('pas pour le mode enfant', () => {
		expect(visible(ctxFor({kidsModeEnabled: true})).some((c) => c.id === 'essentials')).toBe(false);
	});

	test('ses raccourcis ouvrent les sous-titres et la qualité vidéo de la lecture', () => {
		const ctx = ctxFor();
		const rows = visible(ctx)[0].subcategories[0].rows;
		const deps = {settings: ctx.settings, updateSetting: jest.fn(), toggleSetting: jest.fn(), pushView: jest.fn(), customRenderers: {}};
		render(<div>{rows.map((row, i) => renderDescriptorRow(row, ctx, i, deps))}</div>);
		expect(screen.getByText('Langue')).toBeTruthy();
		expect(screen.getByText('Aura, le jeu de cinéma')).toBeTruthy();
		fireEvent.click(screen.getByText('Sous-titres'));
		expect(ctx.actions.openScreen).toHaveBeenLastCalledWith('playback', 'subtitles', 'setting-essentialSubtitles');
		fireEvent.click(screen.getByText('Qualité vidéo'));
		expect(ctx.actions.openScreen).toHaveBeenLastCalledWith('playback', 'qualityDecoding', 'setting-essentialQuality');
		fireEvent.click(screen.getByText('Parental Controls'));
		expect(ctx.actions.openParentalControls).toHaveBeenCalled();
	});

	test('les écrans visés existent', () => {
		const playback = SETTINGS_SCHEMA.find((c) => c.id === 'playback');
		const ids = playback.subcategories.map((s) => s.id);
		expect(ids).toEqual(expect.arrayContaining(['subtitles', 'qualityDecoding']));
	});
});
