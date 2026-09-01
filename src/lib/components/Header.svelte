<script>
    export let activeTab = 'scanner';
    export let onSelectTab = (tab) => {};
</script>

<header>
    <div class="header-spacer"></div>

    <nav class="nav-tabs">
        <button 
            class="tab-btn {activeTab === 'scanner' ? 'active' : ''}" 
            on:click={() => onSelectTab('scanner')}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="2"/>
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
            </svg>
            <span>Thị Trường</span>
        </button>

        <button 
            class="tab-btn {activeTab === 'positions' ? 'active' : ''}" 
            on:click={() => onSelectTab('positions')}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span>Vị Thế</span>
        </button>

        <button 
            class="tab-btn {activeTab === 'history' ? 'active' : ''}" 
            on:click={() => onSelectTab('history')}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3v5h5"/>
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
                <path d="M12 7v5l4 2"/>
            </svg>
            <span>Lịch Sử</span>
        </button>

        <button 
            class="tab-btn {activeTab === 'account' ? 'active' : ''}" 
            on:click={() => onSelectTab('account')}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Sổ Vốn</span>
        </button>
    </nav>

    <div class="header-right">
        <div class="status-badge" title="Kết nối Backend Live: http://103.167.88.197:8081">
            <div class="status-dot"></div>
            <span>LIVE 8081</span>
        </div>
    </div>
</header>

<style>
    header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        padding: 0.65rem 1.75rem;
    }
    .header-spacer {
        grid-column: 1;
    }
    .nav-tabs {
        grid-column: 2;
        justify-self: center;
    }
    .header-right {
        grid-column: 3;
        justify-self: end;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    @media (max-width: 900px) {
        header {
            display: flex;
            flex-direction: column;
            padding: 0.75rem 1rem;
            gap: 0.75rem;
        }
        .header-spacer {
            display: none;
        }
        .nav-tabs {
            width: 100%;
            justify-content: center;
        }
        .header-right {
            display: none;
        }
    }
</style>
