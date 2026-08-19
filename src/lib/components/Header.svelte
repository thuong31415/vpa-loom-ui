<script>
    export let activeTab = 'scanner';
    export let onSelectTab = (tab) => {};
</script>

<header>
    <div class="logo-area">
        <div class="logo-icon">V</div>
        <div class="logo-title">VPA Loom</div>
    </div>

    <nav class="nav-tabs">
        <button 
            class="tab-btn {activeTab === 'scanner' ? 'active' : ''}" 
            on:click={() => onSelectTab('scanner')}
        >🎯 Quét Setup</button>
        <button 
            class="tab-btn {activeTab === 'positions' ? 'active' : ''}" 
            on:click={() => onSelectTab('positions')}
        >⚡ Vị Thế Theo Dõi</button>
        <button 
            class="tab-btn {activeTab === 'history' ? 'active' : ''}" 
            on:click={() => onSelectTab('history')}
        >📜 Lịch Sử Lệnh</button>
        <button 
            class="tab-btn {activeTab === 'account' ? 'active' : ''}" 
            on:click={() => onSelectTab('account')}
        >💼 Sổ Vốn</button>
    </nav>

    <div class="status-badge" title="Kết nối Backend Live: http://103.167.88.197:8081">
        <div class="status-dot"></div>
        <span>Live API (103.167.88.197:8081)</span>
    </div>
</header>
