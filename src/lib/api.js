export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const REMOTE_HOSTS = [
    'http://103.167.88.197:8081'
];
export const REMOTE_API_HOST = REMOTE_HOSTS[0];

// Supported Universe Coins
export const UNIVERSE_COINS = [
    "ETHUSDT", "BTCUSDT", "SOLUSDT", "SUIUSDT", "UNIUSDT",
    "LINKUSDT", "ZECUSDT", "LDOUSDT", "NEARUSDT", "BNBUSDT",
    "PEPEUSDT", "TAOUSDT", "ADAUSDT", "ENAUSDT", "ZKUSDT"
];

/**
 * Robust Multi-Target JSON Fetcher:
 * Automatically rotates across candidate endpoints:
 * 1. Direct Backend API hosts (bypasses static Caddy 405 Method Not Allowed)
 * 2. Relative reverse proxy path
 * 3. Handles non-2xx (404, 405, 502) by trying the next target seamlessly
 */
async function safeJsonFetch(endpoint, options = {}) {
    const defaultHeaders = {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...(options.headers || {})
    };

    const fetchOptions = {
        cache: 'no-store',
        ...options,
        headers: defaultHeaders
    };

    // Candidate URLs to try in order
    const candidates = [];
    if (BASE_URL) {
        candidates.push(`${BASE_URL}${endpoint}`);
    }
    // Direct remote hosts (CORS-enabled backend ports)
    REMOTE_HOSTS.forEach(host => {
        candidates.push(`${host}${endpoint}`);
    });
    // Relative fallback
    candidates.push(endpoint);

    let lastStatus = 0;
    let lastError = null;

    for (const targetUrl of candidates) {
        try {
            const response = await fetch(targetUrl, fetchOptions);
            lastStatus = response.status;
            
            if (response.status === 204 || response.status === 205) {
                return { ok: true, data: null, status: response.status, url: targetUrl };
            }
            if (!response.ok) {
                // If 405 Method Not Allowed, 404, or 502, try next candidate
                console.warn(`Target ${targetUrl} returned status ${response.status}, trying next candidate...`);
                continue;
            }
            const text = await response.text();
            if (!text || text.trim() === '') {
                return { ok: true, data: null, status: response.status, url: targetUrl };
            }
            if (text.startsWith('{') || text.startsWith('[')) {
                return { ok: true, data: JSON.parse(text), status: response.status, url: targetUrl };
            }
        } catch (err) {
            console.warn(`Target ${targetUrl} failed with error:`, err.message);
            lastError = err;
        }
    }

    return { 
        ok: false, 
        status: lastStatus, 
        error: lastError?.message || `Không thể kết nối Backend API (Mã lỗi: ${lastStatus || 'Network'})` 
    };
}

/**
 * Fetch detailed analysis for a single symbol (e.g., ETH, BTC, SOL)
 * GET /api/v1/analysis?symbol=ETHUSDT&interval=4h&limit=720
 */
export async function fetchAnalysis(symbol = 'ETHUSDT', interval = '4h', limit = 720) {
    const raw = (symbol || 'ETHUSDT').trim().toUpperCase();
    const cleanSymbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    const endpoint = `/api/v1/analysis?symbol=${encodeURIComponent(cleanSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}&_t=${Date.now()}`;

    const res = await safeJsonFetch(endpoint, { method: 'GET' });
    if (res.ok) {
        return { success: true, data: res.data, source: res.source };
    }
    return { success: false, error: res.error || 'Lỗi kết nối API phân tích' };
}

/**
 * Hydrate and resolve analysis for a single symbol
 * GET /api/v1/analysis?symbol=ETHUSDT&interval=4h&limit=720
 */
export async function resolveAnalysis(symbol = 'ETHUSDT', interval = '4h', limit = 720) {
    return fetchAnalysis(symbol, interval, limit);
}

/**
 * Fetch market scanner candidates across all 12 universe coins
 * GET /api/v1/analysis/scan?interval=4h&limit=720
 */
export async function fetchScanCandidates(interval = '4h', limit = 720) {
    const endpoint = `/api/v1/analysis/scan?interval=${encodeURIComponent(interval)}&limit=${limit}&_t=${Date.now()}`;

    const res = await safeJsonFetch(endpoint, { method: 'GET' });
    if (res.ok && res.data) {
        return { data: res.data, source: res.source, success: true };
    }

    return {
        data: {
            interval: "4h",
            limit: 360,
            latest_evidence_cutoff: new Date().toISOString(),
            scanned_count: UNIVERSE_COINS.length,
            available_count: UNIVERSE_COINS.length,
            actionable_count: 0,
            no_trade_count: UNIVERSE_COINS.length,
            universe: UNIVERSE_COINS,
            candidates: [],
            failures: []
        },
        source: 'OFFLINE_FALLBACK',
        success: false
    };
}

/**
 * Fetch open position for a symbol
 * GET /api/v1/positions?symbol=ETHUSDT
 */
export async function fetchPositionsApi(symbol = 'ETHUSDT') {
    const raw = (symbol || 'ETHUSDT').trim().toUpperCase();
    const cleanSymbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    const endpoint = `/api/v1/positions?symbol=${encodeURIComponent(cleanSymbol)}`;

    const res = await safeJsonFetch(endpoint, { method: 'GET' });
    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false, data: null };
}

/**
 * Fetch all open positions across the universe
 * GET /api/v1/positions/open
 */
export async function fetchOpenPositionsApi() {
    const res = await safeJsonFetch('/api/v1/positions/open');
    if (res.ok && Array.isArray(res.data)) {
        return { success: true, data: res.data };
    }
    // Targeted fallback: check priority coins without flooding server connections
    const priorityCoins = ['LINKUSDT', 'ETHUSDT', 'BTCUSDT', 'SOLUSDT'];
    const results = [];
    for (const sym of priorityCoins) {
        const r = await fetchPositionsApi(sym);
        if (r.success && r.data && r.data.id) {
            results.push(r.data);
        }
    }
    return { success: true, data: results };
}

/**
 * Create a manual open position
 * POST /api/v1/positions
 */
export async function createPositionApi(orderData) {
    const endpoint = '/api/v1/positions';
    const body = JSON.stringify({
        symbol: orderData.symbol,
        interval: orderData.interval || '4h',
        direction: orderData.direction || 'LONG',
        entryPrice: parseFloat(orderData.entry),
        quoteAmount: parseFloat(orderData.risk || 200)
    });

    const res = await safeJsonFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
    });

    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false };
}

/**
 * Close an active position
 * POST /api/v1/positions/{id}/close
 */
export async function closePositionApi(id, exitPrice, reason = 'MANUAL_CLOSE') {
    const endpoint = `/api/v1/positions/${id}/close`;
    const body = JSON.stringify({
        exitPrice: parseFloat(exitPrice),
        reason
    });

    const res = await safeJsonFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
    });

    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false };
}

/**
 * Fetch closed trade history from PostgreSQL database
 * GET /api/v1/positions/history?limit=50
 */
export async function fetchPositionHistoryApi(limit = 50) {
    const endpoint = `/api/v1/positions/history?limit=${limit}`;
    const res = await safeJsonFetch(endpoint, { method: 'GET' });
    if (res.ok && Array.isArray(res.data)) {
        return { success: true, data: res.data };
    }
    return { success: false, data: [] };
}

/**
 * Fetch Capital Account Summary API
 * GET /api/v1/account/summary
 */
export async function fetchAccountSummaryApi() {
    const res = await safeJsonFetch('/api/v1/account/summary', { method: 'GET' });
    if (res.ok && res.data) {
        return { success: true, data: res.data };
    }
    return { success: false, data: null };
}

export async function fetchCapitalTransactionsApi(limit = 50) {
    const res = await safeJsonFetch(`/api/v1/account/transactions?limit=${limit}`, { method: 'GET' });
    if (res.ok && Array.isArray(res.data)) {
        return { success: true, data: res.data };
    }
    return { success: false, data: [] };
}

/**
 * Create Capital Transaction API
 * POST /api/v1/account/transactions
 */
export async function createCapitalTransactionApi(type, amount, note) {
    const cleanType = type === 'WITHDRAWAL' ? 'WITHDRAW' : type;
    const res = await safeJsonFetch('/api/v1/account/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: cleanType, amount: parseFloat(amount), note })
    });
    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false };
}

/**
 * Format Price with dynamic decimal places:
 * - >= 1000: 2 decimals ($65,420.50)
 * - >= 1: 2 to 4 decimals ($2,450.25, $0.6756)
 * - < 1: 4 to 6 decimals ($0.008650, $0.000012)
 */
export function formatPrice(val) {
    if (val === null || val === undefined || val === '') return '-';
    const num = parseFloat(val);
    if (isNaN(num)) return String(val);
    if (num >= 1000) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (num >= 1) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    } else if (num >= 0.0001) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    } else {
        return num.toFixed(8);
    }
}

/**
 * Format timestamp to Vietnam Time (UTC+7):
 * Example: 2026-08-21 19:13
 */
export function formatVNTime(val) {
    if (!val) return '—';
    try {
        const d = (typeof val === 'string' && !val.endsWith('Z') && !val.includes('+')) 
            ? new Date(`${val}Z`) 
            : new Date(val);
        if (isNaN(d.getTime())) return String(val);

        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(d);

        const getPart = (type) => parts.find(p => p.type === type)?.value || '';
        return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}`;
    } catch (e) {
        return String(val);
    }
}

// -------------------------------------------------------------
// Human-Friendly Vietnamese Translators for Wyckoff / VPA Domain
// -------------------------------------------------------------

export function translateTrend(trend) {
    if (!trend || trend === 'UNAVAILABLE') return 'Chưa xác định';
    switch (trend.toUpperCase()) {
        case 'BULLISH': return '📈 Xu hướng Tăng (Bullish)';
        case 'BEARISH': return '📉 Xu hướng Giảm (Bearish)';
        case 'MIXED': return '↔️ Đi ngang / Hỗn hợp (Mixed)';
        case 'MIXED_BULLISH': return '↗️ Hỗn hợp nghiêng Tăng';
        case 'MIXED_BEARISH': return '↘️ Hỗn hợp nghiêng Giảm';
        case 'CONFLICTING': return '⚠️ Xung đột cấu trúc (Conflicting)';
        default: return trend;
    }
}

export function translateStructureBreak(msb) {
    if (!msb || msb === 'NO_CONFIRMED_BREAK' || msb === 'UNAVAILABLE' || msb.startsWith('NOT_DETECTED')) {
        return 'Chưa có Phá vỡ Cấu trúc (No MSB)';
    }
    if (msb.includes('UP') || msb.includes('BULLISH')) return '⚡ Phá vỡ Cấu trúc Tăng (Bullish MSB)';
    if (msb.includes('DOWN') || msb.includes('BEARISH')) return '⚡ Phá vỡ Cấu trúc Giảm (Bearish MSB)';
    return msb;
}

export function translateLocation(loc) {
    if (!loc) return 'Chưa xác định';
    switch (loc.toUpperCase()) {
        case 'AT_SUPPORT': return '🛡️ Tại Vùng Hỗ Trợ (Support)';
        case 'AT_RESISTANCE': return '🚧 Tại Vùng Kháng Cự (Resistance)';
        case 'BETWEEN_SUPPORT_AND_RESISTANCE': return '⚖️ Lưng chừng giữa Hỗ trợ & Kháng cự';
        case 'ABOVE_RESISTANCE': return '🚀 Đột phá trên Kháng cự';
        case 'BELOW_SUPPORT': return '⚠️ Thủng dưới Hỗ trợ';
        default: return loc;
    }
}

export function translateEffort(type) {
    if (!type) return 'Bình thường';
    switch (type.toUpperCase()) {
        case 'HIGH_EFFORT_LOW_RESULT':
            return 'Volume Cao nhưng Nến Nhỏ (Lực cản / Hấp thụ mạnh)';
        case 'HIGH_EFFORT_HIGH_RESULT':
            return 'Volume Cao + Nến Lớn (Đẩy giá quyết liệt)';
        case 'LOW_EFFORT_HIGH_RESULT':
            return 'Volume Thấp nhưng Nến Lớn (Cung/Cầu cạn kiệt)';
        case 'LOW_EFFORT_LOW_RESULT':
            return 'Volume Thấp + Nến Nhỏ (Thị trường trầm lắng)';
        default:
            return type;
    }
}

export function translateDecisionStatus(status) {
    if (!status) return 'Chưa rõ';
    switch (status.toUpperCase()) {
        case 'PROPOSED': return '🟢 ĐÃ CÓ SETUP HỢP LỆ';
        case 'WAITING_CONFIRMATION': return '⏳ Đang Chờ Xác Nhận Tín Hiệu';
        case 'REJECTED': return '⏸️ Tạm Dừng / Chưa Đủ Điều Kiện';
        default: return status;
    }
}

export function translateAction(action) {
    if (!action) return { text: 'CHƯA CÓ LỆNH', class: 'badge-neutral' };
    switch (action.toUpperCase()) {
        case 'BUY_READY':
            return { text: '🟢 SẴN SÀNG MUA (LONG)', class: 'badge-emerald' };
        case 'SHORT_READY':
            return { text: '🔴 SẴN SÀNG BÁN (SHORT)', class: 'badge-rose' };
        case 'NO_TRADE':
        default:
            return { text: '⏸️ QUAN SÁT (NO TRADE)', class: 'badge-neutral' };
    }
}

export function getFriendlyWyckoffTitle(policyId, direction) {
    if (policyId === 'SC_SPRING_RECOVERY_V1') return 'Wyckoff Spring Phase C — Bẫy dụ bán & gom hàng';
    if (policyId === 'SHORT_BREAK_CONTINUATION_V1') return 'Wyckoff Breakdown Phase D — Sập tiếp diễn phá hỗ trợ';
    if (policyId === 'SC_MARKDOWN_RECOVERY_V1') return 'Wyckoff Markdown Retest — Chốt lời nhịp rũ hàng';
    if (policyId === 'POST_BREAK_RETEST_V2') return 'Retest Vùng Phá Vỡ — Kiểm tra lại cản';
    if (policyId === 'RANGE_BREAK_IMPULSE_V1') return 'Phá vỡ biên Range tích lũy — Momentum nổ Volume';
    return direction === 'LONG' ? 'Setup Mua Tích Lũy Wyckoff' : 'Setup Bán Phân Phối Wyckoff';
}

export function getFriendlyVPADesc(candidate) {
    const vol = candidate?.analysis?.volume?.relative_volume || 2.0;
    const effort = candidate?.analysis?.volume?.effort_type;
    const support = candidate?.analysis?.trade_safe_support?.lower || 0.6678;
    
    if (effort === 'HIGH_EFFORT_LOW_RESULT') {
        return `"Khối lượng bán tăng cao (gấp ${vol.toFixed(2)} lần trung bình) nhưng giá không thể thủng vùng hỗ trợ $${support}. Lực bán bị cá voi hấp thụ hoàn toàn (HIGH_EFFORT_LOW_RESULT), xác nhận bẫy dụ Short và sẵn sàng cho đà tăng."`;
    }
    return `"Nguồn cung kiệt sức ở chân sóng tích lũy, khối lượng nén chặt ở vùng cản an toàn, mở ra cơ hội giao dịch với tỷ lệ R:R cao."`;
}
