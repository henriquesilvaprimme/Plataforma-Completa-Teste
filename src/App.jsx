import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from './firebase'; // Importe a instância do Firestore

import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Leads from './Leads';
import LeadsFechados from './LeadsFechados';
import LeadsPerdidos from './LeadsPerdidos';
import BuscarLead from './BuscarLead';
import CriarUsuario from './pages/CriarUsuario';
import GerenciarUsuarios from './pages/GerenciarUsuarios';
import Ranking from './pages/Ranking';
import CriarLead from './pages/CriarLead';
import Renovacoes from './Renovacoes';
import Renovados from './Renovados';
import Segurados from './pages/Segurados';

function ScrollToTop({ scrollContainerRef }) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [pathname, scrollContainerRef]);

  return null;
}

// ======= CONFIGURAÇÃO DE SINCRONIZAÇÃO LOCAL (mantida, mas adaptada para Firebase) =======
const LOCAL_CHANGES_KEY = 'leads_local_changes_v1';
const SYNC_DELAY_MS = 5 * 60 * 1000; // 5 minutos
const SYNC_CHECK_INTERVAL_MS = 1000; // checa a cada 1s
// =========================================================================================

function App() {
  const navigate = useNavigate();
  const mainContentRef = useRef(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);

  const [leads, setLeads] = useState([]);
  const [leadsFechados, setLeadsFechados] = useState([]);
  const [leadSelecionado, setLeadSelecionado] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [leadsCount, setLeadsCount] = useState(0);
  const [ultimoFechadoId, setUltimoFechadoId] = useState(null);

  const localChangesRef = useRef({});

  useEffect(() => {
    const img = new Image();
    img.src = '/background.png';
    img.onload = () => setBackgroundLoaded(true);
  }, []);

  // ------------------ Helpers de localChanges ------------------
  const loadLocalChangesFromStorage = () => {
    try {
      const raw = localStorage.getItem(LOCAL_CHANGES_KEY);
      if (raw) {
        localChangesRef.current = JSON.parse(raw);
      } else {
        localChangesRef.current = {};
      }
    } catch (err) {
      console.error('Erro ao carregar localChanges:', err);
      localChangesRef.current = {};
    }
  };

  const persistLocalChangesToStorage = () => {
    try {
      localStorage.setItem(LOCAL_CHANGES_KEY, JSON.stringify(localChangesRef.current));
    } catch (err) {
      console.error('Erro ao salvar localChanges:', err);
    }
  };

  const saveLocalChange = (change) => {
    const key = String(change.id ?? (change.data && change.data.id) ?? crypto.randomUUID());
    const timestamp = Date.now();
    localChangesRef.current[key] = { ...change, timestamp, id: key };
    persistLocalChangesToStorage();
  };

  // ------------------ FETCH USUÁRIOS (Firebase) ------------------
  const fetchUsuariosForLogin = async () => {
    try {
      const usuariosCol = collection(db, 'usuarios');
      const usuarioSnapshot = await getDocs(usuariosCol);
      const usuarioList = usuarioSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (Array.isArray(usuarioList)) {
        setUsuarios(usuarioList.map(item => ({
          id: item.id || '',
          usuario: item.usuario || '',
          nome: item.nome || '',
          email: item.email || '',
          senha: item.senha || '',
          status: item.status || 'Ativo',
          tipo: item.tipo || 'Usuario',
        })));
      } else {
        setUsuarios([]);
        console.warn('Resposta inesperada ao buscar usuários para login:', usuarioList);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários para login:', error);
      setUsuarios([]);
    }
  };

  useEffect(() => {
    if (!isEditing) {
      fetchUsuariosForLogin();
      const interval = setInterval(fetchUsuariosForLogin, 300000);
      return () => clearInterval(interval);
    }
  }, [isEditing]);

  const formatarDataParaExibicao = (dataString) => {
    if (!dataString) return '';
    try {
      let dateObj;
      const partesHifen = dataString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const partesBarra = dataString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

      if (partesHifen) {
        dateObj = new Date(dataString + 'T00:00:00');
      } else if (partesBarra) {
        dateObj = new Date(`${partesBarra[3]}-${partesBarra[2]}-${partesBarra[1]}T00:00:00`);
      } else {
        dateObj = new Date(dataString);
      }

      if (isNaN(dateObj.getTime())) {
        console.warn('Data inválida para exibição:', dataString);
        return dataString;
      }

      const dia = String(dateObj.getDate()).padStart(2, '0');
      const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
      const ano = dateObj.getFullYear();
      const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                         "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const mesExtenso = nomeMeses[dateObj.getMonth()];
      const anoCurto = String(ano).substring(2);

      return `${dia}/${mesExtenso}/${anoCurto}`;
    } catch (error) {
      console.error('Erro ao formatar data para exibição:', error);
      return dataString;
    }
  };

  // ------------------ FETCH LEADS (Firebase com merge de localChanges) ------------------
  const applyLocalChangesToFetched = (fetchedLeads) => {
    const now = Date.now();
    const merged = fetchedLeads.map(lead => {
      const key = Object.keys(localChangesRef.current).find(k => {
        const ch = localChangesRef.current[k];
        if (!ch) return false;
        if (String(ch.id) === String(lead.id) || (ch.data && String(ch.data.id) === String(lead.id))) return true;
        if (ch.data && ch.data.phone && String(ch.data.phone) === String(lead.phone)) return true;
        return false;
      });

      if (key) {
        const change = localChangesRef.current[key];
        if (now - change.timestamp < SYNC_DELAY_MS) {
          return { ...lead, ...change.data };
        }
      }
      return lead;
    });

    Object.keys(localChangesRef.current).forEach(k => {
      const change = localChangesRef.current[k];
      if (!change) return;
      if (Date.now() - change.timestamp < SYNC_DELAY_MS) {
        const exists = merged.some(l => String(l.id) === String(change.id) || (change.data && String(l.phone) === String(change.data.phone)));
        if (!exists) {
          merged.unshift({ id: change.id, ...change.data });
        }
      }
    });

    return merged;
  };

  const fetchLeadsFromFirebase = async () => {
    try {
      const leadsCol = collection(db, 'leads');
      const leadSnapshot = await getDocs(leadsCol);
      const data = leadSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (Array.isArray(data)) {
        const sortedData = data;

        const formattedLeads = sortedData.map((item, index) => ({
          id: item.id || index + 1,
          name: item.name || item.Name || '',
          vehicleModel: item.vehiclemodel || item.vehicleModel || '',
          vehicleYearModel: item.vehicleyearmodel || item.vehicleYearModel || '',
          city: item.city || '',
          phone: item.phone || item.Telefone || '',
          insuranceType: item.insurancetype || item.insuranceType || '',
          status: item.status || 'Selecione o status',
          confirmado: item.confirmado === 'true' || item.confirmado === true,
          insurer: item.insurer || '',
          insurerConfirmed: item.insurerConfirmed === 'true' || item.insurerConfirmed === true,
          usuarioId: item.usuarioId || null,
          premioLiquido: item.premioLiquido || '',
          comissao: item.comissao || '',
          parcelamento: item.parcelamento || '',
          VigenciaFinal: item.VigenciaFinal || '',
          VigenciaInicial: item.VigenciaInicial || '',
          createdAt: item.data || new Date().toISOString(),
          responsavel: item.responsavel || '',
          editado: item.editado || '',
          observacao: item.observacao || '',
          agendamento: item.agendamento || '',
          agendados: item.agendados || '',
          MeioPagamento: item.MeioPagamento || '',
          CartaoPortoNovo: item.CartaoPortoNovo || '',
        }));

        loadLocalChangesFromStorage();
        const merged = applyLocalChangesToFetched(formattedLeads);

        if (!leadSelecionado) {
          setLeads(merged);
        }
      } else {
        if (!leadSelecionado) {
          setLeads([]);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar leads do Firebase:', error);
      if (!leadSelecionado) {
        setLeads([]);
      }
    }
  };

  useEffect(() => {
    if (!isEditing) {
      fetchLeadsFromFirebase();
      const interval = setInterval(() => {
        fetchLeadsFromFirebase();
      }, 300000);
      return () => clearInterval(interval);
    }
  }, [leadSelecionado, isEditing]);

  // ------------------ LEADS FECHADOS (Firebase) -------------
  const fetchLeadsFechadosFromFirebase = async () => {
    try {
      const leadsFechadosCol = collection(db, 'leadsFechados');
      const leadSnapshot = await getDocs(leadsFechadosCol);
      const data = leadSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const formattedData = data.map(item => ({
        ...item,
        insuranceType: item.insuranceType || '',
        MeioPagamento: item.MeioPagamento || '',
        CartaoPortoNovo: item.CartaoPortoNovo || '',
      }));
      setLeadsFechados(formattedData);

    } catch (error) {
      console.error('Erro ao buscar leads fechados do Firebase:', error);
      setLeadsFechados([]);
    }
  };

  useEffect(() => {
    if (!isEditing) {
      fetchLeadsFechadosFromFirebase();
      const interval = setInterval(() => {
        fetchLeadsFechadosFromFirebase();
      }, 300000);
      return () => clearInterval(interval);
    }
  }, [isEditing]);

  const handleLeadFechadoNameUpdate = async (leadId, novoNome) => {
    try {
      const leadRef = doc(db, 'leadsFechados', leadId);
      await updateDoc(leadRef, { name: novoNome });
      setLeadsFechados(prevLeads => {
        const updatedLeads = prevLeads.map(lead => {
          if (String(lead.id) === String(leadId)) {
            return {
              ...lead,
              name: novoNome,
            };
          }
          return lead;
        });
        return updatedLeads;
      });
    } catch (error) {
      console.error('Erro ao atualizar nome do lead fechado no Firebase:', error);
    }
  };

  const adicionarUsuario = async (usuario) => {
    try {
      const newDocRef = doc(collection(db, 'usuarios'));
      await setDoc(newDocRef, { ...usuario, id: newDocRef.id });
      setUsuarios((prev) => [...prev, { ...usuario, id: newDocRef.id }]);
    } catch (error) {
      console.error('Erro ao adicionar usuário no Firebase:', error);
    }
  };

  const adicionarNovoLead = async (novoLead) => {
    try {
      const newDocRef = doc(collection(db, 'leads'));
      await setDoc(newDocRef, { ...novoLead, id: newDocRef.id });
      setLeads((prevLeads) => {
        if (!prevLeads.some(lead => lead.id === newDocRef.id)) {
          return [{ ...novoLead, id: newDocRef.id }, ...prevLeads];
        }
        return prevLeads;
      });
    } catch (error) {
      console.error('Erro ao adicionar novo lead no Firebase:', error);
    }
  };

  const atualizarStatusLeadAntigo = async (id, novoStatus, phone) => {
    try {
      const leadRef = doc(db, 'leads', id);
      await updateDoc(leadRef, { status: novoStatus, confirmado: true });

      if (novoStatus === 'Fechado') {
        const leadData = (await getDoc(leadRef)).data();
        const newDocRef = doc(collection(db, 'leadsFechados'));
        await setDoc(newDocRef, { ...leadData, id: newDocRef.id, Status: novoStatus, confirmado: true });

        setLeadsFechados((prev) => {
          const atualizados = prev.map((leadsFechados) =>
            leadsFechados.phone === phone ? { ...leadsFechados, Status: novoStatus, confirmado: true } : leadsFechados
          );
          return atualizados;
        });
      }

      setLeads((prev) =>
        prev.map((lead) =>
          lead.phone === phone ? { ...lead, status: novoStatus, confirmado: true } : lead
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar status do lead antigo no Firebase:', error);
    }
  };

  const atualizarStatusLead = async (id, novoStatus, phone) => {
    try {
      const leadRef = doc(db, 'leads', id);
      await updateDoc(leadRef, { status: novoStatus, confirmado: true });

      setLeads((prev) =>
        prev.map((lead) =>
          lead.phone === phone ? { ...lead, status: novoStatus, confirmado: true } : lead
        )
      );

      if (novoStatus === 'Fechado') {
        const leadData = (await getDoc(leadRef)).data();
        const newDocRef = doc(collection(db, 'leadsFechados'));
        await setDoc(newDocRef, { ...leadData, id: newDocRef.id, Status: novoStatus, confirmado: true });

        setLeadsFechados((prev) => {
          const jaExiste = prev.some((lead) => lead.phone === phone);

          if (jaExiste) {
            const atualizados = prev.map((lead) =>
              lead.phone === phone ? { ...lead, Status: novoStatus, confirmado: true } : lead
            );
            return atualizados;
          } else {
            const leadParaAdicionar = leads.find((lead) => lead.phone === phone);

            if (leadParaAdicionar) {
              const novoLeadFechado = {
                ID: leadParaAdicionar.id || crypto.randomUUID(),
                name: leadParaAdicionar.name,
                vehicleModel: leadParaAdicionar.vehicleModel,
                vehicleYearModel: leadParaAdicionar.vehicleYearModel,
                city: leadParaAdicionar.city,
                phone: leadParaAdicionar.phone,
                insuranceType: leadParaAdicionar.insuranceType || "",
                Data: leadParaAdicionar.createdAt || new Date().toISOString(),
                Responsavel: leadParaAdicionar.responsavel || "",
                Status: "Fechado",
                Seguradora: leadParaAdicionar.Seguradora || "",
                PremioLiquido: leadParaAdicionar.premioLiquido || "",
                Comissao: leadParaAdicionar.Comissao || "",
                Parcelamento: leadParaAdicionar.Parcelamento || "",
                VigenciaInicial: leadParaAdicionar.VigenciaInicial || "",
                VigenciaFinal: leadParaAdicionar.VigenciaFinal || "",
                MeioPagamento: leadParaAdicionar.MeioPagamento || "",
                CartaoPortoNovo: leadParaAdicionar.CartaoPortoNovo || "",
                id: leadParaAdicionar.id || null,
                usuario: leadParaAdicionar.usuario || "",
                nome: leadParaAdicionar.nome || "",
                email: leadParaAdicionar.email || "",
                senha: leadParaAdicionar.senha || "",
                status: leadParaAdicionar.status || "Ativo",
                tipo: leadParaAdicionar.tipo || "Usuario",
                "Ativo/Inativo": leadParaAdicionar["Ativo/Inativo"] || "Ativo",
                confirmado: true,
                observacao: leadParaAdicionar.observacao || ''
              };
              return [...prev, novoLeadFechado];
            }
            console.warn("Lead não encontrado na lista principal para adicionar aos fechados.");
            return prev;
          }
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar status do lead no Firebase:', error);
    }
  };

  const handleConfirmAgendamento = async (leadId, dataAgendada) => {
    try {
      const leadRef = doc(db, 'leads', leadId);
      await updateDoc(leadRef, { agendamento: dataAgendada });
      await fetchLeadsFromFirebase();
    } catch (error) {
      console.error('Erro ao confirmar agendamento no Firebase:', error);
    }
  };

  const atualizarSeguradoraLead = async (id, seguradora) => {
    try {
      const leadRef = doc(db, 'leads', id);
      await updateDoc(leadRef, { insurer: seguradora });
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === id
            ? limparCamposLead({ ...lead, insurer: seguradora })
            : lead
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar seguradora do lead no Firebase:', error);
    }
  };

  const limparCamposLead = (lead) => ({
    ...lead,
    premioLiquido: "",
    comissao: "",
    VigenciaFinal: "",
    VigenciaInicial: "",
  });

  const confirmarSeguradoraLead = async (id, premio, seguradora, comissao, parcelamento, vigenciaFinal, vigenciaInicial, meioPagamento, cartaoPortoNovo) => {
    try {
      const leadRef = doc(db, 'leadsFechados', id);
      await updateDoc(leadRef, {
        Seguradora: seguradora,
        PremioLiquido: premio,
        Comissao: comissao,
        Parcelamento: parcelamento,
        VigenciaFinal: vigenciaFinal || '',
        VigenciaInicial: vigenciaInicial || '',
        MeioPagamento: meioPagamento || '',
        CartaoPortoNovo: cartaoPortoNovo || '',
        insurerConfirmed: true,
      });

      setLeadsFechados((prev) => {
        const atualizados = prev.map((l) =>
          l.id === id ? {
            ...l,
            insurerConfirmed: true,
            Seguradora: seguradora,
            PremioLiquido: premio,
            Comissao: comissao,
            Parcelamento: parcelamento,
            VigenciaFinal: vigenciaFinal || '',
            VigenciaInicial: vigenciaInicial || '',
            MeioPagamento: meioPagamento || '',
            CartaoPortoNovo: cartaoPortoNovo || ''
          } : l
        );
        return atualizados;
      });
      setTimeout(() => {
        fetchLeadsFechadosFromFirebase();
      }, 1000);
    } catch (error) {
      console.error('Erro ao confirmar seguradora do lead no Firebase:', error);
    }
  };

  const atualizarDetalhesLeadFechado = async (id, campo, valor) => {
    try {
      const leadRef = doc(db, 'leadsFechados', id);
      await updateDoc(leadRef, { [campo]: valor });
      setLeadsFechados((prev) =>
        prev.map((lead) =>
          lead.id === id ? { ...lead, [campo]: valor } : lead
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar detalhes do lead fechado no Firebase:', error);
    }
  };

  const transferirLead = async (leadId, responsavelId) => {
    try {
      const leadRef = doc(db, 'leads', leadId);
      let responsavelNome = null;
      if (responsavelId) {
        const usuario = usuarios.find((u) => u.id === responsavelId);
        if (usuario) {
          responsavelNome = usuario.nome;
        }
      }
      await updateDoc(leadRef, { responsavel: responsavelNome });

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, responsavel: responsavelNome } : lead
        )
      );
    } catch (error) {
      console.error('Erro ao transferir lead no Firebase:', error);
    }
  };

  const onAbrirLead = (lead) => {
    setLeadSelecionado(lead);

    let path = '/leads';
    if (lead.status === 'Fechado') path = '/leads-fechados';
    else if (lead.status === 'Perdido') path = '/leads-perdidos';

    navigate(path);
  };

  const handleLogin = () => {
    const usuarioEncontrado = usuarios.find(
      (u) => u.usuario === loginInput && u.senha === senhaInput && u.status === 'Ativo'
    );

    if (usuarioEncontrado) {
      setIsAuthenticated(true);
      setUsuarioLogado(usuarioEncontrado);
    } else {
      alert('Login ou senha inválidos ou usuário inativo.');
    }
  };

  const salvarObservacao = async (leadId, observacao) => {
    try {
      const leadRef = doc(db, 'leads', leadId);
      await updateDoc(leadRef, { observacao: observacao });
      console.log('Observação salva com sucesso no Firebase!');
      await fetchLeadsFromFirebase();
    } catch (error) {
      console.error('Erro ao salvar observação no Firebase:', error);
    }
  };

  useEffect(() => {
    loadLocalChangesFromStorage();

    const interval = setInterval(async () => {
      const now = Date.now();
      const dueKeys = [];
      const keys = Object.keys(localChangesRef.current);

      for (const k of keys) {
        const change = localChangesRef.current[k];
        if (!change) continue;
        if (now - change.timestamp >= SYNC_DELAY_MS) {
          dueKeys.push(k);
        }
      }

      if (dueKeys.length === 0) return;

      for (const key of dueKeys) {
        const change = localChangesRef.current[key];
        if (!change) continue;

        try {
          const docRef = doc(db, 'leads', change.id); // Assumindo que 'leads' é a coleção principal
          await updateDoc(docRef, change.data);

          delete localChangesRef.current[key];
          persistLocalChangesToStorage();

          setTimeout(() => {
            fetchLeadsFromFirebase();
            fetchLeadsFechadosFromFirebase();
          }, 800);
        } catch (err) {
          console.error('Erro ao sincronizar alteração local com Firebase:', err);
        }
      }
    }, SYNC_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const formatarDataParaDDMMYYYY = (dataString) => {
    if (!dataString) return '';

    try {
      let dateObj;
      const partesHifen = dataString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (partesHifen) {
        dateObj = new Date(`${partesHifen[1]}-${partesHifen[2]}-${partesHifen[3]}T00:00:00`);
      } else {
        const partesBarra = dataString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (partesBarra) {
          dateObj = new Date(`${partesBarra[3]}-${partesBarra[2]}-${partesBarra[1]}T00:00:00`);
        } else {
          dateObj = new Date(dataString);
        }
      }

      if (isNaN(dateObj.getTime())) {
        console.warn('formatarDataParaDDMMYYYY: Data inválida detectada:', dataString);
        return dataString;
      }

      const dia = String(dateObj.getDate()).padStart(2, '0');
      const mesIndex = dateObj.getMonth();
      const ano = dateObj.getFullYear();
      const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                         "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const mesExtenso = nomeMeses[mesIndex];
      const anoCurto = String(ano).substring(2);

      return `${dia}/${mesExtenso}/${anoCurto}`;
    } catch (e) {
      console.error("Erro na função formatarDataParaDDMMYYYY:", e);
      return dataString;
    }
  };

  const forceSyncWithFirebase = async () => {
    try {
      loadLocalChangesFromStorage();
      const hadLocalChanges = Object.keys(localChangesRef.current).length > 0;
      if (hadLocalChanges) {
        console.log('forceSyncWithFirebase: limpando alterações locais pendentes para forçar estado do Firebase.');
      }
      localChangesRef.current = {};
      persistLocalChangesToStorage();

      await fetchLeadsFromFirebase();
      await fetchLeadsFechadosFromFirebase();

      console.log('forceSyncWithFirebase: dados atualizados a partir do Firebase e alterações locais removidas.');
    } catch (error) {
      console.error('Erro ao forçar sincronização com Firebase:', error);
      alert('Erro ao sincronizar com o Firebase. Verifique a conexão e tente novamente.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div
        className={`flex items-center justify-center min-h-screen bg-cover bg-center transition-opacity duration-1000 ${
          backgroundLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundImage: `url('/background.png')`,
        }}
      >
        <div className="bg-blue-900 bg-opacity-60 text-white p-10 rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 mb-2 flex items-center justify-center text-4xl text-yellow-400">
              👑
            </div>
            <h1 className="text-xl font-semibold">GRUPO</h1>
            <h2 className="text-2xl font-bold text-white">PRIMME SEGUROS</h2>
            <p className="text-sm text-white">CORRETORA DE SEGUROS</p>
          </div>

          <input
            type="text"
            placeholder="Usuário"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            className="w-full mb-4 px-4 py-2 rounded text-black"
          />
          <input
            type="password"
            placeholder="Senha"
            value={senhaInput}
            onChange={(e) => setSenhaInput(e.target.value)}
            className="w-full mb-2 px-4 py-2 rounded text-black"
          />
          <div className="text-right text-sm mb-4">
            <a href="#" className="text-white underline">
            </a>
          </div>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            ENTRAR
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = usuarioLogado?.tipo === 'Admin';

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar isAdmin={isAdmin} nomeUsuario={usuarioLogado} />

      <main ref={mainContentRef} style={{ flex: 1, overflow: 'auto' }}>
        <ScrollToTop scrollContainerRef={mainContentRef} />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <Dashboard
                leadsClosed={
                  isAdmin
                    ? leadsFechados
                    : leadsFechados.filter((lead) => lead.Responsavel === usuarioLogado.nome)
                }
                leads={
                  isAdmin
                    ? leads
                    : leads.filter((lead) => lead.responsavel === usuarioLogado.nome)
                }
                usuarioLogado={usuarioLogado}
                setIsEditing={setIsEditing}
              />
            }
          />
          <Route
            path="/leads"
            element={
              <Leads
                leads={isAdmin ? leads : leads.filter((lead) => lead.responsavel === usuarioLogado.nome)}
                usuarios={usuarios}
                onUpdateStatus={atualizarStatusLead}
                fetchLeadsFromSheet={fetchLeadsFromFirebase} // Alterado para Firebase
                transferirLead={transferirLead}
                usuarioLogado={usuarioLogado}
                leadSelecionado={leadSelecionado}
                setIsEditing={setIsEditing}
                scrollContainerRef={mainContentRef}
                onConfirmAgendamento={handleConfirmAgendamento}
                salvarObservacao={salvarObservacao}
                saveLocalChange={saveLocalChange}
                forceSyncWithSheets={forceSyncWithFirebase} // Alterado para Firebase
              />
            }
          />
          <Route
            path="/leads-fechados"
            element={
              <LeadsFechados
                leads={isAdmin ? leadsFechados : leadsFechados.filter((lead) => lead.Responsavel === usuarioLogado.nome)}
                usuarios={usuarios}
                onUpdateInsurer={atualizarSeguradoraLead}
                onConfirmInsurer={confirmarSeguradoraLead}
                onUpdateDetalhes={atualizarDetalhesLeadFechado}
                fetchLeadsFechadosFromSheet={fetchLeadsFechadosFromFirebase} // Alterado para Firebase
                isAdmin={isAdmin}
                ultimoFechadoId={ultimoFechadoId}
                onAbrirLead={onAbrirLead}
                leadSelecionado={leadSelecionado}
                formatarDataParaExibicao={formatarDataParaExibicao}
                setIsEditing={setIsEditing}
                scrollContainerRef={mainContentRef}
                onLeadNameUpdate={handleLeadFechadoNameUpdate}
              />
            }
          />
          <Route
            path="/leads-perdidos"
            element={
              <LeadsPerdidos
                leads={isAdmin ? leads.filter((lead) => lead.status === 'Perdido') : leads.filter((lead) => lead.responsavel === usuarioLogado.nome && lead.status === 'Perdido')}
                usuarios={usuarios}
                fetchLeadsFromSheet={fetchLeadsFromFirebase} // Alterado para Firebase
                onAbrirLead={onAbrirLead}
                isAdmin={isAdmin}
                leadSelecionado={leadSelecionado}
                setIsEditing={setIsEditing}
              />
            }
          />
          <Route path="/buscar-lead" element={<BuscarLead
            leads={leads}
            fetchLeadsFromSheet={fetchLeadsFromFirebase} // Alterado para Firebase
            fetchLeadsFechadosFromSheet={fetchLeadsFechadosFromFirebase} // Alterado para Firebase
            setIsEditing={setIsEditing}
          />} />
          <Route
            path="/criar-lead"
            element={<CriarLead adicionarLead={adicionarNovoLead} />}
          />
          {isAdmin && (
            <>
              <Route path="/criar-usuario" element={<CriarUsuario adicionarUsuario={adicionarUsuario} />} />
              <Route
                path="/usuarios"
                element={<GerenciarUsuarios />}
              />
            </>
          )}
          <Route path="/ranking" element={<Ranking
            usuarios={usuarios}
            fetchLeadsFromSheet={fetchLeadsFromFirebase} // Alterado para Firebase
            fetchLeadsFechadosFromSheet={fetchLeadsFechadosFromFirebase} // Alterado para Firebase
            leads={leads} />} />
          <Route path="*" element={<h1 style={{ padding: 20 }}>Página não encontrada</h1>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
