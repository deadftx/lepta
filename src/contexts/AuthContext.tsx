import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'MASTER' | 'USER';
  groupId?: string;
  permissions: string[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (loginId: string, pass: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('lepta_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (loginId: string, pass: string): Promise<boolean> => {
    try {
      const res = await fetch('http://localhost:3004/users');
      const users: User[] = await res.json();

      const foundUser = users.find(
        (u: any) => 
          (u.username === loginId || u.email === loginId) && 
          u.password === pass
      );

      if (foundUser) {
        setIsAuthenticated(true);
        setUser(foundUser);
        localStorage.setItem('lepta_user', JSON.stringify(foundUser));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erro ao conectar no banco de dados:", error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('lepta_user');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
