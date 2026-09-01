<script>
    import { createPositionApi, cleanSymbol, formatPrice } from '../api.js';

    export let isOpen = false;
    export let symbol = 'BTCUSDT';
    export let direction = 'LONG';
    export let entry = '';
    export let sl = '';
    export let tp = '';
    export let risk = 200;
    export let onClose = () => {};
    export let onSubmitOrderSuccess = (newPos) => {};

    let isLoading = false;
    let slWarning = '';

    function setQuickRisk(val) {
        risk = val;
    }

    $: {
        validateInputs();
    }

    function validateInputs() {
        const e = parseFloat(entry) || 0;
        const s = parseFloat(sl) || 0;

        if (e > 0 && s > 0) {
            if (direction === 'LONG' && s >= e) {
                slWarning = 'SL phải thấp hơn giá Entry đối với lệnh Long';
            } else if (direction === 'SHORT' && s <= e) {
                slWarning = 'SL phải cao hơn giá Entry đối với lệnh Short';
            } else {
                slWarning = '';
            }
        } else {
            slWarning = '';
        }
    }

    // Calculated metrics
    $: entryNum = parseFloat(entry) || 0;
    $: slNum = parseFloat(sl) || 0;
    $: tpNum = parseFloat(tp) || 0;
    $: riskDist = (entryNum > 0 && slNum > 0) ? Math.abs(entryNum - slNum) : 0;
    $: rewardDist = (entryNum > 0 && tpNum > 0) ? Math.abs(tpNum - entryNum) : 0;
    $: rr = (riskDist > 0 && rewardDist > 0) ? (rewardDist / riskDist).toFixed(2) : '2.00';
    $: estReward = (risk && parseFloat(rr) > 0) ? (risk * parseFloat(rr)).toFixed(1) : (risk * 2).toFixed(1);

    async function handleSubmit(e) {
        e.preventDefault();
        validateInputs();
        if (slWarning) return;

        isLoading = true;
        const res = await createPositionApi({ symbol, direction, entry, sl, tp, risk });
        isLoading = false;

        const newPos = {
            id: res?.data?.id ? `pos-${res.data.id}` : `pos-${Date.now()}`,
            rawId: res?.data?.id || null,
            symbol: symbol || 'BTCUSDT',
            direction: direction || 'LONG',
            status: 'OPEN',
            statusLabel: 'Đang Mở',
            statusClass: direction === 'LONG' ? 'badge-emerald' : 'badge-rose',
            entry: parseFloat(entry) || entryNum,
            currentPrice: parseFloat(entry) || entryNum,
            sl: parseFloat(sl) || slNum,
            tp: parseFloat(tp) || tpNum,
            risk: parseFloat(risk) || 200,
            pnlPercent: 0,
            pnlUsdt: 0,
            rMultiple: 0,
            rResult: '0.00 R',
            isSell: false,
            actionTitle: 'HOLD (TIẾP TỤC GIỮ)',
            actionBadge: 'badge-emerald',
            actionDesc: 'Vị thế vừa mở, hệ thống đang theo dõi cấu trúc nến 4H realtime.',
            actionBtnText: 'Chốt đóng vị thế',
            nextStatus: 'CLOSED',
            entryTime: new Date().toISOString()
        };

        onSubmitOrderSuccess(newPos);
        onClose();
    }
</script>

{#if isOpen}
<div class="modal-overlay" on:click|self={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-card order-modal-box">
        <!-- Minimal Top Bar: Direction Selector + Symbol + Close -->
        <div class="order-top-bar">
            <div class="dir-toggle">
                <button 
                    type="button" 
                    class="dir-btn {direction === 'LONG' ? 'active long' : ''}" 
                    on:click={() => { direction = 'LONG'; }}
                >
                    MUA (LONG)
                </button>
                <button 
                    type="button" 
                    class="dir-btn {direction === 'SHORT' ? 'active short' : ''}" 
                    on:click={() => { direction = 'SHORT'; }}
                >
                    BÁN (SHORT)
                </button>
            </div>

            <div class="order-sym-badge">
                {cleanSymbol(symbol)}
            </div>

            <button type="button" class="order-close-btn" on:click={onClose} aria-label="Đóng">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>

        <form on:submit={handleSubmit} class="order-form">
            <!-- Row 1: Entry & Vốn -->
            <div class="input-grid">
                <div class="order-field">
                    <label for="entry-price">Giá Vào (Entry)</label>
                    <div class="input-wrap">
                        <span class="currency-prefix">$</span>
                        <input 
                            type="number" 
                            step="any" 
                            id="entry-price" 
                            bind:value={entry} 
                            placeholder="0.00"
                            required
                        />
                    </div>
                </div>

                <div class="order-field">
                    <label for="risk-amount">Vốn Phân Bổ</label>
                    <div class="input-wrap">
                        <span class="currency-prefix">$</span>
                        <input 
                            type="number" 
                            step="any" 
                            id="risk-amount" 
                            bind:value={risk} 
                            placeholder="200"
                            required
                        />
                    </div>
                </div>
            </div>

            <!-- Quick Risk Chips -->
            <div class="quick-risk-row">
                <span class="quick-risk-label">Mức vốn nhanh:</span>
                <button type="button" class="risk-chip {risk === 100 ? 'active' : ''}" on:click={() => setQuickRisk(100)}>$100</button>
                <button type="button" class="risk-chip {risk === 200 ? 'active' : ''}" on:click={() => setQuickRisk(200)}>$200</button>
                <button type="button" class="risk-chip {risk === 500 ? 'active' : ''}" on:click={() => setQuickRisk(500)}>$500</button>
                <button type="button" class="risk-chip {risk === 1000 ? 'active' : ''}" on:click={() => setQuickRisk(1000)}>$1,000</button>
            </div>

            <!-- Row 2: Stop Loss & Take Profit -->
            <div class="input-grid">
                <div class="order-field">
                    <label for="sl-price" class="text-rose">Cắt Lỗ (SL)</label>
                    <div class="input-wrap sl-wrap">
                        <span class="currency-prefix text-rose">$</span>
                        <input 
                            type="number" 
                            step="any" 
                            id="sl-price" 
                            bind:value={sl} 
                            class="text-rose"
                            placeholder="0.00"
                            required
                        />
                    </div>
                </div>

                <div class="order-field">
                    <label for="tp-price" class="text-emerald">Chốt Lời (TP)</label>
                    <div class="input-wrap tp-wrap">
                        <span class="currency-prefix text-emerald">$</span>
                        <input 
                            type="number" 
                            step="any" 
                            id="tp-price" 
                            bind:value={tp} 
                            class="text-emerald"
                            placeholder="0.00"
                            required
                        />
                    </div>
                </div>
            </div>

            <!-- Gentle inline warning if SL is invalid -->
            {#if slWarning}
                <div class="sl-warn-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>{slWarning}</span>
                </div>
            {/if}

            <!-- Smart Telemetry Summary Bar -->
            <div class="order-telemetry-bar">
                <div class="telemetry-item">
                    <span class="t-label">Tỷ Lệ R:R</span>
                    <span class="t-val text-emerald">{rr} R</span>
                </div>
                <div class="telemetry-item">
                    <span class="t-label">Kỳ Vọng Lãi</span>
                    <span class="t-val text-emerald">+${estReward}</span>
                </div>
                <div class="telemetry-item">
                    <span class="t-label">Rủi Ro Tối Đa</span>
                    <span class="t-val text-rose">-${risk || 0}</span>
                </div>
            </div>

            <!-- Single Confident Primary Action Button -->
            <button 
                type="submit" 
                class="btn {direction === 'LONG' ? 'btn-emerald' : 'btn-rose'} order-submit-btn" 
                disabled={isLoading || !!slWarning}
            >
                {#if isLoading}
                    Đang thiết lập vị thế...
                {:else}
                    Mở Vị Thế {direction === 'LONG' ? 'Mua' : 'Bán'} {cleanSymbol(symbol)} (${risk || 0})
                {/if}
            </button>
        </form>
    </div>
</div>
{/if}

<style>
    .order-modal-box {
        max-width: 440px;
        padding: 1.35rem 1.5rem;
        background: #FFFFFF;
        border-radius: 14px;
        box-shadow: var(--shadow-lg);
    }

    /* Top Bar */
    .order-top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.25rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border-subtle);
    }
    .dir-toggle {
        display: inline-flex;
        background: var(--bg-subtle);
        padding: 0.2rem;
        border-radius: 8px;
        border: 1px solid var(--border-card);
        gap: 0.15rem;
    }
    .dir-btn {
        background: transparent;
        border: none;
        padding: 0.3rem 0.65rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .dir-btn.active.long {
        background: var(--phase-markup);
        color: #FFFFFF;
    }
    .dir-btn.active.short {
        background: var(--phase-markdown);
        color: #FFFFFF;
    }

    .order-sym-badge {
        font-size: 1.05rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.01em;
    }

    .order-close-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 0.3rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: color 0.15s ease;
    }
    .order-close-btn:hover {
        color: var(--text-primary);
        background: var(--bg-subtle);
    }

    /* Order Form */
    .order-form {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    }

    .input-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .order-field {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }
    .order-field label {
        font-size: 0.725rem;
        font-weight: 700;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    .input-wrap {
        display: flex;
        align-items: center;
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        border-radius: 8px;
        padding: 0.45rem 0.65rem;
        transition: border-color 0.15s ease;
    }
    .input-wrap:focus-within {
        border-color: var(--text-primary);
        background: #FFFFFF;
    }
    .currency-prefix {
        font-size: 0.85rem;
        color: var(--text-muted);
        font-family: var(--font-mono);
        font-weight: 700;
        margin-right: 0.25rem;
    }
    .input-wrap input {
        border: none;
        background: transparent;
        font-family: var(--font-mono);
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-primary);
        width: 100%;
        outline: none;
        padding: 0;
    }

    /* Quick Risk Chips */
    .quick-risk-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: -0.25rem;
    }
    .quick-risk-label {
        font-size: 0.7rem;
        color: var(--text-muted);
        font-weight: 600;
    }
    .risk-chip {
        background: #FFFFFF;
        border: 1px solid var(--border-card);
        border-radius: 4px;
        font-size: 0.7rem;
        padding: 0.15rem 0.4rem;
        color: var(--text-secondary);
        font-family: var(--font-mono);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .risk-chip:hover {
        border-color: var(--text-primary);
        color: var(--text-primary);
    }
    .risk-chip.active {
        background: var(--text-primary);
        color: #FFFFFF;
        border-color: var(--text-primary);
    }

    /* SL Warning */
    .sl-warn-box {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.75rem;
        color: var(--rose);
        background: var(--rose-bg);
        border: 1px solid var(--rose-border);
        padding: 0.45rem 0.65rem;
        border-radius: 6px;
    }

    /* Telemetry Summary Bar */
    .order-telemetry-bar {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        border-radius: 8px;
        padding: 0.55rem 0.75rem;
        text-align: center;
        margin-top: 0.25rem;
    }
    .telemetry-item {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }
    .telemetry-item:not(:last-child) {
        border-right: 1px solid var(--border-card);
    }
    .t-label {
        font-size: 0.65rem;
        color: var(--text-muted);
        font-weight: 600;
        text-transform: uppercase;
    }
    .t-val {
        font-size: 0.825rem;
        font-weight: 800;
        font-family: var(--font-mono);
    }

    /* Submit Button */
    .order-submit-btn {
        width: 100%;
        padding: 0.65rem;
        font-size: 0.875rem;
        font-weight: 700;
        border-radius: 8px;
        margin-top: 0.35rem;
    }

    @media (max-width: 480px) {
        .order-modal-box {
            padding: 1.15rem;
            margin: 0.5rem;
        }
        .input-grid {
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
        }
    }
</style>
