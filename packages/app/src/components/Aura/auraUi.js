// Les petites briques communes au tiroir d'Aura et à « Proposer à… ».
import Spottable from '@enact/spotlight/Spottable';
import css from './Aura.module.less';

export const SPARKLE = 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z';

const SpottableRow = Spottable('div');

// Une ligne qu'on choisit à la télécommande.
export const AuraTile = ({title, subtitle, selected, onClick, spotlightId, className, ...rest}) => (
	<SpottableRow className={`${css.tile} ${selected ? css.tileSelected : ''} ${className || ''}`} onClick={onClick} spotlightId={spotlightId} {...rest}>
		<div className={css.tileTitle}>{title}</div>
		{subtitle ? <div className={css.tileSubtitle}>{subtitle}</div> : null}
	</SpottableRow>
);

export const AuraHeader = ({children}) => <div className={css.header}>{children}</div>;
export const AuraLine = ({children, strong}) => <div className={`${css.line} ${strong ? css.lineStrong : ''}`}>{children}</div>;

// Le focus visible reste à l'écran dans une longue liste.
export const keepInView = (e) => {
	const el = e.target;
	if (el && el.scrollIntoView) el.scrollIntoView({block: 'nearest'});
};
