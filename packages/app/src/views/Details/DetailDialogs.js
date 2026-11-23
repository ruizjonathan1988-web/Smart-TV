import AddToPlaylistModal from '../../components/AddToPlaylistModal';
import AddToCollectionModal from '../../components/AddToCollectionModal';
import DeleteItemDialog from '../../components/DeleteItemDialog';
import MediaDeleteDialog from '../../components/MediaDeleteDialog';
import {canDeleteFromServer} from '../../services/mediaDelete';
import ChangeArtworkModal from '../../components/ChangeArtworkModal';
import IdentifyModal from '../../components/IdentifyModal';

import css from './Details.module.less';

// The dialogs that own their own component, and the toast they all report through.
const DetailDialogs = ({
	item,
	api,
	serverUrl,
	modals,
	onItemRefreshed,
	onConfirmDelete,
	seasons,
	sameServer,
	onItemDeleted,
	onRefresh,
	onToast,
	toastMessage,
	onToastEnd
}) => (
	<>
		<AddToPlaylistModal
			open={modals.showPlaylistModal}
			itemId={item?.Id}
			item={item}
			api={api}
			onClose={modals.handleClosePlaylistModal}
			onSuccess={onToast}
		/>

		<AddToCollectionModal
			open={modals.showCollectionModal}
			itemId={item?.Id}
			item={item}
			api={api}
			onClose={modals.handleCloseCollectionModal}
			onSuccess={onToast}
		/>

		<IdentifyModal
			open={modals.showIdentifyModal}
			item={item}
			api={api}
			onClose={modals.handleCloseIdentifyModal}
			onApplied={onItemRefreshed}
			onSuccess={onToast}
		/>

		{canDeleteFromServer(item) ? (
			// Film ou série : supprimé du serveur par Ma TV, Sonarr / Radarr et torrent compris.
			<MediaDeleteDialog
				open={modals.showDeleteDialog}
				item={item}
				seasons={seasons}
				api={api}
				sameServer={sameServer}
				onClose={modals.handleCloseDeleteDialog}
				onDeleted={onItemDeleted}
				onRefresh={onRefresh}
			/>
		) : (
			<DeleteItemDialog
				open={modals.showDeleteDialog}
				itemName={item?.Name}
				onCancel={modals.handleCloseDeleteDialog}
				onConfirm={onConfirmDelete}
			/>
		)}

		<ChangeArtworkModal
			open={modals.showArtworkModal}
			item={item}
			api={api}
			serverUrl={serverUrl}
			onClose={modals.handleCloseArtworkModal}
			onSuccess={onToast}
			backHandlerRef={modals.artworkModalBackRef}
		/>

		{toastMessage && (
			<div className={css.toast} onAnimationEnd={onToastEnd}>{toastMessage}</div>
		)}
	</>
);

export default DetailDialogs;
