import React from "react";
import {
  X,
  Download,
  Reply,
  Forward,
  Trash2,
  Archive,
  Star,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { EmailResponse } from "@/lib/api";

interface EmailModalProps {
  email: EmailResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onStar: (id: string) => void;
  onTrash: (id: string) => void;
  onArchive: (id: string) => void;
  onReply?: (id: string) => void;
  onForward?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const EmailModal: React.FC<EmailModalProps> = ({
  email,
  isOpen,
  onClose,
  onStar,
  onTrash,
  onArchive,
  onReply,
  onForward,
  onDelete,
}) => {
  if (!isOpen || !email) return null;

  console.log("Email Data:", email);

  const handleDownloadAttachment = async (
    attachmentId: string,
    filename: string
  ) => {
    try {
      const response = await fetch(
        `/api/emails/${email.id}/attachments/${attachmentId}?filename=${filename}`
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading attachment:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold truncate pr-4">
            {email.subject}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full flex-shrink-0"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Email Actions */}
        <div className="flex items-center gap-2 p-4 border-b bg-gray-50 overflow-x-auto">
          <button
            onClick={() => onReply?.(email.id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 whitespace-nowrap"
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
          <button
            onClick={() => onForward?.(email.id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 whitespace-nowrap"
          >
            <Forward className="w-4 h-4" />
            Forward
          </button>
          <button
            onClick={() => onStar(email.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 whitespace-nowrap ${
              email.starred ? "text-yellow-500" : ""
            }`}
          >
            <Star className="w-4 h-4" />
            {email.starred ? "Starred" : "Star"}
          </button>
          <button
            onClick={() => onArchive(email.id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 whitespace-nowrap"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
          <button
            onClick={() => (onDelete ? onDelete(email.id) : onTrash(email.id))}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 text-red-600 whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>

        {/* Email Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Sender and Date Info */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-grow">
                <div className="font-medium">{email.from}</div>
                <div className="text-sm text-gray-500">To: {email.to}</div>
                {email.labels && email.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {email.labels.map((label, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500 whitespace-nowrap ml-4">
                {email.date ? format(new Date(email.date), "PPP p") : ""}
              </div>
            </div>
          </div>

          {/* Special Security Alert Content if present */}
          {email.subject?.includes("Security alert") && (
            <div className="mb-6 border p-4 rounded-lg bg-yellow-50">
              <div className="flex items-start">
                <AlertTriangle className="w-6 h-6 text-yellow-500 mr-3 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-lg mb-2">{email.subject}</h3>
                  <p className="text-gray-800">
                    A new device was granted access to your account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Email Body - with proper handling for HTML, plain text, or content */}
          <div className="prose max-w-none mb-6">
            {email.body?.html ? (
              <div
                dangerouslySetInnerHTML={{ __html: email.body.html }}
                className="email-body"
              />
            ) : email.body?.plain ? (
              <pre className="whitespace-pre-wrap font-sans">
                {email.body.plain}
              </pre>
            ) : (
              <div>{email.content}</div>
            )}
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-lg font-medium mb-3">
                Attachments ({email.attachments.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {email.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {attachment.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {attachment.mimeType} •{" "}
                        {(attachment.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleDownloadAttachment(
                          attachment.id,
                          attachment.filename
                        )
                      }
                      className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-full flex items-center justify-center"
                      title={`Download ${attachment.filename}`}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailModal;
