<script>
    import { onMount } from 'svelte';
    import { fetchPositionHistoryApi, cleanSymbol, formatPrice, formatVNTime } from '../api.js';

    let historyList = [];
    let isLoading = false;
    let totalRealizedR = 0;
    let totalRealizedPnl = 0;
    let winCount = 0;
    let winRate = 0;

    export async function loadHistory() {
        isLoading = true;
        try {
            const res = await fetchPositionHistoryApi(100);
            if (res.success && Array.isArray(res.data)) {
                historyList = res.data.map(p => {
                    const entry = parseFloat(p.entry_price ?? p.entryPrice ?? 0);
                    const exit = parseFloat(p.exit_price ?? p.exitPrice ?? 0);
                    const r = p.realized_r != null ? parseFloat(p.realized_r) : 0;
                    const pnl = p.realized_pnl != null ? parseFloat(p.realized_pnl) : 0;
                    const pnlPercent = p.realized_pnl_percent_display || (p.realized_pnl_percent ? `${p.realized_pnl_percent.toFixed(2)}%` : '');

                    return {
                        id: p.id,
                        symbol: p.symbol || 'ETHUSDT',
                        direction: p.direction || 'LONG',
                        policyId: p.policy_id || '',
                        entry: entry,
                        exit: exit,
                        exitReason: p.exit_reason || 'MANUAL_CLOSE',
                        realizedR: r,
                        rResult: `${r >= 0 ? '+' : ''}${r.toFixed(2)} R`,
                        realizedPnl: pnl,
                        pnlPercent: pnlPercent,
                        entryTime: p.entry_time,
                        exitTime: p.exit_time
                    };
                });

                if (historyList.length > 0) {
                    totalRealizedR = historyList.reduce((acc, curr) => acc + curr.realizedR, 0);
                    totalRealizedPnl = historyList.reduce((acc, curr) => acc + curr.realizedPnl, 0);
                    winCount = historyList.filter(p => p.realizedR > 0).length;
                    winRate = (winCount / historyList.length) * 100;
                } else {
                    totalRealizedR = 0;
                    totalRealizedPnl = 0;
                    winCount = 0;
                    winRate = 0;
                }
            }
        } catch (err) {
            console.warn('Error loading history:', err);
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadHistory();
    });

    function formatExitReason(reason) {
        if (!reason) return 'Chốt đóng thủ công';
        const norm = reason.toUpperCase().trim();
        switch (norm) {
            case 'DYNAMIC_CLOSE_FILLED': return 'Khớp Chốt Lời Tự Động';
            case 'TAKE_PROFIT': return 'Chốt Lời Đạt Mục Tiêu';
            case 'STOP_LOSS': return 'Cắt Lỗ Bảo Vệ Vốn';
            case 'BREAKEVEN':
            case 'BREAK_EVEN': return 'Hòa Vốn';
            case 'TRAILED_STOP':
            case 'TRAILING_STOP': return 'Chốt Lời Dời Chặn Lãi';
            case 'EXIT_ON_OPPOSITE_SIGNAL': return 'Đóng Khi Có Tín Hiệu Ngược';
            case 'EXIT_ON_OPEN_SURFACE_STRUCTURE_LOSS': return 'Đóng Khi Gãy Cấu Trúc Sóng';
            case 'EXIT_ON_OPEN_SURFACE_MATURE_RUNNER_REVERSAL': return 'Chốt Lời Khi Đảo Chiều Đỉnh';
            case 'SC_SPRING_AMBIGUITY_RESOLVED_EXIT': return 'Đóng Lệnh Phòng Ngừa Rủi Ro';
            case 'SC_SPRING_FAILING_SUPPORT_EXIT': return 'Cắt Lỗ Khi Thủng Hỗ Trợ';
            case 'INVALIDATED':
            case 'INVALIDATION': return 'Mô Hình Bị Phủ Nhận';
            case 'TIME_EXPIRATION':
            case 'TIMEOUT': return 'Quá Thời Gian Nắm Giữ';
            case 'FORCE_CLOSE': return 'Đóng Lệnh Khẩn Cấp';
            case 'MANUAL_DASHBOARD_CLOSE':
            case 'MANUAL_CLOSE': return 'Đóng Thủ Công';
            default: return reason;
        }
    }
</script>

<div style="display: flex; flex-direction: column; gap: 1.25rem;">
    <!-- Header with Live Stats -->
    <div class="card history-header-card">
        <div class="history-header-left">
            <span style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">
                Lệnh Đã Đóng ({historyList.length})
            </span>
            {#if historyList.length > 0}
                <div class="history-badges-wrap">
                    <span class="badge {totalRealizedR >= 0 ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.825rem; padding: 0.25rem 0.6rem; font-weight: 700; font-family: var(--font-mono);">
                        Lãi Lũy Kế: {totalRealizedR >= 0 ? '+' : ''}{totalRealizedR.toFixed(2)} R ({totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)})
                    </span>
                    <span class="badge badge-neutral" style="font-size: 0.8rem; padding: 0.25rem 0.6rem; font-family: var(--font-mono);">
                        Tỷ Lệ Thắng: <strong>{winRate.toFixed(1)}%</strong> ({winCount}/{historyList.length})
                    </span>
                </div>
            {/if}
        </div>
        <button class="btn btn-outline" on:click={loadHistory} disabled={isLoading} style="padding: 0.4rem 0.85rem; font-size: 0.825rem;">
            {isLoading ? 'Đang tải...' : 'Tải lại lịch sử'}
        </button>
    </div>

    <!-- Table of Closed Positions -->
    <div class="card" style="padding: 1.25rem;">
        <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
            <table style="width: 100%; border-collapse: collapse; min-width: 700px;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-card); text-align: left;">
                        <th style="padding: 0.75rem; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Mã Coin</th>
                        <th style="padding: 0.75rem; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Hướng</th>
                        <th style="padding: 0.75rem; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Chiến Lược</th>
                        <th style="padding: 0.75rem; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Giá Vào</th>
                        <th style="padding: 0.75rem; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Giá Đóng</th>
                        <th style="padding: 0.75rem; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Lý Do Đóng</th>
                        <th style="padding: 0.75rem; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Hiệu Suất</th>
                        <th style="padding: 0.75rem; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Thời Gian Đóng</th>
                    </tr>
                </thead>
                <tbody>
                    {#each historyList as item (item.id)}
                        <tr style="border-bottom: 1px solid var(--border-subtle);">
                            <td style="padding: 0.85rem 0.75rem;">
                                <strong style="font-weight: 800; color: var(--text-primary);">{cleanSymbol(item.symbol)}</strong>
                            </td>
                            <td style="padding: 0.85rem 0.75rem;">
                                <span class="badge {item.direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}">{item.direction === 'SHORT' ? 'BÁN' : 'MUA'}</span>
                            </td>
                            <td style="padding: 0.85rem 0.75rem; font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">
                                {item.policyId || 'THỦ CÔNG'}
                            </td>
                            <td style="padding: 0.85rem 0.75rem; font-weight: 600; font-family: var(--font-mono);">
                                ${formatPrice(item.entry)}
                            </td>
                            <td style="padding: 0.85rem 0.75rem; font-weight: 700; font-family: var(--font-mono); color: {item.realizedR >= 0 ? 'var(--emerald)' : 'var(--rose)'};">
                                ${formatPrice(item.exit)}
                            </td>
                            <td style="padding: 0.85rem 0.75rem;">
                                <span class="badge badge-neutral" style="font-size: 0.75rem;">{formatExitReason(item.exitReason)}</span>
                            </td>
                            <td style="padding: 0.85rem 0.75rem; font-family: var(--font-mono);">
                                <span style="font-weight: 800; color: {item.realizedR >= 0 ? 'var(--emerald)' : 'var(--rose)'}; font-size: 0.95rem;">
                                    {item.rResult}
                                </span>
                                {#if item.pnlPercent}
                                    <span style="font-size: 0.725rem; color: var(--text-muted); display: block;">
                                        ({item.pnlPercent})
                                    </span>
                                {/if}
                            </td>
                            <td style="padding: 0.85rem 0.75rem; font-size: 0.8rem; color: var(--text-muted);">
                                {item.exitTime ? formatVNTime(item.exitTime) : 'N/A'}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        {#if historyList.length === 0}
            <div style="text-align: center; color: var(--text-muted); padding: 3.5rem 1rem;">
                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.3rem;">Chưa có lệnh nào được chốt</div>
                <div style="font-size: 0.85rem;">Các vị thế khi chốt sẽ tự động lưu lại nhật ký tại đây.</div>
            </div>
        {/if}
    </div>
</div>

<style>
    .history-header-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
    }
    .history-header-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .history-badges-wrap {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
    }

    @media (max-width: 640px) {
        .history-header-card {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
            padding: 1rem;
        }
        .history-header-card button {
            width: 100%;
        }
    }
</style>
