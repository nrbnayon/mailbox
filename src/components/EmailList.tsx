// src\components\EmailList.tsx
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Mail } from 'lucide-react';

interface Email {
  id: string;
  subject: string;
  from: string;
  preview: string;
  date: string;
  unread: boolean;
}

interface EmailListProps {
  emails: Email[];
}

const EmailList = ({ emails }: EmailListProps) => {
  if (emails.length === 0) {
    return (
      <div className="text-center py-8">
        <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium text-muted-foreground">
          No emails found
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {emails.map((email) => (
        <Link
          key={email.id}
          to={`/email/${email.id}`}
          className={`block p-4 rounded-lg border ${
            email.unread
              ? 'bg-primary/5 border-primary/10'
              : 'bg-card border-border/50'
          } hover:border-primary/30 transition-colors`}
        >
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm ${
                  email.unread ? 'font-semibold' : 'font-medium'
                } truncate`}
              >
                {email.subject}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {email.from}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {email.preview}
              </p>
            </div>
            <time className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(email.date), 'MMM d')}
            </time>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default EmailList;