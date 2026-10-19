package top.izuna.foliamajor;

import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.*;
import java.net.*;
import java.util.*;

// Stream audio through the app origin so WebView CORS and mixed-content rules do not block CDNs.
public final class MusicWebViewClient extends BridgeWebViewClient {
    private final Bridge musicBridge;
    public MusicWebViewClient(Bridge bridge) { super(bridge); musicBridge = bridge; }

    @Override public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (musicBridge.getActivity() instanceof MainActivity) {
            MainActivity activity = (MainActivity) musicBridge.getActivity();
            activity.syncWindowLayout();
            activity.restoreWindowAfterLayout();
        }
    }

    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!"https".equals(request.getUrl().getScheme()) || !"localhost".equals(request.getUrl().getHost())
                || !"/folia-media".equals(request.getUrl().getPath())) return super.shouldInterceptRequest(view, request);
        try {
            URL target = new URL(request.getUrl().getQueryParameter("url"));
            String range = request.getRequestHeaders().get("Range");
            if (range == null) range = request.getRequestHeaders().get("range");
            for (int redirects = 0; redirects < 6; redirects++) {
                if (!Arrays.asList("http", "https").contains(target.getProtocol()) || target.getUserInfo() != null)
                    throw new IOException("Invalid media protocol");
                // Preserve signed CDN URLs: some KuGou hosts only serve audio over HTTP.
                // Android permits cleartext only for the explicitly listed music domains.
                HttpURLConnection connection = (HttpURLConnection) target.openConnection();
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(20000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept-Encoding", "identity");
                if (range != null) connection.setRequestProperty("Range", range);
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    connection.disconnect();
                    if (location == null) throw new IOException("Missing redirect");
                    target = new URL(target, location);
                    continue;
                }
                Map<String, String> headers = new HashMap<>();
                for (String name : Arrays.asList("Content-Length", "Content-Range", "Accept-Ranges", "Content-Type")) {
                    String value = connection.getHeaderField(name);
                    if (value != null) headers.put(name, value);
                }
                headers.put("Access-Control-Allow-Origin", "https://localhost");
                headers.put("Cache-Control", "no-store");
                String contentType = connection.getContentType();
                String mime = contentType == null ? "audio/mpeg" : contentType.split(";")[0];
                InputStream body = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                if (body == null) body = new ByteArrayInputStream(new byte[0]);
                InputStream stream = new FilterInputStream(body) {
                    @Override public void close() throws IOException { try { super.close(); } finally { connection.disconnect(); } }
                };
                return new WebResourceResponse(mime, null, status, status == 206 ? "Partial Content" : "Media", headers, stream);
            }
            throw new IOException("Too many media redirects");
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "UTF-8", 502, "Media unavailable", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
    }
}
