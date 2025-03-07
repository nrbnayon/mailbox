// src\pages\Dashboard.tsx (fixed)
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Loader2, Search } from "lucide-react";
import EmailList from "@/components/EmailList";
import { getEmails } from "@/lib/api";

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: emails, isLoading } = useQuery({
    queryKey: ["emails", searchQuery],
    queryFn: () => getEmails(searchQuery),
  });

  return (
    <div className='h-full flex flex-col'>
      <div className='p-4 border-b'>
        <div className='flex gap-4'>
          <div className='flex-1 relative'>
            <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
              <Search className='h-4 w-4 text-muted-foreground' />
            </div>
            <input
              placeholder='Search emails...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-10 py-2 px-4 rounded-md border border-input bg-background'
            />
          </div>
          <button className='flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90'>
            <Mail className='mr-2 h-4 w-4' />
            Compose
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-4'>
        {isLoading ? (
          <div className='flex items-center justify-center h-full'>
            <Loader2 className='h-8 w-8 animate-spin' />
          </div>
        ) : (
          <EmailList emails={emails || []} />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
