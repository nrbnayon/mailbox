import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
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
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [refreshAttempted, setRefreshAttempted] = useState(false);

  // Check auth status with error handling
  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get("/api/auth/me");
      setUser(data.user);
      setIsAuthenticated(true);
      return true;
    } catch (error: any) {
      const isUnauthorized = error?.response?.status === 401;

      // Only show error for non-auth related failures
      if (!isUnauthorized) {
        toast.error("Failed to verify authentication status");
      }

      setUser(null);
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoading(false);
      setSessionChecked(true);
    }
  }, []);

  // Refresh session with improved error handling
  const refreshSession = useCallback(async (): Promise<boolean> => {
    // Don't attempt refresh if user is already logged out
    if (!isAuthenticated && refreshAttempted) {
      return false;
    }

    try {
      setIsLoading(true);
      const { data } = await axios.post("/api/auth/refresh");
      setUser(data.user);
      setIsAuthenticated(true);
      setRefreshAttempted(true);
      return true;
    } catch (error: any) {
      setUser(null);
      setIsAuthenticated(false);
      setRefreshAttempted(true);

      // Handle specific errors
      if (error?.response?.status === 401) {
        // Silently handle session expiration
        console.log("Session expired. Redirecting to login page.");

        // Only show toast if user had been previously authenticated
        if (isAuthenticated) {
          toast.error("Session expired. Please login again.");
        }

        // Only programmatically redirect if not already on the login page
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
      } else if (error?.response) {
        // Handle other API errors
        toast.error(
          error.response.data?.error || "Failed to refresh authentication"
        );
      } else {
        // Handle network errors
        toast.error("Network error. Please check your connection.");
      }

      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, refreshAttempted]);

  // Initial session check
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Set up periodic session refresh
  useEffect(() => {
    if (!isAuthenticated) return;

    // Refresh every 15 minutes (adjust as needed)
    const intervalId = setInterval(() => {
      refreshSession();
    }, 15 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, refreshSession]);

  // Login function with improved error handling
  const login = async (provider: string) => {
    try {
      // Check if already authenticated with the same provider
      if (isAuthenticated && user && user.provider === provider) {
        toast.success("Already logged in!");
        window.location.href = "/dashboard";
        return;
      }

      // If authenticated with a different provider, logout first
      if (isAuthenticated && user && user.provider !== provider) {
        await logout();
      }

      const currentUrl = window.location.origin;
      toast.loading("Redirecting to login...");

      // Determine scopes based on environment
      const scopes =
        process.env.NODE_ENV === "development"
          ? ["profile", "email"]
          : [
              "profile",
              "email",
              "https://www.googleapis.com/auth/gmail.modify",
            ];

      const scopeParam = encodeURIComponent(scopes.join(" "));

      // Redirect to auth endpoint
      const redirectUrl = `${
        import.meta.env.VITE_API_URL
      }/api/auth/${provider}?redirect_url=${encodeURIComponent(
        currentUrl
      )}&scopes=${scopeParam}`;

      window.location.href = redirectUrl;
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
    }
  };

  // Improved logout function
  const logout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setUser(null);
      setIsAuthenticated(false);
      toast.success("Successfully logged out");

      // Only redirect if not already on the login page
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");

      // Force client-side logout even if server logout fails
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = "/login";
    }
  };

  // Show loading state until initial session check is complete
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
