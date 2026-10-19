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
    private final android.os.Handler windowHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable restoreWindow = this::enterFullscreen;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(EmbeddedMusicPlugin.class);
        registerPlugin(CarMediaPlugin.class);
        registerPlugin(NativeAudioPlugin.class);
        registerPlugin(CarSpectrumPlugin.class);
        super.onCreate(savedInstanceState);
        setVolumeControlStream(android.media.AudioManager.STREAM_MUSIC);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        configureSystemBars();
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
        restoreWindowAfterLayout();
    }

    @Override
    public void onResume() {
        super.onResume();
        restoreWindowAfterLayout();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) restoreWindowAfterLayout();
        else windowHandler.removeCallbacks(restoreWindow);
    }

    @Override public void onPause() {
        windowHandler.removeCallbacks(restoreWindow);
        super.onPause();
    }

    @Override public void onDestroy() {
        windowHandler.removeCallbacks(restoreWindow);
        super.onDestroy();
    }

    @Override public boolean dispatchKeyEvent(android.view.KeyEvent event) {
        if (CarMediaService.handleKey(event)) return true;
        return super.dispatchKeyEvent(event);
    }

    @Override public void onMultiWindowModeChanged(boolean active, android.content.res.Configuration configuration) {
        super.onMultiWindowModeChanged(active, configuration);
        restoreWindowAfterLayout();
        syncWindowLayout();
    }

    // Reapply after attach/splash and OEM pane relayout, without a permanent timer or touch dependency.
    void restoreWindowAfterLayout() {
        windowHandler.removeCallbacks(restoreWindow);
        enterFullscreen();
        for (long delay : new long[]{0, 250, 1100, 2000}) windowHandler.postDelayed(restoreWindow, delay);
    }

    void syncWindowLayout() {
        if (bridge == null) return;
        bridge.getWebView().post(() -> {
            if (isFinishing() || isDestroyed()) return;
            String mode = isInMultiWindowMode() ? "split" : "full";
            bridge.getWebView().evaluateJavascript("document.documentElement.dataset.carWindow='" + mode
                + "';window.dispatchEvent(new Event('resize'))", null);
        });
    }

    com.getcapacitor.JSObject windowState() {
        View decor = getWindow().getDecorView();
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
        com.getcapacitor.JSObject state = new com.getcapacitor.JSObject()
            .put("multiWindow", isInMultiWindowMode())
            .put("attached", decor.isAttachedToWindow())
            .put("behavior", WindowCompat.getInsetsController(getWindow(), decor).getSystemBarsBehavior());
        if (insets != null) state.put("statusVisible", insets.isVisible(WindowInsetsCompat.Type.statusBars()))
            .put("navigationVisible", insets.isVisible(WindowInsetsCompat.Type.navigationBars()))
            .put("captionVisible", insets.isVisible(WindowInsetsCompat.Type.captionBar()));
        return state;
    }

    private void enterFullscreen() {
        if (isFinishing() || isDestroyed()) return;
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        configureSystemBars();
        if (isInMultiWindowMode()) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        } else if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView()
        );
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        // The OEM owns the pane caption. Hide only status/navigation bars in multi-window.
        controller.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
    }

    private void configureSystemBars() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 28) getWindow().setNavigationBarDividerColor(android.graphics.Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }
}
