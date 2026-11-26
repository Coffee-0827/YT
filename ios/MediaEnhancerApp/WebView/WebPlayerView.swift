import SwiftUI
import WebKit

struct WebPlayerView: UIViewRepresentable {
    @ObservedObject var viewModel: WebPlayerViewModel

    private static let scriptNames = [
        "browser-api",
        "ad-selectors",
        "ad-filter",
        "layout-enhancer",
        "media-enhancer",
        "main"
    ]

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        config.websiteDataStore = .default()

        let controller = WKUserContentController()
        controller.add(viewModel, name: "mediaState")

        for scriptName in Self.scriptNames {
            if let source = loadBundledText(named: scriptName, ext: "js") {
                let userScript = WKUserScript(
                    source: source,
                    injectionTime: .atDocumentStart,
                    forMainFrameOnly: false
                )
                controller.addUserScript(userScript)
            }
        }
        config.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false

        let ytDark = UIColor(red: 15.0 / 255.0, green: 15.0 / 255.0, blue: 15.0 / 255.0, alpha: 1.0)
        webView.backgroundColor = ytDark
        webView.scrollView.backgroundColor = ytDark

        webView.customUserAgent =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
            "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
            "Version/18.0 Mobile/15E148 Safari/604.1"

        viewModel.webView = webView
        attachContentBlockerAndLoad(webView: webView, controller: controller)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private func attachContentBlockerAndLoad(webView: WKWebView, controller: WKUserContentController) {
        guard let rulesJson = loadBundledText(named: "content-blocker", ext: "json") else {
            viewModel.loadCurrentURL()
            return
        }

        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: "YouTubeAdBlockerRules",
            encodedContentRuleList: rulesJson
        ) { ruleList, _ in
            DispatchQueue.main.async {
                if let ruleList {
                    controller.add(ruleList)
                }
                viewModel.loadCurrentURL()
            }
        }
    }

    private func loadBundledText(named name: String, ext: String) -> String? {
        guard let url = Bundle.main.url(
            forResource: name,
            withExtension: ext,
            subdirectory: "SharedScripts"
        ) ?? Bundle.main.url(forResource: name, withExtension: ext) else {
            return nil
        }
        return try? String(contentsOf: url, encoding: .utf8)
    }
}
