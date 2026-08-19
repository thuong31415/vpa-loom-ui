export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const REMOTE_API_HOST = 'http://103.167.88.197:8081';

// Supported Universe Coins
export const UNIVERSE_COINS = [
    "ETHUSDT", "BTCUSDT", "SOLUSDT", "SUIUSDT", "UNIUSDT",
    "LINKUSDT", "ZECUSDT", "LDOUSDT", "NEARUSDT", "BNBUSDT", "TAOUSDT", "ADAUSDT"
];

/**
 * Robust JSON Fetcher:
 * 1. Tries relative path (Vite / Nginx proxy).
 * 2. If proxy returns HTML / 404 / fails, falls back directly to REMOTE_API_HOST (http://103.167.88.197:8081).
 * 3. Always validates Content-Type is JSON before parsing to prevent "Unexpected token '<'".
 */
async function safeJsonFetch(endpoint, options = {}) {
    const defaultHeaders = {
        'Accept': 'application/json',
        ...(options.headers || {})
    };

    // 1. Try relative path first (through reverse proxy)
    const relativeUrl = `${BASE_URL}${endpoint}`;
    try {
        const response = await fetch(relativeUrl, { ...options, headers: defaultHeaders });
        if (response.status === 204 || response.status === 205) {
            return { ok: true, data: null, status: response.status, source: 'PROXY' };
        }
        const text = await response.text();
        if (!text || text.trim() === '') {
            return { ok: response.ok, data: null, status: response.status, source: 'PROXY' };
        }
        if (response.ok && (text.startsWith('{') || text.startsWith('['))) {
            return { ok: true, data: JSON.parse(text), status: response.status, source: 'PROXY' };
        }
    } catch (err) {
        console.warn(`Relative proxy fetch failed for ${endpoint}:`, err);
    }

    // 2. Direct fallback to remote host if relative path fails
    if (REMOTE_API_HOST) {
        try {
            const directUrl = `${REMOTE_API_HOST}${endpoint}`;
            const response = await fetch(directUrl, { ...options, headers: defaultHeaders });
            if (response.status === 204 || response.status === 205) {
                return { ok: true, data: null, status: response.status, source: 'DIRECT' };
            }
            const text = await response.text();
            if (!text || text.trim() === '') {
                return { ok: response.ok, data: null, status: response.status, source: 'DIRECT' };
            }
            if (response.ok && (text.startsWith('{') || text.startsWith('['))) {
                return { ok: true, data: JSON.parse(text), status: response.status, source: 'DIRECT' };
            }
        } catch (err) {
            console.warn(`Direct fetch failed for ${endpoint}:`, err);
        }
    }

    return { ok: false, error: 'Không thể tải dữ liệu JSON từ API Backend' };
}

/**
 * Fetch detailed analysis for a single symbol (e.g., ETH, BTC, SOL)
 * GET /api/v1/analysis?symbol=ETHUSDT&interval=4h&limit=500
 */
export async function fetchAnalysis(symbol = 'ETHUSDT', interval = '4h', limit = 360) {
    const raw = (symbol || 'ETHUSDT').trim().toUpperCase();
    const cleanSymbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    const endpoint = `/api/v1/analysis?symbol=${encodeURIComponent(cleanSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

    const res = await safeJsonFetch(endpoint, { method: 'GET' });
    if (res.ok) {
        return { success: true, data: res.data, source: res.source };
    }
    return { success: false, error: res.error || 'Lỗi kết nối API phân tích' };
}

/**
 * Hydrate and resolve analysis for a single symbol
 * POST /api/v1/analysis?symbol=ETHUSDT&interval=4h&limit=360
 */
export async function resolveAnalysis(symbol = 'ETHUSDT', interval = '4h', limit = 360) {
    const raw = (symbol || 'ETHUSDT').trim().toUpperCase();
    const cleanSymbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    const endpoint = `/api/v1/analysis?symbol=${encodeURIComponent(cleanSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

    const res = await safeJsonFetch(endpoint, { method: 'POST' });
    if (res.ok) {
        return { success: true, data: res.data, source: res.source };
    }
    return fetchAnalysis(cleanSymbol, interval, limit);
}

/**
 * Fetch market scanner candidates across all 12 universe coins
 * POST /api/v1/analysis/scan?interval=4h&limit=360
 */
export async function fetchScanCandidates(interval = '4h', limit = 360) {
    const endpoint = `/api/v1/analysis/scan?interval=${encodeURIComponent(interval)}&limit=${limit}`;

    let res = await safeJsonFetch(endpoint, { method: 'POST' });
    if (!res.ok) {
        res = await safeJsonFetch(endpoint, { method: 'GET' });
    }

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
 * Account Summary API
 * GET /api/v1/account/summary
 */
export async function fetchAccountSummaryApi() {
    const res = await safeJsonFetch('/api/v1/account/summary', { method: 'GET' });
    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false };
}

/**
 * Account Transactions API
 * GET /api/v1/account/transactions
 */
export async function fetchCapitalTransactionsApi() {
    const res = await safeJsonFetch('/api/v1/account/transactions', { method: 'GET' });
    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false, data: [] };
}

/**
 * Create Capital Transaction API
 * POST /api/v1/account/transactions
 */
export async function createCapitalTransactionApi(type, amount, note) {
    const res = await safeJsonFetch('/api/v1/account/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount: parseFloat(amount), note })
    });
    if (res.ok) {
        return { success: true, data: res.data };
    }
    return { success: false };
}

// -------------------------------------------------------------
// Human-Friendly Vietnamese Translators for Wyckoff / VPA Domain
// -------------------------------------------------------------

export function translateTrend(trend) {
    if (!trend) return 'Chưa xác định';
    switch (trend.toUpperCase()) {
        case 'BULLISH': return '📈 Xu hướng Tăng (Bullish)';
        case 'BEARISH': return '📉 Xu hướng Giảm (Bearish)';
        case 'MIXED': return '↔️ Đi ngang / Hỗn hợp (Mixed)';
        case 'MIXED_BULLISH': return '↗️ Hỗn hợp nghiêng Tăng';
        case 'MIXED_BEARISH': return '↘️ Hỗn hợp nghiêng Giảm';
        default: return trend;
    }
}

export function translateStructureBreak(msb) {
    if (!msb || msb === 'NO_CONFIRMED_BREAK' || msb.startsWith('NOT_DETECTED')) {
        return 'Chưa có Phá vỡ Cấu trúc (No MSB)';
    }
    if (msb.includes('BULLISH')) return '⚡ Phá vỡ Cấu trúc Tăng (Bullish MSB)';
    if (msb.includes('BEARISH')) return '⚡ Phá vỡ Cấu trúc Giảm (Bearish MSB)';
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
