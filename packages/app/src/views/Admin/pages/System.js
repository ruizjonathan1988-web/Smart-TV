// Système : plugins installés et catalogue (admin_plugins_screen.dart), fiche
// d'un plugin (admin_plugin_detail_screen.dart), dépôts
// (admin_repositories_screen.dart), sauvegardes (admin_backups_screen.dart) et
// journaux du serveur (admin_logs_screen.dart, admin_log_viewer_screen.dart).
import {useState, useCallback, useEffect, useMemo, useRef} from 'react';

import CoreDialog from '../../../components/CoreDialog/CoreDialog';
import {useAdmin, useAdminLoad} from '../adminContext';
import {
	PageHeader, Section, Row, InfoRow, Btn, Chip, Loading, ErrorBox, Tabs, SelectRow, SwitchRow, TextRow, Confirm,
	PromptDialog, Group, Note, Warn, SpottableDiv, css
} from '../AdminUi';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';
import {updateFor, formatBytes, formatDateTime} from '../../../services/adminFormat';

const sameId = (a, b) => String(a || '').replace(/-/g, '').toLowerCase() === String(b || '').replace(/-/g, '').toLowerCase();

const statusChip = (status) => {
	switch (status) {
		case 'Active': return <Chip tone="good">{t('adminPluginsActive')}</Chip>;
		case 'Disabled': return <Chip>{t('disabled')}</Chip>;
		case 'Restart': return <Chip tone="warn">{t('adminPluginsChangesPending')}</Chip>;
		case 'Deleted': return <Chip tone="warn">{t('adminPluginsPendingRemoval')}</Chip>;
		case 'Malfunctioned': return <Chip tone="bad">{t('adminPluginDetailMalfunctioned')}</Chip>;
		case 'NotSupported': return <Chip tone="bad">{t('adminPluginDetailNotSupported')}</Chip>;
		case 'Superseded': return <Chip>{t('adminPluginDetailSuperseded')}</Chip>;
		default: return null;
	}
};

const statusBanner = (status) => {
	switch (status) {
		case 'Restart': return t('adminPluginDetailRestartRequired');
		case 'Deleted': return t('adminPluginDetailRemovalPending');
		case 'Malfunctioned': return t('adminPluginDetailMalfunctioned');
		case 'NotSupported': return t('adminPluginDetailNotSupported');
		case 'Superseded': return t('adminPluginDetailSuperseded');
		default: return null;
	}
};

// Les actions partagées par la liste et la fiche.
const usePluginActions = (onDone) => {
	const {api, toast} = useAdmin();
	const toggle = useCallback(async (plugin) => {
		try {
			if (plugin.Status === 'Disabled') await api.enablePlugin(plugin.Id, plugin.Version);
			else await api.disablePlugin(plugin.Id, plugin.Version);
			onDone();
		} catch (e) {
			toast(t('adminPluginToggleFailed', {error: describeAdminError(e)}));
		}
	}, [api, onDone, toast]);
	const uninstall = useCallback(async (plugin) => {
		try {
			await api.uninstallPlugin(plugin.Id, plugin.Version);
			toast(t('adminPluginRemoveAfterRestart', {name: plugin.Name}));
			onDone();
		} catch (e) {
			toast(t('adminPluginUninstallFailed', {error: describeAdminError(e)}));
		}
	}, [api, onDone, toast]);
	const install = useCallback(async (pkg, version, isUpdate, pluginName) => {
		try {
			await api.installPackage(pkg.name, {assemblyGuid: pkg.guid, version: version.version, repositoryUrl: version.repositoryUrl});
			toast(isUpdate ? t('adminPluginUpdating', {name: pluginName || pkg.name, version: version.version}) : t('adminPluginsInstalling', {name: pkg.name}));
			onDone();
		} catch (e) {
			toast(isUpdate ? t('adminPluginUpdateFailed', {error: describeAdminError(e)}) : t('adminPackageInstallFailed', {error: describeAdminError(e)}));
		}
	}, [api, onDone, toast]);
	return {toggle, uninstall, install};
};

// ----------------------------------------------------------------- plugins
const PluginRow = ({plugin, update, onOpen}) => {
	const {api} = useAdmin();
	const handleClick = useCallback(() => onOpen(plugin), [onOpen, plugin]);
	const img = plugin.HasImage ? <img src={api.getPluginImageUrl(plugin)} alt="" /> : String(plugin.Name || '?').charAt(0);
	return (
		<Row avatar={img} label={plugin.Name} help={plugin.Description || `v${plugin.Version}`} chevron onClick={handleClick}>
			<div>
				<Chip>{`v${plugin.Version}`}</Chip>
				{statusChip(plugin.Status)}
				{update ? <Chip tone="accent">{t('adminPluginsUpdateAvailable', {version: update.version.version})}</Chip> : null}
			</div>
		</Row>
	);
};

const PackageRow = ({pkg, installed, onInstall}) => {
	const handleClick = useCallback(() => onInstall(pkg), [onInstall, pkg]);
	const latest = (pkg.versions || [])[0];
	return (
		<Row
			label={pkg.name}
			help={pkg.overview || pkg.description}
			value={installed ? t('adminPluginsInstalled') : latest ? `v${latest.version}` : ''}
			disabled={installed || !latest}
			onClick={handleClick}
		>
			{pkg.category ? <Chip>{pkg.category}</Chip> : null}
		</Row>
	);
};

export const Plugins = () => {
	const {api, push} = useAdmin();
	const load = useCallback(async () => {
		const [installed, available] = await Promise.all([api.getInstalledPlugins(), api.getAvailablePackages().catch(() => [])]);
		return {plugins: installed, packages: available};
	}, [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const quiet = useCallback(() => reload(true), [reload]);
	const {install} = usePluginActions(quiet);
	const [tab, setTab] = useState('installed');
	const [search, setSearch] = useState('');
	const [filter, setFilter] = useState('all');
	const [category, setCategory] = useState('');
	const [installing, setInstalling] = useState(null);
	const handleOpen = useCallback((p) => push('pluginDetail', {pluginId: p.Id}, p.Name), [push]);
	const handleAskInstall = useCallback((pkg) => setInstalling(pkg), []);
	const handleInstallClose = useCallback(() => setInstalling(null), []);
	const handleInstall = useCallback(() => {
		const pkg = installing;
		setInstalling(null);
		if (pkg && pkg.versions && pkg.versions[0]) install(pkg, pkg.versions[0], false);
	}, [installing, install]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox message={t('adminPluginsLoadFailed', {error})} onRetry={reload} />;
	const q = search.trim().toLowerCase();
	const plugins = data.plugins
		.filter((p) => filter === 'all' || (filter === 'active' ? p.Status === 'Active' : p.Status === 'Restart' || p.Status === 'Deleted'))
		.filter((p) => !q || String(p.Name || '').toLowerCase().indexOf(q) >= 0)
		.sort((a, b) => String(a.Name).localeCompare(String(b.Name)));
	const categories = Array.from(new Set(data.packages.map((p) => p.category).filter(Boolean))).sort();
	const packages = data.packages
		.filter((p) => !category || p.category === category)
		.filter((p) => !q || String(p.name || '').toLowerCase().indexOf(q) >= 0 || String(p.description || '').toLowerCase().indexOf(q) >= 0)
		.sort((a, b) => String(a.name).localeCompare(String(b.name)));
	return (
		<div>
			<PageHeader title={t('adminDrawerPlugins')} subtitle={t('adminPageDescPlugins')} />
			<Tabs tabs={[{id: 'installed', label: t('adminPluginsInstalled')}, {id: 'catalog', label: t('adminPluginsCatalog')}]} value={tab} onChange={setTab} />
			<Section>
				<TextRow label={t('adminSearchPlugins')} value={search} onChange={setSearch} />
				{tab === 'installed' ? (
					<SelectRow label={t('status')} value={filter} options={[{value: 'all', label: t('all')}, {value: 'active', label: t('adminPluginsActive')}, {value: 'restart', label: t('adminPluginsRestartRequired')}]} onChange={setFilter} />
				) : (
					<SelectRow label={t('tvCategory')} value={category} options={[{value: '', label: t('all')}].concat(categories.map((c) => ({value: c, label: c})))} onChange={setCategory} />
				)}
			</Section>
			{tab === 'installed' ? (
				<Section>
					{!plugins.length ? <InfoRow label={t('adminPluginsNoneInstalled')} /> : plugins.map((p) => <PluginRow key={p.Id} plugin={p} update={updateFor(p, data.packages)} onOpen={handleOpen} />)}
				</Section>
			) : (
				<Section>
					{!packages.length ? <InfoRow label={q ? t('adminPluginsCatalogNoSearchResults') : t('adminPluginsCatalogEmpty')} /> : packages.map((pkg) => (
						<PackageRow key={pkg.guid || pkg.name} pkg={pkg} installed={data.plugins.some((p) => sameId(p.Id, pkg.guid))} onInstall={handleAskInstall} />
					))}
				</Section>
			)}
			<Confirm
				open={!!installing}
				title={t('adminPluginInstallConfirmTitle', {name: installing ? installing.name : ''})}
				message={t('adminPluginInstallDisclaimer')}
				confirmLabel={t('install')}
				onConfirm={handleInstall}
				onClose={handleInstallClose}
			/>
		</div>
	);
};

export const PluginDetail = ({pluginId}) => {
	const {api, pop} = useAdmin();
	const load = useCallback(async () => {
		const [plugins, packages, pages] = await Promise.all([
			api.getInstalledPlugins(),
			api.getAvailablePackages().catch(() => []),
			api.getConfigurationPages().catch(() => [])
		]);
		return {plugin: plugins.find((p) => p.Id === pluginId) || null, packages, pages};
	}, [api, pluginId]);
	const {status, data, error, reload} = useAdminLoad(load);
	const quiet = useCallback(() => reload(true), [reload]);
	const {toggle, uninstall, install} = usePluginActions(quiet);
	const [confirm, setConfirm] = useState(false);
	const handleToggle = useCallback(() => toggle(data.plugin), [toggle, data]);
	const handleAskUninstall = useCallback(() => setConfirm(true), []);
	const handleClose = useCallback(() => setConfirm(false), []);
	const handleUninstall = useCallback(async () => {
		setConfirm(false);
		await uninstall(data.plugin);
		pop();
	}, [uninstall, data, pop]);
	const handleUpdate = useCallback(() => {
		const u = updateFor(data.plugin, data.packages);
		if (u) install(u.pkg, u.version, true, data.plugin.Name);
	}, [install, data]);
	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox message={t('adminPluginLoadFailed', {error})} onRetry={reload} />;
	const plugin = data.plugin;
	if (!plugin) return <ErrorBox message={t('adminPluginNotFound')} />;
	const pkg = data.packages.find((p) => sameId(p.guid, plugin.Id));
	const update = updateFor(plugin, data.packages);
	const banner = statusBanner(plugin.Status);
	const page = data.pages.find((p) => sameId(p.PluginId, plugin.Id));
	const history = pkg ? (pkg.versions || []).slice(0, 10) : [];
	return (
		<div>
			<PageHeader title={plugin.Name} subtitle={plugin.Description}>{statusChip(plugin.Status)}</PageHeader>
			{banner ? <Warn>{banner}</Warn> : null}
			<Section title={t('adminPluginDetailDetails')}>
				<InfoRow label={t('version')} value={plugin.Version} />
				{pkg && pkg.owner ? <InfoRow label={t('adminPluginDetailDeveloper')} value={pkg.owner} /> : null}
				{update && update.version.repositoryName ? <InfoRow label={t('adminPluginDetailRepository')} value={update.version.repositoryName} /> : null}
				{pkg && pkg.category ? <InfoRow label={t('tvCategory')} value={pkg.category} /> : null}
			</Section>
			<Section title={t('settings')}>
				{plugin.CanUninstall ? <SwitchRow label={t('adminPluginDetailEnablePlugin')} value={plugin.Status !== 'Disabled'} onChange={handleToggle} /> : null}
				{update ? <Row icon="system_update_alt" label={t('adminPluginsInstallUpdateVersioned', {version: update.version.version})} onClick={handleUpdate} /> : null}
				{page ? <InfoRow label={t('adminPluginSettingsPage')} help={t('tvPluginSettingsElsewhere')} /> : null}
				{plugin.CanUninstall ? <Row icon="warning" label={t('uninstall')} onClick={handleAskUninstall} /> : null}
			</Section>
			{history.length ? (
				<Section title={t('adminRevisionHistory')}>
					{history.map((v) => <InfoRow key={v.version} label={`v${v.version}`} help={v.changelog || t('adminNoChangelog')} value={v.timestamp ? formatDateTime(v.timestamp) : ''} />)}
				</Section>
			) : null}
			<Confirm open={confirm} title={t('adminUninstallPlugin')} message={t('adminUninstallPluginConfirm', {name: plugin.Name})} confirmLabel={t('uninstall')} danger onConfirm={handleUninstall} onClose={handleClose} />
		</div>
	);
};

// ----------------------------------------------------------------- dépôts
const SORTS = [['oldest', 'adminRepoSortDateOldest'], ['newest', 'adminRepoSortDateNewest'], ['az', 'adminRepoSortNameAsc'], ['za', 'adminRepoSortNameDesc']];

const RepoRow = ({repo, index, onEdit, onToggle, onRemove}) => {
	const handleEdit = useCallback(() => onEdit(index), [onEdit, index]);
	const handleToggle = useCallback(() => onToggle(index), [onToggle, index]);
	const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);
	return (
		<div className={css.splitRow}>
			<SpottableDiv className={css.splitMain} onClick={handleEdit}>
				<div className={css.rowLabel}>{repo.Name || t('adminReposUnnamed')}</div>
				<div className={css.rowHelp}>{repo.Url}</div>
			</SpottableDiv>
			<Btn small label={repo.Enabled !== false ? t('disable') : t('enable')} onClick={handleToggle} />
			<Btn small danger label={t('adminReposRemove')} onClick={handleRemove} />
		</div>
	);
};

export const Repositories = () => {
	const {api, toast} = useAdmin();
	const load = useCallback(() => api.getRepositories(), [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [sort, setSort] = useState('oldest');
	const [dialog, setDialog] = useState(null);
	const save = useCallback(async (repos) => {
		try {
			await api.setRepositories(repos);
			reload(true);
		} catch (e) {
			toast(t('adminRepositoriesSaveFailed', {error: describeAdminError(e)}));
		}
	}, [api, reload, toast]);
	const handleAdd = useCallback(() => setDialog({kind: 'edit', index: null}), []);
	const handleEdit = useCallback((index) => setDialog({kind: 'edit', index}), []);
	const handleRemove = useCallback((index) => setDialog({kind: 'remove', index}), []);
	const handleToggle = useCallback((index) => save(data.map((r, i) => (i === index ? {...r, Enabled: r.Enabled === false} : r))), [save, data]);
	const handleClose = useCallback(() => setDialog(null), []);
	const handleSubmit = useCallback(({name, url}) => {
		const index = dialog.index;
		setDialog(null);
		const repo = {...(index !== null ? data[index] : {Enabled: true}), Name: String(name || '').trim(), Url: String(url || '').trim()};
		save(index !== null ? data.map((r, i) => (i === index ? repo : r)) : data.concat([repo]));
	}, [dialog, data, save]);
	const handleConfirmRemove = useCallback(() => {
		const index = dialog.index;
		setDialog(null);
		save(data.filter((r, i) => i !== index));
	}, [dialog, data, save]);
	const fields = useMemo(() => {
		const repo = dialog && dialog.index !== null && data ? data[dialog.index] : null;
		return [
			{key: 'name', label: t('name'), placeholder: t('adminReposNameHint'), value: repo ? repo.Name : ''},
			{key: 'url', label: t('adminReposUrl'), value: repo ? repo.Url : '', required: true}
		];
	}, [dialog, data]);
	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox message={t('adminRepositoriesLoadFailed', {error})} onRetry={reload} />;
	const sorted = data.map((repo, index) => ({repo, index}));
	const nameOf = (r) => String(r.Name || r.Url || '').toLowerCase();
	if (sort === 'newest') sorted.reverse();
	if (sort === 'az') sorted.sort((a, b) => nameOf(a.repo).localeCompare(nameOf(b.repo)));
	if (sort === 'za') sorted.sort((a, b) => nameOf(b.repo).localeCompare(nameOf(a.repo)));
	const d = dialog || {};
	const removing = d.kind === 'remove' ? data[d.index] : null;
	return (
		<div>
			<PageHeader title={t('adminDrawerRepositories')} subtitle={t('adminReposEmptySubtitle')}>
				<Btn small primary icon="add" label={t('adminReposAddTitle')} onClick={handleAdd} />
			</PageHeader>
			<Section>
				<SelectRow label={t('tvSort')} value={sort} options={SORTS.map(([v, k]) => ({value: v, label: t(k)}))} onChange={setSort} />
			</Section>
			<Section>
				{!data.length ? <InfoRow label={t('adminReposEmpty')} /> : sorted.map(({repo, index}) => <RepoRow key={`${repo.Url}:${index}`} repo={repo} index={index} onEdit={handleEdit} onToggle={handleToggle} onRemove={handleRemove} />)}
			</Section>
			<PromptDialog open={d.kind === 'edit'} title={d.index !== null && d.index !== undefined ? t('adminReposEditTitle') : t('adminReposAddTitle')} fields={fields} onSubmit={handleSubmit} onClose={handleClose} />
			<Confirm open={!!removing} title={t('adminReposRemoveTitle')} message={removing ? t('adminReposRemoveConfirm', {name: removing.Name || removing.Url}) : ''} confirmLabel={t('adminReposRemove')} danger onConfirm={handleConfirmRemove} onClose={handleClose} />
		</div>
	);
};

// ----------------------------------------------------------------- sauvegardes
const backupPath = (b) => String(b.Path || '');
const backupName = (b) => {
	const p = backupPath(b);
	return p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1) || p;
};
const RESTORE_POLL_MS = 10000;

const BackupRow = ({backup, onManifest, onRestore}) => {
	const handleManifest = useCallback(() => onManifest(backup), [onManifest, backup]);
	const handleRestore = useCallback(() => onRestore(backup), [onRestore, backup]);
	return (
		<div className={css.splitRow}>
			<SpottableDiv className={css.splitMain} onClick={handleManifest}>
				<div className={css.rowLabel}>{backupName(backup)}</div>
				<div className={css.rowHelp}>{formatDateTime(backup.DateCreated)}</div>
			</SpottableDiv>
			<Btn small label={t('adminViewDetails')} onClick={handleManifest} />
			<Btn small danger label={t('restore')} onClick={handleRestore} />
		</div>
	);
};

export const Backups = () => {
	const {api, toast} = useAdmin();
	const load = useCallback(() => api.getBackups(), [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [dialog, setDialog] = useState(null);
	const [options, setOptions] = useState({Metadata: false, Subtitles: false, Trickplay: false});
	const [busy, setBusy] = useState(null);
	const alive = useRef(true);
	useEffect(() => () => {
		alive.current = false;
	}, []);
	const handleCreate = useCallback(() => setDialog({kind: 'options'}), []);
	const handleClose = useCallback(() => setDialog(null), []);
	const handleOption = useCallback((v, k) => setOptions((o) => ({...o, [k]: v})), []);
	const runCreate = useCallback(async () => {
		setDialog(null);
		setBusy({title: t('adminCreatingBackup'), text: t('adminBackupDisclaimer')});
		try {
			await api.createBackup(options);
			toast(t('adminBackupCreated'));
			reload(true);
		} catch (e) {
			toast(t('adminBackupCreateFailed', {error: describeAdminError(e)}));
		} finally {
			if (alive.current) setBusy(null);
		}
	}, [api, options, reload, toast]);
	const handleOptionsDone = useCallback(async () => {
		let running = [];
		try {
			running = (await api.getTasks(false)).filter((x) => x.State && x.State !== 'Idle').map((x) => x.Name);
		} catch {
			running = [];
		}
		if (running.length) setDialog({kind: 'tasks', running});
		else runCreate();
	}, [api, runCreate]);
	const handleManifest = useCallback(async (backup) => {
		const path = backupPath(backup);
		if (!path) {
			toast(t('adminBackupPathMissing'));
			return;
		}
		try {
			const manifest = await api.getBackupManifest(path);
			setDialog({kind: 'manifest', backup, manifest});
		} catch (e) {
			toast(t('adminManifestLoadFailed', {error: e.status === 404 ? t('adminBackupArchiveNotFound') : describeAdminError(e)}));
		}
	}, [api, toast]);
	const handleRestore = useCallback((backup) => {
		if (!backupPath(backup)) {
			toast(t('adminBackupPathMissing'));
			return;
		}
		setDialog({kind: 'restore', backup, step: 0});
	}, [toast]);
	const handleRestoreStep = useCallback(async () => {
		const cur = dialog;
		if (cur.step < 3) {
			setDialog({...cur, step: cur.step + 1});
			return;
		}
		setDialog(null);
		setBusy({title: t('adminRestoringBackup')});
		try {
			await api.restoreBackup(backupPath(cur.backup));
		} catch (e) {
			setBusy(null);
			toast(t('adminRestoreFailed', {error: e.status === 404 ? t('adminBackupArchiveNotFound') : describeAdminError(e)}));
			return;
		}
		// Le serveur redémarre : on attend qu'il réponde de nouveau.
		setBusy({title: t('adminRestoreInProgress'), text: t('adminRestoreWaitingForServer')});
		for (;;) {
			await new Promise((resolve) => setTimeout(resolve, RESTORE_POLL_MS));
			if (!alive.current) return;
			try {
				await api.call('GET', '/System/Info/Public');
				break;
			} catch {
				// toujours en train de redémarrer
			}
		}
		setBusy(null);
		toast(t('adminRestoreSucceeded'));
		reload(true);
	}, [api, dialog, reload, toast]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={t('adminBackupsLoadFailed')} message={error && error.indexOf('404') >= 0 ? t('adminBackupsNotAvailable') : error} onRetry={reload} />;
	const d = dialog || {};
	const steps = [t('adminRestoreWarning1'), t('adminRestoreWarning2'), t('adminRestoreWarning3'), d.backup ? t('adminRestoreConfirmMessage', {name: backupName(d.backup)}) : ''];
	const backups = data.slice().sort((a, b) => String(b.DateCreated || '').localeCompare(String(a.DateCreated || '')));
	return (
		<div>
			<PageHeader title={t('adminBackupsTitle')} subtitle={t('adminBackupsHelp')}>
				<Btn small icon="refresh" label={t('refresh')} onClick={reload} />
				<Btn small primary icon="add" label={t('adminCreateBackup')} disabled={!!busy} onClick={handleCreate} />
			</PageHeader>
			{busy ? <Warn>{`${busy.title}${busy.text ? ` — ${busy.text}` : ''}`}</Warn> : null}
			<Section>
				{!backups.length ? <InfoRow label={t('adminNoBackups')} /> : backups.map((b) => <BackupRow key={backupPath(b)} backup={b} onManifest={handleManifest} onRestore={handleRestore} />)}
			</Section>
			{d.kind === 'options' ? (
				<CoreDialog open onClose={handleClose} title={t('adminBackupOptionsTitle')} spotlightId="admin-backup-options">
					<div className={css.dialogBody}>
						<Note>{t('adminBackupDisclaimer')}</Note>
						<Group className={css.group}>
							<InfoRow label={t('adminBackupDatabase')} help={t('adminBackupDatabaseAlways')} />
							<SwitchRow field="Metadata" label={t('adminBackupMetadata')} value={options.Metadata} onChange={handleOption} />
							<SwitchRow field="Subtitles" label={t('adminBackupSubtitles')} value={options.Subtitles} onChange={handleOption} />
							<SwitchRow field="Trickplay" label={t('adminBackupTrickplay')} value={options.Trickplay} onChange={handleOption} />
						</Group>
						<div className={css.dialogActions}>
							<Btn label={t('cancel')} onClick={handleClose} />
							<Btn primary label={t('create')} onClick={handleOptionsDone} />
						</div>
					</div>
				</CoreDialog>
			) : null}
			<Confirm open={d.kind === 'tasks'} title={t('adminBackupTasksWarningTitle')} message={d.running ? `${t('adminBackupTasksWarning')}\n${d.running.join('\n')}` : ''} confirmLabel={t('create')} onConfirm={runCreate} onClose={handleClose} />
			<Confirm open={d.kind === 'restore'} title={t('adminConfirmRestore')} message={steps[d.step || 0]} confirmLabel={d.step === 3 ? t('restore') : t('continueAction')} danger={d.step === 3} onConfirm={handleRestoreStep} onClose={handleClose} />
			{d.kind === 'manifest' ? (
				<CoreDialog open onClose={handleClose} title={t('adminBackupManifest', {name: backupName(d.backup)})} spotlightId="admin-backup-manifest">
					<div className={css.dialogBody}>
						<Group className={`${css.group} ${css.dialogList}`}>
							{Object.keys(d.manifest).map((k) => <InfoRow key={k} label={k} help={typeof d.manifest[k] === 'object' ? JSON.stringify(d.manifest[k]) : String(d.manifest[k])} />)}
						</Group>
						<div className={css.dialogActions}><Btn primary label={t('close')} onClick={handleClose} /></div>
					</div>
				</CoreDialog>
			) : null}
		</div>
	);
};

// ----------------------------------------------------------------- journaux
const LogFileRow = ({file, onOpen}) => {
	const handleClick = useCallback(() => onOpen(file), [onOpen, file]);
	return <Row icon="article" label={file.Name} help={formatDateTime(file.DateModified || file.DateCreated)} value={formatBytes(file.Size)} chevron onClick={handleClick} />;
};

export const Logs = () => {
	const {api, push} = useAdmin();
	const load = useCallback(() => api.getLogFiles(), [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [newest, setNewest] = useState(true);
	const handleSort = useCallback(() => setNewest((n) => !n), []);
	const handleOpen = useCallback((f) => push('logViewer', {fileName: f.Name}, f.Name), [push]);
	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox message={error} onRetry={reload} />;
	const files = data.slice().sort((a, b) => {
		const c = String(a.DateModified || a.DateCreated || '').localeCompare(String(b.DateModified || b.DateCreated || ''));
		return newest ? -c : c;
	});
	return (
		<div>
			<PageHeader title={t('adminLogsTitle')} subtitle={t('adminPageDescLogs')}>
				<Btn small label={newest ? t('adminLogsNewestFirst') : t('adminLogsOldestFirst')} onClick={handleSort} />
				<Btn small icon="refresh" label={t('refresh')} onClick={reload} />
			</PageHeader>
			<Section>
				{!files.length ? <InfoRow label={t('adminNoLogFiles')} /> : files.map((f) => <LogFileRow key={f.Name} file={f} onOpen={handleOpen} />)}
			</Section>
		</div>
	);
};

// ERR, WRN, INF ou DBG d'une ligne de journal Jellyfin, sinon null.
export const logLevel = (line) => {
	const upper = String(line).toUpperCase();
	for (const level of ['ERR', 'WRN', 'INF', 'DBG']) {
		if (upper.indexOf(`[${level}]`) >= 0) return level;
	}
	return null;
};

const LINES_PAGE = 400;

const LogLine = ({line}) => {
	const level = logLevel(line);
	return <SpottableDiv className={`${css.logLine} ${css.mono} ${level === 'ERR' ? css.logError : level === 'WRN' ? css.logWarn : ''}`}>{line || ' '}</SpottableDiv>;
};

export const LogViewer = ({fileName}) => {
	const {api} = useAdmin();
	const load = useCallback(() => api.getLogFileContent(fileName), [api, fileName]);
	const {status, data, error, reload} = useAdminLoad(load);
	const [query, setQuery] = useState('');
	const [level, setLevel] = useState('');
	const [shown, setShown] = useState(LINES_PAGE);
	const handleMore = useCallback(() => setShown((n) => n + LINES_PAGE), []);
	const lines = useMemo(() => {
		const q = query.trim().toLowerCase();
		return String(data || '').replace(/\r\n/g, '\n').split('\n')
			.filter((line) => (!q || line.toLowerCase().indexOf(q) >= 0) && (!level || logLevel(line) === level));
	}, [data, query, level]);
	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox message={error} onRetry={reload} />;
	// Les lignes les plus récentes sont à la fin : on part de la fin.
	const start = Math.max(0, lines.length - shown);
	return (
		<div>
			<PageHeader title={fileName}>
				<Btn small icon="refresh" label={t('refresh')} onClick={reload} />
			</PageHeader>
			<Section>
				<TextRow label={t('search')} value={query} onChange={setQuery} />
				<SelectRow label={t('tvLevel')} value={level} options={[{value: '', label: t('all')}, {value: 'ERR', label: 'ERR'}, {value: 'WRN', label: 'WRN'}, {value: 'INF', label: 'INF'}, {value: 'DBG', label: 'DBG'}]} onChange={setLevel} />
			</Section>
			<Section title={t('tvLogLines', {shown: lines.length - start, total: lines.length})}>
				{start > 0 ? <Row label={t('tvShowOlder')} chevron onClick={handleMore} /> : null}
				<div style={{padding: '0.6rem 0.8rem'}}>
					{lines.slice(start).map((line, i) => <LogLine key={start + i} line={line} />)}
				</div>
			</Section>
		</div>
	);
};
