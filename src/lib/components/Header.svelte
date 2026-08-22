<script>
    export let activeTab = 'scanner';
    export let onSelectTab = (tab) => {};
</script>

<header>
    <div class="header-left">
        <button class="logo-area" on:click={() => onSelectTab('scanner')} style="background: none; border: none; cursor: pointer; text-align: left; padding: 0;">
            <div class="logo-icon">V</div>
            <div class="logo-title">VPA Loom</div>
        </button>
    </div>

    <nav class="nav-tabs">
        <button 
            class="tab-btn {activeTab === 'scanner' ? 'active' : ''}" 
            on:click={() => onSelectTab('scanner')}
        >🎯 Quét Setup</button>
        <button 
            class="tab-btn {activeTab === 'positions' ? 'active' : ''}" 
            on:click={() => onSelectTab('positions')}
        >⚡ Vị Thế</button>
        <button 
            class="tab-btn {activeTab === 'history' ? 'active' : ''}" 
            on:click={() => onSelectTab('history')}
        >📜 Lịch Sử</button>
        <button 
            class="tab-btn {activeTab === 'account' ? 'active' : ''}" 
            on:click={() => onSelectTab('account')}
        >💼 Sổ Vốn</button>
    </nav>

    <div class="header-right">
        <div class="status-badge" title="Kết nối Backend Live: http://103.167.88.197:8081">
            <div class="status-dot"></div>
            <span>Live API (8081)</span>
        </div>
    </div>
</header>

<style>
    .header-left {
        display: flex;
        align-items: center;
        gap: 1.25rem;
    }
    .header-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
</style>
