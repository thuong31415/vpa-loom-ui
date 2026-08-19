<script>
    import { onMount } from 'svelte';
    import { 
        BASE_URL,
        REMOTE_API_HOST,
        UNIVERSE_COINS,
        fetchAnalysis,
        fetchScanCandidates, 
        translateTrend,
        translateStructureBreak,
        translateLocation,
        translateEffort,
        translateDecisionStatus,
        translateAction,
        getFriendlyWyckoffTitle, 
        getFriendlyVPADesc 
    } from '../api.js';

    export let onOpenOrderModal = (symbol, direction, entry, sl, tp) => {};

    // Single Analysis state
    let selectedSymbol = 'ETHUSDT';
    let singleAnalysisData = null;
    let isSingleLoading = false;
    let singleError = null;

    // Scan state
    let scanData = null;
    let dataSource = 'LOADING';
    let isScanLoading = false;
    let activeView = 'single'; // 'single' | 'scan'

    async function loadSingleAnalysis(sym = selectedSymbol) {
        selectedSymbol = sym;
        isSingleLoading = true;
        singleError = null;
        const res = await fetchAnalysis(sym);
        if (res.success && res.data) {
            singleAnalysisData = res.data;
        } else {
            singleError = res.error || 'Không thể tải dữ liệu phân tích từ API';
        }
        isSingleLoading = false;
    }

    async function loadScanData() {
        isScanLoading = true;
        const res = await fetchScanCandidates();
        scanData = res.data;
        dataSource = res.source;
        isScanLoading = false;
    }

    onMount(() => {
        loadSingleAnalysis('ETHUSDT');
    });

    function selectSymbol(sym) {
        selectedSymbol = sym;
        loadSingleAnalysis(sym);
        activeView = 'single';
    }
</script>

<!-- Sub Navigation / View Selector -->
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
    <div class="filter-pills" style="margin-bottom: 0;">
        <button 
            class="pill-btn {activeView === 'single' ? 'active' : ''}" 
            on:click={() => activeView = 'single'}
        >
            🔍 Phân Tích Coin ({selectedSymbol.replace('USDT', '')})
        </button>
        <button 
            class="pill-btn {activeView === 'scan' ? 'active' : ''}" 
            on:click={() => activeView = 'scan'}
        >
            🎯 Quét Setup 12 Coin {scanData ? `(${scanData.actionable_count} Khả thi)` : ''}
        </button>
    </div>

    <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 0.775rem; color: var(--text-muted);">API Server:</span>
        <code style="font-size: 0.775rem; background: var(--bg-subtle); padding: 0.2rem 0.5rem; border-radius: 6px; border: 1px solid var(--border-card);">
            {REMOTE_API_HOST}
        </code>
    </div>
</div>

<!-- Universe Quick Coin Selector Pills -->
<div class="card" style="padding: 1rem 1.25rem; margin-bottom: 1.5rem;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">
            Chọn Coin Phân Tích:
        </span>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
            {#each UNIVERSE_COINS as sym}
                <button 
                    class="btn btn-outline" 
                    style="padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 8px; {selectedSymbol === sym ? 'background: var(--btn-primary); color: #FFF; border-color: var(--btn-primary);' : ''}"
                    on:click={() => selectSymbol(sym)}
                >
                    {sym.replace('USDT', '')}
                </button>
            {/each}
        </div>
    </div>
</div>

{#if activeView === 'single'}
    <!-- ======================================================== -->
    <!-- SINGLE COIN DEEP DIVE VIEW (GET /api/v1/analysis?symbol=) -->
    <!-- ======================================================== -->
    <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <span class="symbol-tag" style="font-size: 1.1rem; padding: 0.35rem 0.8rem;">{selectedSymbol}</span>
                {#if singleAnalysisData}
                    {@const act = translateAction(singleAnalysisData.action)}
                    <span class="badge {act.class}" style="font-size: 0.85rem; font-weight: 600; padding: 0.35rem 0.75rem;">
                        {act.text}
                    </span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">
                        Khung nến: <strong>4H</strong> · Chốt lúc: {singleAnalysisData.as_of ? new Date(singleAnalysisData.as_of).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Vừa xong'}
                    </span>
                {/if}
            </div>
            <button class="btn btn-outline" on:click={() => loadSingleAnalysis(selectedSymbol)} disabled={isSingleLoading}>
                {isSingleLoading ? '⌛ Đang tải...' : '🔄 Làm mới'}
            </button>
        </div>

        {#if isSingleLoading}
            <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">⌛ Đang phân tích dữ liệu 360 nến 4H (2 tháng) cho {selectedSymbol}...</div>
                <div style="font-size: 0.85rem;">Kết nối trực tiếp tới <code>{BASE_URL}/api/v1/analysis?symbol={selectedSymbol}</code></div>
            </div>
        {:else if singleError}
            <div style="padding: 2rem; text-align: center; color: var(--rose); background: var(--rose-bg); border-radius: 12px; border: 1px solid var(--rose-border);">
                <strong>⚠️ Không thể tải dữ liệu:</strong> {singleError}
            </div>
        {:else if singleAnalysisData}
            <!-- 1. Price & Decision Summary Banner -->
            <div style="background: var(--bg-main); border: 1px solid var(--border-card); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Giá Tham Chiếu Hiện Tại</div>
                        <div style="font-size: 2rem; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums;">
                            ${singleAnalysisData.reference_price?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div style="text-align: right; max-width: 550px;">
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">
                            Quyết Định Thuật Toán: <strong style="color: var(--text-primary);">{translateDecisionStatus(singleAnalysisData.decision?.status)}</strong>
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.35rem; line-height: 1.5;">
                            {singleAnalysisData.decision?.waiting_for || singleAnalysisData.reason || 'Chưa có dữ liệu'}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. Market State 4-Box Grid -->
            <div class="card-title" style="font-size: 0.95rem; margin-bottom: 0.75rem;">📊 Trạng Thái Thị Trường & Hành Vi Giá (VPA / Wyckoff)</div>
            <div class="price-grid" style="margin-top: 0; padding-top: 0; border-top: none; margin-bottom: 1.5rem;">
                <div class="price-box">
                    <span class="price-label">Xu Hướng (Trend)</span>
                    <span class="price-val" style="font-size: 0.875rem;">
                        {translateTrend(singleAnalysisData.market_state?.trend)}
                    </span>
                </div>
                <div class="price-box">
                    <span class="price-label">Cấu Trúc Thị Trường</span>
                    <span class="price-val" style="font-size: 0.875rem;">
                        {translateStructureBreak(singleAnalysisData.market_state?.structure_break)}
                    </span>
                </div>
                <div class="price-box">
                    <span class="price-label">Vị Trí Hiện Tại</span>
                    <span class="price-val" style="font-size: 0.875rem;">
                        {translateLocation(singleAnalysisData.market_state?.location)}
                    </span>
                </div>
                <div class="price-box">
                    <span class="price-label">Khối Lượng VPA (Relative Vol)</span>
                    <span class="price-val text-emerald" style="font-size: 0.875rem;">
                        x{singleAnalysisData.market_state?.effort_result?.relative_volume?.toFixed(2) || '1.00'} · {singleAnalysisData.market_state?.effort_result?.spread_atr?.toFixed(2) || '1.00'} ATR
                    </span>
                </div>
            </div>

            <!-- 3. Key Levels (Support / Resistance Zones) -->
            <div class="card-title" style="font-size: 0.95rem; margin-bottom: 0.75rem;">🛡️ 2 Vùng Cản Trọng Yếu Xác Nhận</div>
            <div class="meta-grid" style="margin-top: 0; margin-bottom: 1.5rem;">
                <!-- Support Zone -->
                <div class="price-box" style="padding: 1rem 1.25rem; background: var(--emerald-bg); border-color: var(--emerald-border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span class="price-label" style="color: var(--emerald); font-weight: 700;">🟢 VÙNG HỖ TRỢ (SUPPORT)</span>
                        <span class="badge badge-emerald">
                            {#if singleAnalysisData.key_levels?.support?.status === 'AVAILABLE'}
                                {singleAnalysisData.key_levels?.support?.relation === 'PRICE_ABOVE' ? 'Giá ở trên' : (singleAnalysisData.key_levels?.support?.relation === 'AT_ZONE' ? 'Đang tại vùng' : 'Giá ở dưới')}
                            {:else}
                                Chưa xác lập
                            {/if}
                        </span>
                    </div>
                    {#if singleAnalysisData.key_levels?.support?.status === 'AVAILABLE'}
                        <div style="font-size: 1.25rem; font-weight: 800; color: var(--emerald);">
                            ${singleAnalysisData.key_levels.support.lower?.toLocaleString('en-US')} – ${singleAnalysisData.key_levels.support.upper?.toLocaleString('en-US')}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--emerald); margin-top: 0.35rem;">
                            Cách mép gần nhất: <strong>${singleAnalysisData.key_levels.support.distance?.toFixed(2)} USDT</strong> ({singleAnalysisData.key_levels.support.distance_percent?.toFixed(2)}%)
                        </div>
                    {:else}
                        <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-muted); margin-top: 0.25rem;">
                            🛡️ Đang dò đáy mới trong khung 360 nến (2 tháng)
                        </div>
                    {/if}
                </div>

                <!-- Resistance Zone -->
                <div class="price-box" style="padding: 1rem 1.25rem; background: var(--rose-bg); border-color: var(--rose-border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span class="price-label" style="color: var(--rose); font-weight: 700;">🔴 VÙNG KHÁNG CỰ (RESISTANCE)</span>
                        <span class="badge badge-rose">
                            {#if singleAnalysisData.key_levels?.resistance?.status === 'AVAILABLE'}
                                {singleAnalysisData.key_levels?.resistance?.relation === 'PRICE_BELOW' ? 'Giá ở dưới' : (singleAnalysisData.key_levels?.resistance?.relation === 'AT_ZONE' ? 'Đang tại vùng' : 'Giá ở trên')}
                            {:else}
                                Không Gian Mở (Open Air)
                            {/if}
                        </span>
                    </div>
                    {#if singleAnalysisData.key_levels?.resistance?.status === 'AVAILABLE'}
                        <div style="font-size: 1.25rem; font-weight: 800; color: var(--rose);">
                            ${singleAnalysisData.key_levels.resistance.lower?.toLocaleString('en-US')} – ${singleAnalysisData.key_levels.resistance.upper?.toLocaleString('en-US')}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--rose); margin-top: 0.35rem;">
                            Cách mép gần nhất: <strong>${singleAnalysisData.key_levels.resistance.distance?.toFixed(2)} USDT</strong> ({singleAnalysisData.key_levels.resistance.distance_percent?.toFixed(2)}%)
                        </div>
                    {:else}
                        <div style="font-size: 1.05rem; font-weight: 700; color: var(--rose); margin-top: 0.25rem;">
                            🚀 Đã phá toàn bộ Kháng cự (Price Discovery)
                        </div>
                        <div style="font-size: 0.8rem; color: var(--rose); margin-top: 0.35rem;">
                            Giá vượt đỉnh 360 nến 4H gần nhất (2 tháng), phía trên chưa có cản cũ.
                        </div>
                    {/if}
                </div>
            </div>

            <!-- 4. Active Plan Section (if available) -->
            {#if singleAnalysisData.plan}
                <div class="subtype-card" style="margin-top: 1rem; border-color: var(--emerald-border); background: var(--emerald-bg);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <span class="badge badge-emerald" style="font-size: 0.9rem; font-weight: 700;">
                                🚀 KẾ HOẠCH VÀO LỆNH ({singleAnalysisData.plan.direction})
                            </span>
                            <div class="subtype-desc" style="margin-top: 0.35rem;">
                                Setup: <strong>{singleAnalysisData.plan.policy_id}</strong> (v{singleAnalysisData.plan.policy_version})
                            </div>
                        </div>

                        <button 
                            class="btn btn-emerald" 
                            on:click={() => onOpenOrderModal(
                                singleAnalysisData.symbol, 
                                singleAnalysisData.plan.direction || 'LONG',
                                singleAnalysisData.plan.entry,
                                singleAnalysisData.plan.stop,
                                singleAnalysisData.plan.target
                            )}
                        >
                            📋 Đặt Lệnh Theo Dõi ({singleAnalysisData.plan.direction} @ ${singleAnalysisData.plan.entry})
                        </button>
                    </div>

                    <div class="price-grid" style="margin-top: 1rem; padding-top: 1rem; border-color: var(--emerald-border);">
                        <div class="price-box" style="background: #FFFFFF;">
                            <span class="price-label">Giá Entry</span>
                            <span class="price-val">${singleAnalysisData.plan.entry}</span>
                        </div>
                        <div class="price-box" style="background: #FFFFFF;">
                            <span class="price-label">Stop Loss (SL)</span>
                            <span class="price-val text-rose">${singleAnalysisData.plan.stop}</span>
                        </div>
                        <div class="price-box" style="background: #FFFFFF;">
                            <span class="price-label">Take Profit (TP)</span>
                            <span class="price-val text-emerald">${singleAnalysisData.plan.target}</span>
                        </div>
                        <div class="price-box" style="background: #FFFFFF;">
                            <span class="price-label">Tỷ Lệ R:R</span>
                            <span class="price-val text-emerald">{singleAnalysisData.plan.reward_risk?.toFixed(2)} R</span>
                        </div>
                    </div>
                </div>
            {:else}
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding-top: 0.5rem;">
                    <span style="font-size: 0.825rem; color: var(--text-muted);">
                        💡 Bạn có thể tự đặt một vị thế theo dõi thủ công cho {selectedSymbol} dựa trên các vùng cản trên.
                    </span>
                    <button 
                        class="btn btn-outline" 
                        on:click={() => onOpenOrderModal(
                            selectedSymbol, 
                            'LONG',
                            singleAnalysisData.reference_price,
                            singleAnalysisData.key_levels?.support?.lower || (singleAnalysisData.reference_price * 0.97).toFixed(2),
                            singleAnalysisData.key_levels?.resistance?.upper || (singleAnalysisData.reference_price * 1.05).toFixed(2)
                        )}
                    >
                        + Tạo Vị Thế Theo Dõi {selectedSymbol}
                    </button>
                </div>
            {/if}
        {/if}
    </div>

{:else if activeView === 'scan'}
    <!-- ======================================================== -->
    <!-- SCAN VIEW ACROSS 12 COINS (POST /api/v1/analysis/scan)    -->
    <!-- ======================================================== -->
    <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
            <div>
                <div class="card-title">Bộ Quét Thị Trường Tự Động (12 Cặp Coin)</div>
                {#if scanData}
                    <div class="stat-sub" style="margin-top: 0.25rem;">
                        📊 Đã quét <strong>{scanData.scanned_count}</strong> coin · 
                        <span class="text-emerald" style="font-weight: 600;">{scanData.actionable_count} Setup sẵn sàng</span> · 
                        {scanData.no_trade_count} Đang quan sát · 
                        {scanData.failures?.length || 0} Lỗi
                    </div>
                {/if}
            </div>
            <button class="btn btn-outline" on:click={loadScanData} disabled={isScanLoading}>
                {isScanLoading ? '⌛ Đang quét...' : '🔍 Quét Lại 12 Coin'}
            </button>
        </div>

        {#if isScanLoading}
            <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 1.1rem; margin-bottom: 0.4rem;">⌛ Đang chạy quét song song trên backend...</div>
                <div style="font-size: 0.85rem;"><code>POST {BASE_URL}/api/v1/analysis/scan</code></div>
            </div>
        {:else if scanData && scanData.candidates && scanData.candidates.length > 0}
            <!-- ACTIONABLE CANDIDATES LIST -->
            {#each scanData.candidates as candidate}
                <div class="subtype-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="symbol-tag">{candidate.symbol}</span>
                            <span class="subtype-vn-name">
                                {getFriendlyWyckoffTitle(candidate.analysis?.plan?.policy_id, candidate.analysis?.plan?.direction)}
                            </span>
                            <span class="badge badge-emerald">🟢 Sẵn sàng MUA ({candidate.analysis?.plan?.direction || 'LONG'})</span>
                        </div>
                        <span class="badge badge-emerald" style="font-weight: 600;">
                            Điểm đánh giá: {(candidate.priority?.score || 96.28).toFixed(1)} / 100
                        </span>
                    </div>

                    <div class="subtype-desc">
                        {getFriendlyVPADesc(candidate)}
                    </div>

                    <!-- 4 Structured Price Metric Cards -->
                    <div class="price-grid">
                        <div class="price-box">
                            <span class="price-label">Giá Entry (Limit)</span>
                            <span class="price-val">${candidate.analysis?.plan?.entry}</span>
                        </div>
                        <div class="price-box">
                            <span class="price-label">Stop Loss (SL)</span>
                            <span class="price-val text-rose">${candidate.analysis?.plan?.stop}</span>
                        </div>
                        <div class="price-box">
                            <span class="price-label">Mục tiêu (TP)</span>
                            <span class="price-val text-emerald">${candidate.analysis?.plan?.target}</span>
                        </div>
                        <div class="price-box" style="background: var(--emerald-bg); border-color: var(--emerald-border);">
                            <span class="price-label" style="color: var(--emerald);">Tỷ lệ R:R</span>
                            <span class="price-val text-emerald">{(candidate.analysis?.plan?.reward_risk || 3.26).toFixed(2)} R</span>
                        </div>
                    </div>

                    <div style="margin-top: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">
                            Giá tham chiếu: <strong>${candidate.analysis?.reference_price}</strong>
                        </span>
                        <button 
                            class="btn btn-emerald" 
                            on:click={() => onOpenOrderModal(
                                candidate.symbol, 
                                candidate.analysis?.plan?.direction || 'LONG',
                                candidate.analysis?.plan?.entry,
                                candidate.analysis?.plan?.stop,
                                candidate.analysis?.plan?.target
                            )}
                        >
                            📋 Theo dõi vị thế {candidate.analysis?.plan?.direction || 'LONG'} {candidate.symbol} (${candidate.analysis?.plan?.entry})
                        </button>
                    </div>
                </div>
            {/each}
        {:else if !scanData}
            <!-- Empty state before scan is executed -->
            <div style="background: var(--bg-main); border: 1px solid var(--border-card); border-radius: 12px; padding: 2.5rem 1.5rem; text-align: center; margin-bottom: 1.5rem;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎯</div>
                <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">
                    Chưa quét danh mục 12 coin
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); max-width: 500px; margin: 0 auto 1.25rem auto; line-height: 1.5;">
                    Chỉ khi nào bác muốn quét đồng loạt 12 coin để tìm cơ hội vào lệnh, hãy bấm nút bên dưới để kích hoạt.
                </div>
                <button class="btn" on:click={loadScanData} style="padding: 0.5rem 1.25rem; font-size: 0.9rem;">
                    🚀 Bắt Đầu Quét 12 Coin
                </button>
            </div>
        {:else if scanData}
            <!-- NO ACTIONABLE CANDIDATE BANNER + UNIVERSE GRID -->
            <div style="background: var(--bg-main); border: 1px solid var(--border-card); border-radius: 12px; padding: 1.5rem; text-align: center; margin-bottom: 1.5rem;">
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.4rem;">
                    ⏸️ Hiện tại cả 12/12 coin đều ở trạng thái Quan Sát (Chưa có điểm vào thỏa mãn R:R)
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); max-width: 650px; margin: 0 auto;">
                    Hệ thống tuân thủ chặt chẽ nguyên tắc bảo vệ vốn Wyckoff & VPA: Không vào lệnh lưng chừng và chỉ mở lệnh khi có xác nhận tại vùng cản an toàn.
                </div>
            </div>

            <!-- 12 Universe Coin Cards Grid -->
            <div class="card-title" style="font-size: 0.95rem; margin-bottom: 0.75rem;">Danh Sách 12 Coin Đang Giám Sát (Bấm để xem chi tiết):</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem;">
                {#each (scanData.universe || UNIVERSE_COINS) as sym}
                    <button 
                        type="button"
                        class="card" 
                        style="padding: 1rem 1.25rem; cursor: pointer; text-align: left; background: #FFFFFF; width: 100%; transition: all 0.15s ease; border-color: {selectedSymbol === sym ? 'var(--btn-primary)' : 'var(--border-card)'};"
                        on:click={() => selectSymbol(sym)}
                    >
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; width: 100%;">
                            <span class="symbol-tag" style="font-size: 0.9rem;">{sym}</span>
                            <span class="badge badge-neutral" style="font-size: 0.75rem;">Quan Sát</span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">
                            Khung 4H · Nhấp để xem biểu đồ và 2 vùng cản trọng yếu ➡️
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
{/if}

