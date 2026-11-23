// Les questions du soir (l'écran « Ce soir » de l'APK) : avec qui, l'âge du
// plus jeune en famille, combien de temps, quelle envie. Trois réponses, et
// la bannière s'occupe du reste. Retour ferme sans rien changer.
import {useState, useEffect, useCallback} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import $L from '@enact/i18n/$L';

import css from './VjodBanner.module.less';

const SpottableDiv = Spottable('div');
const SheetContainer = SpotlightContainerDecorator({restrict: 'self-only', enterTo: 'last-focused'}, 'div');

export const companyLabel = (c) => ({alone: $L('Seul'), couple: $L('À deux'), family: $L('En famille'), friends: $L('Entre amis')}[c]);
export const timeLabel = (t) => ({short: $L('Moins d’1 h 30'), evening: $L('Toute la soirée'), any: $L('Peu importe')}[t]);
export const moodLabel = (m) => ({
	laugh: $L('Rire'), chills: $L('Frissons'), escape: $L('Évasion'), think: $L('Réfléchir'),
	comfort: $L('Réconfort'), surprise: $L('Surprends-moi')
}[m]);
const kidsLabel = (k) => ({under7: $L('Moins de 7 ans'), from7to12: $L('7 à 12 ans'), teen: $L('13 ans et plus')}[k]);

const Choice = ({field, value, label, on, onPick, spotlightId}) => {
	const handleClick = useCallback(() => onPick(field, value), [onPick, field, value]);
	return (
		<SpottableDiv spotlightId={spotlightId} className={`${css.choice} ${on ? css.choiceOn : ''}`} onClick={handleClick}>
			{label}
		</SpottableDiv>
	);
};

const Question = ({title, field, values, labelOf, current, onPick, first}) => (
	<div className={css.question}>
		<div className={css.questionTitle}>{title}</div>
		<div className={css.choices}>
			{values.map((v, i) => (
				<Choice
					key={v}
					field={field}
					value={v}
					label={labelOf(v)}
					on={current === v}
					onPick={onPick}
					spotlightId={first && i === 0 ? 'tonight-first' : undefined}
				/>
			))}
		</div>
	</div>
);

const TonightSheet = ({answers, onDone}) => {
	const [draft, setDraft] = useState(answers);

	useEffect(() => {
		const t = setTimeout(() => Spotlight.focus('tonight-first'), 0);
		return () => clearTimeout(t);
	}, []);

	const pick = useCallback((field, value) => setDraft((d) => ({...d, [field]: value})), []);
	const go = useCallback(() => onDone({...draft, at: Date.now()}), [draft, onDone]);

	return (
		<div className={css.sheetBackdrop}>
			<SheetContainer className={css.sheet} spotlightId="tonight-sheet">
				<div className={css.sheetTitle}>{$L('Qu’est-ce qu’on regarde ce soir ?')}</div>
				<div className={css.sheetHint}>{$L('Trois réponses, et je m’occupe du reste.')}</div>
				<Question title={$L('Avec qui ?')} field="company" values={['alone', 'couple', 'family', 'friends']} labelOf={companyLabel} current={draft.company} onPick={pick} first />
				{draft.company === 'family' ? (
					<Question title={$L('Le plus jeune a…')} field="kidsAge" values={['under7', 'from7to12', 'teen']} labelOf={kidsLabel} current={draft.kidsAge} onPick={pick} />
				) : null}
				<Question title={$L('Combien de temps ?')} field="time" values={['short', 'evening', 'any']} labelOf={timeLabel} current={draft.time} onPick={pick} />
				<Question title={$L('Quelle envie ?')} field="mood" values={['laugh', 'chills', 'escape', 'think', 'comfort', 'surprise']} labelOf={moodLabel} current={draft.mood} onPick={pick} />
				<SpottableDiv className={css.go} onClick={go}>{$L('C’est parti')}</SpottableDiv>
			</SheetContainer>
		</div>
	);
};

export default TonightSheet;
