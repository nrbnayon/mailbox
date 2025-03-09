import React, { useEffect } from "react";
import {
  X,
  Download,
  Reply,
  Forward,
  Trash2,
  Archive,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { EmailResponse, getEmailById } from "@/lib/api";

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
  const [fullEmail, setFullEmail] = React.useState<EmailResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    const fetchFullEmail = async () => {
      if (isOpen && email?.id) {
        setLoading(true);
        try {
          const data = await getEmailById(email.id);
          setFullEmail(data);
        } catch (error) {
          console.error("Error fetching full email:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchFullEmail();
  }, [isOpen, email?.id]);

  if (!isOpen || !email) return null;

  const displayEmail = fullEmail || email;

  const handleDownloadAttachment = async (
    attachmentId: string,
    filename: string
  ) => {
    try {
      const response = await fetch(
        `/api/emails/${
          displayEmail.id
        }/attachments/${attachmentId}?filename=${encodeURIComponent(filename)}`
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
        <div className="flex items-center gap-2 p-4 border-b bg-gray-50">
          <button
            onClick={() => onReply?.(displayEmail.id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 whitespace-nowrap"
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
          <button
            onClick={() => onForward?.(displayEmail.id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 whitespace-nowrap"
          >
            <Forward className="w-4 h-4" />
            Forward
          </button>
          <button
            onClick={() => onStar(displayEmail.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 whitespace-nowrap ${
              displayEmail.starred ? "text-yellow-500" : ""
            }`}
          >
            <Star className="w-4 h-4" />
            {displayEmail.starred ? "Starred" : "Star"}
          </button>
          <button
            onClick={() => onArchive(displayEmail.id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 whitespace-nowrap"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
          <button
            onClick={() =>
              onDelete ? onDelete(displayEmail.id) : onTrash(displayEmail.id)
            }
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-200 text-red-600 whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>

        {/* Email Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Sender and Date Info */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-grow">
                    <div className="font-medium">{email.from}</div>
                    <div className="text-sm text-gray-500">To: {email.to}</div>
                    {email.cc && (
                      <div className="text-sm text-gray-500">
                        Cc: {email.cc}
                      </div>
                    )}
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
                    {email.date && format(new Date(email.date), "PPP p")}
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <div className="prose max-w-none mb-6">
                {displayEmail.body?.html ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: displayEmail.body.html }}
                    className="email-body"
                  />
                ) : displayEmail.body?.plain ? (
                  <pre className="whitespace-pre-wrap font-sans">
                    {displayEmail.body.plain}
                  </pre>
                ) : (
                  <div>{displayEmail.preview}</div>
                )}
              </div>

              {/* Attachments */}
              {displayEmail.attachments &&
                displayEmail.attachments.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <h3 className="text-lg font-medium mb-3">
                      Attachments ({displayEmail.attachments.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {displayEmail.attachments.map((attachment) => (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailModal;
