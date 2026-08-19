<script>
    export let historyList = [
        {
            symbol: 'BNBUSDT',
            direction: 'SHORT',
            entry: 678.13,
            exit: 604.21,
            rResult: '+9.29 R 🎯',
            time: '2026-06-08 16:00'
        },
        {
            symbol: 'UNIUSDT',
            direction: 'SHORT',
            entry: 9.871,
            exit: 7.301,
            rResult: '+38.07 R 🚀',
            time: '2026-06-06 20:00'
        },
        {
            symbol: 'ZECUSDT',
            direction: 'LONG',
            entry: 338.03,
            exit: 414.65,
            rResult: '+2.66 R 🎯',
            time: '2026-06-12 20:00'
        }
    ];
</script>

<div class="card">
    <div class="card-header">
        <div class="card-title">Lịch Sử Lệnh</div>
        <span class="badge badge-emerald">Lãi chốt lũy kế: +183.48 R</span>
    </div>

    <div class="table-responsive">
        <table>
            <thead>
                <tr>
                    <th>Mã Coin</th>
                    <th>Hướng</th>
                    <th>Giá Entry</th>
                    <th>Giá Exit Chốt</th>
                    <th>Kết Quả R</th>
                    <th>Thời Gian Đóng</th>
                </tr>
            </thead>
            <tbody>
                {#each historyList as item}
                    <tr>
                        <td><strong style="font-weight: 700; color: var(--text-primary);">{item.symbol}</strong></td>
                        <td>
                            <span class="badge {item.direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}">{item.direction}</span>
                        </td>
                        <td>${item.entry}</td>
                        <td class="text-emerald" style="font-weight: 600;">${item.exit}</td>
                        <td class="text-emerald" style="font-weight: 700;">{item.rResult}</td>
                        <td>{item.time}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>
