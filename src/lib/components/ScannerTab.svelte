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
        getFriendlyVPAStatus,
        translateDecisionStatus,
        formatDecisionExplanation,
        translateAction,
        getFriendlyWyckoffTitle, 
        getFriendlyVPADesc,
        cleanSymbol,
        formatPrice,
        formatVNTime 
    } from '../api.js';
    import PriceLocationGauge from './PriceLocationGauge.svelte';

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

<!-- Top Control Strip (View Selector + Coin Quick Pills) -->
<div class="top-control-bar">
    <div class="view-toggle-group">
        <button 
            class="pill-btn {activeView === 'single' ? 'active' : ''}" 
            on:click={() => activeView = 'single'}
        >
            Phân Tích ({selectedSymbol.replace('USDT', '')})
        </button>
        <button 
            class="pill-btn {activeView === 'scan' ? 'active' : ''}" 
            on:click={() => { activeView = 'scan'; if (!scanData) loadScanData(); }}
        >
            Quét 15 Coin {scanData ? `(${scanData.actionable_count})` : ''}
        </button>
    </div>

    <div class="coin-selector-strip">
        {#each UNIVERSE_COINS as sym}
            <button 
                class="coin-pill-btn {selectedSymbol === sym ? 'selected' : ''}"
                on:click={() => selectSymbol(sym)}
            >
                {sym.replace('USDT', '')}
            </button>
        {/each}
    </div>
</div>

{#if activeView === 'single'}
    <!-- ======================================================== -->
    <!-- AIRY & SPACIOUS 2-COLUMN COCKPIT VIEW                     -->
    <!-- ======================================================== -->
    {#if isSingleLoading}
        <div class="card" style="padding: 3.5rem; text-align: center; color: var(--text-muted);">
            <div style="font-size: 1.15rem; margin-bottom: 0.4rem; font-weight: 600;">⌛ Đang phân tích dữ liệu 720 nến 4H cho {selectedSymbol}...</div>
            <div style="font-size: 0.85rem;">Kết nối trực tiếp tới <code>/api/v1/analysis?symbol={selectedSymbol}</code></div>
        </div>
    {:else if singleError}
        <div class="card" style="padding: 2.5rem; text-align: center; color: var(--rose); background: var(--rose-bg); border-color: var(--rose-border);">
            <strong style="font-size: 1.05rem;">⚠️ Không thể tải dữ liệu:</strong> {singleError}
            <div style="margin-top: 1rem;">
                <button class="btn btn-outline" on:click={() => loadSingleAnalysis(selectedSymbol)}>🔄 Thử lại</button>
            </div>
        </div>
    {:else if singleAnalysisData}
        {@const act = translateAction(singleAnalysisData.action)}
        {@const vpa = getFriendlyVPAStatus(singleAnalysisData.market_state?.effort_result)}
        <div class="cockpit-grid">
            <!-- ==================================================== -->
            <!-- LEFT COLUMN: CON TÀU THỊ TRƯỜNG & VỊ TRÍ 2 CẢN      -->
            <!-- ==================================================== -->
            <div class="card cockpit-card">
                <!-- Header Info -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span class="symbol-tag">{cleanSymbol(selectedSymbol)}</span>
                        <span class="status-pill {act.class}">
                            <span class="dot"></span>
                            {act.text}
                        </span>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-variant-numeric: tabular-nums;">
                        {singleAnalysisData.as_of ? formatVNTime(singleAnalysisData.as_of) : '4H'}
                    </span>
                </div>

                <!-- Price Headline -->
                <div style="display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.85rem;">
                    <div style="font-size: 2.2rem; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; line-height: 1;">
                        ${formatPrice(singleAnalysisData.reference_price)}
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Giá Tham Chiếu Nến 4H</span>
                </div>

                <!-- Price Location Visual Gauge (Con Tàu Thị Trường) -->
                <PriceLocationGauge 
                    price={singleAnalysisData.reference_price} 
                    support={singleAnalysisData.key_levels?.support} 
                    resistance={singleAnalysisData.key_levels?.resistance} 
                />

                <!-- 2 Hộp Cản Hỗ Trợ & Kháng Cự (Side-by-Side) -->
                <div class="meta-grid" style="margin-top: 1rem;">
                    <!-- Support -->
                    <div class="price-box" style="background: var(--emerald-bg); border-color: var(--emerald-border); padding: 0.85rem 1rem;">
                        <span class="price-label" style="color: var(--emerald); font-weight: 700; font-size: 0.75rem; text-transform: uppercase;">HỖ TRỢ</span>
                        {#if singleAnalysisData.key_levels?.support?.status === 'AVAILABLE'}
                            <div style="font-size: 0.95rem; font-weight: 700; color: var(--emerald); margin: 0.25rem 0; white-space: nowrap; font-variant-numeric: tabular-nums;">
                                ${formatPrice(singleAnalysisData.key_levels.support.lower)} – ${formatPrice(singleAnalysisData.key_levels.support.upper)}
                            </div>
                            <div style="font-size: 0.775rem; color: var(--emerald);">
                                Cách: <strong>${formatPrice(singleAnalysisData.key_levels.support.distance)}</strong> ({singleAnalysisData.key_levels.support.distance_percent?.toFixed(1)}%)
                            </div>
                        {:else}
                            <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-muted); margin-top: 0.25rem;">
                                Đang dò đáy mới
                            </div>
                        {/if}
                    </div>

                    <!-- Resistance -->
                    <div class="price-box" style="background: var(--rose-bg); border-color: var(--rose-border); padding: 0.85rem 1rem;">
                        <span class="price-label" style="color: var(--rose); font-weight: 700; font-size: 0.75rem; text-transform: uppercase;">KHÁNG CỰ</span>
                        {#if singleAnalysisData.key_levels?.resistance?.status === 'AVAILABLE'}
                            <div style="font-size: 0.95rem; font-weight: 700; color: var(--rose); margin: 0.25rem 0; white-space: nowrap; font-variant-numeric: tabular-nums;">
                                ${formatPrice(singleAnalysisData.key_levels.resistance.lower)} – ${formatPrice(singleAnalysisData.key_levels.resistance.upper)}
                            </div>
                            <div style="font-size: 0.775rem; color: var(--rose);">
                                Cách: <strong>${formatPrice(singleAnalysisData.key_levels.resistance.distance)}</strong> ({singleAnalysisData.key_levels.resistance.distance_percent?.toFixed(1)}%)
                            </div>
                        {:else}
                            <div style="font-size: 0.9rem; font-weight: 600; color: var(--rose); margin-top: 0.25rem;">
                                Không gian mở (Open Air)
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- ==================================================== -->
            <!-- RIGHT COLUMN: ĐỘNG LỰC, VPA & QUYẾT ĐỊNH THUẬT TOÁN   -->
            <!-- ==================================================== -->
            <div class="card cockpit-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <!-- 2x2 Grid Trạng Thái Thị Trường -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                        <span style="font-size: 0.825rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;">
                            Trạng Thái & Động Lực (VPA / Wyckoff)
                        </span>
                    </div>

                    <div class="price-grid" style="margin-bottom: 1rem;">
                        <div class="price-box">
                            <span class="price-label">Xu Hướng</span>
                            <span class="price-val" style="font-size: 0.875rem;">
                                {translateTrend(singleAnalysisData.market_state?.trend)}
                            </span>
                        </div>
                        <div class="price-box">
                            <span class="price-label">Cấu Trúc</span>
                            <span class="price-val" style="font-size: 0.875rem;">
                                {translateStructureBreak(singleAnalysisData.market_state?.structure_break)}
                            </span>
                        </div>
                        <div class="price-box">
                            <span class="price-label">Vị Trí Cản</span>
                            <span class="price-val" style="font-size: 0.875rem;">
                                {translateLocation(singleAnalysisData.market_state?.location)}
                            </span>
                        </div>
                        <div class="price-box">
                            <span class="price-label">Động Lực VPA</span>
                            <div style="font-weight: 700; font-size: 0.875rem; color: var(--text-primary);">
                                {vpa.headline}
                            </div>
                            <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.15rem;">
                                {vpa.detail}
                            </div>
                        </div>
                    </div>

                    <!-- Algorithmic Decision Box -->
                    <div style="background: var(--bg-subtle); border: 1px solid var(--border-card); border-radius: 12px; padding: 0.95rem 1.15rem; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                            <span style="font-size: 0.775rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                                Quyết Định Thuật Toán
                            </span>
                            <span class="badge badge-neutral" style="font-size: 0.75rem; font-weight: 600;">
                                {translateDecisionStatus(singleAnalysisData.decision?.status)}
                            </span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.55;">
                            {formatDecisionExplanation(singleAnalysisData)}
                        </div>
                    </div>
                </div>

                <!-- Plan or Manual Position Action -->
                <div>
                    {#if singleAnalysisData.plan}
                        <div style="background: var(--emerald-bg); border: 1px solid var(--emerald-border); border-radius: 12px; padding: 0.85rem 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span class="badge badge-emerald" style="font-weight: 700; font-size: 0.8rem;">
                                    🚀 KẾ HOẠCH {singleAnalysisData.plan.direction}
                                </span>
                                <span style="font-size: 0.8rem; font-weight: 600; color: var(--emerald);">
                                    {getFriendlyWyckoffTitle(singleAnalysisData.plan.policy_id, singleAnalysisData.plan.direction)}
                                </span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; text-align: center; margin-bottom: 0.65rem;">
                                <div style="background: #FFF; padding: 0.45rem; border-radius: 8px; border: 1px solid var(--emerald-border);">
                                    <div style="font-size: 0.7rem; color: var(--text-muted);">Entry</div>
                                    <div style="font-size: 0.875rem; font-weight: 700;">${formatPrice(singleAnalysisData.plan.entry)}</div>
                                </div>
                                <div style="background: #FFF; padding: 0.45rem; border-radius: 8px; border: 1px solid var(--emerald-border);">
                                    <div style="font-size: 0.7rem; color: var(--text-muted);">Stop Loss</div>
                                    <div style="font-size: 0.875rem; font-weight: 700; color: var(--rose);">${formatPrice(singleAnalysisData.plan.stop)}</div>
                                </div>
                                <div style="background: #FFF; padding: 0.45rem; border-radius: 8px; border: 1px solid var(--emerald-border);">
                                    <div style="font-size: 0.7rem; color: var(--text-muted);">Take Profit</div>
                                    <div style="font-size: 0.875rem; font-weight: 700; color: var(--emerald);">${formatPrice(singleAnalysisData.plan.target)}</div>
                                </div>
                                <div style="background: #FFF; padding: 0.45rem; border-radius: 8px; border: 1px solid var(--emerald-border);">
                                    <div style="font-size: 0.7rem; color: var(--text-muted);">Tỷ Lệ R:R</div>
                                    <div style="font-size: 0.875rem; font-weight: 700; color: var(--emerald);">{singleAnalysisData.plan.reward_risk?.toFixed(2)} R</div>
                                </div>
                            </div>
                            <button 
                                class="btn btn-emerald" 
                                style="width: 100%; padding: 0.6rem; font-size: 0.875rem; font-weight: 600;"
                                on:click={() => onOpenOrderModal(
                                    singleAnalysisData.symbol, 
                                    singleAnalysisData.plan.direction || 'LONG',
                                    singleAnalysisData.plan.entry,
                                    singleAnalysisData.plan.stop,
                                    singleAnalysisData.plan.target
                                )}
                            >
                                📋 Đặt Lệnh Theo Dõi (${formatPrice(singleAnalysisData.plan.entry)})
                            </button>
                        </div>
                    {:else}
                        <button 
                            class="btn btn-outline" 
                            style="width: 100%; padding: 0.65rem; font-size: 0.85rem; font-weight: 600; border-style: dashed;"
                            on:click={() => onOpenOrderModal(
                                selectedSymbol, 
                                'LONG',
                                singleAnalysisData.reference_price,
                                singleAnalysisData.key_levels?.support?.lower || (singleAnalysisData.reference_price * 0.97).toFixed(4),
                                singleAnalysisData.key_levels?.resistance?.upper || (singleAnalysisData.reference_price * 1.05).toFixed(4)
                            )}
                        >
                            + Tạo Vị Thế Theo Dõi Cho {cleanSymbol(selectedSymbol)}
                        </button>
                    {/if}
                </div>
            </div>
        </div>
    {/if}

{:else if activeView === 'scan'}
    <!-- ======================================================== -->
    <!-- SCAN VIEW ACROSS ALL UNIVERSE COINS                       -->
    <!-- ======================================================== -->
    <div class="card">
        <div class="card-header" style="margin-bottom: 1rem;">
            <div>
                <div class="card-title">Bộ Quét Thị Trường Tự Động ({scanData?.scanned_count || UNIVERSE_COINS.length} Cặp Coin)</div>
                {#if scanData}
                    <div class="stat-sub" style="margin-top: 0.25rem;">
                        📊 Đã quét <strong>{scanData.scanned_count}</strong> coin · 
                        <span class="text-emerald" style="font-weight: 600;">{scanData.actionable_count} Setup sẵn sàng</span> · 
                        {scanData.no_trade_count} Đang quan sát · 
                        {scanData.failures?.length || 0} Lỗi
                    </div>
                {/if}
            </div>
            <button class="btn btn-outline" style="padding: 0.45rem 0.9rem; font-size: 0.85rem;" on:click={loadScanData} disabled={isScanLoading}>
                {isScanLoading ? '⌛ Đang quét...' : '🔍 Quét Lại Danh Mục'}
            </button>
        </div>

        {#if isScanLoading}
            <div style="padding: 3.5rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 1.15rem; margin-bottom: 0.4rem; font-weight: 600;">⌛ Đang chạy quét song song trên backend...</div>
                <div style="font-size: 0.85rem;"><code>GET /api/v1/analysis/scan</code></div>
            </div>
        {:else if scanData && scanData.candidates && scanData.candidates.length > 0}
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 1rem;">
                {#each scanData.candidates as candidate}
                    <div class="subtype-card" style="margin-bottom: 0; padding: 1.15rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="symbol-tag" style="font-size: 1rem;">{cleanSymbol(candidate.symbol)}</span>
                                <span class="badge badge-emerald" style="font-size: 0.775rem;">🟢 Sẵn sàng ({candidate.analysis?.plan?.direction || 'LONG'})</span>
                            </div>
                            <span class="badge badge-neutral" style="font-size: 0.75rem;">
                                Điểm: {(candidate.priority?.score || 95).toFixed(1)}/100
                            </span>
                        </div>

                        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.3rem;">
                            {getFriendlyWyckoffTitle(candidate.analysis?.plan?.policy_id, candidate.analysis?.plan?.direction)}
                        </div>

                        <div style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 0.75rem;">
                            {getFriendlyVPADesc(candidate)}
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.45rem; text-align: center; margin-bottom: 0.75rem;">
                            <div class="price-box" style="padding: 0.4rem;">
                                <span class="price-label" style="font-size: 0.7rem;">Entry</span>
                                <span class="price-val" style="font-size: 0.85rem;">${formatPrice(candidate.analysis?.plan?.entry)}</span>
                            </div>
                            <div class="price-box" style="padding: 0.4rem;">
                                <span class="price-label" style="font-size: 0.7rem;">SL</span>
                                <span class="price-val text-rose" style="font-size: 0.85rem;">${formatPrice(candidate.analysis?.plan?.stop)}</span>
                            </div>
                            <div class="price-box" style="padding: 0.4rem;">
                                <span class="price-label" style="font-size: 0.7rem;">TP</span>
                                <span class="price-val text-emerald" style="font-size: 0.85rem;">${formatPrice(candidate.analysis?.plan?.target)}</span>
                            </div>
                            <div class="price-box" style="padding: 0.4rem;">
                                <span class="price-label" style="font-size: 0.7rem;">R:R</span>
                                <span class="price-val text-emerald" style="font-size: 0.85rem;">{candidate.analysis?.plan?.reward_risk?.toFixed(2)} R</span>
                            </div>
                        </div>

                        <button 
                            class="btn btn-emerald" 
                            style="width: 100%; padding: 0.5rem; font-size: 0.85rem; font-weight: 600;"
                            on:click={() => onOpenOrderModal(
                                candidate.symbol,
                                candidate.analysis?.plan?.direction || 'LONG',
                                candidate.analysis?.plan?.entry,
                                candidate.analysis?.plan?.stop,
                                candidate.analysis?.plan?.target
                            )}
                        >
                            📋 Đặt Lệnh ({candidate.analysis?.plan?.direction} @ ${formatPrice(candidate.analysis?.plan?.entry)})
                        </button>
                    </div>
                {/each}
            </div>
        {:else}
            <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
                <div style="font-size: 1.15rem; margin-bottom: 0.4rem; font-weight: 600;">⏸️ Chưa có coin nào đạt chuẩn vào lệnh (NO TRADE)</div>
                <div style="font-size: 0.875rem; max-width: 520px; margin: 0 auto; line-height: 1.55;">
                    Toàn bộ {UNIVERSE_COINS.length} coin đang trong trạng thái quan sát hoặc nằm lưng chừng range. Hệ thống giữ vững kỷ luật, chờ tín hiệu xác nhận cạn cung tại hỗ trợ.
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .top-control-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        gap: 1rem;
        flex-wrap: wrap;
    }
    .view-toggle-group {
        display: flex;
        gap: 0.4rem;
    }
    .coin-selector-strip {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
        align-items: center;
    }
    .coin-pill-btn {
        background: #FFFFFF;
        border: 1px solid var(--border-card);
        color: var(--text-secondary);
        padding: 0.3rem 0.65rem;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .coin-pill-btn:hover {
        border-color: var(--text-primary);
        color: var(--text-primary);
    }
    .coin-pill-btn.selected {
        background: var(--btn-primary);
        color: #FFFFFF;
        border-color: var(--btn-primary);
    }
    .cockpit-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
        align-items: stretch;
    }
    .cockpit-card {
        margin-bottom: 0;
        padding: 1.5rem 1.75rem;
    }
    @media (max-width: 950px) {
        .cockpit-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
