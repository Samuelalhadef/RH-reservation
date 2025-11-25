import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const { user, logout, isRH } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-primary-700 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div>
            <h1 className="text-xl font-bold">Mairie de Chartrettes</h1>
            <p className="text-sm text-primary-100">Gestion des congés</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="hover:bg-primary-600 px-4 py-2 rounded transition"
            >
              Tableau de bord
            </button>

            {isRH() && (
              <button
                onClick={() => navigate('/rh')}
                className="hover:bg-primary-600 px-4 py-2 rounded transition"
              >
                Interface RH
              </button>
            )}

            <div className="text-right border-l border-primary-500 pl-4">
              <p className="font-semibold">{user?.prenom} {user?.nom}</p>
              <p className="text-xs text-primary-200">{user?.type}</p>
            </div>

            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
