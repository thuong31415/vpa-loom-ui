<script>
    import { onMount } from 'svelte';
    import { fetchPositionsApi, closePositionApi, UNIVERSE_COINS } from '../api.js';

    export let onOpenOrderModal = (symbol, direction, entry, sl, tp) => {};

    let currentFilter = 'ALL';
    let isLoading = false;

    let positions = [
        {
            id: 'pos-seed-1',
            rawId: null,
            symbol: 'ETHUSDT',
            direction: 'LONG',
            status: 'FILLED',
            statusLabel: 'Đã khớp',
            statusClass: 'badge-emerald',
            entry: 1580.13,
            sl: 1540.18,
            tp: 1950.00,
            risk: 200.00,
            rResult: '+7.81 R',
            actionBtnText: 'Chốt đóng vị thế',
            nextStatus: 'CLOSED'
        }
    ];

    export async function loadLivePositions() {
        isLoading = true;
        try {
            const promises = UNIVERSE_COINS.map(sym => fetchPositionsApi(sym));
            const results = await Promise.all(promises);
            const livePositions = results
                .filter(r => r.success && r.data && r.data.id)
                .map(r => {
                    const p = r.data;
                    return {
                        id: `pos-${p.id}`,
                        rawId: p.id,
                        symbol: p.symbol || 'ETHUSDT',
                        direction: p.direction || 'LONG',
                        status: p.status === 'OPEN' ? 'FILLED' : (p.status || 'FILLED'),
                        statusLabel: p.status === 'OPEN' ? 'Đang Mở (Live)' : (p.status || 'Đang Mở'),
                        statusClass: p.direction === 'LONG' ? 'badge-emerald' : 'badge-rose',
                        entry: parseFloat(p.entryPrice) || 0,
                        sl: parseFloat(p.protectiveStop) || 0,
                        tp: parseFloat(p.target) || 0,
                        risk: parseFloat(p.quoteAmount) || 200,
                        rResult: p.realizedR != null ? `${p.realizedR >= 0 ? '+' : ''}${p.realizedR.toFixed(2)} R` : (p.realizedPnlPercentDisplay || 'Đang mở'),
                        actionBtnText: 'Chốt đóng vị thế',
                        nextStatus: 'CLOSED'
                    };
                });

            if (livePositions.length > 0) {
                positions = livePositions;
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
        if (nextStatus === 'ORDERED') {
            pos.status = 'ORDERED';
            pos.statusLabel = 'Đã đặt thủ công';
            pos.statusClass = 'badge-amber';
            pos.actionBtnText = 'Đã khớp lệnh sàn';
            pos.nextStatus = 'FILLED';
        } else if (nextStatus === 'FILLED') {
            pos.status = 'FILLED';
            pos.statusLabel = 'Đã khớp';
            pos.statusClass = 'badge-emerald';
            pos.rResult = '+0.00 R';
            pos.actionBtnText = 'Chốt đóng vị thế';
            pos.nextStatus = 'CLOSED';
        } else if (nextStatus === 'CLOSED') {
            if (pos.rawId) {
                const exitPrice = prompt(`Nhập giá chốt đóng vị thế ${pos.symbol} (Entry: $${pos.entry}):`, String(pos.entry));
                if (exitPrice === null) return;
                const res = await closePositionApi(pos.rawId, parseFloat(exitPrice) || pos.entry, 'MANUAL_DASHBOARD_CLOSE');
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
            <div class="card-title">Quản Lý Vị Thế</div>
            <div class="stat-sub" style="margin-top: 0.2rem;">
                Tự động đồng bộ vị thế mở từ PostgreSQL DB
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
        <button class="pill-btn {currentFilter === 'ALL' ? 'active' : ''}" on:click={() => currentFilter = 'ALL'}>Tất cả vị thế mở</button>
        <button class="pill-btn {currentFilter === 'PROPOSED' ? 'active' : ''}" on:click={() => currentFilter = 'PROPOSED'}>Đề xuất</button>
        <button class="pill-btn {currentFilter === 'ORDERED' ? 'active' : ''}" on:click={() => currentFilter = 'ORDERED'}>Đã đặt</button>
        <button class="pill-btn {currentFilter === 'FILLED' ? 'active' : ''}" on:click={() => currentFilter = 'FILLED'}>Đã khớp</button>
    </div>

    <div id="positions-list">
        {#each filteredPositions as pos (pos.id)}
            <div class="position-card" data-status={pos.status}>
                <div class="position-header">
                    <div class="position-title-group">
                        <span class="symbol-tag">{pos.symbol}</span>
                        <span class="badge {pos.direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}">{pos.direction}</span>
                        <span class="badge {pos.statusClass}">{pos.statusLabel}</span>
                    </div>
                    <button class="btn btn-outline" on:click={() => changeStatus(pos, pos.nextStatus)}>
                        {pos.actionBtnText}
                    </button>
                </div>
                <div class="position-metrics-grid">
                    <div class="p-metric-item">
                        <span class="p-metric-label">Giá Entry</span>
                        <span class="p-metric-val">${pos.entry.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="p-metric-item">
                        <span class="p-metric-label">Stop Loss (SL)</span>
                        <span class="p-metric-val text-rose">${pos.sl.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="p-metric-item">
                        <span class="p-metric-label">Target TP</span>
                        <span class="p-metric-val text-emerald">${pos.tp.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="p-metric-item">
                        <span class="p-metric-label">Rủi ro ($)</span>
                        <span class="p-metric-val">${pos.risk.toFixed(2)}</span>
                    </div>
                    <div class="p-metric-item">
                        <span class="p-metric-label">Lãi lũy kế</span>
                        <span class="p-metric-val {pos.rResult.includes('+') ? 'text-emerald' : 'text-muted'}">{pos.rResult}</span>
                    </div>
                </div>
            </div>
        {/each}
        {#if filteredPositions.length === 0}
            <div class="position-card" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                Không có vị thế nào thuộc bộ lọc này.
            </div>
        {/if}
    </div>
</div>
