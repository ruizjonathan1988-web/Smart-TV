// « Films · Films RU · Fournisseur » en haut d'une bibliothèque qui a des
// copies (library_sibling_switcher.dart) : une pastille passe à l'autre.
import {useCallback} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import {libraryChipLabel} from '../../utils/libraryCopies';
import css from './LibraryCopyChips.module.less';

const Chip = Spottable('div');

const LibraryCopyChips = ({siblings, current, onSwitch}) => {
	const open = useCallback((e) => {
		const id = e.currentTarget.dataset.id;
		const lib = siblings.find((s) => s.Id === id);
		if (lib && lib.Id !== (current && current.Id)) onSwitch?.(lib);
	}, [siblings, current, onSwitch]);
	if (!siblings || siblings.length < 2) return null;
	return (
		<div className={css.chips}>
			{siblings.map((lib) => (
				<Chip
					key={lib.Id}
					data-id={lib.Id}
					className={`${css.chip} ${lib.Id === (current && current.Id) ? css.selected : ''}`}
					onClick={open}
					spotlightId={`library-copy-${lib.Id}`}
				>
					{libraryChipLabel(lib, siblings)}
				</Chip>
			))}
		</div>
	);
};

export default LibraryCopyChips;
