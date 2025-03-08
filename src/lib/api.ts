import axios from "./axios";

export interface EmailResponse {
  id: string;
  subject: string;
  from: string;
  to: string;
  preview: string;
  content: string;
  date: string;
  unread: boolean;
  starred?: boolean;
  labels: string[];
  body?: {
    html: string;
    plain: string;
  };
  attachments?: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }[];
}

export interface GetEmailsParams {
  query?: string;
  filter?: string;
  page?: number;
  pageSize?: number;
  pageToken?: string;
}

export interface EmailsResponse {
  messages: EmailResponse[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
  totalPages: number;
  currentPage: number;
}
export interface AIModel {
  id: string;
  name: string;
  developer: string;
  contextWindow: number;
  maxCompletionTokens?: number;
  description?: string;
  isDefault?: boolean;
  apiType?: string;
}

const getLabelIdsForFilter = (filter?: string): string[] | undefined => {
  const filterMapping: Record<string, string[]> = {
    unread: ["UNREAD"],
    starred: ["STARRED"],
    sent: ["SENT"],
    archived: [],
    trash: ["TRASH"],
  };

  return filter ? filterMapping[filter] || ["INBOX"] : undefined;
};

export const getEmails = async (
  params: GetEmailsParams = {}
): Promise<EmailsResponse> => {
  const { data } = await axios.get("/api/emails", {
    params: {
      ...params,
      labelIds: getLabelIdsForFilter(params.filter) || [],
      maxResults: params.pageSize || 20,
    },
  });

  return {
    ...data,
    totalPages: Math.ceil(data.resultSizeEstimate / (params.pageSize || 20)),
    currentPage: params.page || 1,
  };
};

export const getEmailById = async (id: string): Promise<EmailResponse> => {
  const { data } = await axios.get(`/api/emails/${id}`);
  return data;
};

export const sendEmail = async (emailData: {
  to: string;
  subject: string;
  content: string;
  attachments?: File[];
}) => {
  const formData = new FormData();
  formData.append("to", emailData.to);
  formData.append("subject", emailData.subject);
  formData.append("content", emailData.content);

  if (emailData.attachments) {
    emailData.attachments.forEach((file) => {
      formData.append("attachments", file);
    });
  }

  const { data } = await axios.post("/api/emails", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};

export const restoreEmail = async (id: string) => {
  const { data } = await axios.post(`/api/emails/${id}/untrash`);
  return data;
};

export const markAsUnread = async (id: string) => {
  const { data } = await axios.post(`/api/emails/${id}/markRead`, {
    read: false,
  });
  return data;
};

export const starEmail = async (id: string) => {
  const { data } = await axios.post(`/api/emails/${id}/modify`, {
    addLabelIds: ["STARRED"],
  });
  return data;
};

export const unstarEmail = async (id: string) => {
  const { data } = await axios.post(`/api/emails/${id}/modify`, {
    removeLabelIds: ["STARRED"],
  });
  return data;
};

export const archiveEmail = async (id: string) => {
  const { data } = await axios.post(`/api/emails/${id}/modify`, {
    addLabelIds: ["CATEGORY_PERSONAL"],
    removeLabelIds: ["INBOX"],
  });
  return data;
};

export const trashEmail = async (id: string) => {
  const { data } = await axios.post(`/api/emails/${id}/modify`, {
    addLabelIds: ["TRASH"],
    removeLabelIds: [],
  });
  return data;
};

export const markAsRead = async (id: string) => {
  const { data } = await axios.post(`/api/emails/${id}/modify`, {
    addLabelIds: [],
    removeLabelIds: ["UNREAD"],
  });
  return data;
};

export const deleteEmail = async (id: string) => {
  const { data } = await axios.delete(`/api/emails/${id}`);
  return data;
};

export const unarchiveEmail = async (id: string) => {
  const { data } = await axios.post(`/api/emails/${id}/modify`, {
    addLabelIds: [],
    removeLabelIds: ["INBOX"],
  });
  return data;
};

// Fixed model methods
export const getModels = async (): Promise<AIModel[]> => {
  try {
    const { data } = await axios.get("/api/models");

    console.log("Data from /api/models:", data);
    return data;
  } catch (error) {
    console.error("Error fetching models:", error);
    throw error;
  }
};

export const getDefaultModel = async (): Promise<AIModel> => {
  try {
    const { data } = await axios.get("/api/models/default");
    return data;
  } catch (error) {
    console.error("Error fetching default model:", error);
    throw error;
  }
};

export const processWithAI = async ({
  content,
  action,
  modelId,
  context,
}: {
  content: string;
  action: string;
  modelId: string;
  context: {
    emails: EmailResponse[];
    previousMessages: any[];
  };
}) => {
  const { data } = await axios.post("/api/ai/process", {
    content,
    action,
    modelId,
    context,
  });
  return data;
};
