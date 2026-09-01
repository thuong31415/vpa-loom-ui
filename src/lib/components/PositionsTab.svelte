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

            const enrichedPromises = rawPositions.map(async (p) => {
                const sym = p.symbol || 'LINKUSDT';
                const entry = parseFloat(p.entry_price ?? p.entryPrice ?? p.entry) || 0;
                const sl = parseFloat(p.protective_stop ?? p.protectiveStop ?? p.protective_stop_price ?? p.sl) || 0;
                const tp = parseFloat(p.target ?? p.target_price ?? p.tp) || 0;
                const risk = parseFloat(p.quote_amount ?? p.quoteAmount ?? p.notional_amount ?? p.risk) || 200;
                const direction = (p.direction || 'LONG').toUpperCase();

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

                let isSell = false;
                let actionTitle = 'TIẾP TỤC NẮM GIỮ';
                let actionBadge = 'badge-emerald';
                let actionDesc = `Vị thế an toàn, xu hướng được bảo toàn (+${rMultiple.toFixed(2)} R). Tiếp tục nắm giữ theo sóng.`;

                if (engineRec === 'STOP_LOSS') {
                    isSell = true;
                    actionTitle = 'CẮT LỖ BẢO VỆ VỐN';
                    actionBadge = 'badge-rose';
                    actionDesc = 'Giá đã chạm ngưỡng cắt lỗ bảo vệ. Đóng vị thế ngay.';
                } else if (engineRec === 'EXIT_ON_OPPOSITE_SIGNAL' || engineRec === 'EXIT_ON_OPEN_SURFACE_STRUCTURE_LOSS' || engineRec === 'EXIT_ON_OPEN_SURFACE_MATURE_RUNNER_REVERSAL') {
                    isSell = true;
                    actionTitle = 'CHỐT LỜI KHI ĐẢO CHIỀU';
                    actionBadge = 'badge-rose';
                    actionDesc = 'Nến 4H đã đóng xác nhận tín hiệu đảo chiều. Đóng vị thế chốt lời ngay.';
                } else if (effortType === 'HIGH_EFFORT_LOW_RESULT') {
                    isSell = true;
                    actionTitle = 'CHỐT LỜI KHI BỊ XẢ HÀNG';
                    actionBadge = 'badge-rose';
                    actionDesc = 'Nến đóng có áp lực xả hàng lớn của dòng tiền lớn. Đóng vị thế chốt lời ngay.';
                } else if (direction === 'LONG' && tp > 0 && currentPrice >= tp) {
                    actionTitle = 'TIẾP TỤC GỒNG LÃI';
                    actionBadge = 'badge-emerald';
                    actionDesc = `Giá ($${currentPrice.toFixed(3)}) đã vượt mục tiêu ($${tp.toFixed(3)}), sóng vẫn đang mạnh (+${rMultiple.toFixed(2)} R). Tiếp tục gồng lãi cho đến khi xuất hiện nến đảo chiều.`;
                }

                return {
                    id: `pos-${p.id}`,
                    rawId: p.id,
                    symbol: sym,
                    direction: direction,
                    status: p.status === 'OPEN' ? 'FILLED' : (p.status || 'FILLED'),
                    statusLabel: p.status === 'OPEN' ? 'Đang Mở' : (p.status || 'Đang Mở'),
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
                    actionBtnText: isSell ? 'Bán Ngay' : 'Chốt đóng vị thế',
                    nextStatus: 'CLOSED'
                };
            });

            const livePositions = await Promise.all(enrichedPromises);
            positions = livePositions;

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

<div style="display: flex; flex-direction: column; gap: 1.25rem;">
    <!-- Compact Summary Header -->
    <div class="card pos-summary-card">
        <div class="pos-summary-left">
            <span style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">
                Vị Thế Đang Mở ({positions.length})
            </span>
            {#if positions.length > 0}
                <div class="pos-badges-wrap">
                    <span class="badge {totalPnlUsdt >= 0 ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.825rem; padding: 0.25rem 0.6rem; font-family: var(--font-mono);">
                        Lợi Nhuận: {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}% ({totalPnlUsdt >= 0 ? '+' : ''}${totalPnlUsdt.toFixed(2)})
                    </span>
                    <span class="badge badge-emerald" style="font-size: 0.825rem; padding: 0.25rem 0.6rem; font-family: var(--font-mono);">
                        {totalR >= 0 ? '+' : ''}{totalR.toFixed(2)} R
                    </span>
                    <span class="badge badge-neutral" style="font-size: 0.8rem; font-family: var(--font-mono);">
                        Tổng Vốn: ${totalCapital.toFixed(2)}
                    </span>
                </div>
            {/if}
        </div>
        <div class="pos-summary-actions">
            <button class="btn btn-outline" on:click={loadLivePositions} disabled={isLoading} style="padding: 0.4rem 0.85rem; font-size: 0.825rem;">
                {isLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
            <button class="btn" on:click={() => onOpenOrderModal('', 'LONG', '', '', '')} style="padding: 0.4rem 0.95rem; font-size: 0.825rem;">
                + Mở vị thế
            </button>
        </div>
    </div>

    <!-- Active Positions List -->
    <div id="positions-list">
        {#each positions as pos (pos.id)}
            <div class="position-card" data-status={pos.status}>
                <div class="position-header">
                    <div class="position-title-group">
                        <span class="station-symbol">{cleanSymbol(pos.symbol)}</span>
                        <span class="badge {pos.direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}">{pos.direction === 'SHORT' ? 'BÁN' : 'MUA'}</span>
                        <span class="badge {pos.statusClass}">{pos.statusLabel}</span>
                        {#if pos.policyId}
                            <span class="badge badge-neutral">Chiến Lược: {pos.policyId}</span>
                        {/if}
                    </div>
                    <button class="btn {pos.isSell ? 'btn-rose' : 'btn-outline'}" style="font-size: 0.825rem; padding: 0.35rem 0.85rem;" on:click={() => handleOpenCloseModal(pos)}>
                        {pos.actionBtnText}
                    </button>
                </div>

                <div class="position-metrics-grid">
                    <div class="p-metric-item">
                        <span class="p-metric-label">Giá Vào</span>
                        <span class="p-metric-val">${formatPrice(pos.entry)}</span>
                    </div>

                    <div class="p-metric-item">
                        <span class="p-metric-label">Giá Hiện Tại</span>
                        <span class="p-metric-val {pos.pnlPercent >= 0 ? 'text-emerald' : 'text-rose'}">
                            ${formatPrice(pos.currentPrice)}
                        </span>
                    </div>

                    <div class="p-metric-item">
                        <span class="p-metric-label">Cắt Lỗ</span>
                        <span class="p-metric-val text-rose">${formatPrice(pos.sl)}</span>
                    </div>

                    <div class="p-metric-item">
                        <span class="p-metric-label">Chốt Lời</span>
                        <span class="p-metric-val text-emerald">${formatPrice(pos.tp)}</span>
                    </div>

                    <div class="p-metric-item">
                        <span class="p-metric-label">Lợi Nhuận</span>
                        <span class="p-metric-val {pos.pnlPercent >= 0 ? 'text-emerald' : 'text-rose'}">
                            {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                            <span style="font-size: 0.75rem; opacity: 0.8;">
                                ({pos.pnlUsdt >= 0 ? '+' : ''}${pos.pnlUsdt.toFixed(2)})
                            </span>
                        </span>
                    </div>

                    <div class="p-metric-item">
                        <span class="p-metric-label">Hiệu Suất R</span>
                        <span class="p-metric-val {pos.rMultiple >= 0 ? 'text-emerald' : 'text-rose'}">
                            {pos.rResult}
                        </span>
                    </div>
                </div>

                <!-- Strategic Action Banner -->
                <div style="margin-top: 0.85rem; padding: 0.85rem 1.15rem; background: {pos.isSell ? 'var(--phase-markdown-bg)' : 'var(--phase-markup-bg)'}; border: 1px solid {pos.isSell ? 'var(--phase-markdown-border)' : 'var(--phase-markup-border)'}; border-radius: 8px;">
                    <div style="font-size: 0.9rem; font-weight: 800; color: {pos.isSell ? 'var(--rose)' : 'var(--emerald)'};">
                        {pos.actionTitle}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem; line-height: 1.45;">
                        {pos.actionDesc}
                    </div>
                </div>

                {#if pos.entryTime}
                    <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.75rem; font-family: var(--font-mono);">
                        Thời gian mở: <strong>{formatVNTime(pos.entryTime)}</strong> · Vốn phân bổ: <strong>${pos.risk.toFixed(2)}</strong>
                    </div>
                {/if}
            </div>
        {/each}

        {#if positions.length === 0}
            <div class="card" style="text-align: center; color: var(--text-muted); padding: 4rem 1.5rem;">
                <div style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem; margin-bottom: 0.4rem;">
                    Chưa có vị thế mở nào
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); max-width: 480px; margin: 0 auto; line-height: 1.5;">
                    Hệ thống đang giám sát 15 coin theo chu kỳ Wyckoff. Khi xuất hiện điểm vào phù hợp hoặc bạn mở vị thế thủ công, trạng thái sẽ được theo dõi realtime tại đây.
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

<style>
    .pos-summary-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
    }
    .pos-summary-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .pos-badges-wrap {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
    }
    .pos-summary-actions {
        display: flex;
        gap: 0.5rem;
    }

    @media (max-width: 640px) {
        .pos-summary-card {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
            padding: 1rem;
        }
        .pos-summary-actions {
            width: 100%;
        }
        .pos-summary-actions button {
            flex: 1;
            justify-content: center;
        }
    }
</style>
