// TV en direct (admin_live_tv_screen.dart et live_tv_dialogs.dart) : onglet
// Sources (tuners, appareils détectés, fournisseurs de guide XMLTV et
// Schedules Direct, correspondance des chaînes, actualisation du guide) et
// onglet Enregistrements (jours de guide, dossiers, marges, post-traitement,
// NFO et images), enregistré avec la barre du bas.
import {useState, useCallback, useEffect, useRef} from 'react';

import CoreDialog from '../../../components/CoreDialog/CoreDialog';
import {useAdmin, useDraftPage} from '../adminContext';
import {PathRow, SchemaSections} from '../AdminForm';
import {
	PageHeader, Section, Row, InfoRow, Btn, Loading, ErrorBox, Tabs, SelectRow, SwitchRow, TextRow, Confirm, Group, Note,
	ChoiceDialog, css
} from '../AdminUi';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';

const maps = (raw) => (Array.isArray(raw) ? raw.filter((x) => x && typeof x === 'object') : []);
const text = (m, k) => (m && m[k] != null ? String(m[k]) : '');

export const tunerName = (tuner) => {
	const name = text(tuner, 'FriendlyName').trim();
	if (name) return name;
	const type = text(tuner, 'Type');
	if (type === 'm3u') return t('adminTunerTypeM3u');
	if (type === 'hdhomerun') return t('adminTunerTypeHdHomerun');
	return type || t('unknown');
};

const sourceName = (type) => {
	switch (String(type || '').toLowerCase()) {
		case 'xmltv': return t('adminProviderXmltv');
		case 'schedulesdirect': return t('adminProviderSchedulesDirect');
		default: return null;
	}
};

// Le fournisseur tel que le serveur l'a, pour garder ce que le formulaire ne montre pas.
const storedProvider = async (api, id, fallback) => {
	if (id) {
		const config = await api.getLiveTvConfiguration();
		const found = maps(config.ListingProviders).find((p) => p.Id === id);
		if (found) return {...found};
	}
	return {...fallback};
};

// « Activer pour tous les tuners », sinon une case par tuner.
const useEnabledTuners = (seed, tuners) => {
	const [all, setAll] = useState(seed.EnableAllTuners !== false);
	const [enabled, setEnabled] = useState(() => tuners.filter((x) => seed.EnableAllTuners !== false || (seed.EnabledTuners || []).indexOf(x.Id) >= 0).map((x) => String(x.Id)));
	const apply = useCallback((info) => {
		info.EnableAllTuners = all;
		info.EnabledTuners = all ? [] : tuners.filter((x) => enabled.indexOf(String(x.Id)) >= 0).map((x) => String(x.Id));
	}, [all, enabled, tuners]);
	const handleTuner = useCallback((on, id) => setEnabled((list) => (on ? list.concat([id]) : list.filter((x) => x !== id))), []);
	const rows = (
		<>
			<SwitchRow label={t('adminEnableAllTuners')} value={all} onChange={setAll} />
			{!all ? tuners.map((x) => <SwitchRow key={x.Id} field={String(x.Id)} label={tunerName(x)} help={text(x, 'Url')} value={enabled.indexOf(String(x.Id)) >= 0} onChange={handleTuner} />) : null}
		</>
	);
	return {apply, rows};
};

const DialogFrame = ({title, error, onClose, onSave, saving, saveLabel, children}) => (
	<CoreDialog open onClose={onClose} title={title} spotlightId="admin-livetv-dialog">
		<div className={css.dialogBody}>
			<Group className={`${css.group} ${css.dialogList}`}>{children}</Group>
			{error ? <Note>{error}</Note> : null}
			<div className={css.dialogActions}>
				<Btn label={t('cancel')} onClick={onClose} />
				{onSave ? <Btn primary disabled={saving} label={saveLabel || t('save')} onClick={onSave} /> : null}
			</div>
		</div>
	</CoreDialog>
);

// ----------------------------------------------------------------- tuner (LiveTvTunerDialog)
const mbps = (bps) => {
	const v = Number(bps) || 0;
	if (v <= 0) return '30';
	return v % 1000000 === 0 ? String(v / 1000000) : String(v / 1000000);
};

const TunerDialog = ({seed, types, onSaved, onClose}) => {
	const {api} = useAdmin();
	const id = text(seed, 'Id');
	const [type, setType] = useState(text(seed, 'Type') || types[0].value);
	const [url, setUrl] = useState(text(seed, 'Url'));
	const [name, setName] = useState(text(seed, 'FriendlyName'));
	const [agent, setAgent] = useState(text(seed, 'UserAgent'));
	const [count, setCount] = useState(String(Number(seed.TunerCount) || 0));
	const [bitrate, setBitrate] = useState(mbps(seed.FallbackMaxStreamingBitrate));
	const [flags, setFlags] = useState({
		ImportFavoritesOnly: seed.ImportFavoritesOnly === true,
		AllowHWTranscoding: seed.AllowHWTranscoding === true,
		AllowFmp4TranscodingContainer: seed.AllowFmp4TranscodingContainer === true,
		AllowStreamSharing: seed.AllowStreamSharing !== false,
		EnableStreamLooping: seed.EnableStreamLooping === true,
		IgnoreDts: seed.IgnoreDts !== false,
		ReadAtNativeFramerate: seed.ReadAtNativeFramerate !== false
	});
	const [error, setError] = useState(null);
	const [saving, setSaving] = useState(false);
	const handleFlag = useCallback((v, k) => setFlags((f) => ({...f, [k]: v})), []);
	const handleType = useCallback((v) => {
		if (!id) setType(v);
	}, [id]);
	const handleSave = useCallback(async () => {
		setSaving(true);
		setError(null);
		try {
			const orNull = (s) => (String(s || '').trim() ? String(s).trim() : null);
			await api.addTunerHost({
				...(id ? {Id: id} : null),
				Type: type,
				Url: orNull(url),
				UserAgent: orNull(agent),
				FriendlyName: orNull(name),
				DeviceId: text(seed, 'DeviceId') || null,
				TunerCount: parseInt(count, 10) || 0,
				FallbackMaxStreamingBitrate: Math.round((parseFloat(String(bitrate).replace(',', '.')) || 30) * 1000000),
				...flags
			});
			onSaved(seed);
		} catch (e) {
			setSaving(false);
			setError(describeAdminError(e));
		}
	}, [api, id, type, url, agent, name, seed, count, bitrate, flags, onSaved]);
	const isM3u = type === 'm3u';
	const isHd = type === 'hdhomerun';
	const typeOptions = types.some((x) => x.value === type) ? types : types.concat([{value: type, label: type}]);
	return (
		<DialogFrame title={id ? t('adminLiveTvEditTuner') : t('adminLiveTvAddTuner')} error={error} saving={saving} onSave={handleSave} onClose={onClose}>
			<SelectRow label={t('adminLiveTvTunerType')} value={type} options={typeOptions} disabled={!!id} onChange={handleType} />
			{isM3u ? <PathRow label={t('adminTunerFileOrUrl')} value={url} includeFiles onChange={setUrl} /> : null}
			{isHd ? <TextRow label={t('adminTunerIpAddress')} value={url} onChange={setUrl} /> : null}
			<TextRow label={t('adminTunerFriendlyName')} value={name} onChange={setName} />
			{isM3u ? <TextRow label={t('adminTunerUserAgent')} value={agent} onChange={setAgent} /> : null}
			{isM3u ? <TextRow label={t('adminTunerCount')} help={t('adminTunerCountHelp')} numeric value={count} onChange={setCount} /> : null}
			{isM3u || isHd ? <TextRow label={t('adminTunerFallbackBitrate')} numeric suffix="Mbps" value={bitrate} onChange={setBitrate} /> : null}
			{isHd ? <SwitchRow field="ImportFavoritesOnly" label={t('adminTunerImportFavoritesOnly')} value={flags.ImportFavoritesOnly} onChange={handleFlag} /> : null}
			{isHd ? <SwitchRow field="AllowHWTranscoding" label={t('adminTunerAllowHwTranscoding')} value={flags.AllowHWTranscoding} onChange={handleFlag} /> : null}
			{isHd ? <InfoRow label={t('adminLiveTvDrmNote')} /> : null}
			{isM3u ? <SwitchRow field="AllowFmp4TranscodingContainer" label={t('adminTunerAllowFmp4')} value={flags.AllowFmp4TranscodingContainer} onChange={handleFlag} /> : null}
			{isM3u ? <SwitchRow field="AllowStreamSharing" label={t('adminTunerAllowStreamSharing')} value={flags.AllowStreamSharing} onChange={handleFlag} /> : null}
			{isM3u ? <SwitchRow field="EnableStreamLooping" label={t('adminTunerEnableStreamLooping')} value={flags.EnableStreamLooping} onChange={handleFlag} /> : null}
			{isM3u ? <SwitchRow field="IgnoreDts" label={t('adminTunerIgnoreDts')} value={flags.IgnoreDts} onChange={handleFlag} /> : null}
			{isM3u ? <SwitchRow field="ReadAtNativeFramerate" label={t('adminTunerReadAtNativeFramerate')} value={flags.ReadAtNativeFramerate} onChange={handleFlag} /> : null}
		</DialogFrame>
	);
};

// ----------------------------------------------------------------- XMLTV (LiveTvXmltvDialog)
const CATEGORY_KEYS = [['MovieCategories', 'adminXmltvMovieCategories'], ['KidsCategories', 'adminXmltvKidsCategories'], ['NewsCategories', 'adminXmltvNewsCategories'], ['SportsCategories', 'adminXmltvSportsCategories']];

const XmltvDialog = ({seed, tuners, onSaved, onClose}) => {
	const {api} = useAdmin();
	const id = text(seed, 'Id');
	const [path, setPath] = useState(text(seed, 'Path'));
	const [prefix, setPrefix] = useState(text(seed, 'MoviePrefix'));
	const [agent, setAgent] = useState(text(seed, 'UserAgent'));
	const [cats, setCats] = useState(() => {
		const c = {};
		CATEGORY_KEYS.forEach(([k]) => {
			c[k] = (seed[k] || []).join('|');
		});
		return c;
	});
	const [error, setError] = useState(null);
	const [saving, setSaving] = useState(false);
	const tunerSel = useEnabledTuners(seed, tuners);
	const handleCat = useCallback((v, k) => setCats((c) => ({...c, [k]: v})), []);
	const handleSave = useCallback(async () => {
		setSaving(true);
		setError(null);
		try {
			const info = await storedProvider(api, id, seed);
			info.Type = 'xmltv';
			info.Path = path.trim();
			info.MoviePrefix = prefix.trim() || null;
			info.UserAgent = agent.trim() || null;
			CATEGORY_KEYS.forEach(([k]) => {
				info[k] = String(cats[k] || '').split('|').map((x) => x.trim()).filter(Boolean);
			});
			tunerSel.apply(info);
			await api.addListingProvider(info, {validateListings: true});
			onSaved();
		} catch (e) {
			setSaving(false);
			setError(describeAdminError(e));
		}
	}, [api, id, seed, path, prefix, agent, cats, tunerSel, onSaved]);
	return (
		<DialogFrame title={t('adminProviderXmltv')} error={error} saving={saving} onSave={handleSave} onClose={onClose}>
			<PathRow label={t('adminXmltvPath')} help={t('adminLiveTvXmltvPathHelp')} value={path} includeFiles onChange={setPath} />
			<TextRow field="MovieCategories" label={t('adminXmltvMovieCategories')} help={t('adminXmltvCategoriesHelp')} value={cats.MovieCategories} onChange={handleCat} />
			<TextRow label={t('adminXmltvMoviePrefix')} value={prefix} onChange={setPrefix} />
			{CATEGORY_KEYS.slice(1).map(([k, label]) => <TextRow key={k} field={k} label={t(label)} value={cats[k]} onChange={handleCat} />)}
			<TextRow label={t('adminTunerUserAgent')} value={agent} onChange={setAgent} />
			{tunerSel.rows}
		</DialogFrame>
	);
};

// ----------------------------------------------------------------- Schedules Direct (LiveTvSchedulesDirectDialog)
const SchedulesDirectDialog = ({seed, tuners, onSaved, onClose}) => {
	const {api} = useAdmin();
	const [id, setId] = useState(text(seed, 'Id'));
	const [signedIn, setSignedIn] = useState(text(seed, 'Username') !== '' && text(seed, 'Password') !== '');
	const [username, setUsername] = useState(text(seed, 'Username'));
	const [password, setPassword] = useState('');
	const [countries, setCountries] = useState([]);
	const [country, setCountry] = useState(text(seed, 'Country'));
	const [zip, setZip] = useState(text(seed, 'ZipCode'));
	const [lineups, setLineups] = useState([]);
	const [listingsId, setListingsId] = useState(text(seed, 'ListingsId'));
	const [busy, setBusy] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState(null);
	const tunerSel = useEnabledTuners(seed, tuners);
	const listingsRef = useRef(listingsId);
	listingsRef.current = listingsId;

	useEffect(() => {
		api.getSchedulesDirectCountries().then(setCountries, (e) => setError(describeAdminError(e)));
	}, [api]);
	useEffect(() => {
		if (!signedIn || !zip.trim()) {
			setLineups([]);
			return undefined;
		}
		let alive = true;
		api.getListingProviderLineups({providerId: id, location: zip.trim(), country}).then((found) => {
			if (!alive) return;
			setLineups(found);
			if (!found.some((l) => text(l, 'Id') === listingsRef.current)) setListingsId('');
		}, (e) => {
			if (alive) {
				setLineups([]);
				setError(describeAdminError(e));
			}
		});
		return () => {
			alive = false;
		};
	}, [api, signedIn, id, country, zip]);

	const handleSignIn = useCallback(async () => {
		setBusy(true);
		setError(null);
		try {
			const info = await storedProvider(api, id, {EnableAllTuners: true});
			info.Type = 'SchedulesDirect';
			info.Username = username.trim();
			// En clair exprès : le serveur le hache quand il demande un jeton.
			info.Password = password;
			if (id) info.Id = id;
			const result = await api.addListingProvider(info, {validateLogin: true});
			setPassword('');
			if (text(result, 'Id')) setId(text(result, 'Id'));
			setSignedIn(true);
			setSaved(true);
		} catch (e) {
			setError(describeAdminError(e));
		} finally {
			setBusy(false);
		}
	}, [api, id, username, password]);
	const handleSave = useCallback(async () => {
		if (!listingsId) {
			setError(t('adminLiveTvSdSelectLineup'));
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const info = await storedProvider(api, id, seed);
			info.Type = 'SchedulesDirect';
			info.ZipCode = zip.trim();
			info.Country = country;
			info.ListingsId = listingsId;
			if (id) info.Id = id;
			if (password) {
				info.Username = username.trim();
				info.Password = password;
			}
			tunerSel.apply(info);
			await api.addListingProvider(info, {validateListings: true});
			onSaved();
		} catch (e) {
			setBusy(false);
			setError(describeAdminError(e));
		}
	}, [api, id, seed, zip, country, listingsId, password, username, tunerSel, onSaved]);
	const handleClose = useCallback(() => (saved ? onSaved() : onClose()), [saved, onSaved, onClose]);
	const countryOptions = [{value: '', label: t('adminSdCountrySelect')}].concat(countries.map((c) => ({value: text(c, 'shortName'), label: text(c, 'fullName')})));
	const lineupOptions = lineups.map((l) => ({value: text(l, 'Id'), label: text(l, 'Name')}));
	return (
		<DialogFrame title={t('adminProviderSchedulesDirect')} error={error} saving={busy} onSave={signedIn ? handleSave : null} onClose={handleClose}>
			<InfoRow label={t('adminLiveTvSdCreateAccount', {url: 'https://www.schedulesdirect.org'})} />
			<TextRow label={t('adminSdUsername')} value={username} onChange={setUsername} />
			<TextRow label={t('adminSdPassword')} type="password" value={password} onChange={setPassword} />
			<Row icon="lock" label={t('adminLiveTvSdSignIn')} disabled={busy || !username.trim() || !password} onClick={handleSignIn} />
			{signedIn ? <SelectRow label={t('adminSdCountry')} value={country} options={countryOptions} onChange={setCountry} /> : null}
			{signedIn ? <TextRow label={t('adminSdPostalCode')} value={zip} onChange={setZip} /> : null}
			{signedIn && lineupOptions.length ? <SelectRow label={t('adminLiveTvSdLineup')} value={listingsId} options={lineupOptions} onChange={setListingsId} /> : null}
			{signedIn ? tunerSel.rows : null}
		</DialogFrame>
	);
};

// ----------------------------------------------------------------- correspondance des chaînes (LiveTvChannelMapperDialog)
const MapRow = ({channel, onPick}) => {
	const handleClick = useCallback(() => onPick(channel), [onPick, channel]);
	return <Row label={text(channel, 'Name')} value={text(channel, 'ProviderChannelName') || '—'} chevron onClick={handleClick} />;
};

const ChannelMapper = ({providerId, onClose}) => {
	const {api} = useAdmin();
	const [state, setState] = useState({loading: true, channels: [], providers: [], error: null});
	const [picking, setPicking] = useState(null);
	useEffect(() => {
		let alive = true;
		api.getChannelMappingOptions(providerId).then((o) => {
			if (!alive) return;
			setState({loading: false, channels: maps(o.TunerChannels), providers: maps(o.ProviderChannels).sort((a, b) => text(a, 'Name').localeCompare(text(b, 'Name'))), error: null});
		}, (e) => {
			if (alive) setState({loading: false, channels: [], providers: [], error: describeAdminError(e)});
		});
		return () => {
			alive = false;
		};
	}, [api, providerId]);
	const handlePickClose = useCallback(() => setPicking(null), []);
	const handlePicked = useCallback(async (value) => {
		const channel = picking;
		setPicking(null);
		if (!channel || value === text(channel, 'ProviderChannelId')) return;
		try {
			const mapping = await api.setChannelMapping(providerId, text(channel, 'Id'), value);
			const option = state.providers.find((p) => text(p, 'Id') === value);
			setState((s) => ({...s, channels: s.channels.map((c) => (c === channel ? {...c, ProviderChannelName: mapping.ProviderChannelName || (option && option.Name), ProviderChannelId: mapping.ProviderChannelId || value} : c))}));
		} catch (e) {
			setState((s) => ({...s, error: t('adminChannelMappingsUpdateFailed', {error: describeAdminError(e)})}));
		}
	}, [api, providerId, picking, state.providers]);
	const options = state.providers.map((p) => ({value: text(p, 'Id'), label: text(p, 'Name')}));
	return (
		<CoreDialog open onClose={onClose} title={t('adminLiveTvMapChannels')} spotlightId="admin-channel-map">
			<div className={css.dialogBody}>
				{state.loading ? <Loading /> : null}
				{state.error ? <Note>{state.error}</Note> : null}
				{!state.loading && !state.channels.length ? <Note>{t('adminLiveTvNoTunerChannels')}</Note> : null}
				<Group className={`${css.group} ${css.dialogList}`}>
					{state.channels.map((c) => <MapRow key={text(c, 'Id')} channel={c} onPick={setPicking} />)}
				</Group>
				<div className={css.dialogActions}><Btn primary label={t('close')} onClick={onClose} /></div>
			</div>
			{picking ? <ChoiceDialog open title={text(picking, 'Name')} options={options} value={text(picking, 'ProviderChannelId')} onPick={handlePicked} onClose={handlePickClose} /> : null}
		</CoreDialog>
	);
};

// ----------------------------------------------------------------- lignes
const TunerRow = ({tuner, onEdit, onDelete}) => {
	const handleEdit = useCallback(() => onEdit(tuner), [onEdit, tuner]);
	const handleDelete = useCallback(() => onDelete(tuner), [onDelete, tuner]);
	return (
		<div className={css.splitRow}>
			<div className={css.splitMain}>
				<div className={css.rowLabel}>{tunerName(tuner)}</div>
				{text(tuner, 'Url') ? <div className={css.rowHelp}>{text(tuner, 'Url')}</div> : null}
			</div>
			<Btn small label={t('edit')} onClick={handleEdit} />
			<Btn small danger label={t('delete')} onClick={handleDelete} />
		</div>
	);
};

const ProviderRow = ({provider, onEdit, onMap, onDelete}) => {
	const handleEdit = useCallback(() => onEdit(provider), [onEdit, provider]);
	const handleMap = useCallback(() => onMap(provider), [onMap, provider]);
	const handleDelete = useCallback(() => onDelete(provider), [onDelete, provider]);
	const type = text(provider, 'Type');
	const name = sourceName(type) || type || t('unknown');
	const path = text(provider, 'Path') || text(provider, 'ListingsId');
	return (
		<div className={css.splitRow}>
			<div className={css.splitMain}>
				<div className={css.rowLabel}>{name}</div>
				{path ? <div className={css.rowHelp}>{path}</div> : null}
			</div>
			{sourceName(type) ? <Btn small label={t('edit')} onClick={handleEdit} /> : null}
			<Btn small label={t('adminLiveTvMapChannels')} onClick={handleMap} />
			<Btn small danger label={t('delete')} onClick={handleDelete} />
		</div>
	);
};

const DiscoveredRow = ({device, onAdd}) => {
	const handleAdd = useCallback(() => onAdd(device), [onAdd, device]);
	return <Row icon="settings_input_hdmi" label={tunerName(device)} help={text(device, 'Url')} value={t('add')} onClick={handleAdd} />;
};

// ----------------------------------------------------------------- onglet Enregistrements
const recordingSections = (draft) => {
	const cfg = draft.working();
	const days = cfg.GuideDays == null ? null : Number(cfg.GuideDays);
	const dayOptions = [{value: null, label: t('adminGuideDaysAuto')}];
	for (let d = 1; d <= 14; d++) dayOptions.push({value: d, label: String(d)});
	if (days != null && (days < 1 || days > 14)) dayOptions.push({value: days, label: String(days)});
	// Minutes à l'écran, secondes sur le serveur.
	const padding = (key, labelKey, suffixKey) => ({
		kind: 'number', key, label: t(labelKey), suffix: t(suffixKey), decimals: 2, min: 0, empty: 0,
		read: (c) => (Number(c[key]) || 0) / 60,
		write: (c, v) => {
			c[key] = Math.round((Number(v) || 0) * 60);
		}
	});
	return [
		{id: 'guide', title: t('adminLiveTvSectionGuide'), rows: [
			{kind: 'select', key: 'GuideDays', label: t('adminLiveTvGuideDays'), help: t('adminLiveTvGuideDaysHelp'), read: () => days, options: dayOptions},
			Object.prototype.hasOwnProperty.call(cfg, 'WakeServer') ? {kind: 'switch', key: 'WakeServer', label: t('adminLiveTvWakeServer'), fallback: true} : null
		]},
		{id: 'paths', title: t('adminLiveTvSectionPaths'), rows: [
			{kind: 'path', key: 'RecordingPath', label: t('adminLiveTvRecordingPath'), help: t('adminLiveTvRecordingPathHelp')},
			{kind: 'path', key: 'MovieRecordingPath', label: t('adminMovieRecordingPath')},
			{kind: 'path', key: 'SeriesRecordingPath', label: t('adminSeriesRecordingPath')}
		]},
		{id: 'default', title: t('adminLiveTvSectionDefaultRecording'), rows: [
			padding('PrePaddingSeconds', 'adminLiveTvStartWhenPossible', 'adminLiveTvMinutesBefore'),
			padding('PostPaddingSeconds', 'adminLiveTvStopWhenPossible', 'adminLiveTvMinutesAfter')
		]},
		{id: 'post', title: t('adminLiveTvSectionPostProcessing'), rows: [
			{kind: 'path', key: 'RecordingPostProcessor', label: t('adminRecordingPostProcessor'), includeFiles: true},
			{kind: 'text', key: 'RecordingPostProcessorArguments', label: t('adminRecordingPostProcessorArgs')}
		]},
		Object.prototype.hasOwnProperty.call(cfg, 'SaveRecordingNFO') ? {id: 'meta', title: t('adminLiveTvSectionMetadata'), rows: [
			{kind: 'switch', key: 'SaveRecordingNFO', label: t('adminSaveRecordingNfo'), fallback: true},
			{kind: 'switch', key: 'SaveRecordingImages', label: t('adminSaveRecordingImages'), fallback: true}
		]} : null
	];
};

// ----------------------------------------------------------------- la page
const LiveTv = () => {
	const {api, toast} = useAdmin();
	const load = useCallback(async () => {
		const config = await api.getLiveTvConfiguration();
		return {targets: {main: {value: config, reload: () => api.getLiveTvConfiguration(), post: (v) => api.updateLiveTvConfiguration(v)}}};
	}, [api]);
	const {status, error, draft, reload} = useDraftPage(load);
	const [tab, setTab] = useState('sources');
	const [lists, setLists] = useState({tuners: [], providers: []});
	const [discovered, setDiscovered] = useState([]);
	const [dialog, setDialog] = useState(null);
	const [confirm, setConfirm] = useState(null);
	const [detecting, setDetecting] = useState(false);

	const refreshLists = useCallback(async () => {
		try {
			const config = await api.getLiveTvConfiguration();
			setLists({tuners: maps(config.TunerHosts), providers: maps(config.ListingProviders)});
		} catch (e) {
			toast(describeAdminError(e));
		}
	}, [api, toast]);
	useEffect(() => {
		if (status === 'ready') refreshLists();
	}, [status, refreshLists]);

	const tunerTypes = useCallback(async () => {
		try {
			const types = (await api.getTunerHostTypes()).filter((x) => text(x, 'Id')).map((x) => ({value: text(x, 'Id'), label: text(x, 'Name') || text(x, 'Id')}));
			if (types.length) return types;
		} catch {
			// les deux types connus
		}
		return [{value: 'm3u', label: t('adminTunerTypeM3u')}, {value: 'hdhomerun', label: t('adminTunerTypeHdHomerun')}];
	}, [api]);
	const handleEditTuner = useCallback(async (seed) => {
		const types = await tunerTypes();
		setDialog({kind: 'tuner', seed: seed || {}, types});
	}, [tunerTypes]);
	const handleAddTuner = useCallback(() => handleEditTuner({}), [handleEditTuner]);
	const handleTunerSaved = useCallback((seed) => {
		setDialog(null);
		toast(t('adminLiveTvTunerSaved'));
		setDiscovered((list) => list.filter((d) => d !== seed));
		refreshLists();
	}, [toast, refreshLists]);
	const handleDetect = useCallback(async () => {
		setDetecting(true);
		try {
			const found = await api.discoverTuners();
			setDiscovered(found);
			if (!found.length) toast(t('adminLiveTvNoNewDevices'));
		} catch (e) {
			toast(t('adminTunerDiscoveryFailed', {error: describeAdminError(e)}));
		} finally {
			setDetecting(false);
		}
	}, [api, toast]);
	const handleAskDeleteTuner = useCallback((tuner) => setConfirm({kind: 'tuner', item: tuner}), []);
	const handleAskDeleteProvider = useCallback((p) => setConfirm({kind: 'provider', item: p}), []);
	const handleConfirmClose = useCallback(() => setConfirm(null), []);
	const handleConfirmDelete = useCallback(async () => {
		const c = confirm;
		setConfirm(null);
		try {
			if (c.kind === 'tuner') await api.removeTunerHost(text(c.item, 'Id'));
			else await api.removeListingProvider(text(c.item, 'Id'));
			refreshLists();
		} catch (e) {
			toast(t(c.kind === 'tuner' ? 'adminTunerRemoveFailed' : 'adminProviderRemoveFailed', {error: describeAdminError(e)}));
		}
	}, [api, confirm, refreshLists, toast]);
	const handleEditProvider = useCallback(async (stored, type) => {
		const kind = String(type || (stored && stored.Type) || '').toLowerCase();
		let seed = stored || {};
		if (kind === 'xmltv' && !stored) {
			try {
				seed = await api.getDefaultListingProvider();
			} catch (e) {
				toast(describeAdminError(e));
				return;
			}
		}
		setDialog({kind: kind === 'xmltv' ? 'xmltv' : 'sd', seed});
	}, [api, toast]);
	const handleAddXmltv = useCallback(() => handleEditProvider(null, 'xmltv'), [handleEditProvider]);
	const handleAddSd = useCallback(() => handleEditProvider(null, 'SchedulesDirect'), [handleEditProvider]);
	const handleProviderSaved = useCallback(() => {
		setDialog(null);
		toast(t('adminLiveTvProviderSaved'));
		refreshLists();
	}, [toast, refreshLists]);
	const handleMap = useCallback((p) => setDialog({kind: 'map', providerId: text(p, 'Id')}), []);
	const handleDialogClose = useCallback(() => setDialog(null), []);
	const handleRefreshGuide = useCallback(async () => {
		try {
			const tasks = await api.getTasks(false);
			const task = tasks.find((x) => x.Key === 'RefreshGuide');
			if (!task) {
				toast(t('adminGuideRefreshUnavailable'));
				return;
			}
			await api.startTask(task.Id);
			toast(t('adminGuideRefreshStarted'));
		} catch (e) {
			toast(describeAdminError(e));
		}
	}, [api, toast]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox title={t('adminLiveTvLoadFailed')} message={error} onRetry={reload} />;
	const tabs = [{id: 'sources', label: t('adminLiveTvTabSources')}, {id: 'recordings', label: t('adminLiveTvTabRecordings')}];
	return (
		<div>
			<PageHeader title={t('adminDrawerLiveTv')} subtitle={t('adminPageDescLiveTv')} />
			<Tabs tabs={tabs} value={tab} onChange={setTab} />
			{tab === 'sources' ? (
				<>
					<Section title={t('adminTunerDevices')}>
						{!lists.tuners.length ? <InfoRow label={t('adminNoTunerHosts')} /> : null}
						{lists.tuners.map((x) => <TunerRow key={text(x, 'Id')} tuner={x} onEdit={handleEditTuner} onDelete={handleAskDeleteTuner} />)}
						{discovered.map((d, i) => <DiscoveredRow key={text(d, 'DeviceId') || i} device={d} onAdd={handleEditTuner} />)}
						<div className={css.btnRow}>
							<Btn small icon="add" label={t('adminLiveTvAddTuner')} onClick={handleAddTuner} />
							<Btn small icon="search" label={t('adminLiveTvDetectDevices')} disabled={detecting} onClick={handleDetect} />
						</div>
					</Section>
					<Section title={t('adminGuideProviders')}>
						{!lists.providers.length ? <InfoRow label={t('adminNoListingProviders')} /> : null}
						{lists.providers.map((p) => <ProviderRow key={text(p, 'Id')} provider={p} onEdit={handleEditProvider} onMap={handleMap} onDelete={handleAskDeleteProvider} />)}
						<div className={css.btnRow}>
							<Btn small icon="add" label={`${t('adminLiveTvAddProvider')} · ${t('adminProviderXmltv')}`} onClick={handleAddXmltv} />
							<Btn small icon="add" label={`${t('adminLiveTvAddProvider')} · ${t('adminProviderSchedulesDirect')}`} onClick={handleAddSd} />
							<Btn small icon="refresh" label={t('adminLiveTvRefreshGuide')} onClick={handleRefreshGuide} />
						</div>
					</Section>
				</>
			) : (
				<SchemaSections sections={recordingSections(draft)} draft={draft} />
			)}
			{dialog && dialog.kind === 'tuner' ? <TunerDialog seed={dialog.seed} types={dialog.types} onSaved={handleTunerSaved} onClose={handleDialogClose} /> : null}
			{dialog && dialog.kind === 'xmltv' ? <XmltvDialog seed={dialog.seed} tuners={lists.tuners} onSaved={handleProviderSaved} onClose={handleDialogClose} /> : null}
			{dialog && dialog.kind === 'sd' ? <SchedulesDirectDialog seed={dialog.seed} tuners={lists.tuners} onSaved={handleProviderSaved} onClose={handleDialogClose} /> : null}
			{dialog && dialog.kind === 'map' ? <ChannelMapper providerId={dialog.providerId} onClose={handleDialogClose} /> : null}
			<Confirm
				open={!!confirm}
				title={confirm && confirm.kind === 'provider' ? t('adminLiveTvDeleteProvider') : t('adminLiveTvDeleteTuner')}
				message={confirm && confirm.kind === 'provider' ? t('adminLiveTvDeleteProviderConfirm') : t('adminLiveTvDeleteTunerConfirm')}
				confirmLabel={t('delete')}
				danger
				onConfirm={handleConfirmDelete}
				onClose={handleConfirmClose}
			/>
		</div>
	);
};

export default LiveTv;
