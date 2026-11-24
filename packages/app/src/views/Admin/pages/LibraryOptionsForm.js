// Les options d'une bibliothèque, pour l'ajout comme pour la modification
// (library_options_form.dart) : partie « Options » (général, métadonnées,
// infos intégrées, sous-titres, images, marqueurs, reprise, séries, musique,
// films) et partie « Téléchargeurs » (lecteurs, fournisseurs de métadonnées,
// enregistreurs, images, similaires, sous-titres, paroles, segments), avec
// cases à cocher et flèches pour l'ordre.
import {useState, useCallback} from 'react';

import CoreDialog from '../../../components/CoreDialog/CoreDialog';
import {
	Section, SwitchRow, SelectRow, MultiRow, TextRow, NumberRow, InfoRow, Row, Btn, Group, SpottableDiv, Icon, css
} from '../AdminUi';
import {localizationOptions} from '../AdminForm';
import {t} from '../adminText';
import {providers, moveInOrder, toggleName, libraryTraits, imageOptionFor} from '../../../services/adminLibraryOptions';

const strs = (raw) => (Array.isArray(raw) ? raw.map(String) : []);

// Une ligne de fournisseur : case à cocher (OK), puis ▲ ▼ pour l'ordre.
const ProviderRow = ({name, enabled, index, count, onToggle, onMove}) => {
	const handleToggle = useCallback(() => onToggle(name, !enabled), [onToggle, name, enabled]);
	const handleUp = useCallback(() => onMove(index, -1), [onMove, index]);
	const handleDown = useCallback(() => onMove(index, 1), [onMove, index]);
	return (
		<div className={css.splitRow}>
			{onToggle ? (
				<SpottableDiv className={css.splitMain} onClick={handleToggle} role="checkbox" aria-checked={enabled ? 'true' : 'false'}>
					<div className={css.rowLabel}><span className={css.checkMark}><Icon name={enabled ? 'check' : 'circle'} /></span>{name}</div>
				</SpottableDiv>
			) : (
				<div className={css.splitMain}><div className={css.rowLabel}>{name}</div></div>
			)}
			{onMove ? <Btn small icon="keyboard_arrow_up" label="" disabled={index === 0} onClick={handleUp} /> : null}
			{onMove ? <Btn small icon="keyboard_arrow_down" label="" disabled={index >= count - 1} onClick={handleDown} /> : null}
		</div>
	);
};

const ProviderSection = ({title, owner, enabledKey, disabledKey, orderKey, names, onEdit, extra}) => {
	const order = orderKey ? strs(owner[orderKey]) : names;
	const enabled = enabledKey ? strs(owner[enabledKey]) : null;
	const disabled = disabledKey ? strs(owner[disabledKey]) : null;
	const handleToggle = useCallback((name, on) => onEdit(() => {
		if (enabledKey) owner[enabledKey] = toggleName(strs(owner[enabledKey]), name, on);
		else if (disabledKey) owner[disabledKey] = toggleName(strs(owner[disabledKey]), name, !on);
	}), [onEdit, owner, enabledKey, disabledKey]);
	const handleMove = useCallback((index, delta) => onEdit(() => {
		owner[orderKey] = moveInOrder(strs(owner[orderKey]), index, delta);
	}), [onEdit, owner, orderKey]);
	if (!order.length) return null;
	return (
		<Section title={title}>
			{order.map((name, i) => (
				<ProviderRow
					key={name}
					name={name}
					index={i}
					count={order.length}
					enabled={enabled ? enabled.indexOf(name) >= 0 : disabled ? disabled.indexOf(name) < 0 : undefined}
					onToggle={enabled || disabled ? handleToggle : null}
					onMove={orderKey ? handleMove : null}
				/>
			))}
			{extra}
		</Section>
	);
};

// Options d'images d'un type (_ImageOptionsDialog) : quelles images récupérer, fonds d'écran.
const IMAGE_LABELS = {
	Primary: 'adminMetadataImagePrimary', Art: 'adminImageTypeArt', BoxRear: 'adminImageTypeBoxRear', Banner: 'adminMetadataImageBanner',
	Box: 'adminImageTypeBox', Disc: 'adminImageTypeDisc', Logo: 'adminMetadataImageLogo', Menu: 'adminImageTypeMenu', Thumb: 'adminMetadataImageThumb'
};

const ImageOptionsDialog = ({type, supported, stored, defaults, onDone, onClose}) => {
	const kinds = supported.filter((x) => x !== 'Backdrop');
	const [wanted, setWanted] = useState(() => {
		const f = {};
		kinds.forEach((k) => {
			f[k] = (imageOptionFor(stored, defaults, k).Limit || 0) > 0;
		});
		return f;
	});
	const backdrop = imageOptionFor(stored, defaults, 'Backdrop');
	const [limit, setLimit] = useState(backdrop.Limit || 0);
	const [minWidth, setMinWidth] = useState(backdrop.MinWidth || 0);
	const handleToggle = useCallback((v, k) => setWanted((f) => ({...f, [k]: v})), []);
	const handleDone = useCallback(() => {
		const out = kinds.map((k) => ({Type: k, Limit: wanted[k] ? 1 : 0, MinWidth: 0}));
		if (supported.indexOf('Backdrop') >= 0) out.push({Type: 'Backdrop', Limit: Number(limit) || 0, MinWidth: Number(minWidth) || 0});
		onDone(out);
	}, [kinds, wanted, supported, limit, minWidth, onDone]);
	return (
		<CoreDialog open onClose={onClose} title={t('adminLibImageOptionsTitle', {type})} spotlightId="admin-image-options">
			<div className={css.dialogBody}>
				<Group className={css.group}>
					<InfoRow label={t('adminLibFetchImages')} />
					{kinds.map((k) => <SwitchRow key={k} field={k} label={t(IMAGE_LABELS[k] || 'adminMetadataImageThumb')} value={!!wanted[k]} onChange={handleToggle} />)}
					{supported.indexOf('Backdrop') >= 0 ? <NumberRow label={t('adminLibMaxBackdrops')} value={limit} min={0} fallback={0} onChange={setLimit} /> : null}
					{supported.indexOf('Backdrop') >= 0 ? <NumberRow label={t('adminLibMinBackdropWidth')} value={minWidth} min={0} fallback={0} onChange={setMinWidth} /> : null}
				</Group>
				<div className={css.dialogActions}>
					<Btn label={t('cancel')} onClick={onClose} />
					<Btn primary label={t('done')} onClick={handleDone} />
				</div>
			</div>
		</CoreDialog>
	);
};

const typeStored = (options, type) => (Array.isArray(options.TypeOptions) ? options.TypeOptions.find((x) => x && x.Type === type) : null);

const ImageOptionsButton = ({availType, options, onEdit}) => {
	const [open, setOpen] = useState(false);
	const supported = strs(availType.SupportedImageTypes);
	const type = String(availType.Type);
	const handleOpen = useCallback(() => setOpen(true), []);
	const handleClose = useCallback(() => setOpen(false), []);
	const handleDone = useCallback((list) => {
		setOpen(false);
		const target = typeStored(options, type);
		if (target) {
			onEdit(() => {
				target.ImageOptions = list;
			});
		}
	}, [options, type, onEdit]);
	if (!supported.length || (supported.length === 1 && supported[0] === 'Primary')) return null;
	const stored = typeStored(options, type);
	return (
		<>
			<Row icon="tune" label={t('adminLibFetcherSettings')} onClick={handleOpen} />
			{open ? <ImageOptionsDialog type={type} supported={supported} stored={providers(stored && stored.ImageOptions)} defaults={providers(availType.DefaultImageOptions)} onDone={handleDone} onClose={handleClose} /> : null}
		</>
	);
};

export const Downloaders = ({options, available, collectionType, onEdit}) => {
	const types = providers(available.TypeOptions);
	const readers = providers(available.MetadataReaders);
	const type = collectionType || null;
	const traits = libraryTraits(type);
	const sections = [];
	if (readers.length > 1) {
		sections.push(<ProviderSection key="readers" title={t('adminLibMetadataReaders')} owner={options} orderKey="LocalMetadataReaderOrder" onEdit={onEdit} />);
	}
	const typeSection = (availType, enabledKey, orderKey, titleKey, withImages) => {
		const stored = typeStored(options, String(availType.Type));
		if (!stored || !providers(availType[enabledKey]).length) return null;
		return (
			<ProviderSection
				key={`${availType.Type}:${enabledKey}`}
				title={t(titleKey, {type: availType.Type})}
				owner={stored}
				enabledKey={enabledKey}
				orderKey={orderKey}
				onEdit={onEdit}
				extra={withImages ? <ImageOptionsButton availType={availType} options={options} onEdit={onEdit} /> : null}
			/>
		);
	};
	types.forEach((ty) => sections.push(typeSection(ty, 'MetadataFetchers', 'MetadataFetcherOrder', 'adminLibMetadataDownloadersFor')));
	const savers = providers(available.MetadataSavers);
	if (savers.length) {
		sections.push(<ProviderSection key="savers" title={t('adminLibMetadataSavers')} owner={options} enabledKey="MetadataSavers" names={savers.map((p) => String(p.Name))} onEdit={onEdit} />);
	}
	types.forEach((ty) => sections.push(typeSection(ty, 'ImageFetchers', 'ImageFetcherOrder', 'adminLibImageFetchersFor', true)));
	types.forEach((ty) => sections.push(typeSection(ty, 'SimilarItemProviders', 'SimilarItemProviderOrder', 'adminLibSimilarProvidersFor')));
	const globalSection = (availKey, disabledKey, orderKey, titleKey) => {
		if (!providers(available[availKey]).length) return null;
		return <ProviderSection key={availKey} title={t(titleKey)} owner={options} disabledKey={disabledKey} orderKey={orderKey} onEdit={onEdit} />;
	};
	if (traits.subtitles) sections.push(globalSection('SubtitleFetchers', 'DisabledSubtitleFetchers', 'SubtitleFetcherOrder', 'adminLibSubtitleDownloaders'));
	if (type === 'music') {
		sections.push(globalSection('LyricFetchers', 'DisabledLyricFetchers', 'LyricFetcherOrder', 'adminLibLyricDownloaders'));
		sections.push(globalSection('LyricsFetchers', 'DisabledLyricsFetchers', 'LyricsFetcherOrder', 'adminLibLyricDownloaders'));
	}
	sections.push(globalSection('MediaSegmentProviders', 'DisabledMediaSegmentProviders', 'MediaSegmentProviderOrder', 'adminLibMediaSegmentProviders'));
	const shown = sections.filter(Boolean);
	if (!shown.length) return <InfoRow label={t('adminLibNoDownloaders')} />;
	return <div>{shown}</div>;
};

// ----------------------------------------------------------------- partie « Options »
export const OptionsPart = ({options, available, collectionType, cultures, countries, onSet}) => {
	const type = collectionType || null;
	const traits = libraryTraits(type);
	const has = (k) => Object.prototype.hasOwnProperty.call(options, k);
	const sw = (key, labelKey, helpKey, fallback = false) => (
		<SwitchRow key={key} field={key} label={t(labelKey)} help={helpKey ? t(helpKey) : undefined} value={options[key] === undefined || options[key] === null ? fallback : !!options[key]} onChange={onSet} />
	);
	const anyTypeOffers = (key) => providers(available.TypeOptions).some((x) => Array.isArray(x[key]) && x[key].length > 0);
	const hasSubtitleFetchers = providers(available.SubtitleFetchers).length > 0;

	const languageOptions = localizationOptions(cultures, options.PreferredMetadataLanguage, (c) => c.TwoLetterISOLanguageName || c.ThreeLetterISOLanguageName, (c) => c.DisplayName || c.Name);
	const countryOptions = localizationOptions(countries, options.MetadataCountryCode, (c) => c.TwoLetterISORegionName || c.Name, (c) => c.DisplayName || c.Name);
	const refresh = Number(options.AutomaticRefreshIntervalDays) || 0;
	const refreshOptions = [0, 30, 60, 90].concat([0, 30, 60, 90].indexOf(refresh) < 0 ? [refresh] : []).map((d) => ({value: d, label: d === 0 ? t('adminLibRefreshNever') : t('adminLibRefreshDays', {days: d})}));
	const embeddedOptions = [
		{value: 'AllowAll', label: t('adminLibEmbeddedAllowAll')},
		{value: 'AllowText', label: t('adminLibEmbeddedAllowText')},
		{value: 'AllowImage', label: t('adminLibEmbeddedAllowImage')},
		{value: 'AllowNone', label: t('adminLibEmbeddedAllowNone')}
	];
	const seenLang = {};
	const subtitleLanguages = (cultures || []).filter((c) => {
		const code = c.ThreeLetterISOLanguageName && String(c.ThreeLetterISOLanguageName).toLowerCase();
		if (!code || seenLang[code]) return false;
		seenLang[code] = true;
		return true;
	}).map((c) => ({value: String(c.ThreeLetterISOLanguageName).toLowerCase(), label: c.DisplayName || c.Name}));
	const handleDelims = useCallback((v) => onSet(String(v || '').split(''), 'CustomTagDelimiters'), [onSet]);
	const handleWhitelist = useCallback((v) => onSet(String(v || '').split(/[\n,]/).map((x) => x.trim()).filter(Boolean), 'DelimiterWhitelist'), [onSet]);
	const intSet = useCallback((v, k) => {
		if (v !== null && v !== undefined) onSet(v, k);
	}, [onSet]);
	const embedded = [];
	if (traits.embeddedTitles) {
		embedded.push(sw('EnableEmbeddedTitles', 'adminLibEmbeddedTitles'));
		if (options.EnableEmbeddedTitles) embedded.push(sw('EnableEmbeddedExtrasTitles', 'adminLibEmbeddedExtrasTitles'));
	}
	if (type === 'tvshows') embedded.push(sw('EnableEmbeddedEpisodeInfos', 'adminLibEmbeddedEpisodeInfos'));
	if (traits.subtitles) {
		embedded.push(<SelectRow key="AllowEmbeddedSubtitles" field="AllowEmbeddedSubtitles" label={t('adminLibAllowEmbeddedSubtitles')} value={embeddedOptions.some((o) => o.value === options.AllowEmbeddedSubtitles) ? options.AllowEmbeddedSubtitles : 'AllowAll'} options={embeddedOptions} onChange={onSet} />);
	}
	return (
		<div>
			<Section title={t('adminLibrarySectionGeneral')}>
				{sw('Enabled', 'adminLibEnableLibrary', 'adminLibEnableLibraryHelp', true)}
				{type === 'homevideos' || type === 'photos' ? sw('EnablePhotos', 'adminLibEnablePhotos') : null}
				{sw('EnableRealtimeMonitor', 'adminLibRealtimeMonitor', 'adminLibRealtimeMonitorHint')}
				{anyTypeOffers('ImageFetchers') ? sw('SaveLocalMetadata', 'adminLibSaveLocalMetadata') : null}
				{has('ImportPlaylists') ? sw('ImportPlaylists', 'adminLibImportPlaylists') : null}
				{has('ExcludeFromSearch') ? sw('ExcludeFromSearch', 'adminLibExcludeFromSearch') : null}
			</Section>
			<Section title={t('adminLibrarySectionMetadata')}>
				<SelectRow field="PreferredMetadataLanguage" label={t('adminPreferredMetadataLanguage')} help={cultures && cultures.length ? undefined : t('adminMetadataLanguageHint')} value={options.PreferredMetadataLanguage || ''} options={languageOptions} onChange={onSet} />
				<SelectRow field="MetadataCountryCode" label={t('adminMetadataCountryCode')} help={countries && countries.length ? undefined : t('adminMetadataCountryHint')} value={options.MetadataCountryCode || ''} options={countryOptions} onChange={onSet} />
				<SelectRow field="AutomaticRefreshIntervalDays" label={t('adminLibRefreshInterval')} value={refresh} options={refreshOptions} onChange={onSet} />
				{type === 'tvshows' ? <TextRow field="SeasonZeroDisplayName" label={t('adminLibSeasonZeroName')} value={options.SeasonZeroDisplayName || ''} onChange={onSet} /> : null}
			</Section>
			{embedded.length ? <Section title={t('adminLibrarySectionEmbedded')}>{embedded}</Section> : null}
			{traits.subtitles ? (
				<Section title={t('adminLibrarySectionSubtitles')}>
					{hasSubtitleFetchers && subtitleLanguages.length ? <MultiRow field="SubtitleDownloadLanguages" label={t('adminLibDownloadLanguages')} values={strs(options.SubtitleDownloadLanguages)} options={subtitleLanguages} onChange={onSet} /> : null}
					{hasSubtitleFetchers ? sw('RequirePerfectSubtitleMatch', 'adminLibRequirePerfectMatch') : null}
					{hasSubtitleFetchers ? sw('SkipSubtitlesIfAudioTrackMatches', 'adminLibSkipIfAudioMatches') : null}
					{hasSubtitleFetchers ? sw('SkipSubtitlesIfEmbeddedSubtitlesPresent', 'adminLibSkipIfEmbeddedSubs') : null}
					{hasSubtitleFetchers && has('ForcedSubtitlesOnly') ? sw('ForcedSubtitlesOnly', 'adminLibForcedSubtitlesOnly') : null}
					{sw('SaveSubtitlesWithMedia', 'adminLibSaveSubtitlesWithMedia')}
				</Section>
			) : null}
			{traits.chapters ? (
				<Section title={t('adminLibrarySectionImages')}>
					{has('EnableTrickplayImageExtraction') ? sw('EnableTrickplayImageExtraction', 'adminLibTrickplayExtraction') : null}
					{has('ExtractTrickplayImagesDuringLibraryScan') ? sw('ExtractTrickplayImagesDuringLibraryScan', 'adminLibTrickplayDuringScan') : null}
					{has('SaveTrickplayWithMedia') ? sw('SaveTrickplayWithMedia', 'adminLibSaveTrickplayWithMedia') : null}
					{sw('EnableChapterImageExtraction', 'adminLibChapterImageExtraction')}
					{sw('ExtractChapterImagesDuringLibraryScan', 'adminLibChapterImagesDuringScan')}
				</Section>
			) : null}
			{has('EnableMarkerDetection') && (type === null || type === 'tvshows') ? (
				<Section title={t('adminLibrarySectionMarkers')}>
					{sw('EnableMarkerDetection', 'adminLibIntroDetection')}
					{sw('EnableMarkerDetectionDuringLibraryScan', 'adminLibIntroDetectionDuringScan')}
				</Section>
			) : null}
			{has('MinResumePct') && traits.resume ? (
				<Section title={t('adminDrawerResume')}>
					<NumberRow field="MinResumePct" label={t('adminResumeMinPct')} help={t('adminResumeMinPctSubtitle')} value={options.MinResumePct} onChange={intSet} />
					<NumberRow field="MaxResumePct" label={t('adminResumeMaxPct')} help={t('adminResumeMaxPctSubtitle')} value={options.MaxResumePct} onChange={intSet} />
					<NumberRow field="MinResumeDurationSeconds" label={t('adminResumeMinDuration')} help={t('adminResumeMinDurationSubtitle')} value={options.MinResumeDurationSeconds} onChange={intSet} />
				</Section>
			) : null}
			{type === 'tvshows' ? <Section title={t('adminLibrarySectionSeries')}>{sw('EnableAutomaticSeriesGrouping', 'adminLibAutomaticSeriesGrouping')}</Section> : null}
			{type === 'music' ? (
				<Section title={t('adminLibrarySectionMusic')}>
					{has('EnableLUFSScan') ? sw('EnableLUFSScan', 'adminLibLufsScan') : null}
					{sw('SaveLyricsWithMedia', 'adminLibSaveLyricsWithMedia')}
					{sw('PreferNonstandardArtistsTag', 'adminLibPreferNonstandardArtist')}
					{sw('UseCustomTagDelimiters', 'adminLibUseCustomTagDelimiters')}
					<TextRow label={t('adminLibCustomTagDelimiters')} help={t('adminLibCustomTagDelimitersHelp')} value={strs(options.CustomTagDelimiters).join('')} onChange={handleDelims} />
					<TextRow label={t('adminLibDelimiterWhitelist')} help={t('adminLibDelimiterWhitelistHelp')} value={strs(options.DelimiterWhitelist).join(', ')} onChange={handleWhitelist} />
				</Section>
			) : null}
			{type === 'movies' || type === 'mixed' ? <Section title={t('adminLibrarySectionMovies')}>{sw('AutomaticallyAddToCollection', 'adminLibAutoAddToCollection')}</Section> : null}
		</div>
	);
};
