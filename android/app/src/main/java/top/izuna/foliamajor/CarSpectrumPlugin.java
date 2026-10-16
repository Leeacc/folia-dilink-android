package top.izuna.foliamajor;

import android.Manifest;
import android.media.audiofx.Visualizer;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;

// Read only Folia's playback session, never the microphone or the system output mix (session zero).
@CapacitorPlugin(name = "CarSpectrum", permissions = {
    @Permission(alias = "spectrum", strings = { Manifest.permission.RECORD_AUDIO })
})
public class CarSpectrumPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private Visualizer visualizer;
    private int sessionId;
    private boolean enabled;
    private final byte[] fft = new byte[512];
    private final Runnable tick = new Runnable() { public void run() {
        if (!enabled) return;
        NativeAudioPlugin audio = NativeAudioPlugin.instance;
        JSObject state = audio == null ? null : audio.snapshot();
        int next = state == null ? 0 : state.optInt("sessionId");
        boolean sounding = state != null && state.optBoolean("playing");
        if (!sounding || next == 0 || getPermissionState("spectrum") != PermissionState.GRANTED) release();
        else {
            try {
                if (sessionId != next || visualizer == null) {
                    release();
                    visualizer = new Visualizer(next);
                    visualizer.setCaptureSize(fft.length);
                    visualizer.setScalingMode(Visualizer.SCALING_MODE_NORMALIZED);
                    visualizer.setEnabled(true);
                    sessionId = next;
                }
                if (visualizer.getFft(fft) == Visualizer.SUCCESS) {
                    JSArray bins = new JSArray();
                    for (int i = 0; i < fft.length / 2; i++) {
                        double re = fft[2 * i], im = i == 0 ? 0 : fft[2 * i + 1];
                        bins.put((int)Math.min(255, Math.hypot(re, im) * 2));
                    }
                    notifyListeners("spectrum", new JSObject().put("bins", bins)
                        .put("sampleRate", visualizer.getSamplingRate() / 1000).put("sessionId", sessionId));
                }
            } catch (RuntimeException error) {
                release();
                notifyListeners("unavailable", new JSObject().put("reason", "unsupported-session"));
                enabled = false;
            }
        }
        if (enabled) main.postDelayed(this, sounding ? 50 : 500);
    }};
    private void release() {
        if (sessionId != 0) notifyListeners("spectrum", new JSObject().put("bins", new JSArray()).put("sampleRate", 44100).put("sessionId", 0));
        if (visualizer != null) { try { visualizer.release(); } catch (RuntimeException ignored) {} visualizer = null; }
        sessionId = 0;
    }
    @PluginMethod public void permission(PluginCall call) {
        if (getPermissionState("spectrum") == PermissionState.GRANTED) permissionResult(call);
        else requestPermissionForAlias("spectrum", call, "permissionResult");
    }
    @PermissionCallback private void permissionResult(PluginCall call) {
        call.resolve(new JSObject().put("granted", getPermissionState("spectrum") == PermissionState.GRANTED));
    }
    @PluginMethod public void configure(PluginCall call) { main.post(() -> {
        enabled = call.getBoolean("enabled", false) && getPermissionState("spectrum") == PermissionState.GRANTED;
        main.removeCallbacks(tick);
        if (enabled) main.post(tick); else release();
        call.resolve(new JSObject().put("enabled", enabled));
    }); }
    @Override protected void handleOnDestroy() {
        main.post(() -> { enabled = false; main.removeCallbacks(tick); release(); });
        super.handleOnDestroy();
    }
}
