<script>
    import { createCapitalTransactionApi } from '../api.js';

    export let isOpen = false;
    export let onClose = () => {};
    export let onSubmitDeposit = (depositData) => {};

    let type = 'DEPOSIT';
    let amount = '';
    let note = '';
    let isLoading = false;

    function setQuickAmount(val) {
        amount = String(val);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert('⚠️ Vui lòng nhập số tiền hợp lệ lớn hơn 0!');
            return;
        }

        isLoading = true;
        const res = await createCapitalTransactionApi(type, numAmount, note);
        isLoading = false;

        const nowStr = new Date().toISOString();
        const data = {
            id: res?.data?.id ? `#CAP-${String(res.data.id).padStart(3, '0')}` : `#CAP-000`,
            type: type === 'DEPOSIT' ? 'NẠP VỐN' : 'RÚT VỐN',
            typeClass: type === 'DEPOSIT' ? 'badge-emerald' : 'badge-rose',
            amount: type === 'DEPOSIT' 
                ? `+$${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
                : `-$${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            rawAmount: type === 'DEPOSIT' ? numAmount : -numAmount,
            amountClass: type === 'DEPOSIT' ? 'text-emerald' : 'text-rose',
            time: nowStr,
            note: note || (type === 'DEPOSIT' ? 'Nạp thêm vốn' : 'Rút chốt lời')
        };

        if (res.success) {
            alert(`✅ Giao dịch ${type === 'DEPOSIT' ? 'NẠP' : 'RÚT'} $${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT thành công!`);
        }

        onSubmitDeposit(data);
        amount = '';
        note = '';
        onClose();
    }
</script>

{#if isOpen}
<div class="modal-overlay active" on:click|self={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-card" style="max-width: 460px; padding: 1.75rem; border-radius: 20px;">
        <div class="card-header" style="margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
            <div class="card-title" style="font-size: 1.1rem; font-weight: 700; margin: 0;">Ghi Chép Nạp / Rút Vốn</div>
            <button class="btn btn-outline" style="padding: 0.2rem 0.55rem; border-radius: 50%;" on:click={onClose}>✕</button>
        </div>

        <form on:submit={handleSubmit}>
            <div class="form-group">
                <label for="capType">Loại Giao Dịch Dòng Tiền</label>
                <select id="capType" bind:value={type}>
                    <option value="DEPOSIT">🟢 NẠP VỐN (DEPOSIT)</option>
                    <option value="WITHDRAW">🔴 RÚT VỐN (WITHDRAW)</option>
                </select>
            </div>

            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label for="capAmount">Số Tiền (USDT)</label>
                    <div style="display: flex; gap: 0.3rem;">
                        <button type="button" class="quick-btn" on:click={() => setQuickAmount(100)}>+100</button>
                        <button type="button" class="quick-btn" on:click={() => setQuickAmount(500)}>+500</button>
                        <button type="button" class="quick-btn" on:click={() => setQuickAmount(1000)}>+1K</button>
                        <button type="button" class="quick-btn" on:click={() => setQuickAmount(5000)}>+5K</button>
                    </div>
                </div>
                <input 
                    type="number" 
                    step="any" 
                    id="capAmount" 
                    bind:value={amount} 
                    placeholder="VD: 1000" 
                    style="font-size: 1.15rem; font-weight: 700; font-family: monospace;"
                    required
                />
            </div>

            <div class="form-group">
                <label for="capNote">Ghi Chú Sổ Vốn</label>
                <input type="text" id="capNote" bind:value={note} placeholder="VD: Nạp vốn đầu tư chu kỳ mới">
            </div>

            <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
                <button type="button" class="btn btn-outline" style="flex: 1;" on:click={onClose}>Hủy bỏ</button>
                <button 
                    type="submit" 
                    class="btn {type === 'DEPOSIT' ? 'btn-emerald' : ''}" 
                    style="flex: 2; justify-content: center; padding: 0.85rem; font-size: 0.95rem; font-weight: 700;"
                    disabled={isLoading}
                >
                    {isLoading ? '⌛ Đang lưu...' : (type === 'DEPOSIT' ? '🟢 Xác Nhận Nạp Vốn' : '🔴 Xác Nhận Rút Vốn')}
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
        font-size: 0.725rem;
        padding: 0.2rem 0.45rem;
        cursor: pointer;
        color: var(--text-secondary);
        font-weight: 600;
    }
    .quick-btn:hover {
        background: var(--btn-primary);
        color: #FFFFFF;
    }
</style>
