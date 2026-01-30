'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

const Navbar = () => {
  const { user, logout, isRH } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profilePhoto, setProfilePhoto] = useState(null);

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
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white shadow-sm border border-gray-200">
              <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Mon Portail Agent</h1>
              <p className="text-xs text-gray-500">Chartrettes</p>
            </div>
          </div>

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

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-600 hover:text-gray-800 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            <div className="relative">
              <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
                {/* Clic sur avatar/nom = profil */}
                <button
                  onClick={handleProfileClick}
                  className="flex items-center gap-3 hover:opacity-80 transition"
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

                {/* Bouton déconnexion séparé */}
                <button
                  onClick={handleLogout}
                  className="ml-2 p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Se déconnecter"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
