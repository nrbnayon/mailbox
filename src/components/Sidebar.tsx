// src\components\Sidebar.tsx (fixed)
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  LogOut,
  User,
} from "lucide-react";

const Sidebar = () => {
  const { user, logout } = useAuth();

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Chat",
      href: "/chat",
      icon: MessageSquare,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ];

  return (
    <div className='w-64 border-r bg-card flex flex-col'>
      <div className='p-4 border-b'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden'>
            {user?.image ? (
              <img
                src={user.image}
                alt={user?.name || "User"}
                className='w-full h-full object-cover'
              />
            ) : (
              <User className='h-5 w-5 text-primary' />
            )}
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-medium truncate'>
              {user?.name || "User"}
            </p>
            <p className='text-xs text-muted-foreground truncate'>
              {user?.email || "No email"}
            </p>
          </div>
        </div>
      </div>

      <nav className='flex-1 p-4 space-y-1'>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.name} to={item.href}>
              <button className='w-full flex items-center px-3 py-2 text-sm rounded-md hover:bg-accent'>
                <Icon className='mr-2 h-4 w-4' />
                {item.name}
              </button>
            </Link>
          );
        })}
      </nav>

      <div className='p-4 border-t'>
        <button
          className='w-full flex items-center px-3 py-2 text-sm rounded-md text-destructive hover:bg-destructive/10'
          onClick={logout}
        >
          <LogOut className='mr-2 h-4 w-4' />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
