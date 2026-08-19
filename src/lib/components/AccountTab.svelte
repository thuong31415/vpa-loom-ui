<script>
    import { onMount } from 'svelte';
    import { fetchAccountSummaryApi, fetchCapitalTransactionsApi } from '../api.js';

    export let onOpenDepositModal = () => {};

    let initialCapital = 10000.00;
    let currentBalance = 12450.00;
    let isLoading = false;

    let capitalLogs = [
        {
            id: '#CAP-001',
            type: 'NẠP VỐN',
            typeClass: 'badge-emerald',
            amount: '+$10,000.00',
            amountClass: 'text-emerald',
            time: '2026-05-01 10:00',
            note: 'Vốn ban đầu'
        },
        {
            id: '#CAP-002',
            type: 'RÚT VỐN',
            typeClass: 'badge-rose',
            amount: '-$1,000.00',
            amountClass: 'text-rose',
            time: '2026-06-15 14:30',
            note: 'Rút chốt lời'
        }
    ];

    export async function loadAccountData() {
        isLoading = true;
        const [sumRes, txRes] = await Promise.all([
            fetchAccountSummaryApi(),
            fetchCapitalTransactionsApi()
        ]);

        if (sumRes.success && sumRes.data) {
            initialCapital = parseFloat(sumRes.data.initialCapital) || 10000.00;
            currentBalance = parseFloat(sumRes.data.currentBalance) || 12450.00;
        }

        if (txRes.success && txRes.data && txRes.data.length > 0) {
            capitalLogs = txRes.data.map(t => {
                const typeUpper = (t.type || '').toUpperCase();
                const isDeposit = typeUpper === 'INITIAL_CAPITAL' || typeUpper === 'DEPOSIT';
                const amt = parseFloat(t.amount) || 0;
                return {
                    id: `#CAP-00${t.id}`,
                    type: typeUpper === 'INITIAL_CAPITAL' ? 'VỐN BAN ĐẦU' : (isDeposit ? 'NẠP VỐN' : 'RÚT VỐN'),
                    typeClass: isDeposit ? 'badge-emerald' : 'badge-rose',
                    amount: isDeposit ? `+$${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                    amountClass: isDeposit ? 'text-emerald' : 'text-rose',
                    time: t.createdAt ? t.createdAt.replace('T', ' ').substring(0, 16) : 'Vừa xong',
                    note: t.note || ''
                };
            });
        }
        isLoading = false;
    }

    onMount(() => {
        loadAccountData();
    });

    export function addTransaction(transaction) {
        capitalLogs = [transaction, ...capitalLogs];
        currentBalance += transaction.rawAmount;
    }

    $: balanceDiff = currentBalance - initialCapital;
    $: balanceDiffPercent = initialCapital > 0 ? (balanceDiff / initialCapital * 100).toFixed(1) : '0.0';
</script>

<div class="bento-grid">
    <div class="card" style="grid-column: span 4;">
        <div class="card-header">
            <span class="card-title">Vốn Ban Đầu</span>
        </div>
        <div class="stat-val">${initialCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="stat-sub text-muted">Vốn cố định lưu PostgreSQL DB</div>
    </div>

    <div class="card" style="grid-column: span 4;">
        <div class="card-header">
            <span class="card-title">Số Dư Hiện Tại</span>
        </div>
        <div class="stat-val {currentBalance >= initialCapital ? 'text-emerald' : 'text-rose'}">
            ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div class="stat-sub {balanceDiff >= 0 ? 'text-emerald' : 'text-rose'}">
            {balanceDiff >= 0 ? '+' : ''}${balanceDiff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({balanceDiff >= 0 ? '+' : ''}{balanceDiffPercent}%)
        </div>
    </div>

    <div class="card" style="grid-column: span 4;">
        <div class="card-header">
            <span class="card-title">Lợi Nhuận R</span>
            <span class="badge badge-emerald">Winrate 75%</span>
        </div>
        <div class="stat-val text-emerald">+183.48 R</div>
        <div class="stat-sub">12 thắng · 4 thua</div>
    </div>

    <div class="card" style="grid-column: span 12;">
        <div class="card-header">
            <div>
                <div class="card-title">Sổ Nạp Rút Vốn</div>
                <div class="stat-sub" style="margin-top: 0.2rem;">
                    Tự động đồng bộ lịch sử giao dịch dòng tiền từ DB
                </div>
            </div>
            <div style="display: flex; gap: 0.75rem;">
                <button class="btn btn-outline" on:click={loadAccountData} disabled={isLoading}>
                    {isLoading ? '⌛ Đang tải...' : '🔄 Tải sổ vốn DB'}
                </button>
                <button class="btn btn-outline" on:click={onOpenDepositModal}>+ Ghi chép nạp/rút vốn</button>
            </div>
        </div>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Mã GD</th>
                        <th>Loại Giao Dịch</th>
                        <th>Số Tiền</th>
                        <th>Thời Gian</th>
                        <th>Ghi Chú</th>
                    </tr>
                </thead>
                <tbody>
                    {#each capitalLogs as log}
                        <tr>
                            <td>{log.id}</td>
                            <td><span class="badge {log.typeClass}">{log.type}</span></td>
                            <td class="{log.amountClass}" style="font-weight: 600;">{log.amount}</td>
                            <td>{log.time}</td>
                            <td>{log.note}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</div>
