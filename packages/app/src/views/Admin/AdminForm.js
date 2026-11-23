// Une page de réglages décrite par un schéma : sections de lignes liées aux
// clés d'un objet de configuration (System/Configuration, metadata, encoding…).
// Le brouillon garde les modifications jusqu'à « Enregistrer » dans la barre du bas.
import {useState, useCallback, useEffect} from 'react';

import {getPath} from '../../services/adminDraft';
import {describeAdminError} from '../../services/adminApi';
import {useAdmin, useDraftPage} from './adminContext';
import {
	PageHeader, Section, Loading, ErrorBox, SwitchRow, TextRow, NumberRow, SliderRow, SelectRow,
	MultiRow, ListRow, Row, InfoRow, Btn, Group, Note, css
} from './AdminUi';
import CoreDialog from '../../components/CoreDialog/CoreDialog';
import {t} from './adminText';

// ----------------------------------------------------------------- explorateur de dossiers (filesystem_browser.dart)
const FolderEntry = ({entry, onOpen}) => {
	const handleClick = useCallback(() => onOpen(entry.Path), [onOpen, entry.Path]);
	return <Row icon={entry.Type === 'File' ? 'description' : 'folder'} label={entry.Name || entry.Path} onClick={handleClick} />;
};

export const FolderBrowser = ({open, title, initialPath, includeFiles, onPick, onClose}) => {
	const {api} = useAdmin();
	const [path, setPath] = useState('');
	const [entries, setEntries] = useState([]);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);

	const go = useCallback(async (target) => {
		setLoading(true);
		setError(null);
		try {
			const list = target ? await api.getDirectoryContents(target, {includeFiles: !!includeFiles, includeDirectories: true}) : await api.getDrives();
			setPath(target || '');
			setEntries(list);
		} catch (e) {
			setError(describeAdminError(e));
		} finally {
			setLoading(false);
		}
	}, [api, includeFiles]);

	useEffect(() => {
		if (open) go(initialPath || '');
	}, [open, initialPath, go]);

	const handleUp = useCallback(async () => {
		if (!path) return;
		try {
			const parent = await api.getParentPath(path);
			go(parent || '');
		} catch {
			go('');
		}
	}, [api, path, go]);
	const handlePick = useCallback(() => onPick(path), [onPick, path]);

	return (
		<CoreDialog open={open} onClose={onClose} title={title || t('adminBrowse')} subtitle={path || t('adminFsDrives')} spotlightId="admin-folders">
			<div className={css.dialogBody}>
				<div className={css.dialogActions}>
					{path ? <Btn small icon="arrow_left" label={t('adminFsUp')} onClick={handleUp} /> : null}
					{path ? <Btn small primary label={t('adminFsSelect')} onClick={handlePick} /> : null}
				</div>
				{error ? <Note>{error}</Note> : null}
				{loading ? <Loading /> : (
					<Group className={`${css.group} ${css.dialogList}`}>
						{entries.length === 0 ? <InfoRow label={t('adminFsEmpty')} /> : entries.map((e) => (
							<FolderEntry key={e.Path} entry={e} onOpen={e.Type === 'File' ? onPick : go} />
						))}
					</Group>
				)}
			</div>
		</CoreDialog>
	);
};

export const PathRow = ({label, help, value, onChange, field, includeFiles}) => {
	const [open, setOpen] = useState(false);
	const handleOpen = useCallback(() => setOpen(true), []);
	const handleClose = useCallback(() => setOpen(false), []);
	const handlePick = useCallback((p) => {
		setOpen(false);
		onChange(p, field);
	}, [onChange, field]);
	return (
		<>
			<TextRow label={label} help={help} value={value} onChange={onChange} field={field} />
			<Row icon="folder" label={t('adminBrowse')} help={label} onClick={handleOpen} />
			<FolderBrowser open={open} title={label} initialPath={value} includeFiles={includeFiles} onPick={handlePick} onClose={handleClose} />
		</>
	);
};

// ----------------------------------------------------------------- lignes du schéma
const FieldRow = ({row, draft, extra}) => {
	const target = row.target || 'main';
	const working = draft.working(target);
	const handleChange = useCallback((v) => {
		if (row.write) row.write(working, v, extra);
		else draft.set(row.key, v, target);
		if (row.write) draft.touch();
	}, [row, working, draft, target, extra]);
	const raw = row.read ? row.read(working, extra) : getPath(working, row.key);
	const value = raw === undefined || raw === null ? row.fallback : raw;
	const common = {label: row.label, help: row.help, onChange: handleChange, disabled: row.disabled};
	switch (row.kind) {
		case 'switch':
			return <SwitchRow {...common} value={!!value} />;
		case 'text':
			return <TextRow {...common} value={value} type={row.password ? 'password' : 'text'} placeholder={row.placeholder} wide={row.wide} />;
		case 'number':
			return <NumberRow {...common} value={value} min={row.min} max={row.max} decimals={row.decimals} suffix={row.suffix} placeholder={row.placeholder} fallback={row.empty === undefined ? null : row.empty} />;
		case 'slider':
			return <SliderRow {...common} value={value} min={row.min} max={row.max} step={row.step} format={row.format} />;
		case 'select':
			return <SelectRow {...common} value={value} options={row.options} placeholder={row.placeholder} />;
		case 'multi':
			return <MultiRow {...common} values={value || []} options={row.options} />;
		case 'list':
			return <ListRow {...common} values={value || []} numeric={row.numeric} />;
		case 'path':
			return <PathRow {...common} value={value} includeFiles={row.includeFiles} />;
		case 'info':
			return <InfoRow label={row.label} help={row.help} value={value} />;
		default:
			return null;
	}
};

export const SchemaSections = ({sections, draft, extra}) => (
	<>
		{sections.filter(Boolean).map((section, i) => {
			const rows = (section.rows || []).filter((r) => r && (!r.when || r.when(draft.working(r.target || 'main'), extra)));
			if (!rows.length && !section.custom) return null;
			return (
				<Section key={section.id || i} title={section.title} help={section.help}>
					{rows.map((row, j) => (row.kind === 'custom' ? <div key={row.id || j}>{row.render(draft, extra)}</div> : (
						<FieldRow key={(row.target || 'main') + ':' + (row.key || row.id || j)} row={row} draft={draft} extra={extra} />
					)))}
					{section.custom ? section.custom(draft, extra) : null}
				</Section>
			);
		})}
	</>
);

/**
 * page = {title, subtitle, load: (api) => ({targets, extra}), sections: (draft, extra) => [...], footer}
 */
export const DraftForm = ({page}) => {
	const {api} = useAdmin();
	const loader = useCallback(() => page.load(api), [page, api]);
	const {status, error, draft, extra, reload} = useDraftPage(loader);
	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={page.loadFailed ? t(page.loadFailed) : undefined} message={error} onRetry={reload} />;
	return (
		<div>
			<PageHeader title={page.title} subtitle={page.subtitle} />
			<SchemaSections sections={page.sections(draft, extra)} draft={draft} extra={extra} />
			{page.footer ? page.footer(draft, extra) : null}
		</div>
	);
};

// Un objet de configuration simple comme cible de brouillon.
export const configTarget = (value, reload, post) => ({value, reload, post});

// Les options (code, nom) d'une liste de localisation, avec « Par défaut » et la valeur actuelle inconnue gardée.
export const localizationOptions = (items, current, codeOf, nameOf) => {
	const seen = {};
	const out = [{value: '', label: t('adminLibDefault')}];
	(items || []).forEach((it) => {
		const code = codeOf(it);
		if (!code || seen[code]) return;
		seen[code] = true;
		out.push({value: code, label: nameOf(it) || code});
	});
	if (current && !seen[current]) out.push({value: current, label: current});
	return out;
};
