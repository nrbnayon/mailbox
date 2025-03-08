import { createContext, useContext, useState, useEffect } from "react";
import axios from "@/lib/axios";
import { toast } from "react-hot-toast";

interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  provider: "gmail" | "outlook" | "yahoo";
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (provider: string) => void;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get("/api/auth/me");
      setUser(data.user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      if ((error as any)?.response?.status !== 401) {
        toast.error("Failed to verify authentication status");
      }
      setUser(null);
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoading(false);
      setSessionChecked(true);
    }
  };

  // Initial session check
  useEffect(() => {
    checkAuth();
  }, []);

  // Periodic session refresh (every 5 minutes)
  useEffect(() => {
    if (!isAuthenticated) return;

    const intervalId = setInterval(() => {
      refreshSession();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  const refreshSession = async () => {
    try {
      const { data } = await axios.post("/api/auth/refresh");
      setUser(data.user);
      setIsAuthenticated(true);
    } catch (error) {
      if ((error as any)?.response?.status === 401) {
        // Session expired
        setUser(null);
        setIsAuthenticated(false);
        toast.error("Session expired. Please login again.");
        window.location.href = "/login";
      }
    }
  };

  const login = async (provider: string) => {
    try {
      // Check if already authenticated
      if (isAuthenticated && user) {
        if (user.provider === provider) {
          toast.success("Already logged in!");
          window.location.href = "/dashboard";
          return;
        } else {
          // If trying to login with a different provider, logout first
          await logout();
        }
      }

      const currentUrl = window.location.origin;
      toast.loading("Redirecting to login...");

      // For development, use restricted scopes
      const scopes =
        process.env.NODE_ENV === "development"
          ? ["profile", "email"] // Basic scopes for development
          : [
              "profile",
              "email",
              "https://www.googleapis.com/auth/gmail.modify",
            ]; // Full scopes for production

      const scopeParam = encodeURIComponent(scopes.join(" "));
      const redirectUrl = `${
        import.meta.env.VITE_API_URL
      }/api/auth/${provider}?redirect_url=${encodeURIComponent(
        currentUrl
      )}&scopes=${scopeParam}`;

      window.location.href = redirectUrl;
    } catch (error) {
      toast.error("Login failed. Please try again.");
      console.error("Login error:", error);
    }
  };

  const logout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setUser(null);
      setIsAuthenticated(false);
      toast.success("Successfully logged out");
      window.location.href = "/login";
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  // Don't render children until initial session check is complete
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
