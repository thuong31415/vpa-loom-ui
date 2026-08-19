<script>
    import { onMount } from 'svelte';
    import { fetchPositionHistoryApi } from '../api.js';

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

                // Calculate cumulative stats
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
        switch (reason) {
            case 'DYNAMIC_CLOSE_FILLED': return '🎯 Dynamic Close';
            case 'TAKE_PROFIT': return '🟢 Take Profit';
            case 'STOP_LOSS': return '🔴 Stop Loss';
            case 'EXIT_ON_OPPOSITE_SIGNAL': return '🔄 Đảo Chiều';
            case 'MANUAL_DASHBOARD_CLOSE': return '👤 Chốt Trên UI';
            default: return reason;
        }
    }
</script>

<div class="card" style="box-shadow: none; border: none; background: transparent; padding: 0;">
    <!-- Header with Live Stats -->
    <div class="card-header" style="background: #FFFFFF; padding: 1.25rem 1.5rem; border-radius: 16px; border: 1px solid var(--border-card); margin-bottom: 1.25rem;">
        <div>
            <div class="card-title">Lịch Sử Lệnh Đã Đóng</div>
            <div class="stat-sub" style="margin-top: 0.2rem;">
                Dữ liệu chốt lệnh thực tế từ PostgreSQL Database
            </div>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            {#if historyList.length > 0}
                <span class="badge {totalRealizedR >= 0 ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.9rem; padding: 0.4rem 0.8rem; font-weight: 700;">
                    Lãi Lũy Kế: {totalRealizedR >= 0 ? '+' : ''}{totalRealizedR.toFixed(2)} R ({totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)})
                </span>
                <span class="badge badge-neutral" style="font-size: 0.85rem; padding: 0.4rem 0.8rem;">
                    Win Rate: <strong>{winRate.toFixed(1)}%</strong> ({winCount}/{historyList.length})
                </span>
            {/if}
            <button class="btn btn-outline" on:click={loadHistory} disabled={isLoading}>
                {isLoading ? '⌛ Đang tải...' : '🔄 Tải lại lịch sử'}
            </button>
        </div>
    </div>

    <!-- Table of Closed Positions -->
    <div class="card" style="background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 14px; padding: 1rem 1.25rem;">
        <div class="table-responsive">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-card); text-align: left;">
                        <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Mã Coin</th>
                        <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Hướng</th>
                        <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Setup Policy</th>
                        <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Giá Entry</th>
                        <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Giá Exit</th>
                        <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Lý Do Thoát</th>
                        <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Kết Quả R</th>
                        <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Thời Gian Đóng</th>
                    </tr>
                </thead>
                <tbody>
                    {#each historyList as item (item.id)}
                        <tr style="border-bottom: 1px solid var(--border-card);">
                            <td style="padding: 0.85rem 0.75rem;">
                                <strong style="font-weight: 800; color: var(--text-primary);">{item.symbol}</strong>
                            </td>
                            <td style="padding: 0.85rem 0.75rem;">
                                <span class="badge {item.direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}">{item.direction}</span>
                            </td>
                            <td style="padding: 0.85rem 0.75rem; font-size: 0.8rem; color: var(--text-muted);">
                                {item.policyId || 'MANUAL'}
                            </td>
                            <td style="padding: 0.85rem 0.75rem; font-weight: 600;">
                                ${item.entry.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </td>
                            <td style="padding: 0.85rem 0.75rem; font-weight: 700; color: {item.realizedR >= 0 ? 'var(--emerald)' : 'var(--rose)'};">
                                ${item.exit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </td>
                            <td style="padding: 0.85rem 0.75rem;">
                                <span class="badge badge-neutral" style="font-size: 0.75rem;">{formatExitReason(item.exitReason)}</span>
                            </td>
                            <td style="padding: 0.85rem 0.75rem;">
                                <span style="font-weight: 800; color: {item.realizedR >= 0 ? 'var(--emerald)' : 'var(--rose)'}; font-size: 0.95rem;">
                                    {item.rResult}
                                </span>
                                {#if item.pnlPercent}
                                    <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">
                                        ({item.pnlPercent})
                                    </span>
                                {/if}
                            </td>
                            <td style="padding: 0.85rem 0.75rem; font-size: 0.8rem; color: var(--text-muted);">
                                {item.exitTime ? new Date(item.exitTime).toLocaleString('vi-VN') : '—'}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        {#if historyList.length === 0}
            <div style="text-align: center; color: var(--text-muted); padding: 3.5rem 1rem;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📜</div>
                <div style="font-weight: 700; color: var(--text-primary); font-size: 1.05rem;">Chưa có lệnh nào được chốt đóng</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem; max-width: 450px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                    Toàn bộ các vị thế khi được chốt đóng (thủ công hoặc tự động bởi tín hiệu của Engine) sẽ được lưu trữ vĩnh viễn và thống kê chi tiết tại đây.
                </div>
            </div>
        {/if}
    </div>
</div>
