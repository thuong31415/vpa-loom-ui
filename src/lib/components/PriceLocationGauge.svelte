<script>
    import { formatPrice } from '../api.js';

    export let price = 0;
    export let support = null;
    export let resistance = null;

    $: gauge = computeGauge(price, support, resistance);

    function computeGauge(currentPrice, sup, res) {
        const p = parseFloat(currentPrice);
        if (isNaN(p) || p <= 0) return null;

        const supUpper = sup && sup.upper ? parseFloat(sup.upper) : null;
        const supLower = sup && sup.lower ? parseFloat(sup.lower) : null;
        const resLower = res && res.lower ? parseFloat(res.lower) : null;
        const resUpper = res && res.upper ? parseFloat(res.upper) : null;

        if (supUpper === null || resLower === null || resLower <= supUpper) {
            return null;
        }

        const totalRange = resLower - supUpper;
        const rawPercent = ((p - supUpper) / totalRange) * 100;
        const clampedPercent = Math.max(0, Math.min(100, rawPercent));

        let zoneLabel = '';
        let zoneClass = '';
        let zoneTip = '';

        if (p <= supUpper) {
            zoneLabel = '🟢 Sát Vùng Hỗ Trợ Đáy';
            zoneClass = 'text-emerald';
            zoneTip = 'Đang ở hỗ trợ';
        } else if (p >= resLower) {
            zoneLabel = '⚡ Sát Vùng Kháng Cự Đỉnh';
            zoneClass = 'text-rose';
            zoneTip = 'Đang ở kháng cự';
        } else if (clampedPercent <= 30) {
            zoneLabel = '↗️ Vùng Thấp Nghiêng Hỗ Trợ';
            zoneClass = 'text-emerald';
            zoneTip = 'Nghiêng hỗ trợ';
        } else if (clampedPercent >= 70) {
            zoneLabel = '⚠️ Vùng Cao Cận Kháng Cự';
            zoneClass = 'text-rose';
            zoneTip = 'Nghiêng kháng cự';
        } else {
            zoneLabel = '↔️ Vùng Lưng Chừng Giữa 2 Cản';
            zoneClass = 'text-amber';
            zoneTip = 'Lưng chừng biên';
        }

        return {
            percent: clampedPercent,
            rawPercent,
            supUpper,
            resLower,
            zoneLabel,
            zoneClass,
            zoneTip
        };
    }
</script>

{#if gauge}
    <div class="gauge-container">
        <div class="gauge-header" style="justify-content: flex-end; margin-bottom: 1.1rem;">
            <span class="{gauge.zoneClass}" style="font-size: 0.8rem; font-weight: 700;">
                {gauge.zoneLabel}
            </span>
        </div>

        <!-- Gauge Visual Track -->
        <div class="track-wrapper">
            <div class="gauge-track">
                <!-- Zone markers -->
                <div class="zone-segment zone-sup" style="width: 25%;" title="Vùng Hỗ Trợ"></div>
                <div class="zone-segment zone-mid" style="width: 50%;" title="Vùng Lưng Chừng"></div>
                <div class="zone-segment zone-res" style="width: 25%;" title="Vùng Kháng Cự"></div>

                <!-- Current Price Needle / Dot -->
                <div 
                    class="price-pointer" 
                    style="left: {gauge.percent}%;"
                >
                    <div class="pointer-bubble">
                        ${formatPrice(price)}
                    </div>
                    <div class="pointer-dot"></div>
                </div>
            </div>
        </div>

        <!-- Labels at edges -->
        <div class="gauge-labels">
            <div style="text-align: left; white-space: nowrap;">
                <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">HỖ TRỢ ĐÁY</div>
                <div style="font-size: 0.85rem; font-weight: 700; font-family: monospace; color: var(--emerald);">
                    ${formatPrice(gauge.supUpper)}
                </div>
            </div>
            <div style="text-align: center; font-size: 0.75rem; color: var(--text-muted); padding: 0 0.5rem;">
                {gauge.zoneTip}
            </div>
            <div style="text-align: right; white-space: nowrap;">
                <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">KHÁNG CỰ ĐỈNH</div>
                <div style="font-size: 0.85rem; font-weight: 700; font-family: monospace; color: var(--rose);">
                    ${formatPrice(gauge.resLower)}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .gauge-container {
        background: #FFFFFF;
        border: 1px solid var(--border-card);
        border-radius: 12px;
        padding: 0.95rem 1.15rem;
        margin: 0.75rem 0;
    }
    .gauge-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
    }
    .track-wrapper {
        position: relative;
        padding: 0.5rem 0.75rem 0.25rem 0.75rem;
    }
    .gauge-track {
        height: 10px;
        background: var(--bg-subtle);
        border-radius: 999px;
        position: relative;
        display: flex;
        overflow: visible;
        border: 1px solid var(--border-card);
    }
    .zone-segment {
        height: 100%;
    }
    .zone-sup {
        background: rgba(22, 101, 52, 0.22);
        border-top-left-radius: 999px;
        border-bottom-left-radius: 999px;
    }
    .zone-mid {
        background: rgba(154, 52, 18, 0.1);
    }
    .zone-res {
        background: rgba(153, 27, 27, 0.22);
        border-top-right-radius: 999px;
        border-bottom-right-radius: 999px;
    }
    .price-pointer {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 10;
        pointer-events: none;
        transition: left 0.3s ease;
    }
    .pointer-dot {
        width: 16px;
        height: 16px;
        background: var(--btn-primary);
        border: 3px solid #FFFFFF;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
        border-radius: 50%;
    }
    .pointer-bubble {
        position: absolute;
        bottom: 18px;
        background: var(--btn-primary);
        color: #FFFFFF;
        font-size: 0.725rem;
        font-weight: 700;
        font-family: monospace;
        padding: 0.2rem 0.55rem;
        border-radius: 6px;
        white-space: nowrap;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
    }
    .pointer-bubble::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border-width: 4px;
        border-style: solid;
        border-color: var(--btn-primary) transparent transparent transparent;
    }
    .gauge-labels {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        margin-top: 0.85rem;
        gap: 0.5rem;
    }
</style>
