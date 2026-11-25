import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = WebPlayerViewModel()
    @State private var showGuide = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                addressBar
                statusStrip
                WebPlayerView(viewModel: viewModel)
                    .ignoresSafeArea(edges: .bottom)
            }
            .navigationTitle("影音增強瀏覽器")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showGuide = true
                    } label: {
                        Image(systemName: "info.circle")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("子母畫面") {
                        viewModel.togglePictureInPicture()
                    }
                }
            }
            .sheet(isPresented: $showGuide) {
                safariExtensionGuide
            }
        }
    }

    private var addressBar: some View {
        HStack(spacing: 8) {
            TextField("輸入網址", text: $viewModel.urlString)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .onSubmit {
                    viewModel.loadCurrentURL()
                }

            Button("前往") {
                viewModel.loadCurrentURL()
            }
            .buttonStyle(.borderedProminent)

            Button {
                viewModel.reload()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.bordered)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var statusStrip: some View {
        HStack(spacing: 12) {
            Toggle("過濾廣告", isOn: $viewModel.adFilterEnabled)
                .toggleStyle(.button)
                .font(.caption)
                .onChange(of: viewModel.adFilterEnabled) { _, _ in
                    viewModel.syncSettingsToPage()
                }

            Toggle("背景播放", isOn: $viewModel.backgroundPlayEnabled)
                .toggleStyle(.button)
                .font(.caption)
                .onChange(of: viewModel.backgroundPlayEnabled) { _, _ in
                    viewModel.syncSettingsToPage()
                }

            Spacer()

            Text(viewModel.isPlaying ? "背景音訊就緒" : "待命中")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 6)
    }

    private var safariExtensionGuide: some View {
        NavigationStack {
            List {
                Section("如何在 Safari 啟用擴充功能") {
                    Text("1. 前往 iPhone 的「設定」→「App」→「Safari」。")
                    Text("2. 點選「延伸功能」並開啟「影音增強器」。")
                    Text("3. 將所有網站或指定網站權限設為「允許」。")
                }
                Section("背景播放與鎖屏控制說明") {
                    Text("本 App 內建瀏覽器已啟用 AVAudioSession 背景音訊模式，可於鎖屏與控制中心控制播放、暫停與快轉。")
                }
            }
            .navigationTitle("使用說明")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") {
                        showGuide = false
                    }
                }
            }
        }
    }
}
