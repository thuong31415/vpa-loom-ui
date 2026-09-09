<script>
    import { createPositionApi, cleanSymbol, formatPrice } from '../api.js';

    export let isOpen = false;
    export let symbol = 'BTCUSDT';
    export let direction = 'LONG';
    export let entry = '';
    export let sl = '';
    export let tp = '';
    export let margin = 200;
    export let risk = 200; // alias for backward compatibility
    export let leverage = 1;
    export let onClose = () => {};
    export let onSubmitOrderSuccess = (newPos) => {};

    let isLoading = false;
    let slWarning = '';
    let apiError = '';

    $: if (entry || sl || tp || internalMargin || leverage) apiError = '';

    $: internalMargin = margin || risk || 200;

    function setQuickMargin(val) {
        internalMargin = val;
        margin = val;
        risk = val;
    }

    function setQuickLeverage(val) {
        leverage = val;
    }

    $: {
        validateInputs();
    }

    function validateInputs() {
        const e = parseFloat(entry) || 0;
        const s = parseFloat(sl) || 0;

        if (e > 0 && s > 0) {
            if (direction === 'LONG' && s >= e) {
                slWarning = 'Mức cắt lỗ phải thấp hơn giá vào lệnh';
            } else if (direction === 'SHORT' && s <= e) {
                slWarning = 'Mức cắt lỗ phải cao hơn giá vào lệnh';
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
    $: marginNum = parseFloat(internalMargin) || 0;
    $: levNum = Math.max(1, parseInt(leverage) || 1);

    // Notional & Coin quantity
    $: notionalSize = marginNum * levNum;
    $: coinQuantity = entryNum > 0 ? (notionalSize / entryNum) : 0;

    // Distances
    $: slDist = (entryNum > 0 && slNum > 0) ? Math.abs(entryNum - slNum) : 0;
    $: tpDist = (entryNum > 0 && tpNum > 0) ? Math.abs(tpNum - entryNum) : 0;
    $: slPercent = entryNum > 0 ? (slDist / entryNum) : 0;
    $: tpPercent = entryNum > 0 ? (tpDist / entryNum) : 0;

    // Loss at SL
    $: maxLossUsdt = notionalSize * slPercent;
    $: maxLossPercent = slPercent * levNum * 100;

    // Profit at TP
    $: estProfitUsdt = notionalSize * tpPercent;
    $: estProfitPercent = tpPercent * levNum * 100;

    // R:R
    $: rr = (slDist > 0 && tpDist > 0) ? (tpDist / slDist).toFixed(2) : '2.00';

    // Liquidation price estimation
    $: estLiqPrice = entryNum > 0
        ? (direction === 'LONG'
            ? Math.max(0, entryNum * (1 - 1 / levNum))
            : entryNum * (1 + 1 / levNum))
        : 0;

    // Safety guard
    $: isLiquidationRisk = levNum > 1 && maxLossPercent >= 100;
    $: liquidationWarning = isLiquidationRisk
        ? `Đòn bẩy ${levNum}x quá cao! Vị thế sẽ bị thanh lý trước khi chạm mức Cắt lỗ (${maxLossPercent.toFixed(1)}% vốn).`
        : '';

    async function handleSubmit(e) {
        e.preventDefault();
        validateInputs();
        if (slWarning || isLiquidationRisk) return;

        isLoading = true;
        apiError = '';
        const res = await createPositionApi({
            symbol,
            interval: '4h',
            direction,
            entry,
            sl,
            tp,
            margin: marginNum,
            leverage: levNum,
            risk: marginNum
        });
        isLoading = false;

        if (!res.success) {
            apiError = res.error || 'Không thể mở vị thế trên Backend';
            return;
        }

        const data = res.data || {};
        const newPos = {
            id: data.id ? `pos-${data.id}` : `pos-${Date.now()}`,
            rawId: data.id || null,
            symbol: data.symbol || symbol || 'BTCUSDT',
            direction: data.direction || direction || 'LONG',
            status: data.status || 'OPEN',
            statusLabel: (data.status === 'OPEN' || !data.status) ? 'Đang Mở' : data.status,
            statusClass: (data.direction || direction) === 'LONG' ? 'badge-emerald' : 'badge-rose',
            entry: parseFloat(data.entry_price) || entryNum,
            currentPrice: parseFloat(data.entry_price) || entryNum,
            sl: parseFloat(data.protective_stop) || slNum,
            tp: parseFloat(data.target) || tpNum,
            margin: marginNum,
            leverage: levNum,
            notionalAmount: notionalSize,
            risk: marginNum,
            policyId: data.policy_id || '',
            pnlPercent: 0,
            pnlUsdt: 0,
            rMultiple: 0,
            rResult: '0.00 R',
            isSell: false,
            actionTitle: 'TIẾP TỤC NẮM GIỮ',
            actionBadge: 'badge-emerald',
            actionDesc: 'Vị thế vừa mở, hệ thống đang theo dõi cấu trúc nến 4H realtime.',
            actionBtnText: 'Chốt đóng vị thế',
            nextStatus: 'CLOSED',
            entryTime: data.entry_time || new Date().toISOString()
        };

        onSubmitOrderSuccess(newPos);
        onClose();
    }
</script>

{#if isOpen}
<div class="modal-overlay" on:click|self={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="order-ticket">
        <!-- Minimal Header -->
        <div class="ticket-header">
            <div class="ticket-title-group">
                <span class="ticket-symbol">{cleanSymbol(symbol)}</span>
                <div class="dir-toggle">
                    <button 
                        type="button" 
                        class="dir-btn {direction === 'LONG' ? 'active-long' : ''}" 
                        on:click={() => { direction = 'LONG'; }}
                    >
                        MUA
                    </button>
                    <button 
                        type="button" 
                        class="dir-btn {direction === 'SHORT' ? 'active-short' : ''}" 
                        on:click={() => { direction = 'SHORT'; }}
                    >
                        BÁN
                    </button>
                </div>
            </div>
            <button type="button" class="ticket-close" on:click={onClose} aria-label="Đóng">✕</button>
        </div>

        <form on:submit={handleSubmit} class="ticket-body">
            <!-- 1. Vốn ký quỹ Hero input -->
            <div class="risk-section">
                <div class="section-label-row">
                    <span class="section-label">Vốn Ký Quỹ</span>
                    <span class="notional-hint">
                        Vị thế: <strong>${notionalSize.toLocaleString('en-US', { maximumFractionDigits: 1 })}</strong>
                        {#if entryNum > 0}
                            <span class="coin-qty">({coinQuantity >= 1000 ? (coinQuantity / 1000).toFixed(1) + 'K' : coinQuantity.toFixed(2)} {cleanSymbol(symbol)})</span>
                        {/if}
                    </span>
                </div>
                <div class="risk-input-row">
                    <div class="risk-amount-box">
                        <span class="dollar-sign">$</span>
                        <input 
                            type="number" 
                            step="any" 
                            bind:value={internalMargin} 
                            class="risk-num-input" 
                            placeholder="200"
                            required 
                        />
                    </div>
                    <div class="quick-chips">
                        <button type="button" class="chip {internalMargin === 100 ? 'selected' : ''}" on:click={() => setQuickMargin(100)}>100</button>
                        <button type="button" class="chip {internalMargin === 200 ? 'selected' : ''}" on:click={() => setQuickMargin(200)}>200</button>
                        <button type="button" class="chip {internalMargin === 500 ? 'selected' : ''}" on:click={() => setQuickMargin(500)}>500</button>
                        <button type="button" class="chip {internalMargin === 1000 ? 'selected' : ''}" on:click={() => setQuickMargin(1000)}>1K</button>
                    </div>
                </div>
            </div>

            <!-- 2. Đòn bẩy (Leverage) Selector -->
            <div class="leverage-section">
                <div class="section-label-row">
                    <span class="section-label">Đòn Bẩy</span>
                    <span class="leverage-val-tag">{levNum}x</span>
                </div>
                <div class="leverage-chips">
                    {#each [1, 2, 3, 5, 10, 20] as lev}
                        <button 
                            type="button" 
                            class="chip lev-chip {levNum === lev ? 'selected' : ''}" 
                            on:click={() => setQuickLeverage(lev)}
                        >
                            {lev}x
                        </button>
                    {/each}
                </div>
            </div>

            <!-- 3. 3 Mốc Giá Chiến Lược (Entry / SL / TP) -->
            <div class="params-card">
                <div class="param-cell">
                    <label for="p-entry" class="param-label">Giá Vào</label>
                    <div class="param-input-wrap">
                        <span class="param-prefix">$</span>
                        <input id="p-entry" type="number" step="any" bind:value={entry} placeholder="0.00" required />
                    </div>
                </div>

                <div class="param-cell divider">
                    <div class="param-label-row">
                        <label for="p-sl" class="param-label text-rose">Cắt Lỗ</label>
                        {#if entryNum > 0 && slNum > 0}
                            <span class="param-sub text-rose">-{maxLossPercent.toFixed(1)}%</span>
                        {/if}
                    </div>
                    <div class="param-input-wrap">
                        <span class="param-prefix text-rose">$</span>
                        <input id="p-sl" type="number" step="any" bind:value={sl} class="text-rose" placeholder="0.00" required />
                    </div>
                </div>

                <div class="param-cell">
                    <div class="param-label-row">
                        <label for="p-tp" class="param-label text-emerald">Chốt Lời</label>
                        {#if entryNum > 0 && tpNum > 0}
                            <span class="param-sub text-emerald">+{estProfitPercent.toFixed(1)}%</span>
                        {/if}
                    </div>
                    <div class="param-input-wrap">
                        <span class="param-prefix text-emerald">$</span>
                        <input id="p-tp" type="number" step="any" bind:value={tp} class="text-emerald" placeholder="0.00" required />
                    </div>
                </div>
            </div>

            <!-- 4. Dòng tóm tắt R:R & PnL minh bạch -->
            <div class="metrics-summary">
                <div class="m-col">
                    <span class="m-label">Tỷ Lệ R:R</span>
                    <span class="m-val text-emerald">{rr} R</span>
                </div>
                <div class="m-col">
                    <span class="m-label">Kỳ Vọng Lãi</span>
                    <span class="m-val text-emerald">+{estProfitUsdt >= 1000 ? estProfitUsdt.toLocaleString('en-US', { maximumFractionDigits: 1 }) : estProfitUsdt.toFixed(1)}$</span>
                </div>
                <div class="m-col">
                    <span class="m-label">Rủi Ro Tối Đa</span>
                    <span class="m-val text-rose">-{maxLossUsdt >= 1000 ? maxLossUsdt.toLocaleString('en-US', { maximumFractionDigits: 1 }) : maxLossUsdt.toFixed(1)}$</span>
                </div>
            </div>

            {#if levNum > 1 && estLiqPrice > 0}
                <div class="liq-bar">
                    <span class="liq-label">Giá thanh lý ước tính:</span>
                    <span class="liq-val">${formatPrice(estLiqPrice)}</span>
                </div>
            {/if}

            {#if slWarning}
                <div class="sl-inline-warn">{slWarning}</div>
            {/if}

            {#if liquidationWarning}
                <div class="sl-inline-warn warn-liq">{liquidationWarning}</div>
            {/if}

            {#if apiError}
                <div class="sl-inline-warn warn-liq">Lỗi Backend: {apiError}</div>
            {/if}

            <button 
                type="submit" 
                class="submit-btn {direction === 'LONG' ? 'btn-emerald' : 'btn-rose'}" 
                disabled={isLoading || !!slWarning || isLiquidationRisk}
            >
                {isLoading ? 'Đang gửi lệnh...' : `Xác Nhận Mở Lệnh ${direction === 'LONG' ? 'Mua' : 'Bán'} (${levNum}x)`}
            </button>
        </form>
    </div>
</div>
{/if}

<style>
    .order-ticket {
        background: #FFFFFF;
        border: 1px solid var(--border-card);
        border-radius: 12px;
        width: 100%;
        max-width: 400px;
        padding: 1.25rem 1.35rem;
        box-shadow: var(--shadow-lg);
        animation: ticketIn 0.15s ease-out;
    }
    @keyframes ticketIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* Header */
    .ticket-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 0.85rem;
        border-bottom: 1px solid var(--border-subtle);
        margin-bottom: 1rem;
    }
    .ticket-title-group {
        display: flex;
        align-items: center;
        gap: 0.65rem;
    }
    .ticket-symbol {
        font-size: 1.15rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.02em;
    }
    .dir-toggle {
        display: flex;
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        border-radius: 6px;
        padding: 0.15rem;
        gap: 0.15rem;
    }
    .dir-btn {
        background: transparent;
        border: none;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .dir-btn.active-long {
        background: var(--phase-markup);
        color: #FFFFFF;
    }
    .dir-btn.active-short {
        background: var(--phase-markdown);
        color: #FFFFFF;
    }
    .ticket-close {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 1rem;
        cursor: pointer;
        padding: 0.2rem 0.4rem;
        border-radius: 4px;
        transition: color 0.15s ease;
    }
    .ticket-close:hover {
        color: var(--text-primary);
    }

    /* Body */
    .ticket-body {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
    }

    /* Risk / Amount Section */
    .risk-section {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .section-label-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
    }
    .notional-hint {
        font-size: 0.72rem;
        color: var(--text-secondary);
        font-family: var(--font-mono);
    }
    .notional-hint strong {
        color: var(--text-primary);
    }
    .coin-qty {
        color: var(--text-muted);
        font-size: 0.675rem;
    }
    .section-label {
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }

    /* Leverage Section */
    .leverage-section {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .leverage-val-tag {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--text-primary);
        font-family: var(--font-mono);
    }
    .leverage-chips {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 0.3rem;
    }
    .lev-chip {
        padding: 0.35rem 0;
        text-align: center;
        font-size: 0.725rem;
        font-weight: 700;
    }
    .risk-input-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
    }
    .risk-amount-box {
        display: flex;
        align-items: center;
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        border-radius: 8px;
        padding: 0.35rem 0.65rem;
        flex: 1;
    }
    .dollar-sign {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-muted);
        margin-right: 0.25rem;
        font-family: var(--font-mono);
    }
    .risk-num-input {
        border: none;
        background: transparent;
        font-family: var(--font-mono);
        font-size: 1.15rem;
        font-weight: 800;
        color: var(--text-primary);
        width: 100%;
        outline: none;
        padding: 0;
    }

    .quick-chips {
        display: flex;
        gap: 0.25rem;
    }
    .chip {
        background: #FFFFFF;
        border: 1px solid var(--border-card);
        border-radius: 6px;
        padding: 0.35rem 0.5rem;
        font-size: 0.725rem;
        font-weight: 600;
        font-family: var(--font-mono);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .chip:hover {
        border-color: var(--text-primary);
        color: var(--text-primary);
    }
    .chip.selected {
        background: var(--text-primary);
        color: #FFFFFF;
        border-color: var(--text-primary);
    }

    /* Price Parameters (3 inline columns) */
    .params-card {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        border-radius: 8px;
        padding: 0.5rem 0.4rem;
    }
    .param-cell {
        display: flex;
        flex-direction: column;
        padding: 0.15rem 0.4rem;
    }
    .param-cell.divider {
        border-left: 1px solid var(--border-card);
        border-right: 1px solid var(--border-card);
    }
    .param-label-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 0.15rem;
    }
    .param-sub {
        font-size: 0.65rem;
        font-weight: 700;
        font-family: var(--font-mono);
    }
    .param-label {
        font-size: 0.65rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        margin-bottom: 0.15rem;
    }
    .param-input-wrap {
        display: flex;
        align-items: baseline;
    }
    .param-prefix {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-muted);
        margin-right: 0.15rem;
        font-family: var(--font-mono);
    }
    .param-input-wrap input {
        border: none;
        background: transparent;
        font-family: var(--font-mono);
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--text-primary);
        width: 100%;
        outline: none;
        padding: 0;
    }

    /* Metrics summary */
    .metrics-summary {
        display: flex;
        justify-content: space-around;
        align-items: center;
        padding: 0.25rem 0;
        font-family: var(--font-mono);
    }
    .m-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1rem;
    }
    .m-label {
        font-size: 0.625rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-family: var(--font-main);
        font-weight: 600;
    }
    .m-val {
        font-size: 0.825rem;
        font-weight: 800;
    }

    .liq-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--bg-subtle);
        border: 1px dashed var(--border-card);
        border-radius: 6px;
        padding: 0.35rem 0.65rem;
        font-size: 0.7rem;
        font-family: var(--font-mono);
    }
    .liq-label {
        color: var(--text-muted);
    }
    .liq-val {
        font-weight: 700;
        color: var(--rose);
    }

    .sl-inline-warn {
        font-size: 0.725rem;
        color: var(--rose);
        text-align: center;
        background: var(--rose-bg);
        border: 1px solid var(--rose-border);
        padding: 0.35rem;
        border-radius: 6px;
    }
    .sl-inline-warn.warn-liq {
        font-weight: 700;
        background: #FEE2E2;
        border-color: #F87171;
        color: #991B1B;
    }

    /* Submit Button */
    .submit-btn {
        width: 100%;
        padding: 0.65rem;
        font-size: 0.875rem;
        font-weight: 700;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none;
        color: #FFFFFF;
        margin-top: 0.2rem;
    }
    .submit-btn.btn-emerald {
        background: var(--emerald);
    }
    .submit-btn.btn-emerald:hover {
        background: #14522B;
    }
    .submit-btn.btn-rose {
        background: var(--rose);
    }
    .submit-btn.btn-rose:hover {
        background: #801C1E;
    }
    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    @media (max-width: 440px) {
        .order-ticket {
            padding: 1.1rem;
            max-width: 100%;
            margin: 0.5rem;
        }
        .params-card {
            grid-template-columns: 1fr;
            gap: 0.4rem;
        }
        .param-cell.divider {
            border-left: none;
            border-right: none;
            border-top: 1px solid var(--border-card);
            border-bottom: 1px solid var(--border-card);
            padding: 0.35rem 0.4rem;
        }
    }
</style>
