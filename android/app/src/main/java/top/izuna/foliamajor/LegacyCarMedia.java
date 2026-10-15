package top.izuna.foliamajor;

import android.app.PendingIntent;
import android.content.*;
import android.media.*;
import android.os.Build;

// Android's documented legacy RCC contract for OEM centers that predate MediaBrowser integration.
@SuppressWarnings("deprecation")
final class LegacyCarMedia {
    private final AudioManager audio;
    private final ComponentName receiver;
    private RemoteControlClient client;
    private boolean registered;
    private MediaMetadata lastMetadata;
    String status = "inactive";
    LegacyCarMedia(Context context) {
        audio = context.getSystemService(AudioManager.class);
        receiver = new ComponentName(context, CarMediaButtonReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent intent = PendingIntent.getBroadcast(context, 1,
            new Intent(Intent.ACTION_MEDIA_BUTTON).setComponent(receiver), flags);
        client = new RemoteControlClient(intent);
        client.setTransportControlFlags(RemoteControlClient.FLAG_KEY_MEDIA_PLAY | RemoteControlClient.FLAG_KEY_MEDIA_PAUSE
            | RemoteControlClient.FLAG_KEY_MEDIA_PLAY_PAUSE | RemoteControlClient.FLAG_KEY_MEDIA_NEXT
            | RemoteControlClient.FLAG_KEY_MEDIA_PREVIOUS | RemoteControlClient.FLAG_KEY_MEDIA_POSITION_UPDATE);
        client.setPlaybackPositionUpdateListener(position -> CarMediaService.command("seek", position));
    }
    void update(MediaMetadata metadata, boolean playing, long position) {
        try {
            if (!registered && NativeAudioPlugin.ownsFocus()) {
                audio.registerMediaButtonEventReceiver(receiver);
                audio.registerRemoteControlClient(client); registered = true; status = "registered";
            }
            if (!registered) return;
            if (metadata != lastMetadata) {
            client.editMetadata(true)
                .putString(MediaMetadataRetriever.METADATA_KEY_TITLE, metadata.getString(MediaMetadata.METADATA_KEY_TITLE))
                .putString(MediaMetadataRetriever.METADATA_KEY_ARTIST, metadata.getString(MediaMetadata.METADATA_KEY_ARTIST))
                .putString(MediaMetadataRetriever.METADATA_KEY_ALBUM, metadata.getString(MediaMetadata.METADATA_KEY_ALBUM))
                .putLong(MediaMetadataRetriever.METADATA_KEY_DURATION, metadata.getLong(MediaMetadata.METADATA_KEY_DURATION)).apply();
            lastMetadata = metadata;
            }
            client.setPlaybackState(playing ? RemoteControlClient.PLAYSTATE_PLAYING : RemoteControlClient.PLAYSTATE_PAUSED,
                position, playing ? 1f : 0f);
        } catch (RuntimeException error) { status = error.getClass().getSimpleName(); }
    }
    void close() {
        if (!registered) return;
        audio.unregisterRemoteControlClient(client); audio.unregisterMediaButtonEventReceiver(receiver);
        registered = false; status = "inactive";
    }
}
