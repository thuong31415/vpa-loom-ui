<script>
    import { onMount } from 'svelte';
    import { fetchOpenPositionsApi, fetchPositionsApi, fetchAnalysis, closePositionApi, UNIVERSE_COINS, cleanSymbol, formatPrice, formatVNTime } from '../api.js';
    import ClosePositionModal from './ClosePositionModal.svelte';

    export let onOpenOrderModal = (symbol, direction, entry, sl, tp) => {};

    let isLoading = false;
    let positions = [];

    let totalPnlUsdt = 0;
    let totalPnlPercent = 0;
    let totalR = 0;
    let totalCapital = 0;

    export async function loadLivePositions() {
        isLoading = true;
        try {
            const res = await fetchOpenPositionsApi();
            const rawPositions = (res.success && Array.isArray(res.data)) ? res.data : [];

            if (rawPositions.length === 0) {
                positions = [];
                totalPnlUsdt = 0;
                totalPnlPercent = 0;
                totalR = 0;
                totalCapital = 0;
                return;
            }

            // Enrich each open position with live market price and analysis
            const enrichedPromises = rawPositions.map(async (p) => {
                const sym = p.symbol || 'LINKUSDT';
                const entry = parseFloat(p.entry_price ?? p.entryPrice ?? p.entry) || 0;
                const sl = parseFloat(p.protective_stop ?? p.protectiveStop ?? p.protective_stop_price ?? p.sl) || 0;
                const tp = parseFloat(p.target ?? p.target_price ?? p.tp) || 0;
                const risk = parseFloat(p.quote_amount ?? p.quoteAmount ?? p.notional_amount ?? p.risk) || 200;
                const direction = (p.direction || 'LONG').toUpperCase();

                // Fetch latest current price and market analysis for this active open coin
                let currentPrice = entry;
                let effortType = 'NORMAL';
                let trend = 'BULLISH';
                let engineRec = null;
                try {
                    const anaRes = await fetchAnalysis(sym);
                    if (anaRes && anaRes.success && anaRes.data) {
                        if (anaRes.data.reference_price) {
                            currentPrice = parseFloat(anaRes.data.reference_price);
                        }
                        if (anaRes.data.market_state?.effort_result?.type) {
                            effortType = anaRes.data.market_state.effort_result.type;
                        }
                        if (anaRes.data.market_state?.trend) {
                            trend = anaRes.data.market_state.trend;
                        }
                        if (anaRes.data.position?.recommendation) {
                            engineRec = anaRes.data.position.recommendation;
                        }
                    }
                } catch (e) {
                    console.warn(`Could not fetch live analysis for ${sym}:`, e);
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

                // Streamlined Binary Position Decision (HOLD vs BÁN)
                let isSell = false;
                let actionTitle = '🟢 HOLD (TIẾP TỤC GIỮ)';
                let actionBadge = 'badge-emerald';
                let actionDesc = `Vị thế an toàn, cấu trúc sóng duy trì (+${rMultiple.toFixed(2)} R). Tiếp tục gồng theo sóng.`;

                if (engineRec === 'STOP_LOSS') {
                    isSell = true;
                    actionTitle = '🔴 BÁN (CHẠM STOP LOSS)';
                    actionBadge = 'badge-rose';
                    actionDesc = 'Giá đã chạm ngưỡng cắt lỗ bảo vệ. Đóng vị thế ngay.';
                } else if (engineRec === 'EXIT_ON_OPPOSITE_SIGNAL' || engineRec === 'EXIT_ON_OPEN_SURFACE_STRUCTURE_LOSS' || engineRec === 'EXIT_ON_OPEN_SURFACE_MATURE_RUNNER_REVERSAL') {
                    isSell = true;
                    actionTitle = '🔴 BÁN (ĐẢO CHIỀU CẤU TRÚC)';
                    actionBadge = 'badge-rose';
                    actionDesc = 'Cây nến đã đóng xác nhận tín hiệu đảo chiều / gãy cấu trúc. Đóng vị thế chốt lời ngay.';
                } else if (effortType === 'HIGH_EFFORT_LOW_RESULT') {
                    isSell = true;
                    actionTitle = '🔴 BÁN (XUẤT HIỆN LỰC XẢ)';
                    actionBadge = 'badge-rose';
                    actionDesc = 'Nến đóng có lực xả hàng lớn của Smart Money (Cá mập xả ngầm). Đóng vị thế chốt lời ngay.';
                } else if (direction === 'LONG' && tp > 0 && currentPrice >= tp) {
                    actionTitle = '🟢 HOLD (GỒNG LÃI RUNNER)';
                    actionBadge = 'badge-emerald';
                    actionDesc = `Giá ($${currentPrice.toFixed(3)}) đã vượt Target ($${tp.toFixed(3)}), sóng vẫn đang mạnh (+${rMultiple.toFixed(2)} R). Tiếp tục HOLD theo sóng cho đến khi nến đóng đảo chiều.`;
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
                    isSell: isSell,
                    actionTitle: actionTitle,
                    actionBadge: actionBadge,
                    actionDesc: actionDesc,
                    actionBtnText: isSell ? '🔴 BÁN NGAY' : 'Chốt đóng vị thế',
                    nextStatus: 'CLOSED'
                };
            });

            const livePositions = await Promise.all(enrichedPromises);
            positions = livePositions;

            // Summary Totals
            totalPnlUsdt = positions.reduce((acc, curr) => acc + curr.pnlUsdt, 0);
            totalCapital = positions.reduce((acc, curr) => acc + curr.risk, 0);
            totalR = positions.reduce((acc, curr) => acc + curr.rMultiple, 0);
            totalPnlPercent = totalCapital > 0 ? (totalPnlUsdt / totalCapital) * 100 : 0;

        } catch (err) {
            console.warn('Error loading live positions:', err);
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadLivePositions();
    });

    let isCloseModalOpen = false;
    let selectedClosePosition = null;

    export function addPosition(newPos) {
        positions = [newPos, ...positions];
    }

    function handleOpenCloseModal(pos) {
        selectedClosePosition = pos;
        isCloseModalOpen = true;
    }

    function handleCloseModal() {
        isCloseModalOpen = false;
        selectedClosePosition = null;
    }

    async function handleConfirmClose(pos, exitPrice) {
        if (pos.rawId) {
            const res = await closePositionApi(pos.rawId, exitPrice, 'MANUAL_DASHBOARD_CLOSE');
            if (!res.success) {
                console.warn('Backend close failed:', res.error);
            }
        }
        positions = positions.filter(p => p.id !== pos.id);
        await loadLivePositions();
    }
</script>

<div class="card" style="box-shadow: none; border: none; background: transparent; padding: 0;">
    <!-- Compact, Clean Header with Summary Metrics -->
    <div class="card-header" style="background: #FFFFFF; padding: 1.15rem 1.5rem; border-radius: 16px; border: 1px solid var(--border-card); margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <div class="card-title" style="margin: 0; font-size: 1.15rem;">Vị Thế Đang Mở ({positions.length})</div>
            {#if positions.length > 0}
                <span class="badge {totalPnlUsdt >= 0 ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.85rem; padding: 0.35rem 0.75rem; font-weight: 700;">
                    P&L: {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}% ({totalPnlUsdt >= 0 ? '+' : ''}${totalPnlUsdt.toFixed(2)})
                </span>
                <span class="badge badge-emerald" style="font-size: 0.85rem; padding: 0.35rem 0.75rem; font-weight: 700;">
                    {totalR >= 0 ? '+' : ''}{totalR.toFixed(2)} R
                </span>
                <span class="badge badge-neutral" style="font-size: 0.8rem; padding: 0.35rem 0.65rem;">
                    Vốn: ${totalCapital.toFixed(2)} USDT
                </span>
            {/if}
        </div>
        <div style="display: flex; gap: 0.65rem;">
            <button class="btn btn-outline" on:click={loadLivePositions} disabled={isLoading} style="padding: 0.45rem 0.9rem; font-size: 0.85rem;">
                {isLoading ? '⌛ Đang tải...' : '🔄 Làm mới'}
            </button>
            <button class="btn" on:click={() => onOpenOrderModal('', 'LONG', '', '', '')} style="padding: 0.45rem 1rem; font-size: 0.85rem;">+ Mở vị thế</button>
        </div>
    </div>

    <!-- Active Positions List -->
    <div id="positions-list">
        {#each positions as pos (pos.id)}
            <div class="position-card" data-status={pos.status} style="background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 14px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <div class="position-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
                    <div class="position-title-group" style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                        <span class="symbol-tag">{cleanSymbol(pos.symbol)}</span>
                        <span class="badge {pos.direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}" style="font-weight: 700; font-size: 0.85rem;">{pos.direction}</span>
                        <span class="badge {pos.statusClass}" style="font-size: 0.8rem;">{pos.statusLabel}</span>
                        {#if pos.policyId}
                            <span class="badge badge-neutral" style="font-size: 0.75rem;">Setup: {pos.policyId}</span>
                        {/if}
                    </div>
                    <button class="btn btn-outline" style="font-size: 0.85rem; padding: 0.4rem 0.9rem;" on:click={() => handleOpenCloseModal(pos)}>
                        {pos.actionBtnText}
                    </button>
                </div>

                <div class="position-metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; padding: 1rem; background: var(--bg-subtle); border-radius: 10px; border: 1px solid var(--border-card);">
                    <!-- 1. Entry Price -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Giá Entry</span>
                        <span class="p-metric-val" style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-top: 0.15rem; display: block;">
                            ${formatPrice(pos.entry)}
                        </span>
                    </div>

                    <!-- 2. Current Price -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Giá Hiện Tại</span>
                        <span class="p-metric-val" style="font-size: 1.15rem; font-weight: 800; color: {pos.pnlPercent >= 0 ? 'var(--emerald)' : 'var(--rose)'}; margin-top: 0.15rem; display: block;">
                            ${formatPrice(pos.currentPrice)}
                        </span>
                    </div>

                    <!-- 3. Stop Loss -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Stop Loss (SL)</span>
                        <span class="p-metric-val text-rose" style="font-size: 1.15rem; font-weight: 800; color: var(--rose); margin-top: 0.15rem; display: block;">
                            ${formatPrice(pos.sl)}
                        </span>
                    </div>

                    <!-- 4. Target TP -->
                    <div class="p-metric-item">
                        <span class="p-metric-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Target TP</span>
                        <span class="p-metric-val text-emerald" style="font-size: 1.15rem; font-weight: 800; color: var(--emerald); margin-top: 0.15rem; display: block;">
                            ${formatPrice(pos.tp)}
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

                <!-- Streamlined HOLD / BÁN Action Banner -->
                <div style="margin-top: 1rem; padding: 0.85rem 1.15rem; background: {pos.isSell ? 'var(--rose-bg)' : 'var(--emerald-bg)'}; border: 1px solid {pos.isSell ? 'var(--rose-border)' : 'var(--emerald-border)'}; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <div style="font-size: 0.95rem; font-weight: 800; color: {pos.isSell ? 'var(--rose)' : 'var(--emerald)'};">
                            {pos.actionTitle}
                        </div>
                        <div style="font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.2rem;">
                            {pos.actionDesc}
                        </div>
                    </div>
                    <span class="badge {pos.actionBadge}" style="font-size: 0.85rem; font-weight: 800; padding: 0.35rem 0.85rem;">
                        {pos.isSell ? '🔴 BÁN' : '🟢 HOLD'}
                    </span>
                </div>

                {#if pos.entryTime}
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.75rem;">
                        📅 Thời gian mở lệnh: <strong>{formatVNTime(pos.entryTime)}</strong> · Vốn phân bổ: <strong>${pos.risk.toFixed(2)} USDT</strong>
                    </div>
                {/if}
            </div>
        {/each}

        {#if positions.length === 0}
            <div class="position-card" style="text-align: center; color: var(--text-muted); padding: 3.5rem 1rem; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 14px;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                <div style="font-weight: 700; color: var(--text-primary); font-size: 1.05rem;">Hiện tại chưa có vị thế mở nào</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem; max-width: 450px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                    Hệ thống đang quét thị trường. Khi xuất hiện setup hợp lệ hoặc bác mở vị thế thủ công, lệnh sẽ được quản lý real-time tại đây.
                </div>
            </div>
        {/if}
    </div>
</div>

<ClosePositionModal 
    isOpen={isCloseModalOpen} 
    position={selectedClosePosition} 
    onClose={handleCloseModal} 
    onConfirmClose={handleConfirmClose} 
/>
