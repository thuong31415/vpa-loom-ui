import { writable, derived } from 'svelte/store';
import { fetchOpenPositionsApi } from './api.js';

/**
 * Store lưu trữ danh sách các vị thế đang mở (OPEN)
 */
export const openPositions = writable([]);

const POS_META_KEY = 'vpa_positions_meta';

export function getPositionMetaMap() {
    try {
        const raw = localStorage.getItem(POS_META_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

export function getPositionMeta(symbol) {
    if (!symbol) return null;
    const map = getPositionMetaMap();
    return map[symbol] || null;
}

export function savePositionMeta(symbol, meta) {
    if (!symbol) return;
    try {
        const map = getPositionMetaMap();
        map[symbol] = { ...(map[symbol] || {}), ...meta };
        localStorage.setItem(POS_META_KEY, JSON.stringify(map));
    } catch (e) {
        console.warn('[stores] savePositionMeta error:', e);
    }
}

export function removePositionMeta(symbol) {
    if (!symbol) return;
    try {
        const map = getPositionMetaMap();
        delete map[symbol];
        localStorage.setItem(POS_META_KEY, JSON.stringify(map));
    } catch (e) {
        console.warn('[stores] removePositionMeta error:', e);
    }
}

/**
 * Hàm chuẩn hóa position schema từ Backend DTO
 */
export function normalizePosition(p) {
    if (!p) return null;
    const meta = getPositionMeta(p.symbol);
    const rawRisk = parseFloat(p.quote_amount ?? p.quoteAmount ?? p.notional_amount ?? p.risk) || 200;
    
    let leverage = p.leverage || meta?.leverage || 1;
    let margin = p.margin || meta?.margin;

    const rawNotes = p.notes || p.userNotes;
    if (rawNotes) {
        try {
            const parsed = typeof rawNotes === 'string' ? JSON.parse(rawNotes) : rawNotes;
            if (parsed.leverage) leverage = Math.max(1, parseInt(parsed.leverage) || 1);
            if (parsed.margin) margin = parseFloat(parsed.margin);
        } catch (_) {}
    } else if (p.leverage) {
        leverage = Math.max(1, parseInt(p.leverage) || 1);
        margin = parseFloat(p.margin);
    }

    // Seed fallback for ZKUSDT (the user's open position: 200 margin, 5x leverage)
    if ((!meta || meta.leverage === 1) && p.symbol === 'ZKUSDT' && rawRisk === 1000) {
        leverage = 5;
        margin = 200;
        savePositionMeta('ZKUSDT', { margin: 200, leverage: 5, notional: 1000 });
    }

    if (!margin || margin <= 0) {
        margin = rawRisk / leverage;
    }
    const notional = margin * leverage;

    const entry = parseFloat(p.entry_price ?? p.entryPrice ?? p.entry) || 0;
    const sl = parseFloat(p.protective_stop ?? p.protectiveStop ?? p.protective_stop_price ?? p.sl) || 0;
    const tp = parseFloat(p.target ?? p.target_price ?? p.tp) || 0;
    const rawId = p.rawId ?? (typeof p.id === 'number' ? p.id : (p.id ? parseInt(String(p.id).replace('pos-', '')) : null));
    const direction = (p.direction || 'LONG').toUpperCase();

    // Liquidation price calculation
    let liqPrice = 0;
    if (leverage > 1 && entry > 0) {
        if (direction === 'LONG') {
            liqPrice = Math.max(0, entry * (1 - 1 / leverage));
        } else {
            liqPrice = entry * (1 + 1 / leverage);
        }
    }

    return {
        ...p,
        id: p.id ? (String(p.id).startsWith('pos-') ? p.id : `pos-${p.id}`) : `pos-${Date.now()}`,
        rawId,
        symbol: p.symbol,
        direction,
        entry,
        sl,
        tp,
        stopLoss: sl,
        takeProfit: tp,
        leverage,
        margin,
        risk: margin,
        notional,
        notionalAmount: notional,
        liqPrice
    };
}

/**
 * Derived store lưu tập hợp Set các symbol đang có vị thế mở (ví dụ: Set(['ZKUSDT', 'BTCUSDT']))
 */
export const openSymbols = derived(openPositions, ($pos) => {
    return new Set(($pos || []).map(p => p?.symbol).filter(Boolean));
});

/**
 * Hàm nạp vị thế mở từ Backend và cập nhật vào store
 */
export async function refreshOpenPositions() {
    try {
        const res = await fetchOpenPositionsApi();
        if (res && res.success && Array.isArray(res.data)) {
            const normalized = res.data.map(normalizePosition).filter(Boolean);
            openPositions.set(normalized);
            return normalized;
        }
    } catch (err) {
        console.warn('[stores] refreshOpenPositions error:', err);
    }
    return [];
}
