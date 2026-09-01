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
    <div class="modal-overlay" on:click|self={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="dialog" aria-modal="true" tabindex="-1">
        <div class="modal-card">
            <div class="card-header" style="margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
                <div>
                    <div class="card-title" style="margin: 0;">Chốt Đóng Vị Thế</div>
                    <p style="font-size: 0.775rem; color: var(--text-muted); margin-top: 0.2rem;">
                        Xác nhận giá đóng lệnh để hạch toán vào Sổ Cái
                    </p>
                </div>
                <button class="btn btn-outline" style="padding: 0.2rem 0.55rem; border-radius: 50%;" on:click={onClose}>✕</button>
            </div>

            <!-- Position Overview Card -->
            <div style="background: var(--bg-subtle); border: 1px solid var(--border-card); border-radius: 10px; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="station-symbol">{cleanSymbol(position.symbol)}</span>
                        <span class="badge {position.direction === 'LONG' || position.direction === 'BUY' ? 'badge-emerald' : 'badge-rose'}">
                            {position.direction}
                        </span>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">
                        Vốn: <strong>${parseFloat(position.risk || 0).toFixed(2)} USDT</strong>
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem;">
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Giá vào lệnh (Entry)</div>
                        <div style="font-weight: 700; font-family: var(--font-mono); font-size: 0.95rem; margin-top: 0.15rem;">
                            ${formatPrice(position.entry)}
                        </div>
                    </div>
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Giá thị trường hiện tại</div>
                        <div style="font-weight: 700; font-family: var(--font-mono); font-size: 0.95rem; margin-top: 0.15rem; color: var(--emerald);">
                            ${formatPrice(position.currentPrice)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Exit Price Input Form -->
            <div style="margin-top: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                    <label for="exit-price-input" style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Giá Chốt Lệnh ($ USDT)</label>
                    <div style="display: flex; gap: 0.35rem;">
                        <button type="button" class="quick-btn" on:click={handleUseMarketPrice}>Giá thị trường</button>
                        <button type="button" class="quick-btn" on:click={handleUseEntryPrice}>Hòa vốn</button>
                    </div>
                </div>
                <input 
                    id="exit-price-input"
                    type="number" 
                    step="any" 
                    bind:value={customExitPrice} 
                    placeholder="Nhập giá chốt lệnh..."
                    style="font-size: 1.05rem; font-weight: 700;"
                />
            </div>

            <!-- Estimated PnL Preview -->
            <div style="margin-top: 1rem; padding: 0.85rem 1rem; border-radius: 8px; background: {estimatedPnl.isPositive ? 'var(--phase-markup-bg)' : 'var(--phase-markdown-bg)'}; border: 1px solid {estimatedPnl.isPositive ? 'var(--phase-markup-border)' : 'var(--phase-markdown-border)'}; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.825rem; font-weight: 600; color: {estimatedPnl.isPositive ? 'var(--emerald)' : 'var(--rose)'};">
                    {estimatedPnl.isPositive ? 'Lợi Nhuận Dự Kiến:' : 'Khoản Lỗ Dự Kiến:'}
                </span>
                <span style="font-size: 1.05rem; font-weight: 800; font-family: var(--font-mono); color: {estimatedPnl.isPositive ? 'var(--emerald)' : 'var(--rose)'};">
                    {estimatedPnl.pnlPercent} (${estimatedPnl.pnlUsdt} USDT)
                </span>
            </div>

            <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button type="button" class="btn btn-outline" on:click={onClose} disabled={isSubmitting}>Hủy bỏ</button>
                <button 
                    type="button" 
                    class="btn {estimatedPnl.isPositive ? 'btn-emerald' : 'btn-rose'}" 
                    on:click={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Đóng Vị Thế'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .quick-btn {
        background: var(--bg-subtle);
        border: 1px solid var(--border-card);
        border-radius: 4px;
        font-size: 0.725rem;
        padding: 0.2rem 0.45rem;
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
