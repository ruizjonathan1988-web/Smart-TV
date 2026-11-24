// Briques de la console d'administration, reprises d'admin_form_styles.dart :
// sections titrées, cartes groupant des lignes, ligne réglage avec son aide à
// gauche et la commande à droite, interrupteurs, listes de choix, champs,
// curseurs (gauche / droite), boutons, puces, chargement et erreur.
// Tout se pilote à la télécommande : flèches, OK, Retour.
import {useState, useCallback, useEffect, useRef, useMemo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

import CoreDialog, {CoreDialogRow} from '../../components/CoreDialog/CoreDialog';
import CoreAlertDialog from '../../components/CoreDialog/CoreAlertDialog';
import SpottableInput from '../../components/SpottableInput/SpottableInput';
import LoadingSpinner from '../../components/LoadingSpinner';
import {SettingsGlyph} from '../Settings/settingsIcons';
import {KEYS} from '../../utils/keys';
import {t} from './adminText';

import css from './Admin.module.less';

export const SpottableDiv = Spottable('div');
export const Group = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const DialogList = SpotlightContainerDecorator({enterTo: 'default-element'}, 'div');

export const Icon = ({name}) => (name ? <SettingsGlyph name={name} /> : null);

const cx = (...names) => names.filter(Boolean).join(' ');

// ----------------------------------------------------------------- mise en page
export const PageHeader = ({title, subtitle, children}) => (
	<div className={css.pageHeader}>
		<div className={css.pageHeaderText}>
			<div className={css.pageTitle}>{title}</div>
			{subtitle ? <div className={css.pageSubtitle}>{subtitle}</div> : null}
		</div>
		{children ? <div className={css.pageActions}>{children}</div> : null}
	</div>
);

export const Section = ({title, help, children}) => (
	<div className={css.section}>
		{title ? <div className={css.sectionLabel}>{title}</div> : null}
		{help ? <div className={css.sectionHelp}>{help}</div> : null}
		<Group className={css.group}>{children}</Group>
	</div>
);

export const Note = ({children}) => <div className={css.note}>{children}</div>;
export const Warn = ({children}) => <div className={css.warnBox}>{children}</div>;

export const Loading = () => (
	<div className={css.centered}><LoadingSpinner /></div>
);

export const ErrorBox = ({title, message, onRetry}) => (
	<div className={css.centered}>
		<div className={css.errorTitle}>{title || t('adminSettingsLoadFailed')}</div>
		<div className={css.errorText}>{message || t('adminUnknownError')}</div>
		{onRetry ? <Btn label={t('retry')} onClick={onRetry} /> : null}
	</div>
);

export const Empty = ({children}) => <div className={css.empty}>{children}</div>;

const CHIP_TONES = {good: css.chipGood, warn: css.chipWarn, bad: css.chipBad, accent: css.chipAccent};
export const Chip = ({tone, children}) => <span className={cx(css.chip, CHIP_TONES[tone])}>{children}</span>;

export const Progress = ({value}) => (
	<div className={css.progress}>
		<div className={css.progressFill} style={{width: `${Math.max(0, Math.min(100, value || 0))}%`}} />
	</div>
);

export const Stat = ({value, label}) => (
	<div className={css.stat}>
		<div className={css.statValue}>{value}</div>
		<div className={css.statLabel}>{label}</div>
	</div>
);

// Une tuile de compte qu'on peut choisir (analyses).
export const StatButton = ({value, label, note, onClick, arg}) => {
	const handleClick = useCallback(() => onClick(arg), [onClick, arg]);
	return (
		<SpottableDiv className={css.stat} onClick={handleClick}>
			<div className={css.statValue}>{value}</div>
			<div className={css.statLabel}>{label}</div>
			{note ? <div className={css.statLabel}>{note}</div> : null}
		</SpottableDiv>
	);
};

// ----------------------------------------------------------------- boutons
export const Btn = ({label, icon, primary, danger, small, disabled, onClick, spotlightId, value}) => {
	const handleClick = useCallback(() => {
		if (!disabled && onClick) onClick(value);
	}, [disabled, onClick, value]);
	return (
		<SpottableDiv
			spotlightId={spotlightId}
			className={cx(css.btn, primary && css.btnPrimary, danger && css.btnDanger, small && css.btnSmall, disabled && css.btnDisabled)}
			onClick={handleClick}
			aria-disabled={disabled ? 'true' : undefined}
		>
			{icon ? <Icon name={icon} /> : null}
			{label}
		</SpottableDiv>
	);
};

// ----------------------------------------------------------------- lignes
// Une ligne qu'on choisit avec OK : icône, titre, aide, valeur à droite, chevron.
export const Row = ({icon, avatar, label, help, value, chevron, disabled, onClick, spotlightId, children, arg}) => {
	const handleClick = useCallback(() => {
		if (!disabled && onClick) onClick(arg);
	}, [disabled, onClick, arg]);
	return (
		<SpottableDiv spotlightId={spotlightId} className={cx(css.row, disabled && css.rowDisabled)} onClick={handleClick}>
			{avatar !== undefined ? <div className={css.rowAvatar}>{avatar}</div> : null}
			{icon ? <div className={css.rowIcon}><Icon name={icon} /></div> : null}
			<div className={css.rowText}>
				<div className={css.rowLabel}>{label}</div>
				{help ? <div className={css.rowHelp}>{help}</div> : null}
				{children}
			</div>
			{value !== undefined && value !== null && value !== '' ? <div className={css.rowValue}>{value}</div> : null}
			{chevron ? <div className={css.chevron}><Icon name="arrow_right" /></div> : null}
		</SpottableDiv>
	);
};

// Ligne d'information, non sélectionnable.
export const InfoRow = ({icon, label, help, value}) => (
	<div className={css.row}>
		{icon ? <div className={css.rowIcon}><Icon name={icon} /></div> : null}
		<div className={css.rowText}>
			<div className={css.rowLabel}>{label}</div>
			{help ? <div className={css.rowHelp}>{help}</div> : null}
		</div>
		{value !== undefined && value !== null && value !== '' ? <div className={css.rowValue}>{value}</div> : null}
	</div>
);

export const SwitchRow = ({label, help, value, onChange, disabled, field}) => {
	const handleClick = useCallback(() => {
		if (!disabled) onChange(!value, field);
	}, [disabled, onChange, value, field]);
	return (
		<SpottableDiv className={cx(css.row, disabled && css.rowDisabled)} onClick={handleClick} role="switch" aria-checked={value ? 'true' : 'false'}>
			<div className={css.rowText}>
				<div className={css.rowLabel}>{label}</div>
				{help ? <div className={css.rowHelp}>{help}</div> : null}
			</div>
			<div className={cx(css.switch, value && css.switchOn)}><div className={css.switchThumb} /></div>
		</SpottableDiv>
	);
};

// Un choix dans une liste : OK ouvre la liste des valeurs.
const ChoiceRow = ({option, selected, onPick}) => {
	const handleClick = useCallback(() => onPick(option.value), [onPick, option.value]);
	return <CoreDialogRow label={option.label} selected={selected} onClick={handleClick} />;
};

export const ChoiceDialog = ({open, title, options, value, onPick, onClose, multi}) => {
	const handlePick = useCallback((v) => {
		onPick(v);
		if (!multi) onClose();
	}, [onPick, onClose, multi]);
	const isSelected = (o) => (multi ? (value || []).indexOf(o.value) >= 0 : o.value === value);
	return (
		<CoreDialog open={open} onClose={onClose} title={title} spotlightId="admin-choice" showCancel={!multi}>
			<DialogList className={css.dialogList}>
				{(options || []).map((o) => (
					<ChoiceRow key={String(o.value)} option={o} selected={isSelected(o)} onPick={handlePick} />
				))}
			</DialogList>
			{multi ? (
				<div className={css.dialogActions}><Btn primary label={t('adminDone')} onClick={onClose} /></div>
			) : null}
		</CoreDialog>
	);
};

export const SelectRow = ({label, help, value, options, onChange, disabled, field, placeholder}) => {
	const [open, setOpen] = useState(false);
	const handleOpen = useCallback(() => setOpen(true), []);
	const handleClose = useCallback(() => setOpen(false), []);
	const handlePick = useCallback((v) => onChange(v, field), [onChange, field]);
	const current = (options || []).find((o) => o.value === value);
	return (
		<>
			<Row label={label} help={help} value={current ? current.label : (value || placeholder || '')} chevron disabled={disabled} onClick={handleOpen} />
			<ChoiceDialog open={open} title={label} options={options} value={value} onPick={handlePick} onClose={handleClose} />
		</>
	);
};

// Plusieurs choix cochés (listes de bibliothèques, de codecs, de jours…).
export const MultiRow = ({label, help, values, options, onChange, disabled, field, summary}) => {
	const [open, setOpen] = useState(false);
	const handleOpen = useCallback(() => setOpen(true), []);
	const handleClose = useCallback(() => setOpen(false), []);
	const list = useMemo(() => values || [], [values]);
	const handlePick = useCallback((v) => {
		const next = list.indexOf(v) >= 0 ? list.filter((x) => x !== v) : list.concat([v]);
		onChange(next, field);
	}, [list, onChange, field]);
	const shown = summary !== undefined ? summary : (list.length === 0 ? t('adminNone') : (options || []).filter((o) => list.indexOf(o.value) >= 0).map((o) => o.label).join(', '));
	return (
		<>
			<Row label={label} help={help} value={shown} chevron disabled={disabled} onClick={handleOpen} />
			<ChoiceDialog multi open={open} title={label} options={options} value={list} onPick={handlePick} onClose={handleClose} />
		</>
	);
};

// Un champ texte (ou nombre, ou mot de passe) dans une ligne ; le clavier de la TV s'ouvre sur OK.
export const TextRow = ({label, help, value, onChange, field, type = 'text', numeric, placeholder, suffix, wide, disabled, spotlightId}) => {
	const [text, setText] = useState(value === undefined || value === null ? '' : String(value));
	const editing = useRef(false);
	useEffect(() => {
		if (!editing.current) setText(value === undefined || value === null ? '' : String(value));
	}, [value]);
	const handleChange = useCallback((e) => {
		const v = e && e.target ? e.target.value : e;
		editing.current = true;
		setText(v);
		onChange(v, field);
	}, [onChange, field]);
	const handleBlur = useCallback(() => {
		editing.current = false;
	}, []);
	return (
		<div className={cx(css.inputRow, disabled && css.rowDisabled)}>
			<div className={css.inputLabel}>
				<div className={css.rowLabel}>{label}</div>
				{help ? <div className={css.rowHelp}>{help}</div> : null}
			</div>
			<SpottableInput
				spotlightId={spotlightId}
				className={cx(css.input, wide && css.inputWide)}
				type={type}
				purpose={numeric ? 'numeric' : undefined}
				placeholder={placeholder}
				value={text}
				disabled={disabled}
				onChange={handleChange}
				onBlur={handleBlur}
			/>
			{suffix ? <span className={css.suffix}>{suffix}</span> : null}
		</div>
	);
};

// Nombre entier : saisie au clavier numérique, bornée par min / max.
export const clampNumber = (raw, {min, max, decimals = 0, fallback = null} = {}) => {
	const s = String(raw == null ? '' : raw).replace(',', '.').trim();
	if (s === '') return fallback;
	const n = decimals ? parseFloat(s) : parseInt(s, 10);
	if (!isFinite(n)) return fallback;
	let v = n;
	if (min !== undefined && v < min) v = min;
	if (max !== undefined && v > max) v = max;
	return decimals ? Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals) : v;
};

export const NumberRow = ({label, help, value, onChange, field, min, max, decimals, suffix, fallback = null, placeholder}) => {
	const handleChange = useCallback((text) => {
		onChange(clampNumber(text, {min, max, decimals, fallback}), field);
	}, [onChange, field, min, max, decimals, fallback]);
	return (
		<TextRow label={label} help={help} value={value === null || value === undefined ? '' : value} numeric suffix={suffix} placeholder={placeholder} onChange={handleChange} />
	);
};

// Curseur : gauche et droite changent la valeur, haut et bas passent à la ligne voisine.
export const SliderRow = ({label, help, value, onChange, field, min = 0, max = 100, step = 1, format}) => {
	const v = value === undefined || value === null ? min : Number(value);
	const handleKeyDown = useCallback((e) => {
		const code = e.keyCode || e.which;
		if (code !== KEYS.LEFT && code !== KEYS.RIGHT) return;
		e.preventDefault();
		e.stopPropagation();
		const next = Math.max(min, Math.min(max, Math.round((v + (code === KEYS.RIGHT ? step : -step)) * 1000) / 1000));
		if (next !== v) onChange(next, field);
	}, [v, min, max, step, onChange, field]);
	const pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
	return (
		<SpottableDiv className={css.row} onKeyDown={handleKeyDown}>
			<div className={css.rowText}>
				<div className={css.rowLabel}>{label}</div>
				{help ? <div className={css.rowHelp}>{help}</div> : null}
			</div>
			<div className={css.slider}>
				<div className={css.sliderTrack}><div className={css.sliderFill} style={{width: pct + '%'}} /></div>
				<div className={css.sliderValue}>{format ? format(v) : v}</div>
			</div>
		</SpottableDiv>
	);
};

// Une liste de textes (sous-réseaux, largeurs…) saisie séparée par des virgules.
export const splitList = (text) => String(text || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);

export const ListRow = ({label, help, values, onChange, field, numeric}) => {
	const handleChange = useCallback((text) => {
		const list = splitList(text);
		onChange(numeric ? list.map((x) => parseInt(x, 10)).filter((x) => isFinite(x)) : list, field);
	}, [onChange, field, numeric]);
	return (
		<TextRow
			label={label}
			help={help || t('tvListHelp')}
			value={(values || []).join(', ')}
			onChange={handleChange}
		/>
	);
};

// ----------------------------------------------------------------- dialogues
export const Confirm = ({open, title, message, confirmLabel, danger, onConfirm, onClose}) => {
	const actions = useMemo(() => [
		{label: t('cancel'), onClick: onClose, spotlightId: 'admin-confirm-cancel'},
		{label: confirmLabel || t('adminConfirm'), onClick: onConfirm, destructive: danger, spotlightId: 'admin-confirm-ok'}
	], [onClose, onConfirm, confirmLabel, danger]);
	return (
		<CoreAlertDialog open={open} onClose={onClose} title={title} actions={actions} spotlightId="admin-confirm">
			{message}
		</CoreAlertDialog>
	);
};

// Demande un texte (nom d'une clé, d'un dépôt…) : un ou plusieurs champs, puis Valider.
export const PromptDialog = ({open, title, fields, onSubmit, onClose, submitLabel, message}) => {
	const [values, setValues] = useState({});
	useEffect(() => {
		if (!open) return;
		const init = {};
		(fields || []).forEach((f) => {
			init[f.key] = f.value || '';
		});
		setValues(init);
	}, [open, fields]);
	const handleChange = useCallback((v, key) => setValues((s) => ({...s, [key]: v})), []);
	const handleSubmit = useCallback(() => onSubmit(values), [onSubmit, values]);
	const missing = (fields || []).some((f) => f.required && !String(values[f.key] || '').trim());
	return (
		<CoreDialog open={open} onClose={onClose} title={title} spotlightId="admin-prompt">
			<div className={css.dialogBody}>
				{message ? <div className={css.note}>{message}</div> : null}
				<Group className={css.group}>
					{(fields || []).map((f) => (
						<TextRow key={f.key} field={f.key} label={f.label} help={f.help} type={f.password ? 'password' : 'text'} numeric={f.numeric} placeholder={f.placeholder} value={values[f.key]} onChange={handleChange} />
					))}
				</Group>
				<div className={css.dialogActions}>
					<Btn label={t('cancel')} onClick={onClose} />
					<Btn primary disabled={missing} label={submitLabel || t('adminSave')} onClick={handleSubmit} />
				</div>
			</div>
		</CoreDialog>
	);
};

// Onglets (fiche utilisateur, tâche…) : gauche / droite entre eux, OK pour choisir.
const TabButton = ({tab, on, onPick}) => {
	const handleClick = useCallback(() => onPick(tab.id), [onPick, tab.id]);
	return <SpottableDiv className={cx(css.tab, on && css.tabOn)} onClick={handleClick}>{tab.label}</SpottableDiv>;
};

export const Tabs = ({tabs, value, onChange}) => (
	<Group className={css.tabs}>
		{tabs.map((tab) => <TabButton key={tab.id} tab={tab} on={tab.id === value} onPick={onChange} />)}
	</Group>
);

export {css};
