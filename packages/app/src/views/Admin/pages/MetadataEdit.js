// Édition des métadonnées d'un élément (admin_metadata_edit_screen.dart) :
// onglets Général, Détails, Identifiants externes et Images ; actualiser,
// identifier (même boîte que la fiche), type de contenu. L'enregistrement se
// fait par la barre du bas, en reposant les clés éditées sur une version
// fraîche de l'élément.
import {useState, useCallback, useEffect} from 'react';

import CoreDialog from '../../../components/CoreDialog/CoreDialog';
import IdentifyModal from '../../../components/IdentifyModal/IdentifyModal';
import {useAdmin, useDraftPage} from '../adminContext';
import {
	PageHeader, Section, Row, InfoRow, Btn, Loading, ErrorBox, Tabs, SelectRow, SwitchRow, TextRow, NumberRow, MultiRow,
	PromptDialog, Confirm, Group, Note, SpottableDiv, css
} from '../AdminUi';
import {localizationOptions} from '../AdminForm';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';
import {RefreshDialog} from './Libraries';
import {DAYS, dayLabel} from './adminLabels';

// Les champs qu'un enregistrement envoie (les autres reviennent tels quels).
export const ITEM_FIELDS = ['Id', 'Name', 'OriginalTitle', 'OriginalLanguage', 'ForcedSortName', 'CommunityRating', 'CriticRating', 'IndexNumber',
	'AirsBeforeSeasonNumber', 'AirsAfterSeasonNumber', 'AirsBeforeEpisodeNumber', 'ParentIndexNumber', 'DisplayOrder', 'Album', 'AlbumArtists',
	'ArtistItems', 'SeriesName', 'Overview', 'Status', 'AirDays', 'AirTime', 'Genres', 'Tags', 'Studios', 'PremiereDate', 'DateCreated', 'EndDate',
	'ProductionYear', 'Height', 'AspectRatio', 'Video3DFormat', 'OfficialRating', 'CustomRating', 'People', 'LockData', 'LockedFields', 'ProviderIds',
	'PreferredMetadataLanguage', 'PreferredMetadataCountryCode', 'ProductionLocations', 'RunTimeTicks', 'Taglines'];

const TICKS_MINUTE = 600000000;

export const pickItemFields = (item) => {
	const out = {};
	ITEM_FIELDS.forEach((k) => {
		if (Object.prototype.hasOwnProperty.call(item, k)) out[k] = item[k];
	});
	return out;
};

// La date du jour saisie ; l'heure enregistrée est gardée quand le jour ne change pas.
export const dateValue = (stored, text) => {
	const v = String(text || '').trim();
	if (!v) return null;
	const cur = stored ? String(stored) : '';
	if (cur.length >= 10 && cur.slice(0, 10) === v) return cur;
	return v;
};

// Des noms séparés par des points-virgules, envoyés en {Name}.
export const namesFromText = (text) => String(text || '').split(';').map((s) => s.trim()).filter(Boolean).map((Name) => ({Name}));

const strs = (raw) => (Array.isArray(raw) ? raw.map((x) => (x && typeof x === 'object' ? String(x.Name || '') : String(x))).filter(Boolean) : []);
const maps = (raw) => (Array.isArray(raw) ? raw.filter((x) => x && typeof x === 'object') : []);

const PERSON_KINDS = ['Actor', 'Director', 'Composer', 'Writer', 'GuestStar', 'Producer', 'Conductor', 'Lyricist', 'Arranger', 'Engineer', 'Mixer', 'Remixer',
	'Creator', 'Artist', 'AlbumArtist', 'Author', 'Illustrator', 'Penciller', 'Inker', 'Colorist', 'Letterer', 'CoverArtist', 'Editor', 'Translator', 'Narrator'];
const DISPLAY_ORDERS = [['originalAirDate', 'OriginalAirDate'], ['absolute', 'Absolute'], ['dvd', 'Dvd'], ['digital', 'Digital'], ['storyArc', 'StoryArc'], ['production', 'Production'], ['tv', 'Tv'], ['alternate', 'Alternate'], ['regional', 'Regional'], ['altdvd', 'AlternateDvd']];
const BOXSET_ORDERS = [['Default', 'DateModified'], ['SortName', 'SortName'], ['PremiereDate', 'ReleaseDate']];
const VIDEO_3D = [['HalfSideBySide', 'HSBS'], ['HalfTopAndBottom', 'HTAB'], ['FullSideBySide', 'FSBS'], ['FullTopAndBottom', 'FTAB'], ['MVC', 'MVC']];
const IMAGE_TYPES = [['Primary', 'adminMetadataImagePrimary'], ['Backdrop', 'adminMetadataImageBackdrop'], ['Logo', 'adminMetadataImageLogo'], ['Banner', 'adminMetadataImageBanner'], ['Thumb', 'adminMetadataImageThumb']];

// ----------------------------------------------------------------- listes de noms (genres, tags, studios)
const ChipButton = ({value, onRemove}) => {
	const handleClick = useCallback(() => onRemove(value), [onRemove, value]);
	return <Btn small label={`${value}  ✕`} onClick={handleClick} />;
};

const NameList = ({title, values, addLabel, onAdd, onRemove}) => {
	const [adding, setAdding] = useState(false);
	const handleOpen = useCallback(() => setAdding(true), []);
	const handleClose = useCallback(() => setAdding(false), []);
	const handleSubmit = useCallback(({value}) => {
		setAdding(false);
		const v = String(value || '').trim();
		if (v) onAdd(v);
	}, [onAdd]);
	return (
		<Section title={title}>
			<div className={css.btnRow}>
				{values.map((v) => <ChipButton key={v} value={v} onRemove={onRemove} />)}
				<Btn small primary icon="add" label={addLabel} onClick={handleOpen} />
			</div>
			<PromptDialog open={adding} title={addLabel} fields={[{key: 'value', label: title, required: true}]} submitLabel={t('add')} onSubmit={handleSubmit} onClose={handleClose} />
		</Section>
	);
};

// ----------------------------------------------------------------- personnes
const PersonDialog = ({person, onSave, onClose}) => {
	const [name, setName] = useState(person ? String(person.Name || '') : '');
	const [role, setRole] = useState(person ? String(person.Role || '') : '');
	const [type, setType] = useState(person && person.Type ? String(person.Type) : 'Actor');
	const handleSave = useCallback(() => {
		const n = name.trim();
		if (!n) return;
		onSave({...(person || {}), Name: n, Role: role.trim() || null, Type: type});
	}, [name, role, type, person, onSave]);
	const kinds = PERSON_KINDS.map((k) => ({value: k, label: t(`adminMetadataPersonKind${k}`)}));
	if (PERSON_KINDS.indexOf(type) < 0) kinds.push({value: type, label: type});
	return (
		<CoreDialog open onClose={onClose} title={person ? t('adminMetadataEditPerson') : t('adminMetadataAddPerson')} spotlightId="admin-person">
			<div className={css.dialogBody}>
				<Group className={css.group}>
					<TextRow label={t('name')} value={name} onChange={setName} />
					<SelectRow label={t('adminMetadataType')} value={type} options={kinds} onChange={setType} />
					{type === 'Actor' || type === 'GuestStar' ? <TextRow label={t('adminMetadataRole')} value={role} onChange={setRole} /> : null}
				</Group>
				<div className={css.dialogActions}>
					<Btn label={t('cancel')} onClick={onClose} />
					<Btn primary disabled={!name.trim()} label={person ? t('save') : t('add')} onClick={handleSave} />
				</div>
			</div>
		</CoreDialog>
	);
};

const PersonRow = ({person, index, onEdit, onDelete}) => {
	const handleEdit = useCallback(() => onEdit(index), [onEdit, index]);
	const handleDelete = useCallback(() => onDelete(index), [onDelete, index]);
	return (
		<div className={css.splitRow}>
			<SpottableDiv className={css.splitMain} onClick={handleEdit}>
				<div className={css.rowLabel}>{person.Name}</div>
				<div className={css.rowHelp}>{[person.Role, person.Type].filter(Boolean).join(' · ')}</div>
			</SpottableDiv>
			<Btn small danger label={t('delete')} onClick={handleDelete} />
		</div>
	);
};

// ----------------------------------------------------------------- images distantes (_RemoteImagePickerDialog)
const RemoteImage = ({image, onPick}) => {
	const handleClick = useCallback(() => onPick(image), [onPick, image]);
	return (
		<SpottableDiv className={css.imageThumb} onClick={handleClick}>
			<img src={image.ThumbnailUrl || image.Url} alt="" />
			<div className={css.rowHelp}>{[image.ProviderName, image.Width && image.Height ? `${image.Width}×${image.Height}` : null, image.Language].filter(Boolean).join(' · ')}</div>
		</SpottableDiv>
	);
};

const RemoteImagePicker = ({itemId, imageType, onPicked, onClose}) => {
	const {api} = useAdmin();
	const [provider, setProvider] = useState('');
	const [allLanguages, setAllLanguages] = useState(false);
	const [state, setState] = useState({loading: true, images: [], providers: [], error: null});
	useEffect(() => {
		let alive = true;
		setState((s) => ({...s, loading: true}));
		api.getRemoteImages(itemId, {imageType, providerName: provider || undefined, includeAllLanguages: allLanguages, limit: 60}).then((r) => {
			if (alive) setState({loading: false, images: r.Images, providers: r.Providers, error: null});
		}, (e) => {
			if (alive) setState({loading: false, images: [], providers: [], error: describeAdminError(e)});
		});
		return () => {
			alive = false;
		};
	}, [api, itemId, imageType, provider, allLanguages]);
	const providerOptions = [{value: '', label: t('adminAllProviders')}].concat(state.providers.map((p) => ({value: p, label: p})));
	return (
		<CoreDialog open onClose={onClose} title={t('adminMetadataRemoteImage')} spotlightId="admin-remote-images">
			<div className={css.dialogBody}>
				<Group className={css.group}>
					<SelectRow label={t('adminMetadataProvider')} value={provider} options={providerOptions} onChange={setProvider} />
					<SwitchRow label={t('tvAllLanguages')} value={allLanguages} onChange={setAllLanguages} />
				</Group>
				{state.loading ? <Loading /> : null}
				{state.error ? <Note>{state.error}</Note> : null}
				{!state.loading && !state.images.length ? <Note>{t('adminNoRemoteImages')}</Note> : null}
				<Group className={css.dialogList}>
					{state.images.map((img, i) => <RemoteImage key={img.Url + i} image={img} onPick={onPicked} />)}
				</Group>
			</div>
		</CoreDialog>
	);
};

const ImageCard = ({itemId, type, label, tag, busy, onSearch, onDelete}) => {
	const {api} = useAdmin();
	const handleSearch = useCallback(() => onSearch(type), [onSearch, type]);
	const handleDelete = useCallback(() => onDelete(type), [onDelete, type]);
	return (
		<div className={css.card}>
			<div className={css.cardTitle}>{label}</div>
			<div className={css.imageThumb}>
				{tag ? <img src={api.imageUrl(itemId, type, tag, 400)} alt="" /> : <div className={css.rowHelp}>{t('adminNone')}</div>}
			</div>
			<Btn small label={t('search')} disabled={busy} onClick={handleSearch} />
			{tag ? <Btn small danger label={t('delete')} disabled={busy} onClick={handleDelete} /> : null}
		</div>
	);
};

// ----------------------------------------------------------------- la page
const MetadataEdit = ({itemId}) => {
	const {api, user, toast} = useAdmin();
	const [tab, setTab] = useState('general');
	const [dialog, setDialog] = useState(null);
	const [imageBusy, setImageBusy] = useState(null);
	const fetchItem = useCallback(async () => {
		const fetched = await api.getItem(user.Id, itemId);
		if (fetched.Tags == null && Array.isArray(fetched.TagItems)) fetched.Tags = fetched.TagItems.map((x) => x.Name);
		return fetched;
	}, [api, user, itemId]);
	const load = useCallback(async () => {
		const [fetched, editorInfo] = await Promise.all([fetchItem(), api.getMetadataEditor(itemId).catch(() => ({}))]);
		return {
			targets: {main: {value: fetched, reload: fetchItem, post: (merged) => api.updateItem(itemId, pickItemFields(merged))}},
			extra: {stored: fetched, editor: editorInfo}
		};
	}, [api, itemId, fetchItem]);
	const {status, error, draft, extra, reload} = useDraftPage(load);

	const set = useCallback((v, key) => draft.set(key, v), [draft]);
	// Un texte vide pour un champ qui n'avait pas de valeur reste null.
	const setText = useCallback((v, key) => draft.set(key, (v === '' || v == null) && extra.stored[key] == null ? null : v), [draft, extra]);
	const setDate = useCallback((v, key) => draft.set(key, dateValue(extra.stored[key], v)), [draft, extra]);
	const setNames = useCallback((v, key) => draft.set(key, namesFromText(v)), [draft]);
	const setInt = useCallback((v, key) => draft.set(key, v), [draft]);
	const setRuntime = useCallback((v) => draft.set('RunTimeTicks', v == null ? null : v * TICKS_MINUTE), [draft]);
	const setFirstOf = useCallback((v, key) => draft.set(key, v ? [v] : []), [draft]);
	const setProviderId = useCallback((v, key) => {
		const cur = draft.working().ProviderIds;
		const next = {...(cur && typeof cur === 'object' ? cur : {})};
		if (v) next[key] = v;
		else delete next[key];
		draft.set('ProviderIds', next);
	}, [draft]);
	const setEnabledFields = useCallback((values, all) => draft.set('LockedFields', all.filter((k) => values.indexOf(k) < 0)), [draft]);

	const handleRefresh = useCallback(() => setDialog({kind: 'refresh'}), []);
	const handleIdentify = useCallback(() => setDialog({kind: 'identify'}), []);
	const handleContentType = useCallback(() => setDialog({kind: 'contentType'}), []);
	const handleDialogClose = useCallback(() => setDialog(null), []);
	const handleIdentified = useCallback(() => {
		setDialog(null);
		reload();
	}, [reload]);
	const handleContentTypePick = useCallback(async (value) => {
		setDialog(null);
		try {
			await api.updateContentType(itemId, value);
			reload();
			toast(t('adminMetadataContentTypeUpdated'));
		} catch (e) {
			toast(t('adminMetadataContentTypeFailed', {error: describeAdminError(e)}));
		}
	}, [api, itemId, reload, toast]);

	const handlePersonEdit = useCallback((index) => setDialog({kind: 'person', index}), []);
	const handlePersonAdd = useCallback(() => setDialog({kind: 'person', index: null}), []);
	const handlePersonDelete = useCallback((index) => {
		const list = maps(draft.working().People).slice();
		list.splice(index, 1);
		draft.set('People', list);
	}, [draft]);
	const handlePersonSave = useCallback((person) => {
		const list = maps(draft.working().People).slice();
		if (dialog && dialog.index !== null && dialog.index !== undefined) list[dialog.index] = person;
		else list.push(person);
		draft.set('People', list);
		setDialog(null);
	}, [draft, dialog]);

	const listAdd = useCallback((key, asNames) => (v) => {
		const cur = draft.working()[key];
		if (asNames) {
			const list = maps(cur);
			if (list.every((x) => x.Name !== v)) draft.set(key, list.concat([{Name: v}]));
		} else {
			const list = strs(cur);
			if (list.indexOf(v) < 0) draft.set(key, list.concat([v]));
		}
	}, [draft]);
	const listRemove = useCallback((key, asNames) => (v) => {
		const cur = draft.working()[key];
		draft.set(key, asNames ? maps(cur).filter((x) => x.Name !== v) : strs(cur).filter((x) => x !== v));
	}, [draft]);

	const handleImageSearch = useCallback((imageType) => setDialog({kind: 'images', imageType}), []);
	const handleImagePicked = useCallback(async (image) => {
		const imageType = dialog.imageType;
		setDialog(null);
		setImageBusy(imageType);
		try {
			await api.downloadRemoteImage(itemId, {imageType, imageUrl: image.Url});
			toast(t('adminMetadataImageUpdated'));
			reload();
		} catch (e) {
			toast(t('adminMetadataImageDownloadFailed', {error: describeAdminError(e)}));
		} finally {
			setImageBusy(null);
		}
	}, [api, itemId, dialog, reload, toast]);
	const handleImageAskDelete = useCallback((imageType) => setDialog({kind: 'deleteImage', imageType}), []);
	const handleImageDelete = useCallback(async () => {
		const imageType = dialog.imageType;
		setDialog(null);
		setImageBusy(imageType);
		try {
			await api.deleteItemImage(itemId, {imageType});
			toast(t('adminMetadataImageDeleted'));
			reload();
		} catch (e) {
			toast(t('adminMetadataImageDeleteFailed', {error: describeAdminError(e)}));
		} finally {
			setImageBusy(null);
		}
	}, [api, itemId, dialog, reload, toast]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox message={t('adminMetadataLoadFailed', {error})} onRetry={reload} />;

	const item = draft.working();
	const stored = extra.stored;
	const editor = extra.editor || {};
	const str = (k) => (item[k] == null ? '' : String(item[k]));
	const type = str('Type');
	const isSeries = type === 'Series';
	const isBoxSet = type === 'BoxSet';
	const isPerson = type === 'Person';
	const isTvChannel = type === 'TvChannel';
	const isVideoMedia = str('MediaType') === 'Video';
	const isVideo = isVideoMedia && !isTvChannel;
	const nameOnly = ['Person', 'Genre', 'Studio', 'MusicGenre', 'TvChannel'].indexOf(type) >= 0;
	const isAudioish = ['Audio', 'MusicAlbum', 'MusicVideo'].indexOf(type) >= 0;
	const isSpecial = type === 'Episode' && stored.ParentIndexNumber === 0;
	const ratingOptions = [{value: '', label: t('none')}].concat(maps(editor.ParentalRatingOptions).filter((r) => r.Name).map((r) => ({value: String(r.Name), label: String(r.Name)})));
	const keep = (opts, cur) => (cur && !opts.some((o) => o.value === cur) ? opts.concat([{value: cur, label: cur}]) : opts);
	const cultures = maps(editor.Cultures);
	const countries = maps(editor.Countries);
	const langOptions = (cur, def) => localizationOptions(cultures, cur, (c) => c.TwoLetterISOLanguageName || c.ThreeLetterISOLanguageName, (c) => c.DisplayName || c.Name).map((o) => (o.value === '' ? {value: '', label: def} : o));
	const countryOptions = localizationOptions(countries, str('PreferredMetadataCountryCode'), (c) => c.TwoLetterISORegionName || c.Name, (c) => c.DisplayName || c.Name);
	const contentTypes = maps(editor.ContentTypeOptions).map((o) => ({value: String(o.Value || ''), label: o.Value ? String(o.Name || o.Value) : t('adminMetadataDefault')}));
	const indexLabel = type === 'Episode' ? t('adminMetadataFieldEpisodeNumber') : type === 'Season' ? t('adminMetadataFieldSeasonNumber') : t('adminMetadataFieldTrackNumber');
	const runtime = Number(item.RunTimeTicks);
	const people = maps(item.People);
	const lockedFields = strs(item.LockedFields);
	const lockable = [['Name', 'adminMetadataLockFieldName'], ['Overview', 'adminMetadataLockFieldOverview'], ['Genres', 'adminMetadataLockFieldGenres'],
		['OfficialRating', 'adminMetadataLockFieldOfficialRating'], ['Cast', 'adminMetadataLockFieldCast'],
		['ProductionLocations', isPerson ? 'adminMetadataLockFieldBirthLocation' : 'adminMetadataLockFieldProductionLocations']]
		.concat(isSeries ? [['Runtime', 'adminMetadataLockFieldRuntime']] : [])
		.concat([['Studios', 'adminMetadataLockFieldStudios'], ['Tags', 'adminMetadataLockFieldTags']]);
	const providerIds = item.ProviderIds && typeof item.ProviderIds === 'object' ? item.ProviderIds : {};
	const imageTags = stored.ImageTags || {};
	const tags = {...imageTags, Backdrop: (stored.BackdropImageTags || [])[0]};
	const tabs = [{id: 'general', label: t('general')}, {id: 'details', label: t('adminMetadataDetails')}, {id: 'external', label: t('adminMetadataExternalIds')}, {id: 'images', label: t('adminMetadataImages')}];

	return (
		<div>
			<PageHeader title={t('adminMetadataEditorTitle')} subtitle={str('Name')}>
				<Btn small icon="refresh" label={t('refresh')} onClick={handleRefresh} />
				<Btn small icon="search" label={t('adminMetadataIdentify')} onClick={handleIdentify} />
				{contentTypes.length ? <Btn small icon="category" label={t('adminContentType')} onClick={handleContentType} /> : null}
			</PageHeader>
			<Tabs tabs={tabs} value={tab} onChange={setTab} />

			{tab === 'general' ? (
				<>
					<Section title={t('general')}>
						{str('Path') && item.EnableMediaSourceDisplay !== false ? <InfoRow label={t('path')} help={str('Path')} /> : null}
						<TextRow field="Name" label={isPerson ? t('name') : t('adminMetadataFieldTitle')} value={str('Name')} onChange={setText} />
						{['Series', 'Season', 'Episode', 'Movie', 'Trailer', 'Person'].indexOf(type) >= 0 ? <TextRow field="OriginalTitle" label={t('adminMetadataFieldOriginalTitle')} value={str('OriginalTitle')} onChange={setText} /> : null}
						{['Series', 'Season', 'Episode', 'Movie', 'Trailer', 'Person'].indexOf(type) >= 0 ? <SelectRow field="OriginalLanguage" label={t('adminMetadataFieldOriginalLanguage')} value={str('OriginalLanguage')} options={langOptions(str('OriginalLanguage'), t('none'))} onChange={setText} /> : null}
						<TextRow field="ForcedSortName" label={t('adminMetadataFieldSortTitle')} value={str('ForcedSortName')} onChange={setText} />
						{!isTvChannel ? <TextRow field="DateCreated" label={t('adminMetadataFieldDateAdded')} placeholder="AAAA-MM-JJ" value={str('DateCreated').slice(0, 10)} onChange={setDate} /> : null}
						{isSeries ? <SelectRow field="Status" label={t('status')} value={str('Status')} options={[{value: '', label: t('none')}, {value: 'Continuing', label: t('continuing')}, {value: 'Ended', label: t('ended')}, {value: 'Unreleased', label: t('filterUnreleased')}]} onChange={setText} /> : null}
						{isSeries ? <MultiRow field="AirDays" label={t('adminMetadataAirDays')} values={strs(item.AirDays)} options={DAYS.map((d) => ({value: d, label: dayLabel(d)}))} onChange={set} /> : null}
						{isSeries ? <TextRow field="AirTime" label={t('adminMetadataFieldAirTime')} value={str('AirTime')} onChange={setText} /> : null}
						{isSeries ? <NumberRow label={t('adminMetadataFieldRuntime')} value={runtime > 0 ? Math.floor(runtime / TICKS_MINUTE) : ''} min={0} onChange={setRuntime} /> : null}
						{isAudioish ? <TextRow field="ArtistItems" label={t('adminMetadataFieldArtists')} help={t('adminMetadataNamesHelp')} value={strs(item.ArtistItems).join(';')} onChange={setNames} /> : null}
						{isAudioish ? <TextRow field="AlbumArtists" label={t('adminMetadataFieldAlbumArtists')} help={t('adminMetadataNamesHelp')} value={strs(item.AlbumArtists).join(';')} onChange={setNames} /> : null}
						{type === 'Audio' || type === 'MusicVideo' ? <TextRow field="Album" label={t('adminMetadataFieldAlbum')} value={str('Album')} onChange={setText} /> : null}
						{type === 'Book' ? <TextRow field="SeriesName" label={t('adminMetadataFieldSeriesName')} value={str('SeriesName')} onChange={setText} /> : null}
						{['Audio', 'Episode', 'Season'].indexOf(type) >= 0 ? <NumberRow field="IndexNumber" label={indexLabel} value={item.IndexNumber} min={0} onChange={setInt} /> : null}
						{type === 'Audio' || type === 'Episode' ? <NumberRow field="ParentIndexNumber" label={type === 'Episode' ? t('adminMetadataFieldSeasonNumber') : t('adminMetadataFieldDiscNumber')} value={item.ParentIndexNumber} min={0} onChange={setInt} /> : null}
						{isSpecial ? <NumberRow field="AirsBeforeSeasonNumber" label={t('adminMetadataFieldAirsBeforeSeason')} value={item.AirsBeforeSeasonNumber} min={0} onChange={setInt} /> : null}
						{isSpecial ? <NumberRow field="AirsAfterSeasonNumber" label={t('adminMetadataFieldAirsAfterSeason')} value={item.AirsAfterSeasonNumber} min={0} onChange={setInt} /> : null}
						{isSpecial ? <NumberRow field="AirsBeforeEpisodeNumber" label={t('adminMetadataFieldAirsBeforeEpisode')} value={item.AirsBeforeEpisodeNumber} min={0} onChange={setInt} /> : null}
						{!isTvChannel ? <TextRow field="PremiereDate" label={isPerson ? t('adminMetadataFieldBirthDate') : t('adminMetadataFieldPremiereDate')} placeholder="AAAA-MM-JJ" value={str('PremiereDate').slice(0, 10)} onChange={setDate} /> : null}
						{!isTvChannel ? <NumberRow field="ProductionYear" label={isPerson ? t('adminMetadataFieldBirthYear') : t('adminMetadataFieldProductionYear')} value={item.ProductionYear} min={0} onChange={setInt} /> : null}
						{isPerson ? <TextRow field="ProductionLocations" label={t('adminMetadataFieldPlaceOfBirth')} value={strs(item.ProductionLocations)[0] || ''} onChange={setFirstOf} /> : null}
						{isSeries || isPerson ? <TextRow field="EndDate" label={isPerson ? t('adminMetadataFieldDeathDate') : t('adminMetadataFieldEndDate')} placeholder="AAAA-MM-JJ" value={str('EndDate').slice(0, 10)} onChange={setDate} /> : null}
						{isBoxSet ? <SelectRow field="DisplayOrder" label={t('adminMetadataFieldDisplayOrder')} value={BOXSET_ORDERS.some((o) => o[0] === str('DisplayOrder')) ? str('DisplayOrder') : 'Default'} options={BOXSET_ORDERS.map(([v, k]) => ({value: v, label: t(`adminMetadataDisplayOrder${k}`)}))} onChange={set} /> : null}
						{isSeries ? <SelectRow field="DisplayOrder" label={t('adminMetadataFieldDisplayOrder')} value={str('DisplayOrder')} options={keep([{value: '', label: t('adminMetadataDisplayOrderAired')}].concat(DISPLAY_ORDERS.map(([v, k]) => ({value: v, label: t(`adminMetadataDisplayOrder${k}`)}))), str('DisplayOrder'))} onChange={setText} /> : null}
						{isVideo ? <SelectRow field="Video3DFormat" label={t('adminMetadataField3DFormat')} value={str('Video3DFormat')} options={[{value: '', label: t('none')}].concat(VIDEO_3D.map(([v, l]) => ({value: v, label: l})))} onChange={setText} /> : null}
						{isVideo ? <TextRow field="AspectRatio" label={t('adminMetadataFieldAspectRatio')} value={str('AspectRatio')} onChange={setText} /> : null}
					</Section>
					{!nameOnly || isTvChannel ? (
						<Section title={t('adminMetadataSectionRatings')}>
							{!nameOnly ? <NumberRow field="CommunityRating" label={t('adminMetadataFieldCommunityRating')} value={item.CommunityRating} decimals={1} min={0} onChange={setInt} /> : null}
							{type === 'Movie' || type === 'Trailer' ? <NumberRow field="CriticRating" label={t('adminMetadataFieldCriticRating')} value={item.CriticRating} decimals={1} min={0} onChange={setInt} /> : null}
							<SelectRow field="OfficialRating" label={t('adminMetadataFieldOfficialRating')} value={str('OfficialRating')} options={keep(ratingOptions, str('OfficialRating'))} onChange={setText} />
							{!nameOnly ? <SelectRow field="CustomRating" label={t('adminMetadataFieldCustomRating')} value={str('CustomRating')} options={keep(ratingOptions, str('CustomRating'))} onChange={setText} /> : null}
						</Section>
					) : null}
					<Section title={t('adminMetadataFieldOverview')}>
						{isVideoMedia && type !== 'Episode' ? <TextRow field="Taglines" label={t('adminMetadataFieldTagline')} wide value={strs(item.Taglines)[0] || ''} onChange={setFirstOf} /> : null}
						<TextRow field="Overview" label={t('adminMetadataFieldOverview')} wide value={str('Overview')} onChange={setText} />
					</Section>
				</>
			) : null}

			{tab === 'details' ? (
				<>
					{!nameOnly ? <NameList title={t('adminMetadataGenres')} values={strs(item.Genres)} addLabel={t('adminMetadataAddGenre')} onAdd={listAdd('Genres')} onRemove={listRemove('Genres')} /> : null}
					<NameList title={t('adminMetadataTags')} values={strs(item.Tags)} addLabel={t('adminMetadataAddTag')} onAdd={listAdd('Tags')} onRemove={listRemove('Tags')} />
					{!nameOnly ? <NameList title={t('adminMetadataStudios')} values={strs(item.Studios)} addLabel={t('adminMetadataAddStudio')} onAdd={listAdd('Studios', true)} onRemove={listRemove('Studios', true)} /> : null}
					{!nameOnly ? (
						<Section title={t('adminMetadataPeople')}>
							{people.map((p, i) => <PersonRow key={`${p.Name}:${i}`} person={p} index={i} onEdit={handlePersonEdit} onDelete={handlePersonDelete} />)}
							<Row icon="add" label={people.length ? t('adminMetadataAddPerson') : `${t('adminNoPeopleEntries')} — ${t('adminMetadataAddPerson')}`} onClick={handlePersonAdd} />
						</Section>
					) : null}
					<Section title={t('adminMetadataSettings')}>
						<SelectRow field="PreferredMetadataLanguage" label={t('adminMetadataDownloadLanguage')} help={t('adminMetadataInheritHelp')} value={str('PreferredMetadataLanguage')} options={langOptions(str('PreferredMetadataLanguage'), t('adminLibDefault'))} onChange={setText} />
						<SelectRow field="PreferredMetadataCountryCode" label={t('adminMetadataCountryRegion')} help={t('adminMetadataInheritHelp')} value={str('PreferredMetadataCountryCode')} options={countryOptions} onChange={setText} />
					</Section>
					<Section title={t('adminMetadataEnabledFields')}>
						<SwitchRow field="LockData" label={t('adminMetadataLockItem')} value={item.LockData === true} onChange={set} />
						{item.LockData !== true ? (
							<MultiRow label={t('adminMetadataEnabledFields')} help={t('adminMetadataEnabledFieldsHelp')} field={lockable.map((l) => l[0])} values={lockable.map((l) => l[0]).filter((k) => lockedFields.indexOf(k) < 0)} options={lockable.map(([k, l]) => ({value: k, label: t(l)}))} onChange={setEnabledFields} />
						) : null}
					</Section>
				</>
			) : null}

			{tab === 'external' ? (
				<Section title={t('adminMetadataExternalIds')}>
					{!maps(editor.ExternalIdInfos).length ? <InfoRow label={t('adminNoExternalIds')} /> : maps(editor.ExternalIdInfos).map((info) => {
						const key = String(info.Key || info.Name || info.Type || '');
						const label = [info.Name || info.Key, info.Type].filter(Boolean).join(' · ');
						return (
							<TextRow key={key} field={key} label={label} help={info.UrlFormatString || info.Url || ''} value={providerIds[key] || ''} onChange={setProviderId} />
						);
					})}
				</Section>
			) : null}

			{tab === 'images' ? (
				<div>
					{IMAGE_TYPES.map(([ty, label]) => (
						<ImageCard key={ty} itemId={itemId} type={ty} label={t(label)} tag={tags[ty]} busy={imageBusy === ty} onSearch={handleImageSearch} onDelete={handleImageAskDelete} />
					))}
					<Note>{t('tvImageUploadElsewhere')}</Note>
				</div>
			) : null}

			{dialog && dialog.kind === 'refresh' ? <RefreshDialog open itemId={itemId} onClose={handleDialogClose} /> : null}
			{dialog && dialog.kind === 'identify' ? <IdentifyModal open item={item} api={api} onClose={handleDialogClose} onApplied={handleIdentified} onSuccess={toast} /> : null}
			{dialog && dialog.kind === 'contentType' ? (
				<CoreDialog open onClose={handleDialogClose} title={t('adminUpdateContentType')} spotlightId="admin-content-type">
					<Group className={css.group}>
						<SelectRow label={t('adminContentType')} value={String(editor.ContentType || '')} options={contentTypes} onChange={handleContentTypePick} />
					</Group>
				</CoreDialog>
			) : null}
			{dialog && dialog.kind === 'person' ? <PersonDialog person={dialog.index !== null && dialog.index !== undefined ? people[dialog.index] : null} onSave={handlePersonSave} onClose={handleDialogClose} /> : null}
			{dialog && dialog.kind === 'images' ? <RemoteImagePicker itemId={itemId} imageType={dialog.imageType} onPicked={handleImagePicked} onClose={handleDialogClose} /> : null}
			<Confirm open={!!dialog && dialog.kind === 'deleteImage'} title={t('delete')} message={t('tvDeleteImageConfirm')} confirmLabel={t('delete')} danger onConfirm={handleImageDelete} onClose={handleDialogClose} />
		</div>
	);
};

export default MetadataEdit;
