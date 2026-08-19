<script>
    import { createPositionApi } from '../api.js';

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

    $: {
        validateSL();
    }

    function validateSL() {
        const e = parseFloat(entry) || 0;
        const s = parseFloat(sl) || 0;

        if (direction === 'LONG' && s >= e && e > 0) {
            slWarning = '⚠️ LONG yêu cầu Stop Loss phải nhỏ hơn Entry!';
        } else if (direction === 'SHORT' && s <= e && e > 0) {
            slWarning = '⚠️ SHORT yêu cầu Stop Loss phải lớn hơn Entry!';
        } else {
            slWarning = '';
        }
    }

    $: slDist = (entry && sl) ? Math.abs(parseFloat(entry) - parseFloat(sl)).toFixed(4) : '0.0000';
    $: rr = (entry && sl && tp) ? (Math.abs(parseFloat(tp) - parseFloat(entry)) / Math.abs(parseFloat(entry) - parseFloat(sl))).toFixed(2) : '3.26';

    async function handleSubmit(e) {
        e.preventDefault();
        validateSL();
        if (slWarning) {
            alert('❌ Lỗi Stop Loss: Hãy đảm bảo SL nằm đúng phía so với Entry!');
            return;
        }

        isLoading = true;
        const res = await createPositionApi({ symbol, direction, entry, sl, tp, risk });
        isLoading = false;

        const newPos = {
            id: res?.data?.id ? `pos-${res.data.id}` : `pos-${Date.now()}`,
            symbol: symbol || 'SUIUSDT',
            direction: direction || 'LONG',
            status: 'ORDERED',
            statusLabel: 'Đã đặt thủ công',
            statusClass: 'badge-amber',
            entry: parseFloat(entry) || 0.6756,
            sl: parseFloat(sl) || 0.6678,
            tp: parseFloat(tp) || 0.7010,
            risk: parseFloat(risk) || 200,
            rResult: 'Chờ khớp',
            actionBtnText: 'Đã khớp lệnh sàn',
            nextStatus: 'FILLED'
        };

        if (res.success) {
            alert(`✅ Đã gửi lệnh lên API /api/v1/positions! Vị thế ${direction} ${symbol} @ $${entry} đã được ghi nhận.`);
        } else {
            alert(`🚀 Đã lưu vị thế ${direction} ${symbol} @ $${entry} vào Sổ Giám Sát!`);
        }

        onSubmitOrderSuccess(newPos);
        onClose();
    }
</script>

{#if isOpen}
<div class="modal-overlay active">
    <div class="modal-card" style="max-width: 440px; padding: 1.75rem; border-radius: 20px;">
        <div class="card-header" style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.85rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="symbol-tag" style="font-size: 0.95rem;">{symbol || 'SUIUSDT'}</span>
                <span class="badge {direction === 'LONG' ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.85rem; font-weight: 600;">
                    {direction === 'LONG' ? '🟢 MUA (LONG)' : '🔴 BÁN (SHORT)'}
                </span>
            </div>
            <button class="btn btn-outline" style="padding: 0.2rem 0.55rem; border-radius: 50%;" on:click={onClose}>✕</button>
        </div>

        <form on:submit={handleSubmit}>
            <!-- Ultra Minimal 2 Input Cards (Giá Mua & Stop Loss) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="entry-price" style="font-size: 0.8rem; color: var(--text-muted);">Giá Mua (Entry Limit)</label>
                    <input 
                        type="number" 
                        step="any" 
                        id="entry-price" 
                        bind:value={entry} 
                        style="font-size: 1.1rem; font-weight: 700; font-variant-numeric: tabular-nums; padding: 0.75rem 0.9rem;" 
                        required
                    />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="sl-price" style="font-size: 0.8rem; color: var(--text-muted);">Cắt Lỗ (Stop Loss)</label>
                    <input 
                        type="number" 
                        step="any" 
                        id="sl-price" 
                        bind:value={sl} 
                        style="font-size: 1.1rem; font-weight: 700; color: var(--rose); font-variant-numeric: tabular-nums; padding: 0.75rem 0.9rem;" 
                        required
                    />
                </div>
            </div>

            {#if slWarning}
                <div style="font-size: 0.775rem; color: var(--rose); margin-bottom: 0.8rem; background: var(--rose-bg); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--rose-border);">
                    {slWarning}
                </div>
            {/if}

            <!-- Summary metrics pill -->
            <div style="background: var(--bg-main); padding: 0.75rem 1rem; border-radius: 10px; margin-bottom: 1.25rem; font-size: 0.825rem; display: flex; justify-content: space-between; border: 1px solid var(--border-subtle);">
                <span>Tỷ lệ R:R mong đợi: <strong class="text-emerald">{rr} R</strong></span>
                <span>Khoảng cách SL: <strong>{slDist} USDT</strong></span>
            </div>

            <!-- Single Clean Action Button -->
            <button 
                type="submit" 
                class="btn {direction === 'LONG' ? 'btn-emerald' : ''}" 
                style="width: 100%; justify-content: center; padding: 0.85rem; font-size: 0.95rem; font-weight: 600; border-radius: 10px;"
                disabled={isLoading}
            >
                {isLoading ? '⌛ Đang gửi API...' : `🟢 Xác Nhận Đặt Lệnh ${direction === 'LONG' ? 'Mua' : 'Bán'} ($${entry || '0.6756'})`}
            </button>
        </form>
    </div>
</div>
{/if}
