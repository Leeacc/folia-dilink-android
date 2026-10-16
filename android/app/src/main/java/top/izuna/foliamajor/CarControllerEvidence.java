package top.izuna.foliamajor;

import android.os.SystemClock;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import java.util.LinkedHashSet;
import java.util.ArrayDeque;

// Bounded, read-only evidence of who actually connects and sends commands. No song or account data.
final class CarControllerEvidence {
    private static final LinkedHashSet<String> browsers = new LinkedHashSet<>();
    private static final ArrayDeque<JSObject> commands = new ArrayDeque<>();
    static synchronized void browser(String packageName) {
        browsers.remove(packageName);
        browsers.add(packageName);
        if (browsers.size() > 8) browsers.remove(browsers.iterator().next());
    }
    static synchronized void command(String packageName, String action) {
        append(new JSObject().put("source", "media_session").put("package", packageName).put("action", action));
    }
    static synchronized void key(int code) {
        append(new JSObject().put("source", "key_event").put("action", "media_key").put("keyCode", code));
    }
    static synchronized void serviceIntent(String action) {
        append(new JSObject().put("source", "service_intent").put("action", action == null ? "unknown" : action.substring(0, Math.min(32, action.length()))));
    }
    private static void append(JSObject entry) {
        commands.addLast(entry.put("elapsedMs", SystemClock.elapsedRealtime()));
        if (commands.size() > 8) commands.removeFirst();
    }
    static synchronized JSObject snapshot() {
        return new JSObject().put("browserClients", new JSONArray(browsers))
            .put("remoteCommands", new JSONArray(commands))
            .put("elapsedMs", SystemClock.elapsedRealtime());
    }
}
