import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDocs
} from 'firebase/firestore';

// Substitua pelos seus valores do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAMLDTyqFCQhfll1yPMxUtttgjIxCisIP4",
  authDomain: "painel-de-leads-novos.firebaseapp.com",
  projectId: "painel-de-leads-novos",
  storageBucket: "painel-de-leads-novos.firebasestorage.app",
  messagingSenderId: "630294246900",
  appId: "1:630294246900:web:764b52308c2ffa805175a1"
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const InlineRefreshIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21 12a9 9 0 10-2.4 6.04" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 3v6h-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Dashboard = ({
  leads = [],
  leadsFechados = [],
  usuarioLogado = { tipo: 'User', nome: '' },
  sessionId = null,
  sessionField = 'sessao'
}) => {
  const [loading, setLoading] = useState(true);
  const [isRefreshLoading, setIsRefreshLoading] = useState(false);
  const [leadsSessionFirestore, setLeadsSessionFirestore] = useState([]);
  const [debugMsg, setDebugMsg] = useState('');

  const possibleSessionFields = useMemo(() => {
    const base = [sessionField].filter(Boolean);
    ['sessionId','session_id','session','sessao','sessaoId','sessao_id'].forEach((f) => {
      if (!base.includes(f)) base.push(f);
    });
    return base;
  }, [sessionField]);

  const getSessionIdFromStorage = () => {
    try {
      return localStorage.getItem('sessionId') || localStorage.getItem('sessao') || null;
    } catch (e) {
      return null;
    }
  };

  const inferSessionFromLeadsProp = () => {
    try {
      if (!Array.isArray(leads) || leads.length === 0) return null;
      const freq = {};
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
      let best = null; let bestCount = 0;
      Object.entries(freq).forEach(([val, cnt]) => {
        if (cnt > bestCount) { best = val; bestCount = cnt; }
      });
      return best;
    } catch (err) {
      console.error('Erro ao inferir session from leads prop:', err);
      return null;
    }
  };

  const resolveSessionId = () => {
    if (sessionId) { setDebugMsg(`Usando sessionId via prop: ${sessionId}`); return sessionId; }
    const fromStorage = getSessionIdFromStorage();
    if (fromStorage) { setDebugMsg(`Usando sessionId via localStorage: ${fromStorage}`); return fromStorage; }
    const inferred = inferSessionFromLeadsProp();
    if (inferred) { setDebugMsg(`Usando sessionId inferido a partir da prop leads: ${inferred}`); return inferred; }
    setDebugMsg('sessionId não fornecido nem encontrado no localStorage nem inferido a partir de leads.');
    return null;
  };

  useEffect(() => {
    const sess = resolveSessionId();
    if (!sess) {
      console.warn('Dashboard: sessionId não fornecido nem encontrado. Não será feita query no Firestore.');
      setLeadsSessionFirestore([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDebugMsg(`Criando listener Firestore para sessão '${sess}' usando campo '${sessionField}'`);

    const leadsCol = collection(db, 'leads');
    const q = query(leadsCol, where(sessionField, '==', sess));
    let unsubscribeFn = null;
    try {
      unsubscribeFn = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setLeadsSessionFirestore(docs);
          setLoading(false);
          setDebugMsg(`Listener retornou ${docs.length} docs.`);
        },
        (err) => {
          console.error('Erro onSnapshot:', err);
          setDebugMsg(`Erro onSnapshot: ${String(err)}`);
          setLeadsSessionFirestore([]);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('Erro ao configurar listener:', err);
      setDebugMsg(`Erro ao configurar listener: ${String(err)}`);
      setLeadsSessionFirestore([]);
      setLoading(false);
    }

    const fallbackTimer = setTimeout(async () => {
      if (leadsSessionFirestore.length > 0) return;
      try {
        setDebugMsg('Fallback: buscando todos os docs e filtrando localmente (cuidado com coleções grandes).');
        const snap = await getDocs(leadsCol);
        const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const filtered = allDocs.filter((doc) => {
          for (const f of possibleSessionFields) {
            if (!doc) continue;
            const val = doc[f];
            if (val === undefined) continue;
            if (String(val) === String(sess)) return true;
          }
          return false;
        });
        if (filtered.length > 0) {
          setLeadsSessionFirestore(filtered);
          setLoading(false);
          setDebugMsg(`Fallback encontrou ${filtered.length} leads.`);
        } else {
          setDebugMsg('Fallback não encontrou leads para a sessão.');
        }
      } catch (err) {
        console.error('Erro no fallback getDocs:', err);
        setDebugMsg(`Erro no fallback: ${String(err)}`);
      }
    }, 1200);

    return () => {
      clearTimeout(fallbackTimer);
      if (unsubscribeFn) {
        try { unsubscribeFn(); } catch (e) { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionField, JSON.stringify(leads)]);

  const refreshLeadsFromFirestore = async () => {
    setIsRefreshLoading(true);
    setDebugMsg('Forçando refresh manual.');
    setTimeout(() => setIsRefreshLoading(false), 700);
  };

  const countFromLeadsPropBySession = (sess) => {
    try {
      if (!Array.isArray(leads) || !sess) return 0;
      const matched = leads.filter((d) => {
        for (const f of possibleSessionFields) {
          if (!d) continue;
          const val = d[f];
          if (val === undefined) continue;
          if (String(val) === String(sess)) return true;
        }
        return false;
      });
      setDebugMsg(`Fallback: contados ${matched.length} leads via prop.`);
      return matched.length;
    } catch (err) {
      console.error('Erro fallback countFromLeadsPropBySession:', err);
      return 0;
    }
  };

  const totalLeads = (() => {
    try {
      if (Array.isArray(leadsSessionFirestore) && leadsSessionFirestore.length > 0) {
        const unique = new Set(leadsSessionFirestore.map((l) => String(l.id)));
        return unique.size;
      }
      const sess = resolveSessionId();
      return countFromLeadsPropBySession(sess);
    } catch (err) {
      console.error('Erro ao calcular totalLeads:', err);
      return 0;
    }
  })();

  const leadsFechadosCount = Array.isArray(leadsFechados) ? leadsFechados.length : 0;
  const leadsPerdidos = (Array.isArray(leads) ? leads : []).filter((l) => (l.status ?? l.Status) === 'Perdido').length;
  const leadsEmContato = (Array.isArray(leads) ? leads : []).filter((l) => (l.status ?? l.Status) === 'Em Contato').length;
  const leadsSemContato = (Array.isArray(leads) ? leads : []).filter((l) => (l.status ?? l.Status) === 'Sem Contato').length;

  const boxStyle = { padding: '10px', borderRadius: '6px', flex: 1, color: '#fff', textAlign: 'center' };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={refreshLeadsFromFirestore}
          disabled={isRefreshLoading}
          style={{
            backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '6px',
            padding: '8px 12px', cursor: isRefreshLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
          title="Atualizar contadores (forçar refresh)"
        >
          {isRefreshLoading ? (
            <svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" fill="none" strokeOpacity="0.25" /></svg>
          ) : (
            <InlineRefreshIcon size={16} />
          )}
          Atualizar
        </button>

        <div style={{ marginLeft: '8px', color: '#666' }}>
          {loading ? 'Buscando leads no Firestore...' : 'Dados do Firestore carregados'}
        </div>

        <div style={{ marginLeft: '12px', color: '#888', fontSize: '12px' }}>{debugMsg}</div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ ...boxStyle, backgroundColor: '#2d3748' }}>
          <h3 style={{ margin: 0 }}>Total de Leads (sessão)</h3>
          <p style={{ fontSize: '28px', fontWeight: '700', margin: '8px 0' }}>{totalLeads}</p>
          <small style={{ opacity: 0.9 }}>Contagem baseada nos docs da coleção "leads".</small>
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
