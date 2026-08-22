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
        case 'BULLISH': return '📈 Xu hướng Tăng';
        case 'BEARISH': return '📉 Xu hướng Giảm';
        case 'MIXED': return '↔️ Đi ngang / Hỗn hợp';
        case 'MIXED_BULLISH': return '↗️ Hỗn hợp nghiêng Tăng';
        case 'MIXED_BEARISH': return '↘️ Hỗn hợp nghiêng Giảm';
        case 'CONFLICTING': return '⚠️ Xung đột đa khung';
        default: return trend;
    }
}

export function translateStructureBreak(msb) {
    if (!msb || msb === 'NO_CONFIRMED_BREAK' || msb === 'UNAVAILABLE' || msb.startsWith('NOT_DETECTED')) {
        return 'Chưa có Phá vỡ Cấu trúc';
    }
    if (msb.includes('UP') || msb.includes('BULLISH')) return '⚡ Phá vỡ Cấu trúc Tăng';
    if (msb.includes('DOWN') || msb.includes('BEARISH')) return '⚡ Phá vỡ Cấu trúc Giảm';
    return msb;
}

export function translateLocation(loc) {
    if (!loc) return 'Chưa xác định';
    switch (loc.toUpperCase()) {
        case 'AT_SUPPORT': return '🛡️ Tại Vùng Hỗ Trợ';
        case 'AT_RESISTANCE': return '🚧 Tại Vùng Kháng Cự';
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
            return 'Cá mập hấp thụ (Bẫy thanh khoản)';
        case 'HIGH_EFFORT_HIGH_RESULT':
            return 'Dòng tiền bùng nổ (Đẩy giá mạnh)';
        case 'LOW_EFFORT_HIGH_RESULT':
            return 'Cạn kiệt cản (Giá bay nhẹ)';
        case 'LOW_EFFORT_LOW_RESULT':
            return 'Thị trường cạn cung (Tích lũy)';
        default:
            return type;
    }
}

export function getFriendlyVPAStatus(effortResult) {
    if (!effortResult) {
        return {
            headline: 'Thanh khoản bình thường',
            detail: 'Volume ổn định quanh trung bình',
            badgeClass: 'text-secondary'
        };
    }
    const type = (effortResult.type || '').toUpperCase();
    const vol = effortResult.relative_volume || 1.0;
    const spread = effortResult.spread_atr || 1.0;
    const isCandidate = effortResult.status === 'CANDIDATE';
    const candleState = isCandidate ? '(Đang chạy)' : '(Đã đóng)';

    switch (type) {
        case 'HIGH_EFFORT_HIGH_RESULT':
            return {
                headline: '💥 Dòng tiền bùng nổ',
                detail: `Vol ${vol.toFixed(1)}x · Nến ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-emerald'
            };
        case 'HIGH_EFFORT_LOW_RESULT':
            return {
                headline: '🧲 Cá mập hấp thụ',
                detail: `Vol ${vol.toFixed(1)}x · Nến nén ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-amber'
            };
        case 'LOW_EFFORT_HIGH_RESULT':
            return {
                headline: '🚀 Giá lướt nhẹ cạn cản',
                detail: `Vol ${vol.toFixed(1)}x · Nến ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-emerald'
            };
        case 'LOW_EFFORT_LOW_RESULT':
            return {
                headline: '💤 Thị trường cạn cung',
                detail: `Vol ${vol.toFixed(1)}x · Nến nén ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-secondary'
            };
        default:
            return {
                headline: `Thanh khoản ${vol.toFixed(1)}x trung bình`,
                detail: `Biên độ ${spread.toFixed(1)} ATR ${candleState}`,
                badgeClass: 'text-secondary'
            };
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

export function getFriendlyWyckoffTitle(policyId, direction = 'LONG') {
    if (!policyId) return direction === 'LONG' ? 'Setup Mua Tích Lũy Wyckoff' : 'Setup Bán Phân Phối Wyckoff';
    
    switch (policyId.toUpperCase()) {
        case 'WYCKOFF_CLIMAX_BASE_ACCUMULATION_V1':
            return 'Wyckoff Schematic 2: Climax Base — Gom Hàng Đáy Cạn Cung (Springless)';
        case 'SC_SPRING_RECOVERY_V1':
        case 'SC_MARGINAL_SPRING_RECOVERY_V1':
            return 'Wyckoff Spring Phase C — Bẫy Rũ Bỏ & Gom Hàng (Spring Recovery)';
        case 'SC_SECONDARY_TEST_ABSORPTION_V1':
            return 'Wyckoff Secondary Test Phase B — Hấp Thụ Cung Đáy (ST Absorption)';
        case 'SC_TERMINAL_ABSORPTION_REVERSAL_V1':
            return 'Wyckoff Terminal Absorption — Đảo Chiều Hấp Thụ Cực Đại';
        case 'SC_MARKUP_RECOVERY_V2':
            return 'Wyckoff Markup Role Flip — Xác Nhận Đổi Vai Hỗ Trợ';
        case 'SC_MARKDOWN_RECOVERY_V1':
            return 'Wyckoff Markdown Retest — Chốt Lời Nhịp Rũ Hàng';
        case 'SHORT_BREAK_CONTINUATION_V1':
            return 'Wyckoff Breakdown Phase D — Sập Tiếp Diễn Phá Hỗ Trợ';
        case 'POST_BREAK_RETEST_V2':
            return 'Retest Vùng Phá Vỡ — Kiểm Tra Lại Cản (Post-Break Retest)';
        case 'POST_BREAK_LOW_SUPPLY_ACCEPTANCE_V1':
            return 'Wyckoff Post-Break Low Supply — Chấp Nhận Giá Cạn Cung';
        case 'RANGE_BREAK_IMPULSE_V1':
            return 'Phá Vỡ Biên Range Tích Lũy — Xung Lực Bùng Nổ Volume (RBI)';
        case 'RANGE_BREAK_CONTINUATION_V1':
            return 'Phá Vỡ Biên Range Tiếp Diễn — Mở Rộng Biên Độ Sóng';
        case 'DIRECTIONAL_OPEN_SURFACE_V1':
        case 'DIRECTIONAL_OPEN_SURFACE_ACCEPTANCE_V1':
            return 'Directional Open Surface — Bứt Phá Không Gian Mở (Khám Phá Giá)';
        case 'MICRO_SPRING_UPTHRUST_V1':
            return 'Micro Spring / Upthrust — Bẫy Thanh Khoản Khung Nhỏ';
        default:
            return direction === 'LONG' ? `Setup Mua Wyckoff (${policyId})` : `Setup Bán Wyckoff (${policyId})`;
    }
}

export function getFriendlyVPADesc(candidate) {
    const vol = candidate?.analysis?.market_state?.effort_result?.relative_volume 
        || candidate?.analysis?.volume?.relative_volume 
        || 1.5;
    const effort = candidate?.analysis?.market_state?.effort_result?.type 
        || candidate?.analysis?.volume?.effort_type;
    const support = candidate?.analysis?.key_levels?.support?.lower 
        || candidate?.analysis?.trade_safe_support?.lower 
        || 0;
    const resistance = candidate?.analysis?.key_levels?.resistance?.upper 
        || candidate?.analysis?.trade_safe_resistance?.upper 
        || 0;
    
    if (effort === 'HIGH_EFFORT_LOW_RESULT') {
        return `"Khối lượng giao dịch tăng cao (gấp ${vol.toFixed(2)}x SMA20) nhưng biên độ nến bị nén chặt. Lực đối ứng bị cá mập hấp thụ hoàn toàn (HIGH_EFFORT_LOW_RESULT), xác nhận bẫy thanh khoản và sẵn sàng cho nhịp đảo chiều."`;
    }
    if (effort === 'HIGH_EFFORT_HIGH_RESULT') {
        return `"Khối lượng bùng nổ (gấp ${vol.toFixed(2)}x SMA20) đồng pha với thân nến mở rộng quyết liệt (HIGH_EFFORT_HIGH_RESULT). Dòng tiền lớn tham gia xác nhận xu hướng bứt phá."`;
    }
    if (effort === 'LOW_EFFORT_HIGH_RESULT') {
        return `"Nguồn cung/cầu đối nghịch cạn kiệt hoàn toàn, giá di chuyển thanh thoát mà không cần nhiều khối lượng (LOW_EFFORT_HIGH_RESULT / Ease of Movement)."`;
    }
    return `"Cấu trúc nén chặt tại vùng cản trọng yếu ($${support ? formatPrice(support) : 'Support'} - $${resistance ? formatPrice(resistance) : 'Resistance'}), khối lượng kiểm định đạt chuẩn VPA, mở ra cơ hội giao dịch với tỷ lệ R:R tối ưu."`;
}
