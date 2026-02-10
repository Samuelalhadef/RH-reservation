'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (userId, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur de connexion');
      }

      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success(`Bienvenue ${data.user.prenom} ${data.user.nom}!`);
      return data.user;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      localStorage.removeItem('user');
      toast.success('Déconnexion réussie');
      router.push('/');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors du changement de mot de passe');
      }

      const updatedUser = { ...user, requirePasswordChange: false };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('Mot de passe modifié avec succès');
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const refreshProfile = async () => {
    try {
      const response = await fetch('/api/users/profile');
      const data = await response.json();

      if (response.ok) {
        const updatedUser = { ...user, ...data.user };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const isRH = () => user && (user.type === 'RH' || user.type === 'Direction');
  const isAlternant = () => user && user.type === 'Alternant';

  const value = {
    user,
    loading,
    login,
    logout,
    changePassword,
    refreshProfile,
    isRH,
    isAlternant,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
