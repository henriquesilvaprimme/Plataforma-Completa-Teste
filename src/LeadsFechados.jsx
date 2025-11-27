import React, { useState, useEffect } from 'react';
import { db } from './firebase'; // Ajuste o caminho para o seu arquivo de config do firebase
import { collection, query, where, getDocs } from 'firebase/firestore';

// IMPORTANTE:
// Normalmente você pegaria esses dados do seu AuthContext ou Redux.
// Aqui estou simulando para o exemplo funcionar.
// Você deve substituir 'mockCurrentUser' pelos dados reais do seu login.
const mockCurrentUser = {
  uid: "1764220277964", // Exemplo de ID
  nome: "Paloma Melo",
  role: "Usuarios" // ou 'Admin' para testar a outra visão
};

const LeadsFechados = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Função auxiliar para formatar dinheiro (BRL)
  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Função auxiliar para formatar data
  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    // Se vier do Firebase como Timestamp, converte. Se for string, usa direto.
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR');
  };

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const leadsCollectionRef = collection(db, "leadsFechados");
        let q;

        // --- LÓGICA DE PERMISSÃO ---
        if (mockCurrentUser.role === 'Admin') {
          // Admin vê tudo
          q = leadsCollectionRef;
        } else {
          // Usuário comum vê apenas os seus (filtrado por usuarioId)
          // Certifique-se que no seu banco o campo é exatamente 'usuarioId'
          q = query(leadsCollectionRef, where("usuarioId", "==", mockCurrentUser.uid));
        }

        const querySnapshot = await getDocs(q);
        const leadsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setLeads(leadsData);
      } catch (err) {
        console.error("Erro ao buscar leads:", err);
        setError("Não foi possível carregar os leads fechados.");
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  if (loading) return <div style={styles.loading}>Carregando leads...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Leads Fechados</h2>
      
      {leads.length === 0 ? (
        <p>Nenhum lead encontrado.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headerRow}>
                <th>Nome</th>
                <th>Modelo</th>
                <th>Ano</th>
                <th>Cidade</th>
                <th>Telefone</th>
                <th>Tipo Seguro</th>
                <th>Seguradora</th>
                <th>Meio Pagto</th>
                <th>Cartão Porto</th>
                <th>Prêmio Líq.</th>
                <th>Comissão</th>
                <th>Parcelas</th>
                <th>Responsável</th>
                <th>Vigência Início</th>
                <th>Vigência Final</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} style={styles.row}>
                  <td>{lead.Nome}</td>
                  <td>{lead.Modelo}</td>
                  <td>{lead.AnoModelo}</td>
                  <td>{lead.Cidade}</td>
                  <td>{lead.Telefone}</td>
                  <td>{lead.TipoSeguro}</td>
                  <td>{lead.Seguradora}</td>
                  <td>{lead.MeioPagamento}</td>
                  <td>{lead.CartaoPortoNovo ? 'Sim' : 'Não'}</td>
                  
                  {/* Colunas Financeiras */}
                  <td style={styles.money}>{formatCurrency(lead.PremioLiquido)}</td>
                  <td style={styles.money}>{formatCurrency(lead.Comissao)}</td>
                  
                  <td>{lead.Parcelamento}</td>
                  <td>{lead.Responsavel}</td>
                  
                  {/* Colunas de Data */}
                  <td>{formatDate(lead.VigenciaInicial)}</td>
                  <td>{formatDate(lead.VigenciaFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Estilos simples em objeto (pode ser substituído por CSS ou Styled Components)
const styles = {
  container: { padding: '20px', fontFamily: 'Arial, sans-serif' },
  title: { color: '#333', marginBottom: '20px' },
  loading: { padding: '20px', fontSize: '18px' },
  error: { padding: '20px', color: 'red' },
  tableWrapper: { overflowX: 'auto', boxShadow: '0 0 10px rgba(0,0,0,0.1)' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '1200px' },
  headerRow: { backgroundColor: '#007bff', color: 'white', textAlign: 'left' },
  row: { borderBottom: '1px solid #ddd' },
  money: { color: '#28a745', fontWeight: 'bold' } // Verde para dinheiro
};

export default LeadsFechados;
