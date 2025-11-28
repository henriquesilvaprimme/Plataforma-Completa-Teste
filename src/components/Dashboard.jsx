import React, { useEffect, useState, useMemo } from 'react';

// Firebase v9 modular SDK
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDocs
} from 'firebase/firestore';

import { RefreshCcw } from 'lucide-react';

// Substitua pelos seus valores do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAMLDTyqFCQhfll1yPMxUtttgjIxCisIP4",
  authDomain: "painel-de-leads-novos.firebaseapp.com",
  projectId: "painel-de-leads-novos",
  storageBucket: "painel-de-leads-novos.firebasestorage.app",
  messagingSenderId: "630294246900",
  appId: "1:630294246900:web:764b52308c2ffa805175a1"
};

// Inicializa o Firebase apenas se ainda não houver apps inicializados
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const Dashboard = ({
  leads = [],
  leadsFechados = [],
  usuarioLogado = { tipo: 'User', nome: '' },
  sessionId = null, // ID da sessão atual (prefira passar via prop)
  sessionField = 'sessao' // nome do campo no documento que identifica a sessão
}) => {
  const [loading, setLoading] = useState(true);
  const [isRefreshLoading, setIsRefreshLoading] = useState(false);

  // Estado que recebe os leads vindos do Firestore para a sessão atual
  const [leadsSessionFirestore, setLeadsSessionFirestore] = useState([]);
  // Mensagem de debug / status para ajudar a diagnosticar
  const [debugMsg, setDebugMsg] = useState('');

  // Lista de nomes alternativos de campo que podem armazenar a sessão no documento
  const possibleSessionFields = useMemo(() => {
    const base = [sessionField].filter(Boolean);
    [
      'sessionId',
      'session_id',
      'session',
      'sessao',
      'sessaoId',
      'sessao_id'
    ].forEach((f) => {
      if (!base.includes(f)) base.push(f);
    });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionField]);

  // Tenta obter sessionId do localStorage caso não tenha sido passado via prop
  const getSessionIdFromStorage = () => {
    try {
      return localStorage.getItem('sessionId') || localStorage.getItem('sessao') || null;
    } catch (e) {
      return null;
    }
  };

  // Tenta inferir sessionId a partir da prop `leads` (retorna o valor mais frequente encontrado em possibleSessionFields)
  const inferSessionFromLeadsProp = () => {
    try {
      if (!Array.isArray(leads) || leads.length === 0) return null;
      const freq = {}; // { value: count }
      for (const doc of leads) {
        if (!doc) continue;
        for (const f of possibleSessionFields) {
          const val = doc[f];
          if (val === undefined || val === null) continue;
          const key = String(val).trim();
          if (!key) continue;
          freq[key] = (freq[key] || 0) + 1;
        }
      }
      // pega o valor com maior contagem
      let best = null;
      let bestCount = 0;
      Object.entries(freq).forEach(([val, cnt]) => {
        if (cnt > bestCount) {
          best = val;
          bestCount = cnt;
        }
      });
      if (best) {
        console.debug('[Dashboard] Inferiu sessionId a partir da prop leads:', best, '(', bestCount, 'ocorrências )');
        return best;
      }
      return null;
    } catch (err) {
      console.error('[Dashboard] Erro ao inferir session from leads prop:', err);
      return null;
    }
  };

  // Função unificada que retorna o sessionId a ser usado (prop -> storage -> inferência)
  const resolveSessionId = () => {
    if (sessionId) {
      setDebugMsg(`Usando sessionId via prop: ${sessionId}`);
      return sessionId;
    }
    const fromStorage = getSessionIdFromStorage();
    if (fromStorage) {
      setDebugMsg(`Usando sessionId via localStorage: ${fromStorage}`);
      return fromStorage;
    }
    const inferred = inferSessionFromLeadsProp();
    if (inferred) {
      setDebugMsg(`Usando sessionId inferido a partir da prop leads: ${inferred}`);
      return inferred;
    }
    setDebugMsg('sessionId não fornecido nem encontrado no localStorage nem inferido a partir de leads.');
    return null;
  };

  // Listener Firestore: busca documentos da coleção 'leads' filtrando por campo de sessão
  useEffect(() => {
    const sess = resolveSessionId();
    if (!sess) {
      console.warn('Dashboard: sessionId não fornecido nem encontrado no localStorage/inferido. Total de Leads não será buscado do Firestore.');
      setLeadsSessionFirestore([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDebugMsg(`Criando listener Firestore para sessão '${sess}', campo padrão '${sessionField}'`);

    const leadsCol = collection(db, 'leads');
    const q = query(leadsCol, where(sessionField, '==', sess));

    let unsubscribed = false;
    let unsubscribeFn = null;

    try {
      unsubscribeFn = onSnapshot(
        q,
        (snapshot) => {
          if (unsubscribed) return;
          const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setLeadsSessionFirestore(docs);
          setLoading(false);
          setDebugMsg(`Listener ativo: ${docs.length} docs retornados pelo campo '${sessionField}'.`);
          console.debug('[Dashboard] Snapshot docs count:', docs.length);
        },
        async (err) => {
          console.error('Erro no onSnapshot (campo preferido):', err);
          setDebugMsg(`Erro no listener com campo '${sessionField}': ${String(err)}`);
          setLeadsSessionFirestore([]);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('Erro ao configurar onSnapshot (campo preferido):', err);
      setDebugMsg(`Erro ao configurar listener com campo '${sessionField}': ${String(err)}. Tentando fallback.`);
      setLeadsSessionFirestore([]);
      setLoading(false);
    }

    // Fallback: se após 1200ms não houver docs, faz getDocs e filtra localmente por possibleSessionFields
    const fallbackTimer = setTimeout(async () => {
      if (leadsSessionFirestore.length > 0) return;
      try {
        setDebugMsg('Fallback: buscando todos os docs de "leads" e filtrando localmente pela sessão (pode ser custoso).');
        const snap = await getDocs(leadsCol);
        const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const filtered = allDocs.filter((doc) => {
          for (const f of possibleSessionFields) {
            if (doc == null) continue;
            const val = doc[f];
            if (val === undefined) continue;
            if (String(val) === String(sess)) return true;
          }
          return false;
        });
        if (filtered.length > 0) {
          console.debug('[Dashboard] Fallback local encontrou docs:', filtered.length);
          setLeadsSessionFirestore(filtered);
          setLoading(false);
          setDebugMsg(`Fallback local encontrou ${filtered.length} leads (campos verificados: ${possibleSessionFields.join(', ')}).`);
        } else {
          setDebugMsg('Nenhum lead encontrado no Firestore para a sessão (tanto query por campo preferido quanto fallback local retornaram 0).');
        }
      } catch (err) {
        console.error('[Dashboard] Erro no fallback getDocs:', err);
        setDebugMsg(`Erro no fallback getDocs: ${String(err)}`);
      }
    }, 1200);

    return () => {
      unsubscribed = true;
      clearTimeout(fallbackTimer);
      if (unsubscribeFn) {
        try {
          unsubscribeFn();
        } catch (e) {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionField, JSON.stringify(leads)]); // adicionamos leads ao deps para permitir inferência ao mudar leads

  // Função para forçar "refresh" (recalcula / atualiza mensagens)
  const refreshLeadsFromFirestore = async () => {
    setIsRefreshLoading(true);
    setDebugMsg('Forçando refresh manual (recontagem).');
    setTimeout(() => {
      setIsRefreshLoading(false);
    }, 800);
  };

  // Contagem de Total de Leads: conta IDs únicos vindos do Firestore para a sessão.
  // Se não houver resultados no Firestore, usa fallback a partir da prop `leads`.
  const countFromLeadsPropBySession = (sess) => {
    try {
      if (!Array.isArray(leads) || !sess) return 0;
      const matched = leads.filter((d) => {
        for (const f of possibleSessionFields) {
          if (d == null) continue;
          const val = d[f];
          if (val === undefined) continue;
          if (String(val) === String(sess)) return true;
        }
        return false;
      });
      console.debug('[Dashboard] Fallback counting from leads prop, found:', matched.length);
      setDebugMsg(`Fallback: contados ${matched.length} leads a partir de prop 'leads' (campos verificados: ${possibleSessionFields.join(', ')})`);
      return matched.length;
    } catch (err) {
      console.error('[Dashboard] Erro fallback countFromLeadsPropBySession:', err);
      return 0;
    }
  };

  const totalLeads = (() => {
    try {
      if (Array.isArray(leadsSessionFirestore) && leadsSessionFirestore.length > 0) {
        const uniqueIds = new Set(leadsSessionFirestore.map((l) => String(l.id)));
        return uniqueIds.size;
      }
      const sess = resolveSessionId();
      const fallbackCount = countFromLeadsPropBySession(sess);
      return fallbackCount;
    } catch (err) {
      console.error('Erro ao calcular totalLeads:', err);
      return 0;
    }
  })();

  // Mantive os demais contadores originais baseados em props para compatibilidade.
  const leadsFechadosCount = Array.isArray(leadsFechados) ? leadsFechados.length : 0;
  const leadsPerdidos = (Array.isArray(leads) ? leads : []).filter((l) => (l.status ?? l.Status) === 'Perdido').length;
  const leadsEmContato = (Array.isArray(leads) ? leads : []).filter((l) => (l.status ?? l.Status) === 'Em Contato').length;
  const leadsSemContato = (Array.isArray(leads) ? leads : []).filter((l) => (l.status ?? l.Status) === 'Sem Contato').length;

  const boxStyle = {
    padding: '10px',
    borderRadius: '6px',
    flex: 1,
    color: '#fff',
    textAlign: 'center'
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={refreshLeadsFromFirestore}
          disabled={isRefreshLoading}
          style={{
            backgroundColor: '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: isRefreshLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          title="Atualizar contadores (forçar refresh)"
        >
          {isRefreshLoading ? (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" fill="none" strokeOpacity="0.25" />
            </svg>
          ) : (
            <RefreshCcw size={16} />
          )}
          Atualizar
        </button>

        <div style={{ marginLeft: '8px', color: '#666' }}>
          {loading ? 'Buscando leads no Firestore...' : 'Dados do Firestore carregados'}
        </div>
        <div style={{ marginLeft: '12px', color: '#888', fontSize: '12px' }}>
          {debugMsg}
        </div>
      </div>

      {/* Linha principal de contadores */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ ...boxStyle, backgroundColor: '#2d3748' }}>
          <h3 style={{ margin: 0 }}>Total de Leads (sessão)</h3>
          <p style={{ fontSize: '28px', fontWeight: '700', margin: '8px 0' }}>{totalLeads}</p>
          <small style={{ opacity: 0.9 }}>Contagem baseada nos documentos da coleção "leads" filtrados pela sessão.</small>
        </div>

        <div style={{ ...boxStyle, backgroundColor: '#4caf50' }}>
          <h3 style={{ margin: 0 }}>Vendas (fechados)</h3>
          <p style={{ fontSize: '28px', fontWeight: '700', margin: '8px 0' }}>{leadsFechadosCount}</p>
        </div>

        <div style={{ ...boxStyle, backgroundColor: '#f44336' }}>
          <h3 style={{ margin: 0 }}>Leads Perdidos</h3>
          <p style={{ fontSize: '28px', fontWeight: '700', margin: '8px 0' }}>{leadsPerdidos}</p>
        </div>

        <div style={{ ...boxStyle, backgroundColor: '#ff9800' }}>
          <h3 style={{ margin: 0 }}>Em Contato</h3>
          <p style={{ fontSize: '28px', fontWeight: '700', margin: '8px 0' }}>{leadsEmContato}</p>
        </div>

        <div style={{ ...boxStyle, backgroundColor: '#9e9e9e' }}>
          <h3 style={{ margin: 0 }}>Sem Contato</h3>
          <p style={{ fontSize: '28px', fontWeight: '700', margin: '8px 0' }}>{leadsSemContato}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
