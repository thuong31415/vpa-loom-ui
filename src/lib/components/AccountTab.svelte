<script>
    import { onMount } from 'svelte';
    import { fetchAccountSummaryApi, fetchCapitalTransactionsApi, fetchPositionHistoryApi, formatVNTime } from '../api.js';

    export let onOpenDepositModal = () => {};

    let summary = {
        totalDeposited: 0,
        totalWithdrawn: 0,
        netCapital: 0,
        inPositions: 0,
        availableBalance: 0,
        totalRealizedPnl: 0,
        totalEquity: 0,
        totalClosedTrades: 0,
        winCount: 0,
        lossCount: 0,
        winRate: 0
    };

    let capitalLogs = [];
    let isLoading = false;
    let selectedFilter = 'ALL'; // 'ALL', 'CAPITAL', 'TRADE'

    $: roiPercent = summary.netCapital > 0 
        ? ((summary.totalEquity - summary.netCapital) / summary.netCapital) * 100 
        : 0;

    $: filteredLogs = capitalLogs.filter(log => {
        if (selectedFilter === 'ALL') return true;
        return log.category === selectedFilter;
    });

    export async function loadAccountData() {
        isLoading = true;
        try {
            // 1. Fetch live summary from Backend PostgreSQL
            const summaryRes = await fetchAccountSummaryApi();
            if (summaryRes.success && summaryRes.data) {
                const d = summaryRes.data;
                summary = {
                    totalDeposited: parseFloat(d.total_deposited ?? d.totalDeposited) || 0,
                    totalWithdrawn: parseFloat(d.total_withdrawn ?? d.totalWithdrawn) || 0,
                    netCapital: parseFloat(d.net_capital ?? d.netCapital) || 0,
                    inPositions: parseFloat(d.in_positions ?? d.inPositions) || 0,
                    availableBalance: parseFloat(d.available_balance ?? d.availableBalance) || 0,
                    totalRealizedPnl: parseFloat(d.total_realized_pnl ?? d.totalRealizedPnl) || 0,
                    totalEquity: parseFloat(d.total_equity ?? d.totalEquity) || 0,
                    totalClosedTrades: parseInt(d.total_closed_trades ?? d.totalClosedTrades) || 0,
                    winCount: parseInt(d.win_count ?? d.winCount) || 0,
                    lossCount: parseInt(d.loss_count ?? d.lossCount) || 0,
                    winRate: parseFloat(d.win_rate ?? d.winRate) || 0
                };
            }

            // 2. Fetch live transactions ledger from Backend PostgreSQL
            const txRes = await fetchCapitalTransactionsApi(100);
            if (txRes.success && Array.isArray(txRes.data) && txRes.data.length > 0) {
                capitalLogs = txRes.data.map(t => formatTransaction(t));
            } else {
                loadFallbackLocalData();
            }
        } catch (err) {
            console.warn('Error loading account data from backend:', err);
            loadFallbackLocalData();
        } finally {
            isLoading = false;
        }
    }

    function formatTransaction(t) {
        const type = (t.type || t.transaction_type || t.transactionType || '').toUpperCase();
        let typeLabel = type;
        let typeBadge = 'badge-emerald';
        let amountClass = 'text-emerald';
        let amountPrefix = '+';
        let category = 'CAPITAL';

        if (type === 'DEPOSIT') {
            typeLabel = 'NẠP VỐN';
            typeBadge = 'badge-emerald';
            amountClass = 'text-emerald';
            amountPrefix = '+';
            category = 'CAPITAL';
        } else if (type === 'WITHDRAW' || type === 'WITHDRAWAL') {
            typeLabel = 'RÚT VỐN';
            typeBadge = 'badge-rose';
            amountClass = 'text-rose';
            amountPrefix = '';
            category = 'CAPITAL';
        } else if (type === 'POSITION_BUY') {
            typeLabel = 'VÀO LỆNH (MUA)';
            typeBadge = 'badge-neutral';
            amountClass = 'text-rose';
            amountPrefix = '';
            category = 'TRADE';
        } else if (type === 'POSITION_CLOSE') {
            typeLabel = 'CHỐT LỆNH';
            typeBadge = (parseFloat(t.amount) || 0) >= 0 ? 'badge-emerald' : 'badge-rose';
            amountClass = (parseFloat(t.amount) || 0) >= 0 ? 'text-emerald' : 'text-rose';
            amountPrefix = (parseFloat(t.amount) || 0) >= 0 ? '+' : '';
            category = 'TRADE';
        }

        const amt = parseFloat(t.amount) || 0;
        const bal = parseFloat(t.balance_after ?? t.balanceAfter) || 0;
        const rawTime = t.created_at || t.createdAt || '';

        return {
            id: t.id ? `#CAP-${String(t.id).padStart(3, '0')}` : '#CAP-000',
            type: typeLabel,
            typeClass: typeBadge,
            amount: `${amountPrefix}$${Math.abs(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            amountClass: amountClass,
            balanceAfter: `$${bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            time: formatVNTime(rawTime),
            note: t.note || '',
            category
        };
    }

    function loadFallbackLocalData() {
        try {
            const savedTx = localStorage.getItem('vpa_capital_transactions_v2');
            if (savedTx) {
                capitalLogs = JSON.parse(savedTx);
            }
        } catch (e) {
            console.warn('Fallback error:', e);
        }
    }

    onMount(() => {
        loadAccountData();
    });

    export function addTransaction(transaction) {
        loadAccountData();
    }
</script>

<div class="bento-grid">
    <!-- Card 1: Tổng Vốn Đã Nạp -->
    <div class="card" style="grid-column: span 3; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 16px; padding: 1.25rem 1.5rem;">
        <div class="card-header" style="margin-bottom: 0.5rem;">
            <span class="card-title" style="font-size: 0.9rem; color: var(--text-muted);">Tổng Vốn Đã Nạp</span>
        </div>
        <div class="stat-val" style="font-size: 1.65rem; font-weight: 800; color: var(--text-primary);">
            ${summary.totalDeposited.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div class="stat-sub" style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--text-muted);">
            Vốn ròng: ${summary.netCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
    </div>

    <!-- Card 2: Số Dư Khả Dụng (Tiền Mặt) -->
    <div class="card" style="grid-column: span 3; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 16px; padding: 1.25rem 1.5rem;">
        <div class="card-header" style="margin-bottom: 0.5rem;">
            <span class="card-title" style="font-size: 0.9rem; color: var(--text-muted);">Số Dư Khả Dụng (USDT)</span>
            <span class="badge badge-emerald" style="font-size: 0.7rem;">Sẵn sàng mua</span>
        </div>
        <div class="stat-val text-emerald" style="font-size: 1.65rem; font-weight: 800;">
            ${summary.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div class="stat-sub" style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--text-muted);">
            Tiền mặt tự do trong ví
        </div>
    </div>

    <!-- Card 3: Đang Giam Trong Vị Thế -->
    <div class="card" style="grid-column: span 3; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 16px; padding: 1.25rem 1.5rem;">
        <div class="card-header" style="margin-bottom: 0.5rem;">
            <span class="card-title" style="font-size: 0.9rem; color: var(--text-muted);">Đang Vào Lệnh (Margin)</span>
        </div>
        <div class="stat-val" style="font-size: 1.65rem; font-weight: 800; color: var(--text-primary);">
            ${summary.inPositions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div class="stat-sub" style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--text-muted);">
            Ký quỹ các lệnh đang mở
        </div>
    </div>

    <!-- Card 4: Tổng Tài Sản Thực Tế (Equity) & Lợi Nhuận -->
    <div class="card" style="grid-column: span 3; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 16px; padding: 1.25rem 1.5rem;">
        <div class="card-header" style="margin-bottom: 0.5rem;">
            <span class="card-title" style="font-size: 0.9rem; color: var(--text-muted);">Tổng Tài Sản (Equity)</span>
            <span class="badge {roiPercent >= 0 ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.75rem; font-weight: 700;">
                ROI: {roiPercent >= 0 ? '+' : ''}{roiPercent.toFixed(1)}%
            </span>
        </div>
        <div class="stat-val {summary.totalEquity >= summary.netCapital ? 'text-emerald' : 'text-rose'}" style="font-size: 1.65rem; font-weight: 800;">
            ${summary.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div class="stat-sub" style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--text-muted);">
            {summary.winCount} thắng · {summary.lossCount} thua (Winrate {summary.winRate.toFixed(1)}%)
        </div>
    </div>

    <!-- Table: Sổ Cái Biến Động Số Dư (Ledger) -->
    <div class="card" style="grid-column: span 12; background: #FFFFFF; border: 1px solid var(--border-card); border-radius: 16px; padding: 1.25rem 1.5rem;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
            <div>
                <div class="card-title" style="margin: 0; font-size: 1.1rem; font-weight: 800;">Sổ Cái Tài Chính & Biến Động Nguồn Vốn</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">Hạch toán tự động Nạp, Rút, Mua coin và Chốt lời/Cắt lỗ theo thời gian thực</div>
            </div>
            <div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-outline" on:click={loadAccountData} disabled={isLoading} style="padding: 0.45rem 0.9rem; font-size: 0.85rem;">
                    {isLoading ? '⌛ Đang tải...' : '🔄 Làm mới'}
                </button>
                <button class="btn" on:click={onOpenDepositModal} style="padding: 0.45rem 1rem; font-size: 0.85rem;">+ Ghi chép nạp/rút vốn</button>
            </div>
        </div>

        <!-- Quick Filters for Ledger -->
        <div class="filter-pills" style="margin-bottom: 1rem;">
            <button 
                class="pill-btn {selectedFilter === 'ALL' ? 'active' : ''}" 
                on:click={() => selectedFilter = 'ALL'}
            >
                📋 Tất Cả ({capitalLogs.length})
            </button>
            <button 
                class="pill-btn {selectedFilter === 'CAPITAL' ? 'active' : ''}" 
                on:click={() => selectedFilter = 'CAPITAL'}
            >
                💵 Nạp & Rút Vốn
            </button>
            <button 
                class="pill-btn {selectedFilter === 'TRADE' ? 'active' : ''}" 
                on:click={() => selectedFilter = 'TRADE'}
            >
                ⚡ Vào Lệnh & Chốt Lời
            </button>
        </div>

        {#if filteredLogs.length > 0}
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <table style="width: 100%; border-collapse: collapse; min-width: 650px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-card); text-align: left;">
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Mã GD</th>
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Loại Giao Dịch</th>
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Số Tiền</th>
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Số Dư Khả Dụng</th>
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Thời Gian</th>
                            <th style="padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Chi Tiết / Ghi Chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each filteredLogs as log (log.id)}
                            <tr style="border-bottom: 1px solid var(--border-card);">
                                <td style="padding: 0.85rem 0.75rem; font-family: monospace; font-size: 0.85rem; color: var(--text-muted);">{log.id}</td>
                                <td style="padding: 0.85rem 0.75rem;"><span class="badge {log.typeClass}">{log.type}</span></td>
                                <td style="padding: 0.85rem 0.75rem; font-weight: 700;" class="{log.amountClass}">{log.amount}</td>
                                <td style="padding: 0.85rem 0.75rem; font-weight: 700; color: var(--text-primary);">{log.balanceAfter || '-'}</td>
                                <td style="padding: 0.85rem 0.75rem; font-size: 0.8rem; color: var(--text-muted);">{log.time}</td>
                                <td style="padding: 0.85rem 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">{log.note}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {:else}
            <div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">💳</div>
                <div style="font-weight: 600; color: var(--text-primary);">Chưa có biến động vốn nào phù hợp bộ lọc</div>
                <div style="font-size: 0.85rem; margin-top: 0.25rem;">
                    Bấm nút <strong>"+ Ghi chép nạp/rút vốn"</strong> hoặc mở lệnh giao dịch để bắt đầu hạch toán.
                </div>
            </div>
        {/if}
    </div>
</div>
