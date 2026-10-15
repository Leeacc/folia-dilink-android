package top.izuna.foliamajor;

import android.media.*;
import android.os.*;
import android.net.Uri;
import android.content.Context;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.util.UUID;

// Own the actual music track and audio focus in the application process, rather than Chromium's renderer.
@CapacitorPlugin(name = "NativeAudio")
public class NativeAudioPlugin extends Plugin {
    static NativeAudioPlugin instance;
    static boolean ownsFocus() { return instance != null && instance.focusHeld; }
    private final Handler main = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private boolean prepared, playing, ended, focusHeld, resumeAfterFocus, ducked;
    private double gain = 0.2;
    private String sourceId = "";
    private PluginCall pendingPrepare;
    private double lastPosition, lastDuration;
    private final Runnable prepareTimeout = () -> {
        if (pendingPrepare == null) return;
        PluginCall call = pendingPrepare; pendingPrepare = null;
        releasePlayer(); call.reject("Native audio preparation timed out", "MEDIA_TIMEOUT");
    };
    private File blobFile;
    private long blobBytes;
    private final Runnable tick = new Runnable() { public void run() {
        if (playing) { emit("timeupdate"); main.postDelayed(this, 250); }
    }};
    @Override public void load() {
        instance = this;
        audio = getContext().getSystemService(AudioManager.class);
        gain = getContext().getSharedPreferences("native_audio", Context.MODE_PRIVATE).getFloat("gain", 0.2f);
        if (!Double.isFinite(gain)) gain = 0.2;
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attributes()).setOnAudioFocusChangeListener(this::onFocus, main).build();
    }
    private AudioAttributes attributes() {
        return new AudioAttributes.Builder().setLegacyStreamType(AudioManager.STREAM_MUSIC)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
    }
    private void onFocus(int change) {
        focusHeld = change == AudioManager.AUDIOFOCUS_GAIN;
        if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) { ducked = true; applyGain(); }
        else if (change == AudioManager.AUDIOFOCUS_GAIN) {
            ducked = false; applyGain();
            if (resumeAfterFocus) { resumeAfterFocus = false; try { startPlayer(); } catch (RuntimeException ignored) { emit("pause"); } }
        } else {
            resumeAfterFocus = change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT && playing;
            pausePlayer(false);
        }
    }
    private void applyGain() { if (player != null) { float value = (float)(gain * (ducked ? 0.2 : 1)); try { player.setVolume(value, value); } catch (IllegalStateException ignored) {} } }
    private void releasePlayer() {
        main.removeCallbacks(tick);
        main.removeCallbacks(prepareTimeout);
        if (pendingPrepare != null) { pendingPrepare.reject("Audio source replaced", "ABORTED"); pendingPrepare = null; }
        if (player != null) { player.release(); player = null; }
        prepared = playing = ended = false;
    }
    @PluginMethod public void prepare(PluginCall call) { main.post(() -> {
        try {
            releasePlayer(); lastPosition = lastDuration = 0; sourceId = call.getString("sourceId", "");
            String source = call.getString("source", "");
            Uri uri = Uri.parse(source);
            boolean remote = ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
                && uri.getAuthority() != null && !uri.getAuthority().contains("@");
            boolean cached = "file".equals(uri.getScheme()) && new File(uri.getPath()).getCanonicalPath()
                .startsWith(new File(getContext().getCacheDir(), "native-audio").getCanonicalPath() + File.separator);
            if (!remote && !cached) throw new IOException("Unsupported native audio source");
            pendingPrepare = call;
            MediaPlayer next = new MediaPlayer(); player = next;
            next.setAudioAttributes(attributes());
            next.setWakeMode(getContext(), PowerManager.PARTIAL_WAKE_LOCK);
            applyGain(); // Never start at MediaPlayer's default full per-player gain.
            next.setOnPreparedListener(value -> {
                if (player != value) return;
                main.removeCallbacks(prepareTimeout);
                prepared = true; emit("loadedmetadata");
                PluginCall pending = pendingPrepare; pendingPrepare = null;
                if (pending != null) pending.resolve(snapshot());
            });
            next.setOnCompletionListener(value -> {
                if (player != value) return;
                playing = false; ended = true; main.removeCallbacks(tick); emit("ended");
            });
            next.setOnSeekCompleteListener(value -> { if (player == value) emit("seeked"); });
            next.setOnErrorListener((value, what, extra) -> {
                if (player != value) return true;
                main.removeCallbacks(prepareTimeout);
                playing = false; prepared = false; main.removeCallbacks(tick);
                JSObject error = snapshot().put("event", "error").put("errorCode", what).put("extra", extra);
                notifyListeners("state", error);
                if (pendingPrepare != null) { pendingPrepare.reject("Native media preparation failed", "MEDIA_ERROR"); pendingPrepare = null; }
                return true;
            });
            next.setDataSource(getContext(), uri); next.prepareAsync();
            main.postDelayed(prepareTimeout, 25000);
        } catch (Exception error) {
            if (pendingPrepare == call) pendingPrepare = null;
            call.reject("原生音乐加载失败", error);
        }
    }); }
    private void startPlayer() {
        if (!prepared || player == null || playing) return;
        if (!focusHeld) focusHeld = audio.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        if (!focusHeld) throw new IllegalStateException("Audio focus was not granted");
        resumeAfterFocus = false; ended = false; applyGain(); player.start(); playing = true;
        emit("playing"); main.removeCallbacks(tick); main.post(tick);
    }
    private void pausePlayer(boolean user) {
        if (user) resumeAfterFocus = false;
        if (prepared && player != null && playing) player.pause();
        playing = false; main.removeCallbacks(tick); emit("pause");
    }
    static boolean transport(String action, long position) {
        NativeAudioPlugin active = instance;
        if (active == null || !active.prepared) return false;
        try {
            if ("play".equals(action)) active.startPlayer();
            else if ("pause".equals(action)) active.pausePlayer(true);
            else if ("seek".equals(action)) active.player.seekTo(position, MediaPlayer.SEEK_CLOSEST);
            else return false;
            return true;
        } catch (Exception ignored) { return false; }
    }
    @PluginMethod public void play(PluginCall call) { main.post(() -> {
        try { startPlayer(); if (!prepared) throw new IllegalStateException("No prepared track"); call.resolve(snapshot()); }
        catch (Exception error) { call.reject("尚未取得媒体音频焦点或歌曲未准备好", error); }
    }); }
    @PluginMethod public void pause(PluginCall call) { main.post(() -> { pausePlayer(true); call.resolve(snapshot()); }); }
    @PluginMethod public void seek(PluginCall call) { main.post(() -> {
        if (prepared && player != null) player.seekTo(Math.max(0L, (long)(call.getDouble("position", 0.0) * 1000)), MediaPlayer.SEEK_CLOSEST);
        call.resolve(snapshot());
    }); }
    @PluginMethod public void setGain(PluginCall call) { main.post(() -> {
        double requested = call.getDouble("value", 0.2);
        gain = Double.isFinite(requested) ? Math.max(0, Math.min(1, requested)) : 0.2;
        getContext().getSharedPreferences("native_audio", Context.MODE_PRIVATE).edit().putFloat("gain", (float)gain).apply();
        applyGain(); call.resolve();
    }); }
    @PluginMethod public void setLoop(PluginCall call) { main.post(() -> { if (player != null) player.setLooping(call.getBoolean("loop", false)); call.resolve(); }); }
    @PluginMethod public void status(PluginCall call) { main.post(() -> call.resolve(snapshot())); }
    JSObject snapshot() {
        try { if (prepared && player != null) { lastPosition = player.getCurrentPosition() / 1000.0; lastDuration = player.getDuration() / 1000.0; } } catch (IllegalStateException ignored) {}
        return new JSObject().put("sourceId", sourceId).put("position", lastPosition).put("duration", lastDuration)
            .put("playing", playing).put("prepared", prepared).put("ended", ended).put("gain", gain).put("focusHeld", focusHeld)
            .put("sessionId", player == null ? 0 : player.getAudioSessionId()).put("systemMusicActive", audio.isMusicActive())
            .put("engine", "android.media.MediaPlayer").put("stream", AudioManager.STREAM_MUSIC);
    }
    private void emit(String event) { notifyListeners("state", snapshot().put("event", event)); }
    // Blob caches belong to Chromium. Transfer bounded chunks into private native cache without exposing arbitrary paths.
    @PluginMethod public void cacheBegin(PluginCall call) {
        try {
            if (blobFile != null) blobFile.delete();
            File folder = new File(getContext().getCacheDir(), "native-audio"); folder.mkdirs();
            File[] old = folder.listFiles(); if (old != null) for (File file : old) file.delete();
            blobFile = new File(folder, UUID.randomUUID().toString() + ".media"); blobBytes = 0;
            call.resolve(new JSObject().put("token", blobFile.getName()));
        } catch (Exception error) { call.reject("音频缓存初始化失败", error); }
    }
    @PluginMethod public void cacheAppend(PluginCall call) {
        try {
            if (blobFile == null || !blobFile.getName().equals(call.getString("token"))) throw new IOException("Stale cache transfer");
            String encoded = call.getString("data", ""); if (encoded.length() > 350000) throw new IOException("Chunk too large");
            byte[] data = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT);
            if ((blobBytes += data.length) > 100L * 1024 * 1024) throw new IOException("Audio cache too large");
            try (FileOutputStream out = new FileOutputStream(blobFile, true)) { out.write(data); }
            call.resolve(new JSObject().put("source", Uri.fromFile(blobFile).toString()));
        } catch (Exception error) { call.reject("音频缓存传输失败", error); }
    }
    @Override protected void handleOnDestroy() {
        main.post(() -> { releasePlayer(); audio.abandonAudioFocusRequest(focus); if (instance == this) instance = null; });
        super.handleOnDestroy();
    }
}
