import SwiftUI
import WebKit

/// Wraps WKWebView with media playback capabilities and injected enhancement scripts.
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
        config.applicationNameForUserAgent = "Version/26.0 Mobile/15E148 Safari/604.1"

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
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic

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
