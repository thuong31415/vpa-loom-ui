<script>
    import Header from './lib/components/Header.svelte';
    import ScannerTab from './lib/components/ScannerTab.svelte';
    import PositionsTab from './lib/components/PositionsTab.svelte';
    import HistoryTab from './lib/components/HistoryTab.svelte';
    import AccountTab from './lib/components/AccountTab.svelte';
    import OrderModal from './lib/components/OrderModal.svelte';
    import DepositModal from './lib/components/DepositModal.svelte';

    let activeTab = 'scanner';

    // Order Modal state
    let isOrderModalOpen = false;
    let modalSymbol = 'SUIUSDT';
    let modalDirection = 'LONG';
    let modalEntry = '0.6756';
    let modalSl = '0.6678';
    let modalTp = '0.7010';

    // Deposit Modal state
    let isDepositModalOpen = false;

    // References
    let positionsTabRef;
    let accountTabRef;

    function handleSelectTab(tab) {
        activeTab = tab;
    }

    function handleOpenOrderModal(symbol = 'SUIUSDT', direction = 'LONG', entry = '0.6756', sl = '0.6678', tp = '0.7010') {
        modalSymbol = symbol;
        modalDirection = direction;
        modalEntry = entry;
        modalSl = sl;
        modalTp = tp;
        isOrderModalOpen = true;
    }

    function handleCloseOrderModal() {
        isOrderModalOpen = false;
    }

    function handleOrderSuccess(newPos) {
        if (positionsTabRef && positionsTabRef.addPosition) {
            positionsTabRef.addPosition(newPos);
        }
        activeTab = 'positions';
    }

    function handleOpenDepositModal() {
        isDepositModalOpen = true;
    }

    function handleCloseDepositModal() {
        isDepositModalOpen = false;
    }

    function handleDepositSuccess(transaction) {
        if (accountTabRef && accountTabRef.addTransaction) {
            accountTabRef.addTransaction(transaction);
        }
        activeTab = 'account'; // Stay right on Tab 4 (Sổ Vốn)!
    }
</script>

<Header {activeTab} onSelectTab={handleSelectTab} />

<main>
    {#if activeTab === 'scanner'}
        <ScannerTab onOpenOrderModal={handleOpenOrderModal} />
    {:else if activeTab === 'positions'}
        <PositionsTab bind:this={positionsTabRef} onOpenOrderModal={handleOpenOrderModal} />
    {:else if activeTab === 'history'}
        <HistoryTab />
    {:else if activeTab === 'account'}
        <AccountTab bind:this={accountTabRef} onOpenDepositModal={handleOpenDepositModal} />
    {/if}
</main>

<OrderModal 
    isOpen={isOrderModalOpen}
    symbol={modalSymbol}
    direction={modalDirection}
    entry={modalEntry}
    sl={modalSl}
    tp={modalTp}
    onClose={handleCloseOrderModal}
    onSubmitOrderSuccess={handleOrderSuccess}
/>

<DepositModal
    isOpen={isDepositModalOpen}
    onClose={handleCloseDepositModal}
    onSubmitDeposit={handleDepositSuccess}
/>
