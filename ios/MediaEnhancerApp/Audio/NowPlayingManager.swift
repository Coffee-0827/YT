import Foundation
import MediaPlayer

/// Bridges WebView media playback state with iOS Lock Screen and Control Center controls.
final class NowPlayingManager {
    static let shared = NowPlayingManager()

    var onRemoteCommand: ((String) -> Void)?
    private var commandsRegistered = false

    private init() {}

    func setupRemoteCommands() {
        guard !commandsRegistered else { return }
        commandsRegistered = true

        let center = MPRemoteCommandCenter.shared()

        center.playCommand.isEnabled = true
        center.playCommand.addTarget { [weak self] _ in
            self?.onRemoteCommand?("play")
            return .success
        }

        center.pauseCommand.isEnabled = true
        center.pauseCommand.addTarget { [weak self] _ in
            self?.onRemoteCommand?("pause")
            return .success
        }

        center.togglePlayPauseCommand.isEnabled = true
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.onRemoteCommand?("toggle")
            return .success
        }

        center.skipBackwardCommand.isEnabled = true
        center.skipBackwardCommand.preferredIntervals = [10]
        center.skipBackwardCommand.addTarget { [weak self] _ in
            self?.onRemoteCommand?("seekBackward")
            return .success
        }

        center.skipForwardCommand.isEnabled = true
        center.skipForwardCommand.preferredIntervals = [10]
        center.skipForwardCommand.addTarget { [weak self] _ in
            self?.onRemoteCommand?("seekForward")
            return .success
        }
    }

    func updateNowPlaying(
        title: String,
        artist: String,
        isPlaying: Bool,
        currentTime: Double,
        duration: Double
    ) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]

        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
}
