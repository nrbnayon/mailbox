import axios from "./axios";

export interface EmailResponse {
  id: string;
  subject: string;
  from: string;
  to: string;
  content: string;
  date: string;
  unread: boolean;
  labels: string[];
}

export const getEmails = async (query?: string): Promise<EmailResponse[]> => {
  const { data } = await axios.get("/api/emails", {
    params: { q: query },
  });
  return data;
};

export const getEmailById = async (id: string): Promise<EmailResponse> => {
  const { data } = await axios.get(`/api/emails/${id}`);
  return data;
};

export const sendEmail = async (emailData: {
  to: string;
  subject: string;
  content: string;
}) => {
  const { data } = await axios.post("/api/emails", emailData);
  return data;
};

export const trashEmail = async (id: string) => {
  const { data } = await axios.delete(`/api/emails/${id}`);
  return data;
};

export const processWithAI = async ({
  content,
  action,
  model,
  context,
}: {
  content: string;
  action: string;
  model: string;
  context: {
    emails: EmailResponse[];
    previousMessages: any[];
  };
}) => {
  const { data } = await axios.post("/api/ai/process", {
    content,
    action,
    model,
    context,
  });
  return data;
};
