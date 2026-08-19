<script>
    import { onMount } from 'svelte';
    import { fetchPositionHistoryApi } from '../api.js';

    export let onOpenDepositModal = () => {};

    let totalRealizedPnl = 0;
    let totalRealizedR = 0;
    let winCount = 0;
    let lossCount = 0;
    let winRate = 0;
    let totalClosedTrades = 0;
    let isLoading = false;

    const STORAGE_KEY_TX = 'vpa_capital_transactions_v2';

    let capitalLogs = [];

    function loadLocalCapitalData() {
        try {
            localStorage.removeItem('vpa_capital_transactions');
            localStorage.removeItem('vpa_initial_capital');

            const savedTx = localStorage.getItem(STORAGE_KEY_TX);
            if (savedTx) {
                capitalLogs = JSON.parse(savedTx).filter(t => t.id !== '#CAP-001' && !t.note?.includes('khởi tạo ban đầu'));
            } else {
                capitalLogs = [];
            }
        } catch (e) {
            console.warn('Could not read capital from localStorage:', e);
            capitalLogs = [];
        }
    }

    export async function loadAccountData() {
        isLoading = true;
        loadLocalCapitalData();

        try {
            // Fetch real closed trade profits from PostgreSQL Database
            const res = await fetchPositionHistoryApi(100);
            if (res.success && Array.isArray(res.data)) {
                const closedTrades = res.data;
                totalClosedTrades = closedTrades.length;

                if (closedTrades.length > 0) {
                    totalRealizedPnl = closedTrades.reduce((acc, curr) => acc + (parseFloat(curr.realized_pnl) || 0), 0);
                    totalRealizedR = closedTrades.reduce((acc, curr) => acc + (parseFloat(curr.realized_r) || 0), 0);
                    winCount = closedTrades.filter(t => (parseFloat(t.realized_r) || 0) > 0).length;
                    lossCount = totalClosedTrades - winCount;
                    winRate = (winCount / totalClosedTrades) * 100;
                } else {
                    totalRealizedPnl = 0;
                    totalRealizedR = 0;
                    winCount = 0;
                    lossCount = 0;
                    winRate = 0;
                }
            }
        } catch (err) {
            console.warn('Error loading closed positions for account summary:', err);
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadAccountData();
    });

    export function addTransaction(transaction) {
        capitalLogs = [transaction, ...capitalLogs];
        try {
            localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(capitalLogs));
        } catch (e) {
            console.warn('Could not save transaction to localStorage:', e);
        }
    }

    // Compute Net Capital from deposits & withdrawals
    $: netDeposits = capitalLogs.reduce((acc, curr) => acc + (curr.rawAmount || 0), 0);
    $: currentBalance = netDeposits + totalRealizedPnl;
    $: balanceDiff = currentBalance - netDeposits;
    $: balanceDiffPercent = netDeposits > 0 ? (balanceDiff / netDeposits * 100).toFixed(2) : '0.00';
</script>

<div class="bento-grid">
    <!-- Card 1: Tổng Vốn Đã Nạp -->
    <div class="card" style="grid-column: span 4; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 16px; padding: 1.25rem 1.5rem;">
        <div class="card-header" style="margin-bottom: 0.5rem;">
            <span class="card-title" style="font-size: 0.95rem;">Tổng Vốn Đã Nạp</span>
        </div>
        <div class="stat-val" style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary);">
            ${netDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
    </div>

    <!-- Card 2: Số Dư Hiện Tại -->
    <div class="card" style="grid-column: span 4; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 16px; padding: 1.25rem 1.5rem;">
        <div class="card-header" style="margin-bottom: 0.5rem;">
            <span class="card-title" style="font-size: 0.95rem;">Số Dư Hiện Tại</span>
            {#if totalRealizedPnl !== 0}
                <span class="badge {totalRealizedPnl >= 0 ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.75rem;">
                    {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(2)}
                </span>
            {/if}
        </div>
        <div class="stat-val {currentBalance >= netDeposits ? 'text-emerald' : 'text-rose'}" style="font-size: 1.8rem; font-weight: 800;">
            ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {#if balanceDiff !== 0}
            <div class="stat-sub {balanceDiff >= 0 ? 'text-emerald' : 'text-rose'}" style="margin-top: 0.25rem; font-size: 0.8rem; font-weight: 600;">
                {balanceDiff >= 0 ? '+' : ''}${balanceDiff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({balanceDiff >= 0 ? '+' : ''}{balanceDiffPercent}%)
            </div>
        {/if}
    </div>

    <!-- Card 3: Hiệu Suất R & Winrate Thật Từ DB -->
    <div class="card" style="grid-column: span 4; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 16px; padding: 1.25rem 1.5rem;">
        <div class="card-header" style="margin-bottom: 0.5rem;">
            <span class="card-title" style="font-size: 0.95rem;">Lợi Nhuận Lũy Kế</span>
            {#if totalClosedTrades > 0}
                <span class="badge {winRate >= 50 ? 'badge-emerald' : 'badge-neutral'}" style="font-size: 0.75rem;">
                    Winrate {winRate.toFixed(1)}%
                </span>
            {/if}
        </div>
        <div class="stat-val {totalRealizedR >= 0 ? 'text-emerald' : 'text-rose'}" style="font-size: 1.8rem; font-weight: 800;">
            {totalRealizedR >= 0 ? '+' : ''}{totalRealizedR.toFixed(2)} R
        </div>
        <div class="stat-sub" style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--text-muted);">
            {winCount} thắng · {lossCount} thua
        </div>
    </div>

    <!-- Table: Sổ Nạp Rút Vốn -->
    <div class="card" style="grid-column: span 12; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 16px; padding: 1.25rem 1.5rem;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
            <div class="card-title" style="margin: 0;">Sổ Nạp Rút Vốn</div>
            <div style="display: flex; gap: 0.65rem;">
                <button class="btn btn-outline" on:click={loadAccountData} disabled={isLoading} style="padding: 0.45rem 0.9rem; font-size: 0.85rem;">
                    {isLoading ? '⌛ Đang tải...' : '🔄 Làm mới'}
                </button>
                <button class="btn" on:click={onOpenDepositModal} style="padding: 0.45rem 1rem; font-size: 0.85rem;">+ Ghi chép nạp/rút vốn</button>
            </div>
        </div>

        {#if capitalLogs.length > 0}
            <div class="table-responsive">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-card); text-align: left;">
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Loại Giao Dịch</th>
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Số Tiền</th>
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Thời Gian</th>
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Ghi Chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each capitalLogs as log (log.id)}
                            <tr style="border-bottom: 1px solid var(--border-card);">
                                <td style="padding: 0.85rem 0.75rem;"><span class="badge {log.typeClass}">{log.type}</span></td>
                                <td style="padding: 0.85rem 0.75rem; font-weight: 700;" class="{log.amountClass}">{log.amount}</td>
                                <td style="padding: 0.85rem 0.75rem; font-size: 0.8rem; color: var(--text-muted);">{log.time}</td>
                                <td style="padding: 0.85rem 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">{log.note}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {:else}
            <div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                <div style="font-weight: 700; color: var(--text-primary); font-size: 1.05rem;">Chưa có giao dịch nạp / rút vốn nào</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem; max-width: 450px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                    Bấm nút <strong>"+ Ghi chép nạp/rút vốn"</strong> ở trên để bắt đầu ghi nhận số tiền nạp ban đầu cho quỹ giao dịch của bác.
                </div>
            </div>
        {/if}
    </div>
</div>
