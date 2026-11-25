import SwiftUI

@main
struct MediaEnhancerApp: App {
    init() {
        AudioSessionManager.shared.configureForBackgroundPlayback()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
