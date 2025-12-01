'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

const Navbar = () => {
  const { user, logout, isRH } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
  };

  const navItems = [
    { label: 'Tableau de bord', path: '/dashboard' },
    { label: 'Mes demandes', path: '/mes-demandes' },
    { label: 'Calendrier équipe', path: '/calendrier' },
  ];

  if (isRH()) {
    navItems.splice(2, 0, { label: 'Interface RH', path: '/rh' });
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Mairie de Chartrettes</h1>
              <p className="text-xs text-gray-500">Gestion des congés</p>
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

            <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-semibold text-gray-800">{user?.prenom} {user?.nom}</p>
                <p className="text-xs text-gray-500">{user?.type}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
