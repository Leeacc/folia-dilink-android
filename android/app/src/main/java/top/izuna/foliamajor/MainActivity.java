package top.izuna.foliamajor;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// Fullscreen container with native safe bounds when an OEM keeps its system bars visible.
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(EmbeddedMusicPlugin.class);
        registerPlugin(CarMediaPlugin.class);
        super.onCreate(savedInstanceState);
        if (!isInMultiWindowMode()) setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        setVolumeControlStream(android.media.AudioManager.STREAM_MUSIC);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (bridge != null) {
            bridge.getWebView().setWebViewClient(new MusicWebViewClient(bridge));
            View container = (View) bridge.getWebView().getParent();
            ViewCompat.setOnApplyWindowInsetsListener(container, (view, windowInsets) -> {
                Insets safe = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime()
                );
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(container);
        }
        enterFullscreen();
    }

    @Override
    public void onResume() {
        super.onResume();
        enterFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterFullscreen();
    }

    @Override public boolean dispatchKeyEvent(android.view.KeyEvent event) {
        if (CarMediaService.handleKey(event)) return true;
        return super.dispatchKeyEvent(event);
    }

    @Override public void onMultiWindowModeChanged(boolean active, android.content.res.Configuration configuration) {
        super.onMultiWindowModeChanged(active, configuration);
        setRequestedOrientation(active ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED : android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        enterFullscreen();
        if (bridge != null) bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('resize'))", null));
    }

    private void enterFullscreen() {
        if (isInMultiWindowMode()) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).show(WindowInsetsCompat.Type.systemBars());
            return;
        }
        // Older Android splash/window code can restore the status bar after UI flags change.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView()
        );
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
