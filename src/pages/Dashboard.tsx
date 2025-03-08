import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Mail,
  Loader2,
  Search,
  Inbox,
  Send,
  Star,
  Archive,
  Trash2,
  Plus,
} from "lucide-react";
import EmailList from "@/components/EmailList";
import EmailModal from "@/components/EmailModal";
import {
  getEmails,
  trashEmail,
  starEmail,
  unstarEmail,
  archiveEmail,
  markAsRead,
  EmailResponse,
} from "@/lib/api";
import { useNavigate } from "react-router-dom";

type EmailFilter =
  | "all"
  | "unread"
  | "read"
  | "starred"
  | "sent"
  | "archived"
  | "trash";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFilter, setCurrentFilter] = useState<EmailFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<EmailResponse | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pageSize = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["emails", searchQuery, currentFilter, currentPage],
    queryFn: () =>
      getEmails({
        query: searchQuery,
        filter: currentFilter,
        page: currentPage,
        pageSize,
      }),
  });

  const handleStarEmail = async (id: string) => {
    try {
      const email = data?.messages.find((e) => e.id === id);
      if (email) {
        await (email.starred ? unstarEmail(id) : starEmail(id));
        refetch();
      }
    } catch (error) {
      console.error("Error starring email:", error);
    }
  };

  const handleTrashEmail = async (id: string) => {
    try {
      await trashEmail(id);
      refetch();
      if (isModalOpen) {
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error("Error trashing email:", error);
    }
  };

  const handleArchiveEmail = async (id: string) => {
    try {
      await archiveEmail(id);
      refetch();
      if (isModalOpen) {
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error("Error archiving email:", error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      refetch();
    } catch (error) {
      console.error("Error marking email as read:", error);
    }
  };

  const handleEmailClick = (email: EmailResponse) => {
    setSelectedEmail(email);
    setIsModalOpen(true);
    if (email.unread) {
      handleMarkAsRead(email.id);
    }
  };

  const handleComposeClick = () => {
    navigate("/compose");
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const filterButtons = [
    { id: "all" as EmailFilter, label: "All", icon: Inbox },
    { id: "unread" as EmailFilter, label: "Unread", icon: Mail },
    { id: "starred" as EmailFilter, label: "Starred", icon: Star },
    { id: "sent" as EmailFilter, label: "Sent", icon: Send },
    { id: "archived" as EmailFilter, label: "Archived", icon: Archive },
    { id: "trash" as EmailFilter, label: "Trash", icon: Trash2 },
  ];

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-grow max-w-2xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <button
              onClick={handleComposeClick}
              className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              Compose
            </button>
          </div>

          <div className="flex space-x-4">
            {filterButtons.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setCurrentFilter(id);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  currentFilter === id
                    ? "text-blue-700 bg-blue-100"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-5 w-5 mr-2" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <EmailList
            emails={data?.messages || []}
            onStarEmail={handleStarEmail}
            onTrashEmail={handleTrashEmail}
            onArchiveEmail={handleArchiveEmail}
            onMarkAsRead={handleMarkAsRead}
            onEmailClick={handleEmailClick}
            currentPage={data?.currentPage || 1}
            totalPages={data?.totalPages || 1}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      <EmailModal
        email={selectedEmail}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStar={handleStarEmail}
        onTrash={handleTrashEmail}
        onArchive={handleArchiveEmail}
      />
    </div>
  );
};

export default Dashboard;
