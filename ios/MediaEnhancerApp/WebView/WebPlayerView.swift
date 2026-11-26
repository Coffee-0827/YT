import SwiftUI
import WebKit

struct WebPlayerView: UIViewRepresentable {
    @ObservedObject var viewModel: WebPlayerViewModel

    // Scripts injected in order at document-start
    private static let scriptNames = [
        "browser-api",
        "ad-selectors",
        "ad-filter",
        "layout-enhancer",   // viewport-fit + safe-area CSS + feed-ad block
        "media-enhancer",
        "main"
    ]

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // ── Media settings ────────────────────────────────────────────────
        config.allowsInlineMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Allow larger disk and memory cache so videos buffer less
        let websiteDataStore = WKWebsiteDataStore.default()
        config.websiteDataStore = websiteDataStore

        // ── Script injection ───────────────────────────────────────────────
        let controller = WKUserContentController()
        controller.add(viewModel, name: "mediaState")

        for scriptName in Self.scriptNames {
            if let source = loadBundledScript(named: scriptName) {
                let userScript = WKUserScript(
                    source: source,
                    injectionTime: .atDocumentStart,
                    forMainFrameOnly: false   // also run in iframes (YouTube uses them)
                )
                controller.addUserScript(userScript)
            }
        }
        config.userContentController = controller

        // ── WebView setup ─────────────────────────────────────────────────
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true

        // KEY: .never stops iOS adding insets for the status bar / home
        // indicator, letting our injected CSS handle safe areas via
        // env(safe-area-inset-*) so the page fills the full screen.
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Transparent background so our black body style shows through
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.059, green: 0.059, blue: 0.059, alpha: 1)
        webView.scrollView.backgroundColor = .clear

        // Real Safari UA → YouTube serves standard mobile layout & HLS streams
        webView.customUserAgent =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
            "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
            "Version/18.0 Mobile/15E148 Safari/604.1"

        viewModel.webView = webView
        viewModel.loadCurrentURL()
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private func loadBundledScript(named name: String) -> String? {
        guard let url = Bundle.main.url(
            forResource: name,
            withExtension: "js",
            subdirectory: "SharedScripts"
        ) ?? Bundle.main.url(forResource: name, withExtension: "js") else {
            return nil
        }
        return try? String(contentsOf: url, encoding: .utf8)
    }
}
