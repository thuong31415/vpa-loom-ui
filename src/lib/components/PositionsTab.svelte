<script>
    import { onMount } from 'svelte';
    import { fetchPositionsApi, fetchAnalysis, closePositionApi, UNIVERSE_COINS } from '../api.js';

    export let onOpenOrderModal = (symbol, direction, entry, sl, tp) => {};

    let currentFilter = 'ALL';
    let isLoading = false;

    let positions = [];

    export async function loadLivePositions() {
        isLoading = true;
        try {
            const promises = UNIVERSE_COINS.map(sym => fetchPositionsApi(sym));
            const results = await Promise.all(promises);
            
            const rawPositions = results
                .filter(r => r.success && r.data && r.data.id)
                .map(r => r.data);

            // Enrich each position with live current price from analysis API
            const enrichedPromises = rawPositions.map(async (p) => {
                const sym = p.symbol || 'LINKUSDT';
                const entry = parseFloat(p.entry_price ?? p.entryPrice ?? p.entry) || 0;
                const sl = parseFloat(p.protective_stop ?? p.protectiveStop ?? p.protective_stop_price ?? p.sl) || 0;
                const tp = parseFloat(p.target ?? p.target_price ?? p.tp) || 0;
                const risk = parseFloat(p.quote_amount ?? p.quoteAmount ?? p.notional_amount ?? p.risk) || 200;
                const direction = (p.direction || 'LONG').toUpperCase();

                // Fetch latest current price and market analysis
                let currentPrice = entry;
                let effortType = 'NORMAL';
                let trend = 'BULLISH';
                try {
                    const anaRes = await fetchAnalysis(sym);
                    if (anaRes.success && anaRes.data) {
                        if (anaRes.data.reference_price) {
                            currentPrice = parseFloat(anaRes.data.reference_price);
                        }
                        if (anaRes.data.market_state?.effort_result?.type) {
                            effortType = anaRes.data.market_state.effort_result.type;
                        }
                        if (anaRes.data.market_state?.trend) {
                            trend = anaRes.data.market_state.trend;
                        }
                    }
                } catch (e) {
                    console.warn(`Could not fetch live price for ${sym}:`, e);
                }

                // Compute real-time PnL & R-Multiple
                let pnlPercent = 0;
                let pnlUsdt = 0;
                let rMultiple = 0;

                if (entry > 0) {
                    if (direction === 'LONG') {
                        pnlPercent = ((currentPrice - entry) / entry) * 100;
                        pnlUsdt = risk * (pnlPercent / 100);
                        if (entry > sl && sl > 0) {
                            rMultiple = (currentPrice - entry) / (entry - sl);
                        }
                    } else {
                        pnlPercent = ((entry - currentPrice) / entry) * 100;
                        pnlUsdt = risk * (pnlPercent / 100);
                        if (sl > entry && sl > 0) {
                            rMultiple = (entry - currentPrice) / (sl - entry);
                        }
                    }
                }

                // Smart Position Advisory
                let advisoryTitle = '🟢 TIẾP TỤC NẮM GIỮ (HOLD)';
                let advisoryBadge = 'badge-emerald';
                let advisoryDesc = 'Cấu trúc nến và vùng bảo vệ Stop Loss vẫn an toàn. Tiếp tục gồng theo kế hoạch.';

                if (direction === 'LONG' && tp > 0 && currentPrice >= tp) {
                    advisoryTitle = '🚀 RUNNER: ĐÃ VƯỢT TARGET — TIẾP TỤC GỒNG LÃI';
                    advisoryBadge = 'badge-emerald';
                    advisoryDesc = `Giá ($${currentPrice.toFixed(3)}) đã vượt Target ban đầu ($${tp.toFixed(3)}). Động lực tăng vẫn rất mạnh! Khuyến nghị dời Trailing Stop lên $${tp.toFixed(3)} để khóa chắc lợi nhuận tối thiểu và gồng tiếp trọn sóng lớn!`;
                } else if (effortType === 'HIGH_EFFORT_LOW_RESULT') {
                    advisoryTitle = '⚠️ CẢNH BÁO: XUẤT HIỆN LỰC BÁN CẢN (ABSORPTION)';
                    advisoryBadge = 'badge-amber';
                    advisoryDesc = 'Khối lượng giao dịch tăng cao nhưng nến bị rút râu (HIGH_EFFORT_LOW_RESULT). Có thể gặp áp lực chốt lời ngắn hạn, cân nhắc nâng Stop Loss bảo vệ lãi!';
                } else if (rMultiple >= 5) {
                    advisoryTitle = '💎 LÃI LỚN: TIẾP TỤC GỒNG XU HƯỚNG';
                    advisoryBadge = 'badge-emerald';
                    advisoryDesc = `Vị thế đang có hiệu suất rất cao (+${rMultiple.toFixed(2)} R). Xu hướng ${trend} duy trì tốt, chưa có tín hiệu phá vỡ cấu trúc giảm.`;
                }

                return {
                    id: `pos-${p.id}`,
                    rawId: p.id,
                    symbol: sym,
                    direction: direction,
                    status: p.status === 'OPEN' ? 'FILLED' : (p.status || 'FILLED'),
                    statusLabel: p.status === 'OPEN' ? 'Đang Mở (Live)' : (p.status || 'Đang Mở'),
                    statusClass: direction === 'LONG' ? 'badge-emerald' : 'badge-rose',
                    entry: entry,
                    currentPrice: currentPrice,
                    sl: sl,
                    tp: tp,
                    risk: risk,
                    policyId: p.policy_id || p.policyId || '',
                    entryTime: p.entry_time || p.entryTime || '',
                    pnlPercent: pnlPercent,
                    pnlUsdt: pnlUsdt,
                    rMultiple: rMultiple,
                    rResult: `${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)} R`,
                    advisoryTitle: advisoryTitle,
                    advisoryBadge: advisoryBadge,
                    advisoryDesc: advisoryDesc,
                    actionBtnText: 'Chốt đóng vị thế',
                    nextStatus: 'CLOSED'
                };
            });

            const livePositions = await Promise.all(enrichedPromises);

            if (livePositions.length > 0) {
                positions = livePositions;
            } else if (positions.length === 0) {
                // Keep empty state
                positions = [];
            }
        } catch (err) {
            console.warn('Error loading live positions:', err);
        }
        isLoading = false;
    }

    onMount(() => {
        loadLivePositions();
    });

    export function addPosition(newPos) {
        positions = [newPos, ...positions];
    }

    async function changeStatus(pos, nextStatus) {
        if (nextStatus === 'CLOSED') {
            if (pos.rawId) {
                const exitPrice = prompt(`Nhập giá chốt đóng vị thế ${pos.symbol} (Giá hiện tại: $${pos.currentPrice.toFixed(4)}, Entry: $${pos.entry}):`, String(pos.currentPrice || pos.entry));
                if (exitPrice === null) return;
                const res = await closePositionApi(pos.rawId, parseFloat(exitPrice) || pos.currentPrice, 'MANUAL_DASHBOARD_CLOSE');
                if (res.success) {
                    alert(`✅ Đã đóng vị thế ${pos.symbol} thành công trên backend!`);
                }
            }
            positions = positions.filter(p => p.id !== pos.id);
            alert('✅ Vị thế đã được chốt đóng!');
            return;
        }
        positions = [...positions];
    }

    $: filteredPositions = positions.filter(p => currentFilter === 'ALL' || p.status === currentFilter);
</script>

<div class="card" style="box-shadow: none; border: none; background: transparent; padding: 0;">
    <div class="card-header" style="background: #FFFFFF; padding: 1.25rem 1.5rem; border-radius: 16px; border: 1px solid var(--border-card); margin-bottom: 1.25rem;">
        <div>
            <div class="card-title">Quản Lý Vị Thế Real-Time</div>
            <div class="stat-sub" style="margin-top: 0.2rem;">
                Tự động đồng bộ vị thế mở từ PostgreSQL DB & tính toán P&L theo giá thị trường
            </div>
        </div>
        <div style="display: flex; gap: 0.75rem;">
            <button class="btn btn-outline" on:click={loadLivePositions} disabled={isLoading}>
                {isLoading ? '⌛ Đang tải...' : '🔄 Tải vị thế DB'}
            </button>
            <button class="btn" on:click={() => onOpenOrderModal('', 'LONG', '', '', '')}>+ Thêm vị thế</button>
        </div>
    </div>

    <div class="filter-pills">
        <button class="pill-btn {currentFilter === 'ALL' ? 'active' : ''}" on:click={() => currentFilter = 'ALL'}>
            Tất cả vị thế mở ({positions.length})
        </button>
        <button class="pill-btn {currentFilter === 'PROPOSED' ? 'active' : ''}" on:click={() => currentFilter = 'PROPOSED'}>Đề xuất</button>
        <button class="pill-btn {currentFilter === 'ORDERED' ? 'active' : ''}" on:click={() => currentFilter = 'ORDERED'}>Đã đặt</button>
        <button class="pill-btn {currentFilter === 'FILLED' ? 'active' : ''}" on:click={() => currentFilter = 'FILLED'}>Đã khớp ({positions.length})</button>
    </div>

    <div id="positions-list">
        {#each filteredPositions as pos (pos.id)}
            <div class="position-card" data-status={pos.status} style="background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 14px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <div class="position-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
                    <div class="position-title-group" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span class="symbol-tag" style="font-size: 1rem; font-weight: 800;">{pos.symbol}</span>
                        <span class="badge {pos.direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}" style="font-weight: 700;">{pos.direction}</span>
                        <span class="badge {pos.statusClass}">{pos.statusLabel}</span>
                        {#if pos.policyId}
                            <span class="badge badge-neutral" style="font-size: 0.75rem;">Setup: {pos.policyId}</span>
                        {/if}
                    </div>
                    <button class="btn btn-outline" style="font-size: 0.85rem; padding: 0.4rem 0.9rem;" on:click={() => changeStatus(pos, pos.nextStatus)}>
                        {pos.actionBtnText}
                    </button>
                </div>

                <div class="position-metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; padding: 1rem; background: var(--bg-subtle); border-radius: 10px; border: 1px solid var(--border-card);">
                    <!-- 1. Entry Price -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Giá Entry</span>
                        <span class="p-metric-val" style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-top: 0.15rem; display: block;">
                            ${pos.entry.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                    </div>

                    <!-- 2. Current Price -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Giá Hiện Tại</span>
                        <span class="p-metric-val" style="font-size: 1.15rem; font-weight: 800; color: {pos.pnlPercent >= 0 ? 'var(--emerald)' : 'var(--rose)'}; margin-top: 0.15rem; display: block;">
                            ${pos.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                    </div>

                    <!-- 3. Stop Loss -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Stop Loss (SL)</span>
                        <span class="p-metric-val text-rose" style="font-size: 1.15rem; font-weight: 800; color: var(--rose); margin-top: 0.15rem; display: block;">
                            ${pos.sl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                    </div>

                    <!-- 4. Target TP -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Target TP</span>
                        <span class="p-metric-val text-emerald" style="font-size: 1.15rem; font-weight: 800; color: var(--emerald); margin-top: 0.15rem; display: block;">
                            ${pos.tp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                    </div>

                    <!-- 5. PnL Realtime -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Lợi Nhuận P&L</span>
                        <span class="p-metric-val" style="font-size: 1.15rem; font-weight: 800; color: {pos.pnlPercent >= 0 ? 'var(--emerald)' : 'var(--rose)'}; margin-top: 0.15rem; display: block;">
                            {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                            <span style="font-size: 0.8rem; font-weight: 600; opacity: 0.85;">
                                ({pos.pnlUsdt >= 0 ? '+' : ''}${pos.pnlUsdt.toFixed(2)})
                            </span>
                        </span>
                    </div>

                    <!-- 6. R-Multiple -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Hiệu Suất R</span>
                        <span class="p-metric-val" style="font-size: 1.15rem; font-weight: 800; color: {pos.rMultiple >= 0 ? 'var(--emerald)' : 'var(--rose)'}; margin-top: 0.15rem; display: block;">
                            {pos.rResult}
                        </span>
                    </div>
                </div>

                <!-- Smart Trade Advisory / Holding Recommendation -->
                <div style="margin-top: 1rem; padding: 0.9rem 1.1rem; background: {pos.advisoryBadge === 'badge-amber' ? 'var(--amber-bg)' : 'var(--emerald-bg)'}; border: 1px solid {pos.advisoryBadge === 'badge-amber' ? 'var(--amber-border)' : 'var(--emerald-border)'}; border-radius: 10px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.5rem;">
                        <span style="font-size: 0.85rem; font-weight: 800; color: {pos.advisoryBadge === 'badge-amber' ? 'var(--amber)' : 'var(--emerald)'};">
                            {pos.advisoryTitle}
                        </span>
                        <span class="badge {pos.advisoryBadge}" style="font-size: 0.75rem;">
                            {pos.direction === 'LONG' && pos.tp > 0 && pos.currentPrice >= pos.tp ? '🚀 VƯỢT TARGET TP' : 'SÓNG TĂNG DUY TRÌ'}
                        </span>
                    </div>
                    <div style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.45;">
                        {pos.advisoryDesc}
                    </div>
                </div>

                {#if pos.entryTime}
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.75rem;">
                        📅 Thời gian mở lệnh: <strong>{new Date(pos.entryTime).toLocaleString('vi-VN')}</strong> · Vốn phân bổ: <strong>${pos.risk.toFixed(2)} USDT</strong>
                    </div>
                {/if}
            </div>
        {/each}

        {#if filteredPositions.length === 0}
            <div class="position-card" style="text-align: center; color: var(--text-muted); padding: 3rem; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 14px;">
                <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📭</div>
                <div style="font-weight: 600; color: var(--text-primary);">Chưa có vị thế mở nào</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                    Bấm nút "🔄 Tải vị thế DB" hoặc "+ Thêm vị thế" để theo dõi lệnh.
                </div>
            </div>
        {/if}
    </div>
</div>
