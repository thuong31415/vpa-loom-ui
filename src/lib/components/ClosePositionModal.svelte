<script>
    import { cleanSymbol, formatPrice } from '../api.js';

    export let isOpen = false;
    export let position = null;
    export let onClose = () => {};
    export let onConfirmClose = (pos, exitPrice) => {};

    let customExitPrice = '';
    let isSubmitting = false;

    $: if (position) {
        customExitPrice = position.currentPrice ? String(position.currentPrice) : (position.entry ? String(position.entry) : '');
    }

    $: estimatedPnl = calculatePnl(position, customExitPrice);

    function calculatePnl(pos, exitPriceStr) {
        if (!pos) return { pnlUsdt: '0.00', pnlPercent: '0.00%', isPositive: true };
        const exit = parseFloat(exitPriceStr);
        const entry = parseFloat(pos.entry);
        const risk = parseFloat(pos.risk) || 0;
        if (isNaN(exit) || isNaN(entry) || entry <= 0) {
            return { pnlUsdt: '0.00', pnlPercent: '0.00%', isPositive: true };
        }

        const isLong = pos.direction === 'LONG' || pos.direction === 'BUY';
        const diffPercent = isLong ? (exit - entry) / entry : (entry - exit) / entry;
        const pnlUsdt = risk * diffPercent;
        const isPositive = pnlUsdt >= 0;

        return {
            pnlUsdt: pnlUsdt.toFixed(2),
            pnlPercent: `${isPositive ? '+' : ''}${(diffPercent * 100).toFixed(2)}%`,
            isPositive
        };
    }

    function handleUseMarketPrice() {
        if (position && position.currentPrice) {
            customExitPrice = String(position.currentPrice);
        }
    }

    function handleUseEntryPrice() {
        if (position && position.entry) {
            customExitPrice = String(position.entry);
        }
    }

    async function handleSubmit() {
        const exitNum = parseFloat(customExitPrice);
        if (isNaN(exitNum) || exitNum <= 0) {
            alert('Vui lòng nhập giá chốt lệnh hợp lệ!');
            return;
        }
        isSubmitting = true;
        try {
            await onConfirmClose(position, exitNum);
            onClose();
        } catch (e) {
            alert('Lỗi khi chốt lệnh: ' + e.message);
        } finally {
            isSubmitting = false;
        }
    }
</script>

{#if isOpen && position}
    <div class="modal-backdrop" on:click|self={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="dialog" aria-modal="true" tabindex="-1">
        <div class="modal-card">
            <div class="modal-header">
                <div>
                    <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">Chốt Đóng Vị Thế</h3>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
                        Xác nhận giá đóng lệnh để hạch toán lợi nhuận vào Sổ Cái
                    </p>
                </div>
                <button class="modal-close-btn" on:click={onClose}>✕</button>
            </div>

            <!-- Position Overview Card -->
            <div style="background: var(--bg-subtle); border: 1px solid var(--border-card); border-radius: 10px; padding: 1rem; margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary);">{cleanSymbol(position.symbol)}</span>
                        <span class="badge {position.direction === 'LONG' || position.direction === 'BUY' ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.75rem;">
                            {position.direction}
                        </span>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">
                        Vốn: <strong>${parseFloat(position.risk || 0).toFixed(2)} USDT</strong>
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem; font-size: 0.825rem;">
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.75rem;">Giá vào lệnh (Entry)</div>
                        <div style="font-weight: 700; font-family: monospace;">${formatPrice(position.entry)}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.75rem;">Giá thị trường hiện tại</div>
                        <div style="font-weight: 700; font-family: monospace; color: var(--emerald);">${formatPrice(position.currentPrice)}</div>
                    </div>
                </div>
            </div>

            <!-- Exit Price Input Form -->
            <div style="margin-top: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                    <label for="exit-price-input" style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Giá Chốt Lệnh ($ USDT)</label>
                    <div style="display: flex; gap: 0.35rem;">
                        <button type="button" class="quick-btn" on:click={handleUseMarketPrice}>⚡ Giá thị trường</button>
                        <button type="button" class="quick-btn" on:click={handleUseEntryPrice}>Hòa vốn</button>
                    </div>
                </div>
                <input 
                    id="exit-price-input"
                    type="number" 
                    step="any" 
                    class="modal-input" 
                    bind:value={customExitPrice} 
                    placeholder="Nhập giá chốt lệnh..."
                    style="font-size: 1.05rem; font-weight: 700; font-family: monospace;"
                />
            </div>

            <!-- Estimated PnL Preview -->
            <div style="margin-top: 1rem; padding: 0.85rem 1rem; border-radius: 8px; background: {estimatedPnl.isPositive ? 'var(--emerald-bg)' : 'var(--rose-bg)'}; border: 1px solid {estimatedPnl.isPositive ? 'var(--emerald-border)' : 'var(--rose-border)'}; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.85rem; font-weight: 600; color: {estimatedPnl.isPositive ? 'var(--emerald)' : 'var(--rose)'};">
                    {estimatedPnl.isPositive ? '📈 Lợi Nhuận Dự Kiến:' : '📉 Khoản Lỗ Dự Kiến:'}
                </span>
                <span style="font-size: 1.1rem; font-weight: 800; font-family: monospace; color: {estimatedPnl.isPositive ? 'var(--emerald)' : 'var(--rose)'};">
                    {estimatedPnl.pnlPercent} (${estimatedPnl.pnlUsdt} USDT)
                </span>
            </div>

            <div class="modal-footer" style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button type="button" class="btn btn-outline" on:click={onClose} disabled={isSubmitting}>Hủy bỏ</button>
                <button 
                    type="button" 
                    class="btn btn-primary" 
                    style="background: var(--btn-primary); color: #fff; font-weight: 700;"
                    on:click={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? '⌛ Đang xử lý...' : '✅ Xác Nhận Đóng Vị Thế'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }
    .modal-card {
        background: #FFFFFF;
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        width: 100%;
        max-width: 460px;
        padding: 1.5rem;
        border: 1px solid var(--border-card);
        animation: modalIn 0.18s ease-out;
    }
    @keyframes modalIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }
    .modal-close-btn {
        background: none;
        border: none;
        font-size: 1.1rem;
        cursor: pointer;
        color: var(--text-muted);
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
    }
    .modal-close-btn:hover {
        background: var(--bg-subtle);
        color: var(--text-primary);
    }
    .modal-input {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid var(--border-card);
        border-radius: 8px;
        background: #FFFFFF;
        outline: none;
        transition: border 0.15s;
    }
    .modal-input:focus {
        border-color: var(--btn-primary);
    }
    .quick-btn {
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        border-radius: 4px;
        font-size: 0.725rem;
        padding: 0.2rem 0.5rem;
        cursor: pointer;
        color: var(--text-secondary);
        font-weight: 500;
    }
    .quick-btn:hover {
        background: #FFFFFF;
        color: var(--text-primary);
    }
</style>
