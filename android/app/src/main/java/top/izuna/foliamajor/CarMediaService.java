package top.izuna.foliamajor;

import android.app.*;
import android.content.*;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.*;
import android.media.browse.MediaBrowser;
import android.media.session.*;
import android.os.*;
import android.service.media.MediaBrowserService;
import android.view.KeyEvent;
import java.util.*;
import java.util.concurrent.Executors;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.*;

// Publishes the WebView player's real state to standard Android/OEM media controllers.
public class CarMediaService extends MediaBrowserService {
    static CarMediaService instance;
    interface CommandListener { void onCommand(String action, long position); }
    static CommandListener listener;
    static String lastCommand = "";
    private MediaSession session;
    private MediaMetadata metadata;
    private boolean playing, foreground;
    private long position;
    private String cover = "", metadataKey = "";
    private final BroadcastReceiver noisy = new BroadcastReceiver(){@Override public void onReceive(Context context, Intent intent){command("pause",0);}};
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final java.util.concurrent.ExecutorService artwork = Executors.newSingleThreadExecutor();
    private static final String CHANNEL = "folia_playback";
    private static final int NOTIFICATION = 7;
    static void command(String action, long position) {
        lastCommand = action;
        android.util.Log.i("FoliaCarMedia", "Transport " + action + ", connected=" + (listener != null));
        if (listener != null) listener.onCommand(action, position);
    }
    static boolean handleKey(KeyEvent event) {
        if (instance == null || event.getAction() != KeyEvent.ACTION_DOWN || event.getRepeatCount() != 0) return false;
        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_MEDIA_PLAY: command("play", 0); return true;
            case KeyEvent.KEYCODE_MEDIA_PAUSE: command("pause", 0); return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_HEADSETHOOK: command(instance.playing ? "pause" : "play", 0); return true;
            case KeyEvent.KEYCODE_MEDIA_NEXT: command("next", 0); return true;
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS: command("previous", 0); return true;
            case KeyEvent.KEYCODE_MEDIA_STOP: command("pause", 0); return true;
            default: return false;
        }
    }
    @Override public void onCreate() {
        super.onCreate(); instance = this;
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy,new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY),Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(noisy,new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
        getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL, "Folia 音乐播放", NotificationManager.IMPORTANCE_LOW));
        session = new MediaSession(this, "Folia");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setPlaybackToLocal(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
        session.setSessionActivity(PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { command("play", 0); }
            @Override public void onPause() { command("pause", 0); }
            @Override public void onStop() { command("pause", 0); }
            @Override public void onSkipToNext() { command("next", 0); }
            @Override public void onSkipToPrevious() { command("previous", 0); }
            @Override public void onSeekTo(long pos) { command("seek", pos); }
            @Override public void onPlayFromMediaId(String id, Bundle extras) { command("play", 0); }
            @Override public boolean onMediaButtonEvent(Intent intent) {
                KeyEvent event = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                return event != null && handleKey(event);
            }
        }, handler);
        setSessionToken(session.getSessionToken());
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        if (intent.hasExtra("command")) { command(intent.getStringExtra("command"), 0); return START_NOT_STICKY; }
        boolean wasPlaying = playing;
        playing = intent.getBooleanExtra("playing", false);
        position = Math.max(0, intent.getLongExtra("position", 0));
        if (!intent.getBooleanExtra("hasTrack", false)) {
            session.setActive(false); session.setMetadata(null);
            session.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_NONE, 0, 0).build());
            stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY;
        }
        String nextCover = intent.getStringExtra("cover");
        // Provider metadata may still use HTTP even when the artwork CDN supports HTTPS.
        if (nextCover != null && nextCover.startsWith("http://")) nextCover = "https://" + nextCover.substring(7);
        String nextKey = intent.getStringExtra("title") + "|" + intent.getStringExtra("artist") + "|" + intent.getStringExtra("album") + "|" + nextCover + "|" + intent.getLongExtra("duration",0);
        boolean changed = !Objects.equals(metadataKey,nextKey);
        if (changed) {
        metadataKey = nextKey;
        MediaMetadata.Builder builder = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_MEDIA_ID, "current")
            .putString(MediaMetadata.METADATA_KEY_TITLE, intent.getStringExtra("title"))
            .putString(MediaMetadata.METADATA_KEY_ARTIST, intent.getStringExtra("artist"))
            .putString(MediaMetadata.METADATA_KEY_ALBUM, intent.getStringExtra("album"))
            .putLong(MediaMetadata.METADATA_KEY_DURATION, intent.getLongExtra("duration", 0));
        if (nextCover != null && nextCover.startsWith("https://")) {
            builder.putString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI, nextCover)
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI, nextCover);
        }
        if (Objects.equals(cover, nextCover) && metadata != null) {
            Bitmap image = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
            if (image != null) builder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, image);
        }
        metadata = builder.build(); session.setMetadata(metadata);
        notifyChildrenChanged("root");
        }
        session.setPlaybackState(new PlaybackState.Builder().setActions(
            PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE |
            PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_STOP |
            PlaybackState.ACTION_PLAY_FROM_MEDIA_ID)
            .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, position, playing ? 1f : 0f, SystemClock.elapsedRealtime()).build());
        session.setActive(true);
        // WebView owns audio focus for the actual audio track. A second native focus request would steal it.
        if (playing && !foreground) { startForeground(NOTIFICATION, notification()); foreground = true; }
        else if (foreground && (changed || wasPlaying != playing)) getSystemService(NotificationManager.class).notify(NOTIFICATION, notification());
        if (!Objects.equals(cover, nextCover)) { cover = nextCover; loadArtwork(nextCover); }
        return START_NOT_STICKY;
    }
    private PendingIntent action(String name) {
        return PendingIntent.getService(this, name.hashCode(), new Intent(this, CarMediaService.class).putExtra("command", name), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
    private Notification notification() {
        Notification.Builder builder = new Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_media_note).setContentTitle(metadata.getString(MediaMetadata.METADATA_KEY_TITLE))
            .setContentText(metadata.getString(MediaMetadata.METADATA_KEY_ARTIST)).setContentIntent(session.getController().getSessionActivity())
            .setVisibility(Notification.VISIBILITY_PUBLIC).setOnlyAlertOnce(true).setOngoing(playing)
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous, "上一曲", action("previous")).build())
            .addAction(new Notification.Action.Builder(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "暂停" : "播放", action(playing ? "pause" : "play")).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next, "下一曲", action("next")).build())
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1,2));
        Bitmap image = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (image != null) builder.setLargeIcon(image);
        return builder.build();
    }
    // Fetch a bounded thumbnail off the UI thread, rejecting stale results after a track change.
    private void loadArtwork(String source) {
        if (source == null || !source.startsWith("https://")) return;
        artwork.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(source).openConnection();
                connection.setConnectTimeout(5000); connection.setReadTimeout(5000);
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream input = connection.getInputStream()) {
                    byte[] buffer = new byte[8192]; int count;
                    while ((count = input.read(buffer)) != -1) { if (bytes.size() + count > 2000000) return; bytes.write(buffer, 0, count); }
                }
                byte[] data = bytes.toByteArray();
                BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(data, 0, data.length, options);
                int sample = 1; while (Math.max(options.outWidth, options.outHeight) / sample > 512) sample *= 2;
                options.inJustDecodeBounds = false; options.inSampleSize = sample;
                Bitmap image = BitmapFactory.decodeByteArray(data, 0, data.length, options);
                handler.post(() -> {
                    if (instance != this || !Objects.equals(cover, source) || metadata == null || image == null) return;
                    metadata = new MediaMetadata.Builder(metadata).putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, image).putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON, image).build();
                    session.setMetadata(metadata);
                    if (foreground) getSystemService(NotificationManager.class).notify(NOTIFICATION, notification());
                });
            } catch (Exception ignored) { /* Metadata and transport remain usable without artwork. */ }
            finally { if (connection != null) connection.disconnect(); }
        });
    }
    @Override public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle hints) { return new BrowserRoot("root", null); }
    @Override public void onLoadChildren(String parentId, Result<List<MediaBrowser.MediaItem>> result) {
        List<MediaBrowser.MediaItem> items = new ArrayList<>();
        if ("root".equals(parentId) && metadata != null) items.add(new MediaBrowser.MediaItem(metadata.getDescription(), MediaBrowser.MediaItem.FLAG_PLAYABLE));
        result.sendResult(items);
    }
    @Override public void onTaskRemoved(Intent rootIntent) { command("pause", 0); stopSelf(); }
    @Override public void onDestroy() {
        if (instance == this) instance = null;
        unregisterReceiver(noisy); session.setActive(false); session.release(); artwork.shutdownNow();
        stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy();
    }
}
