import { writable, derived } from 'svelte/store';
import { fetchOpenPositionsApi } from './api.js';

/**
 * Store lưu trữ danh sách các vị thế đang mở (OPEN)
 */
export const openPositions = writable([]);

/**
 * Hàm chuẩn hóa position schema từ Backend DTO
 */
export function normalizePosition(p) {
    if (!p) return null;
    const rawRisk = parseFloat(p.quote_amount ?? p.quoteAmount ?? p.notional_amount ?? p.risk) || 200;
    let leverage = 1;
    let margin = rawRisk;

    const rawNotes = p.notes || p.userNotes;
    if (rawNotes) {
        try {
            const meta = typeof rawNotes === 'string' ? JSON.parse(rawNotes) : rawNotes;
            if (meta.leverage) leverage = Math.max(1, parseInt(meta.leverage) || 1);
            if (meta.margin) margin = parseFloat(meta.margin) || (rawRisk / leverage);
        } catch (_) {}
    } else if (p.leverage) {
        leverage = Math.max(1, parseInt(p.leverage) || 1);
        margin = parseFloat(p.margin) || (rawRisk / leverage);
    }

    const entry = parseFloat(p.entry_price ?? p.entryPrice ?? p.entry) || 0;
    const sl = parseFloat(p.protective_stop ?? p.protectiveStop ?? p.protective_stop_price ?? p.sl) || 0;
    const tp = parseFloat(p.target ?? p.target_price ?? p.tp) || 0;
    const rawId = p.rawId ?? (typeof p.id === 'number' ? p.id : (p.id ? parseInt(String(p.id).replace('pos-', '')) : null));

    return {
        ...p,
        id: p.id ? (String(p.id).startsWith('pos-') ? p.id : `pos-${p.id}`) : `pos-${Date.now()}`,
        rawId,
        symbol: p.symbol,
        direction: (p.direction || 'LONG').toUpperCase(),
        entry,
        sl,
        tp,
        stopLoss: sl,
        takeProfit: tp,
        leverage,
        margin,
        risk: margin,
        notional: margin * leverage,
        notionalAmount: margin * leverage
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
