<script>
    import { onMount, onDestroy } from 'svelte';

    let timeRemainingStr = '';
    let nextCandleTimeStr = '';
    let currentVnTimeStr = '';
    let intervalId = null;

    function updateCountdown() {
        const now = new Date();

        // Current Vietnam Time formatted
        currentVnTimeStr = now.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // 4H Candle boundary hours (UTC): 0, 4, 8, 12, 16, 20
        // In Vietnam Time (UTC+7): 03:00, 07:00, 11:00, 15:00, 19:00, 23:00
        const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
        const currentMs = now.getTime();
        const nextCandleMs = Math.ceil(currentMs / FOUR_HOURS_MS) * FOUR_HOURS_MS;
        const diffMs = Math.max(0, nextCandleMs - currentMs);

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        timeRemainingStr = `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

        const nextDate = new Date(nextCandleMs);
        nextCandleTimeStr = nextDate.toLocaleTimeString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    onMount(() => {
        updateCountdown();
        intervalId = setInterval(updateCountdown, 1000);
    });

    onDestroy(() => {
        if (intervalId) clearInterval(intervalId);
    });
</script>

<div class="countdown-badge" title="Đồng hồ đếm ngược nến 4H sàn Binance theo Giờ Việt Nam">
    <span class="pulse-icon">⏳</span>
    <span class="countdown-text">
        Chốt nến 4H: <strong>{nextCandleTimeStr}</strong> (còn <strong>{timeRemainingStr}</strong>)
    </span>
</div>

<style>
    .countdown-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        padding: 0.35rem 0.8rem;
        border-radius: 999px;
        font-size: 0.775rem;
        color: var(--text-secondary);
        white-space: nowrap;
    }
    .countdown-text strong {
        color: var(--text-primary);
        font-family: monospace;
    }
    .pulse-icon {
        animation: rotateHourglass 4s infinite linear;
    }
    @keyframes rotateHourglass {
        0%, 90% { transform: rotate(0deg); }
        95%, 100% { transform: rotate(180deg); }
    }
</style>
