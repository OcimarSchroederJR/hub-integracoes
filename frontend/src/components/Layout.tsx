import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { logout } = useAuth();

  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">Hub de Integrações</span>
        <nav>
          <NavLink to="/" end>
            Execuções
          </NavLink>
          <NavLink to="/sobreposicoes">Sobreposições</NavLink>
        </nav>
        <button className="botao-ghost" onClick={logout}>
          Sair
        </button>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
