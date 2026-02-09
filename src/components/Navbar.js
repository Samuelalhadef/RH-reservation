'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import NotificationButton from './NotificationButton';

const Navbar = () => {
  const { user, logout, isRH } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Charger la photo de profil
    const fetchPhoto = async () => {
      try {
        const res = await fetch('/api/users/profile');
        const data = await res.json();
        if (data.user?.photo_profil) {
          setProfilePhoto(data.user.photo_profil);
        }
      } catch (error) {
        console.error('Error fetching profile photo:', error);
      }
    };

    if (user) {
      fetchPhoto();
    }
  }, [user]);

  const handleLogout = () => {
    logout();
  };

  const handleProfileClick = () => {
    router.push('/profil');
  };

  const navItems = [
    { label: 'Tableau de bord', path: '/dashboard' },
    { label: 'Mes demandes', path: '/mes-demandes' },
    { label: 'Calendrier équipe', path: '/calendrier' },
  ];

  // Ajouter l'item de validation pour les responsables et la RH
  if (user && (user.niveau_validation > 0 || isRH())) {
    navItems.splice(2, 0, { label: 'Validation', path: '/validation' });
  }

  if (isRH()) {
    navItems.push({ label: 'Interface RH', path: '/rh' });
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center py-3 sm:py-4">
          {/* Logo + titre */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white shadow-sm border border-gray-200">
              <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-gray-800">Mon Portail Agent</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Chartrettes</p>
            </div>
          </div>

          {/* Menu desktop */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  pathname === item.path
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {item.label}
                {pathname === item.path && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
            ))}
          </div>

          {/* Actions droite */}
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationButton />
            <button
              onClick={handleProfileClick}
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: profilePhoto ? 'transparent' : 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)'
                }}
              >
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-sm font-semibold">
                    {user?.prenom?.[0]}{user?.nom?.[0]}
                  </span>
                )}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-semibold text-gray-800">{user?.prenom} {user?.nom}</p>
                <p className="text-xs text-gray-500">{user?.type}</p>
              </div>
            </button>

            {/* Bouton deconnexion - desktop */}
            <button
              onClick={handleLogout}
              className="hidden md:block p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Se déconnecter"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>

            {/* Bouton burger - mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Overlay + Drawer mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black bg-opacity-40" />
        </div>
      )}
      <div
        className={`md:hidden fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200">
              <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-gray-800">Menu</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                router.push(item.path);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
                pathname === item.path
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: profilePhoto ? 'transparent' : 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)'
              }}
            >
              {profilePhoto ? (
                <img src={profilePhoto} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{user?.prenom} {user?.nom}</p>
              <p className="text-xs text-gray-500">{user?.type}</p>
            </div>
          </div>
          <button
            onClick={() => {
              handleLogout();
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Se déconnecter
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
