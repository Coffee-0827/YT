import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = WebPlayerViewModel()
    @State private var showGuide = false
    @State private var showToolbar = false   // hidden by default → full-screen first launch

    var body: some View {
        // The ZStack lets the WebView fill the ENTIRE screen (including under the
        // status bar and home indicator), while the floating toolbar overlays on top.
        ZStack(alignment: .bottom) {

            // ── Full-screen WebView ──────────────────────────────────────────
            WebPlayerView(viewModel: viewModel)
                .ignoresSafeArea()          // extend to all 4 edges

            // ── Floating toolbar (shown/hidden by swipe or button) ───────────
            if showToolbar {
                floatingToolbar
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // ── Tiny handle at the bottom to reveal toolbar when hidden ──────
            if !showToolbar {
                handlePill
                    .transition(.opacity)
            }
        }
        // Swipe up → reveal toolbar; swipe down → hide toolbar
        .gesture(
            DragGesture(minimumDistance: 20)
                .onEnded { value in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if value.translation.height < -20 {
                            showToolbar = true
                        } else if value.translation.height > 20 {
                            showToolbar = false
                        }
                    }
                }
        )
        .sheet(isPresented: $showGuide) {
            safariExtensionGuide
        }
    }

    // ── Handle pill that shows at the very bottom edge when toolbar is hidden ──
    private var handlePill: some View {
        VStack {
            Spacer()
            RoundedRectangle(cornerRadius: 3)
                .fill(.white.opacity(0.35))
                .frame(width: 36, height: 5)
                .padding(.bottom, 8)
        }
        .allowsHitTesting(false)
    }

    // ── Floating toolbar with frosted-glass background ────────────────────────
    private var floatingToolbar: some View {
        VStack(spacing: 0) {
            // Address / navigation row
            HStack(spacing: 6) {
                Button { viewModel.webView?.goBack() } label: {
                    Image(systemName: "chevron.left").frame(width: 30, height: 36)
                }
                Button { viewModel.webView?.goForward() } label: {
                    Image(systemName: "chevron.right").frame(width: 30, height: 36)
                }

                TextField("輸入網址", text: $viewModel.urlString)
                    .textFieldStyle(.roundedBorder)
                    .font(.subheadline)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit { viewModel.loadCurrentURL() }

                Button { viewModel.reload() } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 30, height: 36)
                }
                Button { viewModel.togglePictureInPicture() } label: {
                    Image(systemName: "pip.enter").frame(width: 30, height: 36)
                }
                Button { showGuide = true } label: {
                    Image(systemName: "info.circle").frame(width: 30, height: 36)
                }
            }
            .padding(.horizontal, 10)
            .padding(.top, 10)

            // Toggle / status row
            HStack(spacing: 8) {
                Toggle("廣告過濾", isOn: $viewModel.adFilterEnabled)
                    .toggleStyle(.button)
                    .controlSize(.mini)
                    .onChange(of: viewModel.adFilterEnabled) { _, _ in
                        viewModel.syncSettingsToPage()
                    }

                Toggle("背景播放", isOn: $viewModel.backgroundPlayEnabled)
                    .toggleStyle(.button)
                    .controlSize(.mini)
                    .onChange(of: viewModel.backgroundPlayEnabled) { _, _ in
                        viewModel.syncSettingsToPage()
                    }

                Spacer()

                Text(viewModel.isPlaying ? "▶ 播放中" : "待命中")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                // Close / hide toolbar button
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showToolbar = false
                    }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 4)
            .padding(.bottom, 10)
        }
        .background(
            .ultraThinMaterial,
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        .padding(.horizontal, 10)
        .padding(.bottom, 24)   // above home indicator
        .shadow(color: .black.opacity(0.4), radius: 12, x: 0, y: 4)
    }

    // ── Usage guide sheet ─────────────────────────────────────────────────────
    private var safariExtensionGuide: some View {
        NavigationStack {
            List {
                Section("使用方式") {
                    Text("• 從螢幕下方往上滑 → 顯示工具列（網址列、前進後退、子母畫面）。")
                    Text("• 在工具列往下滑 / 點「∨」→ 收起工具列，恢復完整全螢幕視野。")
                }
                Section("功能說明") {
                    Text("• 廣告過濾：自動隱藏常見影音廣告元素並嘗試略過廣告按鈕。")
                    Text("• 背景播放：鎖屏或切換 App 後繼續播放，鎖屏畫面可操作。")
                    Text("• 子母畫面（PiP）：點工具列中的 PiP 按鈕，影片縮小浮動顯示。")
                }
            }
            .navigationTitle("影音增強瀏覽器")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { showGuide = false }
                }
            }
        }
    }
}
