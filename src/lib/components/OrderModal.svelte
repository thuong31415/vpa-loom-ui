<script>
    import { createPositionApi, cleanSymbol, formatPrice } from '../api.js';

    export let isOpen = false;
    export let symbol = 'BTCUSDT';
    export let direction = 'LONG';
    export let entry = '';
    export let sl = '';
    export let tp = '';
    export let risk = 100;
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
            risk: parseFloat(risk) || 100,
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
            entryTime: new Date().toISOString()
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
                <span class="section-label">Vốn Ký Quỹ</span>
                <div class="risk-input-row">
                    <div class="risk-amount-box">
                        <span class="dollar-sign">$</span>
                        <input 
                            type="number" 
                            step="any" 
                            bind:value={risk} 
                            class="risk-num-input" 
                            placeholder="100"
                            required 
                        />
                    </div>
                    <div class="quick-chips">
                        <button type="button" class="chip {risk === 100 ? 'selected' : ''}" on:click={() => setQuickRisk(100)}>100</button>
                        <button type="button" class="chip {risk === 200 ? 'selected' : ''}" on:click={() => setQuickRisk(200)}>200</button>
                        <button type="button" class="chip {risk === 500 ? 'selected' : ''}" on:click={() => setQuickRisk(500)}>500</button>
                        <button type="button" class="chip {risk === 1000 ? 'selected' : ''}" on:click={() => setQuickRisk(1000)}>1K</button>
                    </div>
                </div>
            </div>

            <!-- 2. 3 Mốc Giá Chiến Lược (Entry / SL / TP) -->
            <div class="params-card">
                <div class="param-cell">
                    <label for="p-entry" class="param-label">Giá Vào</label>
                    <div class="param-input-wrap">
                        <span class="param-prefix">$</span>
                        <input id="p-entry" type="number" step="any" bind:value={entry} placeholder="0.00" required />
                    </div>
                </div>

                <div class="param-cell divider">
                    <label for="p-sl" class="param-label text-rose">Cắt Lỗ</label>
                    <div class="param-input-wrap">
                        <span class="param-prefix text-rose">$</span>
                        <input id="p-sl" type="number" step="any" bind:value={sl} class="text-rose" placeholder="0.00" required />
                    </div>
                </div>

                <div class="param-cell">
                    <label for="p-tp" class="param-label text-emerald">Chốt Lời</label>
                    <div class="param-input-wrap">
                        <span class="param-prefix text-emerald">$</span>
                        <input id="p-tp" type="number" step="any" bind:value={tp} class="text-emerald" placeholder="0.00" required />
                    </div>
                </div>
            </div>

            <!-- 3. Dòng tóm tắt R:R thanh thoát -->
            <div class="metrics-summary">
                <div class="m-col">
                    <span class="m-label">Tỷ Lệ R:R</span>
                    <span class="m-val text-emerald">{rr} R</span>
                </div>
                <div class="m-col">
                    <span class="m-label">Kỳ Vọng Lãi</span>
                    <span class="m-val text-emerald">+${estReward}</span>
                </div>
                <div class="m-col">
                    <span class="m-label">Rủi Ro Tối Đa</span>
                    <span class="m-val text-rose">-${risk || 0}</span>
                </div>
            </div>

            {#if slWarning}
                <div class="sl-inline-warn">{slWarning}</div>
            {/if}

            <!-- 4. Nút Action Tinh Giản -->
            <button 
                type="submit" 
                class="submit-btn {direction === 'LONG' ? 'btn-emerald' : 'btn-rose'}" 
                disabled={isLoading || !!slWarning}
            >
                {isLoading ? 'Đang gửi lệnh...' : 'Xác Nhận Mở Lệnh'}
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
    .section-label {
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.03em;
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

    .sl-inline-warn {
        font-size: 0.725rem;
        color: var(--rose);
        text-align: center;
        background: var(--rose-bg);
        border: 1px solid var(--rose-border);
        padding: 0.35rem;
        border-radius: 6px;
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
