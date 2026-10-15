package top.izuna.foliamajor;

import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

// Native media session and STREAM_MUSIC volume bridge; no stream URLs or credentials leave the player.
@CapacitorPlugin(name = "CarMedia")
public class CarMediaPlugin extends Plugin {
    private CarMediaService.CommandListener commands;
    @Override public void load() {
        commands = (action, position) -> {
            JSObject event = new JSObject().put("action", action).put("position", position / 1000.0);
            notifyListeners("command", event, true);
        };
        CarMediaService.listener = commands;
    }
    @PluginMethod public void update(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                boolean hasTrack = call.getBoolean("hasTrack", false);
                boolean playing = call.getBoolean("playing", false);
                if (playing) getActivity().getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                if (!hasTrack && CarMediaService.instance == null) { call.resolve(); return; }
                Intent intent = new Intent(getContext(), CarMediaService.class)
                    .putExtra("hasTrack", hasTrack).putExtra("playing", playing)
                    .putExtra("title", call.getString("title", "Folia")).putExtra("artist", call.getString("artist", ""))
                    .putExtra("album", call.getString("album", "")).putExtra("cover", call.getString("cover", ""))
                    .putExtra("duration", (long)(call.getDouble("duration", 0.0) * 1000))
                    .putExtra("position", (long)(call.getDouble("position", 0.0) * 1000));
                if (playing && Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
                else getContext().startService(intent);
                call.resolve();
            } catch (Exception error) { call.reject("系统媒体服务暂时不可用", error); }
        });
    }
    private JSObject volume() {
        AudioManager audio = getContext().getSystemService(AudioManager.class);
        int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int current = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
        return new JSObject().put("value", max > 0 ? (double)current / max : 0).put("index", current).put("max", max).put("fixed", audio.isVolumeFixed());
    }
    @PluginMethod public void getVolume(PluginCall call) { call.resolve(volume()); }
    @PluginMethod public void setVolume(PluginCall call) {
        try {
            AudioManager audio = getContext().getSystemService(AudioManager.class);
            double value = Math.max(0, Math.min(1, call.getDouble("value", 0.5)));
            audio.setStreamVolume(AudioManager.STREAM_MUSIC, (int)Math.round(value * audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)), AudioManager.FLAG_SHOW_UI);
            call.resolve(volume());
        } catch (Exception error) { call.reject("车机不允许调整系统媒体音量", error); }
    }
    @PluginMethod public void diagnostics(PluginCall call) {
        JSObject data = volume().put("manufacturer",android.os.Build.MANUFACTURER).put("model",android.os.Build.MODEL)
            .put("android",android.os.Build.VERSION.RELEASE).put("sdk",android.os.Build.VERSION.SDK_INT)
            .put("multiWindow",getActivity().isInMultiWindowMode()).put("mediaSession",CarMediaService.instance != null);
        call.resolve(data);
    }
    @Override protected void handleOnDestroy() {
        if (CarMediaService.listener == commands) CarMediaService.listener = null;
        super.handleOnDestroy();
    }
}
