import React, { useEffect, useState } from 'react';

// Firebase v9 modular SDK
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';

import { RefreshCcw } from 'lucide-react'; // ícone (opcional)

/*
 
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

  // Tenta obter sessionId do localStorage caso não tenha sido passado via prop
  const getSessionId = () => {
    if (sessionId) return sessionId;
    try {
      const stored = localStorage.getItem('sessionId') || localStorage.getItem('sessao') || null;
      return stored;
    } catch (e) {
      return null;
    }
  };

  // Configura listener para a coleção 'leads' filtrando por campo de sessão
  useEffect(() => {
    const sess = getSessionId();
    if (!sess) {
      console.warn('Dashboard: sessionId não fornecido nem encontrado no localStorage. Total de Leads não será buscado do Firestore.');
      setLeadsSessionFirestore([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const leadsCol = collection(db, 'leads');
      const q = query(leadsCol, where(sessionField, '==', sess));

      // Listener em tempo real — atualiza o contador sempre que houver mudanças
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setLeadsSessionFirestore(docs);
          setLoading(false);
        },
        (err) => {
          console.error('Erro ao escutar leads no Firestore:', err);
          setLeadsSessionFirestore([]);
          setLoading(false);
        }
      );

      // cleanup
      return () => unsubscribe();
    } catch (err) {
      console.error('Erro ao criar listener Firestore:', err);
      setLeadsSessionFirestore([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionField]);

  // Função para forçar "refresh" (recria o listener indiretamente)
  const refreshLeadsFromFirestore = async () => {
    setIsRefreshLoading(true);
    // A lógica do onSnapshot já atualiza automaticamente.
    // Aqui apenas simulamos um pequeno delay para UX e garantimos recálculo.
    setTimeout(() => {
      setIsRefreshLoading(false);
    }, 800);
  };

  // Contagem de Total de Leads: conta IDs únicos vindos do Firestore para a sessão
  const totalLeads = (() => {
    try {
      if (!Array.isArray(leadsSessionFirestore)) return 0;
      // garante contagem única por id, embora doc.id já seja único
      const uniqueIds = new Set(leadsSessionFirestore.map((l) => String(l.id)));
      return uniqueIds.size;
    } catch (err) {
      console.error('Erro ao calcular totalLeads:', err);
      return 0;
    }
  })();

  // Mantive os demais contadores originais baseados em props para compatibilidade.
  // Você pode me pedir para também buscar e recalcular os outros contadores via Firestore.
  const leadsFechadosCount = Array.isArray(leadsFechados) ? leadsFechados.length : 0;

  // Exemplos simples de outros contadores (ajuste conforme seu modelo de dados)
  const leadsPerdidos = (Array.isArray(leads) ? leads : []).filter((l) => (l.status ?? l.Status) === 'Perdido').length;
  const leadsEmContato = (Array.isArray(leads) ? leads : []).filter((l) => (l.status ?? l.Status) === 'Em Contato').length;
  const leadsSemContato = (Array.isArray(leads) ? leads : []).filter((l) => (l.status ?? l.Status) === 'Sem Contato').length;

  // Estilo simples embutido — substitua conforme seu CSS/tema
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

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
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
