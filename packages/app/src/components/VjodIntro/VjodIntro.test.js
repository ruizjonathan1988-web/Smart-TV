import {fireEvent, render} from '@testing-library/react';

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
// Le dessin ne démarre pas : seule compte la sortie de l'ouverture.
jest.mock('./introKit', () => ({loadKit: () => new Promise(() => {})}));
jest.mock('./introPainter', () => ({IntroPainter: function IntroPainter() {}}));

import VjodIntro, {introState} from './VjodIntro';
import {INTRO_STYLES} from './introStyles';

const anyStyle = () => INTRO_STYLES[0].id;

describe('VjodIntro', () => {
	test('une touche passe l\'ouverture et appelle onDone une fois', () => {
		const onDone = jest.fn();
		render(<VjodIntro styleId={anyStyle()} onDone={onDone} muted />);
		expect(onDone).not.toHaveBeenCalled();
		expect(introState.played).toBe(true);
		fireEvent.keyDown(window, {keyCode: 13, key: 'Enter'});
		fireEvent.keyDown(window, {keyCode: 37, key: 'ArrowLeft'});
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	test('un style inconnu finit tout de suite', () => {
		const onDone = jest.fn();
		render(<VjodIntro styleId="aucun-style" onDone={onDone} muted />);
		expect(onDone).toHaveBeenCalledTimes(1);
	});
});
