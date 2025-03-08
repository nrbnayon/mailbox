import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  LogOut,
  User,
  Loader2,
} from "lucide-react";

const Sidebar = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="w-64 border-r bg-card flex flex-col">
      {/* User Info Section */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {user.image ? (
              <img
                key={user.image}
                src={user.image || "/avatars/default-avatar.jpg"}
                alt={user.name.slice(0, 1) || "User"}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover text-center border-2 border-gray-600"
              />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user.name || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email || "No email"}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map(({ name, href, icon: Icon }) => (
          <Link key={name} to={href}>
            <button className="w-full flex items-center px-3 py-2 text-sm rounded-md hover:bg-accent">
              <Icon className="mr-2 h-4 w-4" />
              {name}
            </button>
          </Link>
        ))}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t">
        <button
          className="w-full flex items-center px-3 py-2 text-sm rounded-md text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
