import React, {
  createContext,
  useContext,
  useState,
  useEffect
} from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('collegeai_token')
        : null;

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await authApi.getMe();

      if (res.success && res.data?.user) {
        setUser(res.data.user);
      } else {
        logout();
      }
    } catch (err) {
      console.warn('Session check failed:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);

    try {
      const res = await authApi.login({
        email,
        password
      });

      if (res.success && res.data?.token) {
        localStorage.setItem(
          'collegeai_token',
          res.data.token
        );

        setUser(res.data.user);

        return res.data.user;
      }

      throw new Error('Invalid login response');
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const register = async (name, email, password) => {
    setError(null);

    try {
      // Public registration does NOT accept a role.
      // The backend will always create a Student account.
      const res = await authApi.register({
        name,
        email,
        password
      });

      if (res.success && res.data?.token) {
        localStorage.setItem(
          'collegeai_token',
          res.data.token
        );

        setUser(res.data.user);

        return res.data.user;
      }

      throw new Error('Invalid registration response');
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('collegeai_token');
    }

    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,

        // Used by the frontend for UI/navigation.
        // Actual admin authorization must be enforced by the backend.
        isAdmin: user?.role === 'admin'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);