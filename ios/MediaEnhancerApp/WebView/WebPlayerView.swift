import SwiftUI
import WebKit

/// Wraps WKWebView with media playback capabilities and injected enhancement scripts.
/// The view fills the entire screen edge-to-edge including under the status bar and home indicator.
struct WebPlayerView: UIViewRepresentable {
    @ObservedObject var viewModel: WebPlayerViewModel

    private static let scriptNames = [
        "browser-api",
        "ad-selectors",
        "ad-filter",
        "media-enhancer",
        "main"
    ]

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let controller = WKUserContentController()
        controller.add(viewModel, name: "mediaState")

        for scriptName in Self.scriptNames {
            if let source = loadBundledScript(named: scriptName) {
                let userScript = WKUserScript(
                    source: source,
                    injectionTime: .atDocumentStart,
                    forMainFrameOnly: true
                )
                controller.addUserScript(userScript)
            }
        }
        config.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true

        // KEY: Tell the scroll view NOT to auto-adjust insets.
        // This lets the web content fill under the status bar and home indicator
        // exactly like the native YouTube app.
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Extend the webView drawing under the system chrome so the page
        // background colour reaches the edges rather than leaving black bars.
        webView.isOpaque = false
        webView.backgroundColor = .black

        // Proper mobile Safari UA so YouTube serves the full mobile layout
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
