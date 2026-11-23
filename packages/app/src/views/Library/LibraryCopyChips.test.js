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

import LibraryCopyChips from './LibraryCopyChips';

const films = {Id: 'a', Name: 'Films', CollectionType: 'movies'};
const russes = {Id: 'b', Name: 'Films RU', CollectionType: 'movies'};

describe('LibraryCopyChips', () => {
	test('rien sans copie', () => {
		const {container} = render(<LibraryCopyChips siblings={[films]} current={films} onSwitch={jest.fn()} />);
		expect(container.innerHTML).toBe('');
	});

	test('une pastille par copie, et un appui passe à l\'autre', () => {
		const onSwitch = jest.fn();
		render(<LibraryCopyChips siblings={[films, russes]} current={films} onSwitch={onSwitch} />);
		const chips = document.querySelectorAll('[data-id]');
		expect(chips).toHaveLength(2);
		fireEvent.click(chips[0]);
		expect(onSwitch).not.toHaveBeenCalled();
		fireEvent.click(chips[1]);
		expect(onSwitch).toHaveBeenCalledWith(russes);
		expect(screen.getAllByText(/Films/).length).toBeGreaterThan(0);
	});
});
