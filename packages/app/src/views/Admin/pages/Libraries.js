// Bibliothèques (admin_libraries_screen.dart), ajout en étapes
// (admin_library_add_screen.dart) et modification avec ses onglets Chemins /
// Options / Téléchargeurs (admin_library_edit_screen.dart), plus les
// dialogues renommer, supprimer et actualiser les métadonnées
// (admin_library_dialogs.dart).
import {useState, useCallback, useEffect, useRef} from 'react';

import CoreDialog from '../../../components/CoreDialog/CoreDialog';
import {useAdmin, useAdminLoad, useDraftPage, usePoll} from '../adminContext';
import {
	PageHeader, Section, Row, InfoRow, Btn, Progress, Loading, ErrorBox, Tabs, SelectRow, SwitchRow, TextRow, Confirm,
	PromptDialog, Group, Note, css
} from '../AdminUi';
import {FolderBrowser} from '../AdminForm';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';
import {changedKeys, deepCopy} from '../../../services/adminDraft';
import {seedLibraryOptions, newLibraryOptions} from '../../../services/adminLibraryOptions';
import {OptionsPart, Downloaders} from './LibraryOptionsForm';
import {libraryTypeLabel, libraryTypeIcon} from './adminLabels';

// ----------------------------------------------------------------- dialogues
const renameFields = (name) => [{key: 'name', label: t('adminNewName'), help: t('adminRenameLibraryWarning'), value: name, required: true}];

export const RefreshDialog = ({open, itemId, onClose}) => {
	const {api, toast} = useAdmin();
	const [mode, setMode] = useState('scan');
	const [images, setImages] = useState(false);
	const [trickplay, setTrickplay] = useState(false);
	const handleRefresh = useCallback(async () => {
		onClose();
		const full = mode !== 'scan';
		try {
			await api.refreshItem(itemId, {
				recursive: true,
				metadataRefreshMode: full ? 'FullRefresh' : 'Default',
				imageRefreshMode: full ? 'FullRefresh' : 'Default',
				replaceAllMetadata: mode === 'all',
				replaceAllImages: full && images,
				regenerateTrickplay: full && trickplay
			});
			toast(t('adminMetadataRefreshRequested'));
		} catch (e) {
			toast(t('adminMetadataRefreshFailed', {error: describeAdminError(e)}));
		}
	}, [api, itemId, mode, images, trickplay, onClose, toast]);
	const modes = [
		{value: 'scan', label: t('adminRefreshModeScan')},
		{value: 'missing', label: t('adminRefreshModeMissing')},
		{value: 'all', label: t('adminReplaceAllMetadata')}
	];
	return (
		<CoreDialog open={open} onClose={onClose} title={t('adminRefreshMetadata')} spotlightId="admin-refresh">
			<div className={css.dialogBody}>
				<Group className={css.group}>
					<SelectRow label={t('adminRefreshMode')} value={mode} options={modes} onChange={setMode} />
					{mode !== 'scan' ? <SwitchRow label={t('adminReplaceImages')} value={images} onChange={setImages} /> : null}
					{mode !== 'scan' ? <SwitchRow label={t('adminReplaceTrickplayImages')} value={trickplay} onChange={setTrickplay} /> : null}
				</Group>
				<Note>{t('adminRefreshDialogHelp')}</Note>
				<div className={css.dialogActions}>
					<Btn label={t('cancel')} onClick={onClose} />
					<Btn primary label={t('refresh')} onClick={handleRefresh} />
				</div>
			</div>
		</CoreDialog>
	);
};

// Les actions d'une bibliothèque (menu « … » de l'APK).
const LibraryMenu = ({library, onClose, onEdit, onChanged}) => {
	const {api, toast} = useAdmin();
	const [dialog, setDialog] = useState(null);
	const handleEdit = useCallback(() => {
		onClose();
		onEdit(library);
	}, [onClose, onEdit, library]);
	const handleRefresh = useCallback(() => setDialog('refresh'), []);
	const handleRename = useCallback(() => setDialog('rename'), []);
	const handleDelete = useCallback(() => setDialog('delete'), []);
	const handleDialogClose = useCallback(() => {
		setDialog(null);
		onClose();
	}, [onClose]);
	const handleRenamed = useCallback(async ({name}) => {
		const newName = String(name || '').trim();
		setDialog(null);
		onClose();
		if (!newName || newName === library.Name) return;
		try {
			await api.renameVirtualFolder(library.Name, newName, true);
			toast(t('adminLibraryRenamed', {name: newName}));
			onChanged();
		} catch (e) {
			toast(t('adminRenameFailed', {error: describeAdminError(e)}));
		}
	}, [api, library, onClose, onChanged, toast]);
	const handleDeleted = useCallback(async () => {
		setDialog(null);
		onClose();
		try {
			await api.removeVirtualFolder(library.Name, true);
			toast(t('adminLibraryDeleted', {name: library.Name}));
			onChanged();
		} catch (e) {
			toast(t('adminLibraryDeleteFailed', {error: describeAdminError(e)}));
		}
	}, [api, library, onClose, onChanged, toast]);
	return (
		<>
			<CoreDialog open={!dialog} onClose={onClose} title={library.Name} spotlightId="admin-library-menu">
				<Group className={css.group}>
					<Row icon="refresh" label={t('adminRefreshLibrary')} onClick={handleRefresh} />
					<Row icon="edit" label={t('edit')} onClick={handleEdit} />
					<Row icon="textinput" label={t('rename')} onClick={handleRename} />
					<Row icon="warning" label={t('delete')} onClick={handleDelete} />
				</Group>
			</CoreDialog>
			<RefreshDialog open={dialog === 'refresh'} itemId={library.ItemId} onClose={handleDialogClose} />
			<PromptDialog open={dialog === 'rename'} title={t('adminRenameLibrary')} fields={renameFields(library.Name)} submitLabel={t('rename')} onSubmit={handleRenamed} onClose={handleDialogClose} />
			<Confirm
				open={dialog === 'delete'}
				title={t('adminDeleteLibrary')}
				message={`${t('adminDeleteLibraryConfirm', {name: library.Name})}${(library.Locations || []).length ? `\n${t('adminDeleteLibraryLocations')}\n${library.Locations.join('\n')}` : ''}`}
				confirmLabel={t('delete')}
				danger
				onConfirm={handleDeleted}
				onClose={handleDialogClose}
			/>
		</>
	);
};

// ----------------------------------------------------------------- la liste
const LibraryRow = ({library, onOpen}) => {
	const handleClick = useCallback(() => onOpen(library), [onOpen, library]);
	return (
		<Row
			icon={libraryTypeIcon(library.CollectionType)}
			label={library.Name}
			help={[libraryTypeLabel(library.CollectionType)].concat(library.Locations || []).join(' · ')}
			chevron
			onClick={handleClick}
		/>
	);
};

const Libraries = () => {
	const {api, push, toast} = useAdmin();
	const load = useCallback(() => api.getVirtualFolders(), [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [tasks, setTasks] = useState([]);
	const [menu, setMenu] = useState(null);
	const loadTasks = useCallback(() => api.getTasks(false).then(setTasks, () => {}), [api]);
	useEffect(() => {
		loadTasks();
	}, [loadTasks]);
	usePoll(loadTasks, 3000);
	const scanTask = tasks.find((x) => x.Key === 'RefreshLibrary');
	const scanning = scanTask && scanTask.State !== 'Idle';
	const handleScan = useCallback(async () => {
		if (!scanTask) return;
		try {
			await api.startTask(scanTask.Id);
			toast(t('adminLibraryScanStarted'));
			loadTasks();
		} catch (e) {
			toast(t('adminScanFailed', {error: describeAdminError(e)}));
		}
	}, [api, scanTask, toast, loadTasks]);
	const handleAdd = useCallback(() => push('libraryAdd', {}, t('adminAddLibrary')), [push]);
	const handleEdit = useCallback((lib) => push('libraryEdit', {libraryId: lib.ItemId}, lib.Name), [push]);
	const handleMenuClose = useCallback(() => setMenu(null), []);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={t('adminLibrariesLoadFailed')} message={error} onRetry={reload} />;
	const progress = scanTask && scanTask.State === 'Running' ? Math.round(scanTask.CurrentProgressPercentage || 0) : null;
	return (
		<div>
			<PageHeader title={t('adminDrawerLibraries')} subtitle={t('adminPageDescLibraries')}>
				<Btn small icon="refresh" disabled={!scanTask || scanning} label={progress !== null ? `${t('adminRefreshAllLibraries')} ${progress} %` : t('adminRefreshAllLibraries')} onClick={handleScan} />
				<Btn small primary icon="add" label={t('adminAddLibrary')} onClick={handleAdd} />
			</PageHeader>
			{progress !== null ? <Progress value={progress} /> : null}
			<Section>
				{!data.length ? <InfoRow label={t('adminNoLibraries')} /> : data.map((lib) => <LibraryRow key={lib.ItemId || lib.Name} library={lib} onOpen={setMenu} />)}
			</Section>
			{menu ? <LibraryMenu library={menu} onClose={handleMenuClose} onEdit={handleEdit} onChanged={reload} /> : null}
		</div>
	);
};

// ----------------------------------------------------------------- ajout en étapes
const NEW_TYPES = ['movies', 'tvshows', 'music', 'musicvideos', 'books', 'homevideos', 'mixed'];
const NEW_TYPE_LABELS = {homevideos: 'homeVideosAndPhotos', mixed: 'mixedMoviesAndShows'};
const newTypeLabel = (type) => (NEW_TYPE_LABELS[type] ? t(NEW_TYPE_LABELS[type]) : libraryTypeLabel(type));

const TypeRow = ({type, onPick}) => {
	const handleClick = useCallback(() => onPick(type), [onPick, type]);
	return <Row icon={libraryTypeIcon(type)} label={newTypeLabel(type)} chevron onClick={handleClick} />;
};

const PathItem = ({path, onRemove}) => {
	const handleClick = useCallback(() => onRemove(path), [onRemove, path]);
	return <Row icon="folder" label={path} value={t('remove')} onClick={handleClick} />;
};

export const LibraryAdd = () => {
	const {api, pop, toast} = useAdmin();
	const [step, setStep] = useState(0);
	const [type, setType] = useState(null);
	const [name, setName] = useState('');
	const [paths, setPaths] = useState([]);
	const [options, setOptions] = useState(null);
	const [available, setAvailable] = useState({});
	const [cultures, setCultures] = useState([]);
	const [countries, setCountries] = useState([]);
	const [browsing, setBrowsing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [, setTick] = useState(0);
	const loadId = useRef(0);

	const loadOptions = useCallback(async (ty) => {
		const id = ++loadId.current;
		setOptions(null);
		const avail = await api.getAvailableLibraryOptions(ty === 'mixed' ? null : ty, true).catch(() => ({}));
		const cs = await api.getCultures().catch(() => []);
		const ct = await api.getCountries().catch(() => []);
		if (id !== loadId.current) return;
		setAvailable(avail);
		setCultures(cs);
		setCountries(ct);
		setOptions(newLibraryOptions(avail));
	}, [api]);

	const handlePickType = useCallback((ty) => {
		if (ty !== type || !options) loadOptions(ty);
		setType(ty);
		setName((n) => n || newTypeLabel(ty));
		setStep(1);
	}, [type, options, loadOptions]);
	const handleNext = useCallback(() => {
		if (step === 1 && !name.trim()) {
			toast(t('adminLibraryNameRequired'));
			return;
		}
		if (step === 2 && !paths.length) {
			toast(t('adminLibraryFolderRequired'));
			return;
		}
		setStep((s) => s + 1);
	}, [step, name, paths, toast]);
	const handleBack = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);
	const handleBrowse = useCallback(() => setBrowsing(true), []);
	const handleBrowseClose = useCallback(() => setBrowsing(false), []);
	const handlePickPath = useCallback((p) => {
		setBrowsing(false);
		setPaths((list) => (list.indexOf(p) >= 0 ? list : list.concat([p])));
	}, []);
	const handleRemovePath = useCallback((p) => setPaths((list) => list.filter((x) => x !== p)), []);
	const handleSet = useCallback((v, key) => {
		setOptions((o) => ({...o, [key]: v}));
	}, []);
	const handleEdit = useCallback((change) => {
		change();
		setTick((n) => n + 1);
	}, []);
	const handleCreate = useCallback(async () => {
		if (!options) return;
		setSaving(true);
		try {
			await api.addVirtualFolder({name: name.trim(), collectionType: type === 'mixed' ? null : type, paths, libraryOptions: options, refreshLibrary: true});
			pop();
		} catch (e) {
			toast(t('adminLibraryCreateFailed', {error: describeAdminError(e)}));
		} finally {
			setSaving(false);
		}
	}, [api, name, type, paths, options, pop, toast]);

	const steps = [t('type'), t('name'), t('paths'), t('adminLibraryTabOptions'), t('confirm')];
	const nav = (
		<div className={css.dialogActions}>
			{step > 0 ? <Btn label={t('back')} onClick={handleBack} /> : null}
			{step > 0 && step < 4 ? <Btn primary label={t('next')} onClick={handleNext} /> : null}
		</div>
	);
	return (
		<div>
			<PageHeader title={t('adminAddLibrary')} subtitle={steps.map((s, i) => (i === step ? `[${i + 1}. ${s}]` : `${i + 1}. ${s}`)).join('   ')} />
			{step === 0 ? (
				<Section title={t('type')}>
					{NEW_TYPES.map((ty) => <TypeRow key={ty} type={ty} onPick={handlePickType} />)}
				</Section>
			) : null}
			{step === 1 ? (
				<Section title={t('name')}>
					<TextRow label={t('adminLibraryName')} value={name} onChange={setName} />
				</Section>
			) : null}
			{step === 2 ? (
				<Section title={t('adminSelectedPaths')}>
					{!paths.length ? <InfoRow label={t('adminLibraryFolderRequired')} /> : paths.map((p) => <PathItem key={p} path={p} onRemove={handleRemovePath} />)}
					<Row icon="add" label={t('adminBrowseFilesystem')} onClick={handleBrowse} />
				</Section>
			) : null}
			{step === 3 ? (options ? (
				<div>
					<OptionsPart options={options} available={available} collectionType={type === 'mixed' ? null : type} cultures={cultures} countries={countries} onSet={handleSet} />
					<Downloaders options={options} available={available} collectionType={type === 'mixed' ? null : type} onEdit={handleEdit} />
				</div>
			) : <Loading />) : null}
			{step === 4 ? (
				<Section title={t('confirm')}>
					<InfoRow label={t('type')} value={newTypeLabel(type)} />
					<InfoRow label={t('name')} value={name.trim()} />
					<InfoRow label={t('paths')} help={paths.join('\n')} />
					<div className={css.btnRow}>
						<Btn label={t('back')} onClick={handleBack} />
						<Btn primary icon="add" disabled={saving || !options} label={t('adminCreateLibrary')} onClick={handleCreate} />
					</div>
				</Section>
			) : nav}
			<FolderBrowser open={browsing} title={t('adminBrowseFilesystem')} onPick={handlePickPath} onClose={handleBrowseClose} />
		</div>
	);
};

// ----------------------------------------------------------------- modification
export const LibraryEdit = ({libraryId}) => {
	const {api, toast} = useAdmin();
	const [tab, setTab] = useState('paths');
	const [browsing, setBrowsing] = useState(false);
	const [removing, setRemoving] = useState(null);
	const [busy, setBusy] = useState(false);
	const pending = useRef(null);
	const fetchLibrary = useCallback(async () => {
		const folders = await api.getVirtualFolders();
		const found = folders.find((f) => f.ItemId === libraryId);
		if (!found) throw new Error(t('adminLibraryLoadFailed'));
		return found;
	}, [api, libraryId]);
	const load = useCallback(async () => {
		const found = await fetchLibrary();
		const [cultures, countries, available] = await Promise.all([
			api.getCultures().catch(() => []),
			api.getCountries().catch(() => []),
			api.getAvailableLibraryOptions(found.CollectionType).catch(() => ({}))
		]);
		const seeded = (l) => seedLibraryOptions(deepCopy(l.LibraryOptions || {}), available);
		return {
			targets: {
				options: {
					value: seeded(found),
					reload: async () => seeded(await fetchLibrary()),
					post: (value) => api.updateLibraryOptions(libraryId, value)
				}
			},
			extra: {lib: found, cultures, countries, available}
		};
	}, [api, fetchLibrary, libraryId]);
	const {status, error, draft, extra, reload} = useDraftPage(load);

	// Après un changement de dossier, la page est relue et les modifications en cours y sont remises.
	useEffect(() => {
		if (draft && pending.current) {
			const keep = pending.current;
			pending.current = null;
			Object.keys(keep).forEach((k) => draft.set(k, keep[k], 'options'));
		}
	}, [draft]);
	const reloadAfterPathChange = useCallback(() => {
		if (draft) {
			const working = draft.working('options');
			const keep = {};
			changedKeys(extra.lib.LibraryOptions ? seedLibraryOptions(deepCopy(extra.lib.LibraryOptions), extra.available) : {}, working)
				.filter((k) => k !== 'PathInfos')
				.forEach((k) => {
					keep[k] = deepCopy(working[k]);
				});
			pending.current = keep;
		}
		reload();
	}, [draft, extra, reload]);

	const handleBrowse = useCallback(() => setBrowsing(true), []);
	const handleBrowseClose = useCallback(() => setBrowsing(false), []);
	const handleAddPath = useCallback(async (p) => {
		setBrowsing(false);
		if ((extra.lib.Locations || []).indexOf(p) >= 0) return;
		setBusy(true);
		try {
			await api.addMediaPath(extra.lib.Name, p, true);
			reloadAfterPathChange();
		} catch (e) {
			toast(t('adminAddPathFailed', {error: describeAdminError(e)}));
		} finally {
			setBusy(false);
		}
	}, [api, extra, reloadAfterPathChange, toast]);
	const handleRemoveClose = useCallback(() => setRemoving(null), []);
	const handleRemoveConfirm = useCallback(async () => {
		const p = removing;
		setRemoving(null);
		setBusy(true);
		try {
			await api.removeMediaPath(extra.lib.Name, p, true);
			reloadAfterPathChange();
		} catch (e) {
			toast(t('adminRemovePathFailed', {error: describeAdminError(e)}));
		} finally {
			setBusy(false);
		}
	}, [api, removing, extra, reloadAfterPathChange, toast]);
	const handleSet = useCallback((v, key) => draft.set(key, v, 'options'), [draft]);
	const handleEdit = useCallback((change) => {
		change();
		draft.touch();
	}, [draft]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={t('adminLibraryLoadFailed')} message={error} onRetry={reload} />;
	const lib = extra.lib;
	const type = lib.CollectionType || null;
	const showPaths = type !== 'boxsets' && type !== 'playlists';
	const tabs = (showPaths ? [{id: 'paths', label: t('adminLibraryTabPaths')}] : []).concat([
		{id: 'options', label: t('adminLibraryTabOptions')},
		{id: 'downloaders', label: t('adminLibraryTabDownloaders')}
	]);
	const current = !showPaths && tab === 'paths' ? 'options' : tab;
	const options = draft.working('options');
	return (
		<div>
			<PageHeader title={lib.Name} subtitle={libraryTypeLabel(type)} />
			<Tabs tabs={tabs} value={current} onChange={setTab} />
			{current === 'paths' ? (
				<Section title={t('adminLibraryTabPaths')}>
					{!(lib.Locations || []).length ? <InfoRow label={t('adminNoMediaPaths')} /> : lib.Locations.map((p) => <PathItem key={p} path={p} onRemove={setRemoving} />)}
					<Row icon="add" label={t('adminAddPath')} disabled={busy} onClick={handleBrowse} />
				</Section>
			) : null}
			{current === 'options' ? <OptionsPart options={options} available={extra.available} collectionType={type} cultures={extra.cultures} countries={extra.countries} onSet={handleSet} /> : null}
			{current === 'downloaders' ? <Downloaders options={options} available={extra.available} collectionType={type} onEdit={handleEdit} /> : null}
			<FolderBrowser open={browsing} title={t('adminBrowseFilesystem')} onPick={handleAddPath} onClose={handleBrowseClose} />
			<Confirm open={!!removing} title={t('adminRemovePath')} message={t('adminRemovePathConfirm', {path: removing || ''})} confirmLabel={t('remove')} danger onConfirm={handleRemoveConfirm} onClose={handleRemoveClose} />
		</div>
	);
};

export default Libraries;
