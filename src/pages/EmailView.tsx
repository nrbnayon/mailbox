import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Trash2, Loader2, Reply, Forward, Star } from "lucide-react";
import { getEmailById, trashEmail } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { toast } from "react-hot-toast";

const EmailView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: email,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["email", id],
    queryFn: () => getEmailById(id!),
    enabled: !!id,
  });

  const trashMutation = useMutation({
    mutationFn: trashEmail,
    onSuccess: () => {
      toast.success("Email moved to trash");
      navigate("/");
    },
    onError: () => {
      toast.error("Failed to delete email");
    },
  });

  const handleBack = () => {
    navigate("/");
  };

  const handleTrash = () => {
    if (id) {
      trashMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
    );
  }

  if (isError || !email) {
    return (
      <div className='flex flex-col items-center justify-center h-full'>
        <p className='text-lg font-medium'>Email not found</p>
        <button
          onClick={handleBack}
          className='mt-4 text-primary hover:text-primary/80'
        >
          <ArrowLeft className='mr-2 h-4 w-4 inline' />
          Back to inbox
        </button>
      </div>
    );
  }

  // Safely format the date
  const formattedDate = email.date
    ? format(parseISO(email.date), "PPP p")
    : "Unknown date";

  return (
    <div className='h-full flex flex-col bg-background'>
      <div className='p-4 border-b'>
        <div className='flex justify-between items-center'>
          <button
            onClick={handleBack}
            className='text-muted-foreground hover:text-foreground'
          >
            <ArrowLeft className='h-4 w-4' />
          </button>
          <div className='flex items-center gap-2'>
            <button className='p-2 hover:bg-accent rounded-full'>
              <Reply className='h-4 w-4' />
            </button>
            <button className='p-2 hover:bg-accent rounded-full'>
              <Forward className='h-4 w-4' />
            </button>
            <button className='p-2 hover:bg-accent rounded-full'>
              <Star className='h-4 w-4' />
            </button>
            <button
              onClick={handleTrash}
              className='p-2 hover:bg-destructive/10 rounded-full text-destructive'
            >
              <Trash2 className='h-4 w-4' />
            </button>
          </div>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-3xl mx-auto'>
          <h1 className='text-2xl font-bold mb-6'>{email.subject}</h1>

          <div className='flex justify-between items-start mb-6 p-4 bg-accent/50 rounded-lg'>
            <div>
              <p className='font-medium'>{email.from}</p>
              <p className='text-sm text-muted-foreground'>To: {email.to}</p>
            </div>
            <time className='text-sm text-muted-foreground'>
              {formattedDate}
            </time>
          </div>

          <div className='prose prose-sm max-w-none'>{email.content}</div>

          {email.attachments?.length > 0 && (
            <div className='mt-8 border-t pt-6'>
              <h3 className='text-sm font-medium mb-4'>Attachments</h3>
              <div className='grid grid-cols-2 gap-4'>
                {email.attachments.map((attachment: any) => (
                  <div
                    key={attachment.id}
                    className='flex items-center p-3 border rounded-lg hover:bg-accent/50'
                  >
                    <span className='text-sm truncate'>{attachment.name}</span>
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

export default EmailView;
