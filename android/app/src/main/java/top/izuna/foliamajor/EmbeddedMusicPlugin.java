package top.izuna.foliamajor;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

// Keep loopback addresses and the per-process authentication token out of the WebView.
@CapacitorPlugin(name = "EmbeddedMusic")
public class EmbeddedMusicPlugin extends Plugin {
    private static final ExecutorService requests = Executors.newFixedThreadPool(4);
    @Override public void load() { EmbeddedMusic.start(getContext()); }
    @PluginMethod public void request(PluginCall call) {
        String provider = call.getString("provider", "");
        String endpoint = call.getString("endpoint", "");
        if ((!provider.equals("netease") && !provider.equals("kugou")) || !endpoint.startsWith("/") || endpoint.startsWith("//")) {
            call.reject("Invalid music request"); return;
        }
        requests.execute(() -> {
            try {
                JSONObject input = new JSONObject().put("provider", provider).put("endpoint", endpoint);
                call.resolve(new JSObject(EmbeddedMusic.request(input).toString()));
            } catch (Exception e) { call.reject("内置音乐服务暂时无法连接，请检查网络后重试"); }
        });
    }
}
