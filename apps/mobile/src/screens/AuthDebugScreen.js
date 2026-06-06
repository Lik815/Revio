import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl, TUNNEL_HEADERS } from '../mobile-utils';

const AUTH_TOKEN_KEY = 'revio_auth_token';
const AUTH_ACCOUNT_TYPE_KEY = 'revio_account_type';
const STORE_PERSIST_KEY = 'revio-mobile-store';

function ts() {
  return new Date().toISOString().slice(11, 23);
}

function truncate(str, n = 40) {
  if (!str || typeof str !== 'string') return String(str ?? 'null');
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export function AuthDebugScreen({ visible, onClose, authContext, c }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);

  const appendLog = useCallback((label, value, ok = null) => {
    setLog((prev) => [...prev, { time: ts(), label, value, ok }]);
  }, []);

  const runDiagnostic = useCallback(async () => {
    setLog([]);
    setLoading(true);

    // 1. AuthContext snapshot
    appendLog('bootReady', String(authContext?.bootReady), authContext?.bootReady);
    appendLog('authToken (ctx)', truncate(authContext?.authToken ?? null), Boolean(authContext?.authToken));
    appendLog('accountType (ctx)', authContext?.accountType ?? 'null');
    appendLog('loggedInPatient', authContext?.loggedInPatient ? `id=${authContext.loggedInPatient.id}` : 'null', Boolean(authContext?.loggedInPatient));
    appendLog('loggedInTherapist', authContext?.loggedInTherapist ? `id=${authContext.loggedInTherapist.id}` : 'null', Boolean(authContext?.loggedInTherapist));

    // 2. AsyncStorage raw keys
    try {
      const entries = await AsyncStorage.multiGet([AUTH_TOKEN_KEY, AUTH_ACCOUNT_TYPE_KEY, STORE_PERSIST_KEY]);
      const map = Object.fromEntries(entries);

      const rawToken = map[AUTH_TOKEN_KEY];
      const rawType = map[AUTH_ACCOUNT_TYPE_KEY];
      const rawStore = map[STORE_PERSIST_KEY];

      appendLog('AS: revio_auth_token', truncate(rawToken), Boolean(rawToken));
      appendLog('AS: revio_account_type', rawType ?? 'null', Boolean(rawType));

      if (rawStore) {
        try {
          const parsed = JSON.parse(rawStore);
          const state = parsed?.state ?? parsed;
          appendLog('AS: store.authToken', truncate(state?.authToken), Boolean(state?.authToken));
          appendLog('AS: store.accountType', state?.accountType ?? 'null', Boolean(state?.accountType));
        } catch {
          appendLog('AS: revio-mobile-store', 'JSON parse error', false);
        }
      } else {
        appendLog('AS: revio-mobile-store', 'nicht vorhanden', false);
      }

      // 3. /auth/me call
      const token = rawToken || (() => {
        try {
          const s = JSON.parse(rawStore)?.state ?? JSON.parse(rawStore);
          return s?.authToken ?? null;
        } catch { return null; }
      })() || authContext?.authToken;

      if (!token) {
        appendLog('/auth/me', 'kein Token — kein Request', null);
      } else {
        try {
          const t0 = Date.now();
          const res = await fetch(`${getBaseUrl()}/auth/me`, {
            headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${token}` },
          });
          const elapsed = Date.now() - t0;
          const body = await res.json().catch(() => null);
          appendLog(`/auth/me status (${elapsed}ms)`, String(res.status), res.ok);
          if (body) {
            appendLog('/auth/me role', body.role ?? 'kein role-Feld', res.ok);
            appendLog('/auth/me id', String(body.id ?? '—'), res.ok);
          }
        } catch (err) {
          appendLog('/auth/me Netzwerkfehler', err?.message ?? 'unbekannt', false);
        }
      }
    } catch (err) {
      appendLog('AsyncStorage Fehler', err?.message ?? 'unbekannt', false);
    }

    setLoading(false);
  }, [authContext, appendLog]);

  const clearStorage = useCallback(async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_ACCOUNT_TYPE_KEY, STORE_PERSIST_KEY]);
    appendLog('Storage geleert', 'alle 3 Keys entfernt', null);
  }, [appendLog]);

  const bg = c?.background ?? '#fff';
  const text = c?.text ?? '#000';
  const muted = c?.muted ?? '#888';
  const card = c?.card ?? '#f0f0f0';
  const primary = c?.primary ?? '#5b5bd6';
  const border = c?.border ?? '#e0e0e0';
  const success = c?.success ?? '#22c55e';
  const error = c?.error ?? '#ef4444';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: border }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: text }}>Auth Debug</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ fontSize: 15, color: primary, fontWeight: '600' }}>Schliessen</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, padding: 12 }}>
          <Pressable
            onPress={runDiagnostic}
            disabled={loading}
            style={{ flex: 1, backgroundColor: primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Diagnose starten</Text>}
          </Pressable>
          <Pressable
            onPress={clearStorage}
            style={{ flex: 1, backgroundColor: error + '22', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: error }}
          >
            <Text style={{ color: error, fontWeight: '600', fontSize: 14 }}>Storage leeren</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}>
          {log.length === 0 && !loading && (
            <Text style={{ color: muted, fontSize: 13, textAlign: 'center', marginTop: 40 }}>
              Diagnose starten um Auth-Status zu sehen
            </Text>
          )}
          {log.map((entry, i) => (
            <View
              key={i}
              style={{
                backgroundColor: card,
                borderRadius: 8,
                padding: 10,
                marginBottom: 6,
                borderLeftWidth: 3,
                borderLeftColor: entry.ok === true ? success : entry.ok === false ? error : border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 11, color: muted, fontFamily: 'monospace' }}>{entry.time}</Text>
                {entry.ok === true && <Text style={{ fontSize: 11, color: success, fontWeight: '700' }}>OK</Text>}
                {entry.ok === false && <Text style={{ fontSize: 11, color: error, fontWeight: '700' }}>FEHLER</Text>}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: text }}>{entry.label}</Text>
              <Text style={{ fontSize: 12, color: muted, fontFamily: 'monospace', marginTop: 2 }}>{entry.value}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
