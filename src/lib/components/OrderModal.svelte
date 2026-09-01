<script>
    import { createPositionApi, cleanSymbol, formatPrice } from '../api.js';

    export let isOpen = false;
    export let symbol = 'SUIUSDT';
    export let direction = 'LONG';
    export let entry = '0.6756';
    export let sl = '0.6678';
    export let tp = '0.7010';
    export let risk = 200;
    export let onClose = () => {};
    export let onSubmitOrderSuccess = (newPos) => {};

    let isLoading = false;
    let slWarning = '';

    function setQuickRisk(val) {
        risk = val;
    }

    $: {
        validateSL();
    }

    function validateSL() {
        const e = parseFloat(entry) || 0;
        const s = parseFloat(sl) || 0;

        if (direction === 'LONG' && s >= e && e > 0) {
            slWarning = 'LONG yêu cầu Stop Loss phải nhỏ hơn Entry!';
        } else if (direction === 'SHORT' && s <= e && e > 0) {
            slWarning = 'SHORT yêu cầu Stop Loss phải lớn hơn Entry!';
        } else {
            slWarning = '';
        }
    }

    $: slDist = (entry && sl) ? Math.abs(parseFloat(entry) - parseFloat(sl)).toFixed(4) : '0.0000';
    $: rr = (entry && sl && tp && Math.abs(parseFloat(entry) - parseFloat(sl)) > 0) 
        ? (Math.abs(parseFloat(tp) - parseFloat(entry)) / Math.abs(parseFloat(entry) - parseFloat(sl))).toFixed(2) 
        : '3.00';

    async function handleSubmit(e) {
        e.preventDefault();
        validateSL();
        if (slWarning) {
            alert('Lỗi Stop Loss: Hãy đảm bảo SL nằm đúng phía so với Entry!');
            return;
        }

        isLoading = true;
        const res = await createPositionApi({ symbol, direction, entry, sl, tp, risk });
        isLoading = false;

        const newPos = {
            id: res?.data?.id ? `pos-${res.data.id}` : `pos-${Date.now()}`,
            symbol: symbol || 'SUIUSDT',
            direction: direction || 'LONG',
            status: 'OPEN',
            statusLabel: 'Đang mở',
            statusClass: 'badge-emerald',
            entry: parseFloat(entry) || 0.6756,
            sl: parseFloat(sl) || 0.6678,
            tp: parseFloat(tp) || 0.7010,
            risk: parseFloat(risk) || 200,
            rResult: '0.00 R',
            actionBtnText: 'Chốt đóng vị thế',
            nextStatus: 'CLOSED'
        };

        onSubmitOrderSuccess(newPos);
        onClose();
    }
</script>

{#if isOpen}
<div class="modal-overlay" on:click|self={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-card">
        <div class="card-header" style="margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
                <span class="station-symbol">{cleanSymbol(symbol) || 'SUI'}</span>
                <span class="badge {direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}">
                    {direction === 'LONG' ? 'MUA (LONG)' : 'BÁN (SHORT)'}
                </span>
            </div>
            <button class="btn btn-outline" style="padding: 0.2rem 0.55rem; border-radius: 50%;" on:click={onClose}>✕</button>
        </div>

        <form on:submit={handleSubmit}>
            <!-- Giá Vào Lệnh & Vốn Ký Quỹ -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="entry-price">Giá Vào Lệnh (Entry)</label>
                    <input 
                        type="number" 
                        step="any" 
                        id="entry-price" 
                        bind:value={entry} 
                        style="font-size: 1.05rem; font-weight: 700;" 
                        required
                    />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label for="risk-amount">Vốn ($ USDT)</label>
                        <div style="display: flex; gap: 0.2rem;">
                            <button type="button" class="quick-btn" on:click={() => setQuickRisk(100)}>100</button>
                            <button type="button" class="quick-btn" on:click={() => setQuickRisk(200)}>200</button>
                            <button type="button" class="quick-btn" on:click={() => setQuickRisk(500)}>500</button>
                        </div>
                    </div>
                    <input 
                        type="number" 
                        step="any" 
                        id="risk-amount" 
                        bind:value={risk} 
                        style="font-size: 1.05rem; font-weight: 700;" 
                        required
                    />
                </div>
            </div>

            <!-- Stop Loss & Take Profit -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="sl-price">Cắt Lỗ (Stop Loss)</label>
                    <input 
                        type="number" 
                        step="any" 
                        id="sl-price" 
                        bind:value={sl} 
                        class="text-rose"
                        style="font-size: 1.05rem; font-weight: 700;" 
                        required
                    />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="tp-price">Chốt Lời (Take Profit)</label>
                    <input 
                        type="number" 
                        step="any" 
                        id="tp-price" 
                        bind:value={tp} 
                        class="text-emerald"
                        style="font-size: 1.05rem; font-weight: 700;" 
                        required
                    />
                </div>
            </div>

            {#if slWarning}
                <div style="font-size: 0.775rem; color: var(--rose); margin-bottom: 0.8rem; background: var(--phase-markdown-bg); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--phase-markdown-border);">
                    {slWarning}
                </div>
            {/if}

            <!-- Summary metrics pill -->
            <div style="background: var(--bg-subtle); padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.825rem; display: flex; justify-content: space-between; border: 1px solid var(--border-card); font-family: var(--font-mono);">
                <span>Tỷ lệ R:R: <strong class="text-emerald">{rr} R</strong></span>
                <span>Khoảng cách SL: <strong>{slDist} USDT</strong></span>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; gap: 0.75rem;">
                <button type="button" class="btn btn-outline" style="flex: 1;" on:click={onClose}>Hủy bỏ</button>
                <button 
                    type="submit" 
                    class="btn {direction === 'LONG' ? 'btn-emerald' : 'btn-rose'}" 
                    style="flex: 2;"
                    disabled={isLoading}
                >
                    {isLoading ? 'Đang gửi...' : `Xác Nhận Mở Lệnh ($${risk || 200} USDT)`}
                </button>
            </div>
        </form>
    </div>
</div>
{/if}

<style>
    .quick-btn {
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        border-radius: 4px;
        font-size: 0.7rem;
        padding: 0.15rem 0.35rem;
        cursor: pointer;
        color: var(--text-secondary);
        font-weight: 600;
        font-family: var(--font-mono);
    }
    .quick-btn:hover {
        background: var(--btn-primary);
        color: var(--btn-primary-text);
    }
</style>
