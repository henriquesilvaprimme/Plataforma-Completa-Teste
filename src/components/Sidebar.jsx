import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, DollarSign, Settings, LogOut, Menu, X, FileText, Repeat, Shield } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ isOpen, toggleSidebar, usuarioLogado }) => {
  const location = useLocation();
  const auth = getAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const menuItems = [
    { name: 'Dashboard', icon: Home, path: '/dashboard', roles: ['Admin', 'Corretor'] },
    { name: 'Leads', icon: Users, path: '/leads', roles: ['Admin', 'Corretor'] },
    { name: 'Renovações', icon: Repeat, path: '/renovacoes', roles: ['Admin', 'Corretor'] },
    { name: 'Segurados', icon: Shield, path: '/segurados', roles: ['Admin', 'Corretor'] },
    { name: 'Usuários', icon: Users, path: '/usuarios', roles: ['Admin'] },
    { name: 'Configurações', icon: Settings, path: '/configuracoes', roles: ['Admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (!usuarioLogado || !usuarioLogado.tipo) return false;
    return item.roles.includes(usuarioLogado.tipo);
  });

  return (
    <>
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '60px',
            backgroundColor: '#2c3e50',
            display: 'flex',
            alignItems: 'center',
            padding: '0 15px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
          <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginLeft: '15px' }}>
            {usuarioLogado?.nome || 'Usuário'}
          </span>
        </div>
      )}

      <div
        style={{
          width: isOpen ? (isMobile ? '250px' : '200px') : '0',
          backgroundColor: '#2c3e50',
          color: '#ecf0f1',
          padding: isOpen ? '20px 0' : '0',
          position: isMobile ? 'fixed' : 'sticky',
          top: isMobile ? '0' : '0',
          left: '0',
          height: '100vh',
          overflowX: 'hidden',
          transition: 'width 0.3s ease-in-out',
          zIndex: 999,
          boxShadow: isOpen ? '2px 0 5px rgba(0,0,0,0.3)' : 'none',
          paddingTop: isMobile ? '80px' : '20px', // Ajuste para o cabeçalho mobile
        }}
      >
        <div style={{ padding: '0 20px', marginBottom: '30px', display: isOpen ? 'block' : 'none' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#3498db' }}>CRM Seguros</h2>
          {usuarioLogado && (
            <p style={{ fontSize: '16px', color: '#bdc3c7' }}>Olá, {usuarioLogado.nome}!</p>
          )}
        </div>

        <nav>
          <ul style={{ listStyle: 'none', padding: '0' }}>
            {filteredMenuItems.map((item) => (
              <li key={item.name} style={{ marginBottom: '10px' }}>
                <Link
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 20px',
                    color: '#ecf0f1',
                    textDecoration: 'none',
                    fontSize: '18px',
                    backgroundColor: location.pathname === item.path ? '#34495e' : 'transparent',
                    borderLeft: location.pathname === item.path ? '5px solid #3498db' : 'none',
                    transition: 'background-color 0.2s ease, border-left 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#34495e')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      location.pathname === item.path ? '#34495e' : 'transparent')
                  }
                  onClick={isMobile ? toggleSidebar : undefined} // Fecha sidebar no mobile ao clicar
                >
                  <item.icon size={20} style={{ marginRight: '15px' }} />
                  {item.name}
                </Link>
              </li>
            ))}
            <li style={{ marginTop: '30px' }}>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 20px',
                  color: '#e74c3c',
                  textDecoration: 'none',
                  fontSize: '18px',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#34495e')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={20} style={{ marginRight: '15px' }} />
                Sair
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
