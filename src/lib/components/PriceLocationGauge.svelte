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
            zoneLabel = 'Sát Vùng Hỗ Trợ Đáy';
            zoneClass = 'text-emerald';
            zoneTip = 'Đang ở hỗ trợ đáy';
        } else if (p >= resLower) {
            zoneLabel = 'Sát Vùng Kháng Cự Đỉnh';
            zoneClass = 'text-rose';
            zoneTip = 'Đang ở kháng cự đỉnh';
        } else if (clampedPercent <= 30) {
            zoneLabel = 'Vùng Thấp Nghiêng Hỗ Trợ';
            zoneClass = 'text-emerald';
            zoneTip = 'Nghiêng hỗ trợ';
        } else if (clampedPercent >= 70) {
            zoneLabel = 'Vùng Cao Cận Kháng Cự';
            zoneClass = 'text-rose';
            zoneTip = 'Nghiêng kháng cự';
        } else {
            zoneLabel = 'Vùng Lưng Chừng Biên';
            zoneClass = 'text-amber';
            zoneTip = 'Lưng chừng biên Range';
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
        <!-- Gauge Visual Track -->
        <div class="track-wrapper">
            <div class="gauge-track">
                <!-- Zone markers in pastel ink tones -->
                <div class="zone-segment zone-sup" style="width: 25%;" title="Vùng Hỗ Trợ Đáy"></div>
                <div class="zone-segment zone-mid" style="width: 50%;" title="Vùng Lưng Chừng"></div>
                <div class="zone-segment zone-res" style="width: 25%;" title="Vùng Kháng Cự Đỉnh"></div>

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
            <div class="gauge-edge-label">
                <span class="label-title">HỖ TRỢ ĐÁY</span>
                <span class="label-val text-emerald">${formatPrice(gauge.supUpper)}</span>
            </div>
            <div class="gauge-center-tip {gauge.zoneClass}">
                {gauge.zoneTip} ({gauge.percent.toFixed(0)}% Range)
            </div>
            <div class="gauge-edge-label right">
                <span class="label-title">KHÁNG CỰ ĐỈNH</span>
                <span class="label-val text-rose">${formatPrice(gauge.resLower)}</span>
            </div>
        </div>
    </div>
{/if}

<style>
    .gauge-container {
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        border-radius: 8px;
        padding: 0.65rem 1rem 0.65rem 1rem;
        margin: 0.5rem 0;
    }
    .track-wrapper {
        position: relative;
        padding: 1.25rem 0.5rem 0.25rem 0.5rem;
    }
    .gauge-track {
        height: 6px;
        background: #E8E6E0;
        border-radius: 999px;
        position: relative;
        display: flex;
        overflow: visible;
        border: 1px solid #DFDCD4;
    }
    .zone-segment {
        height: 100%;
    }
    .zone-sup {
        background: var(--phase-markup-border);
        border-top-left-radius: 999px;
        border-bottom-left-radius: 999px;
    }
    .zone-mid {
        background: var(--phase-dist-border);
    }
    .zone-res {
        background: var(--phase-markdown-border);
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
        transition: left 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pointer-dot {
        width: 12px;
        height: 12px;
        background: var(--text-primary);
        border: 2px solid #FFFFFF;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
        border-radius: 50%;
    }
    .pointer-bubble {
        position: absolute;
        bottom: 14px;
        background: var(--text-primary);
        color: #FFFFFF;
        font-size: 0.7rem;
        font-weight: 700;
        font-family: var(--font-mono);
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        white-space: nowrap;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    }
    .pointer-bubble::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border-width: 4px;
        border-style: solid;
        border-color: var(--text-primary) transparent transparent transparent;
    }
    .gauge-labels {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        margin-top: 0.45rem;
        gap: 0.5rem;
    }
    .gauge-edge-label {
        display: flex;
        flex-direction: column;
        text-align: left;
    }
    .gauge-edge-label.right {
        text-align: right;
    }
    .label-title {
        font-size: 0.65rem;
        color: var(--text-muted);
        font-weight: 700;
        letter-spacing: 0.03em;
    }
    .label-val {
        font-size: 0.825rem;
        font-weight: 700;
        font-family: var(--font-mono);
    }
    .gauge-center-tip {
        text-align: center;
        font-size: 0.75rem;
        font-weight: 700;
    }
</style>
