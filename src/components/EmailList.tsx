import { format } from "date-fns";
import { Mail, Star, Trash2, Archive, MoreHorizontal } from "lucide-react";
import { EmailResponse } from "@/lib/api";

interface EmailListProps {
  emails: EmailResponse[];
  onStarEmail: (id: string) => void;
  onTrashEmail: (id: string) => void;
  onArchiveEmail: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onEmailClick: (email: EmailResponse) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const EmailList = ({
  emails,
  onStarEmail,
  onTrashEmail,
  onArchiveEmail,
  // onMarkAsRead,
  onEmailClick,
  currentPage,
  totalPages,
  onPageChange,
}: EmailListProps) => {
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Mail className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-500 text-lg">No emails found</p>
      </div>
    );
  }

  const renderPaginationButton = (pageNum: number, label?: string) => (
    <button
      key={label || pageNum}
      onClick={() => onPageChange(pageNum)}
      disabled={pageNum === currentPage || pageNum < 1 || pageNum > totalPages}
      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
        pageNum === currentPage
          ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
          : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
      } ${
        pageNum < 1 || pageNum > totalPages
          ? "opacity-50 cursor-not-allowed"
          : ""
      }`}
    >
      {label || pageNum}
    </button>
  );

  const renderPaginationNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(renderPaginationButton(i));
    }

    return pages;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 divide-y divide-gray-200">
        {emails.map((email) => (
          <div
            key={email.id}
            className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer ${
              email.unread ? "bg-blue-50" : ""
            }`}
            onClick={() => onEmailClick(email)}
          >
            <div className="flex-shrink-0 mr-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStarEmail(email.id);
                }}
                className={`p-1 rounded-full hover:bg-gray-100 ${
                  email.starred ? "text-yellow-400" : "text-gray-400"
                }`}
              >
                <Star className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-grow min-w-0">
              <div className="flex items-center justify-between">
                <p
                  className={`text-sm font-medium ${
                    email.unread ? "text-gray-900" : "text-gray-600"
                  }`}
                >
                  {email.from}
                </p>
                <p className="text-sm text-gray-500">
                  {format(new Date(email.date), "MMM d, yyyy")}
                </p>
              </div>
              <p
                className={`text-sm ${
                  email.unread ? "font-semibold" : ""
                } text-gray-900 truncate`}
              >
                {email.subject}
              </p>
              <p className="text-sm text-gray-500 truncate">{email.preview}</p>
            </div>

            <div className="flex-shrink-0 ml-4 space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchiveEmail(email.id);
                }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <Archive className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTrashEmail(email.id);
                }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button className="p-1 rounded-full hover:bg-gray-100 text-gray-400">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing page <span className="font-medium">{currentPage}</span> of{" "}
              <span className="font-medium">{totalPages}</span>
            </p>
          </div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            {renderPaginationButton(1, "First")}
            {renderPaginationButton(currentPage - 1, "Previous")}
            {renderPaginationNumbers()}
            {renderPaginationButton(currentPage + 1, "Next")}
            {renderPaginationButton(totalPages, "Last")}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default EmailList;
