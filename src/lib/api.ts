import axios from "./axios";

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface EmailBody {
  html: string;
  plain: string;
}

export interface EmailResponse {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  preview: string;
  content?: string;
  date: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
  body?: EmailBody;
  attachments?: EmailAttachment[];
  internalDate?: string;
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

// export const getEmails = async (
//   params: GetEmailsParams = {}
// ): Promise<EmailsResponse> => {
//   const { data } = await axios.get("/api/emails", {
//     params: {
//       ...params,
//       labelIds: getLabelIdsForFilter(params.filter) || [],
//       maxResults: params.pageSize || 20,
//     },
//   });

//   return {
//     ...data,
//     totalPages: Math.ceil(data.resultSizeEstimate / (params.pageSize || 20)),
//     currentPage: params.page || 1,
//   };
// };

export const getEmails = async (
  params: GetEmailsParams = {}
): Promise<EmailsResponse> => {
  // Extract query from params or use empty string
  const searchQuery = params.query || "";

  // Build the search query based on the user's request
  let q = searchQuery;

  // If there's a filter, add it to the query
  if (params.filter) {
    const labelIds = getLabelIdsForFilter(params.filter);
    if (labelIds && labelIds.length > 0) {
      q = `${q} label:${labelIds.join(" label:")}`.trim();
    }
  }

  try {
    const { data }: { data: EmailsResponse } = await axios.get("/api/emails", {
      params: {
        q,
        maxResults: 20, // Limit results to most relevant emails
        pageToken: params.pageToken,
      },
    });

    return {
      messages: data.messages,
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate,
      totalPages: Math.ceil(data.resultSizeEstimate / 20),
      currentPage: params.page || 1,
    };
  } catch (error) {
    console.error("Error fetching emails:", error);
    throw error;
  }
};

export const getEmailById = async (id: string): Promise<EmailResponse> => {
  const { data } = await axios.get(`/api/emails/${id}`);
  return data;
};

export const sendEmail = async (emailData: {
  to: string;
  subject: string;
  content: string;
  cc?: string;
  bcc?: string;
  attachments?: File[];
  isHtml?: boolean;
}) => {
  const formData = new FormData();
  formData.append("to", emailData.to);
  formData.append("subject", emailData.subject);
  formData.append("message", emailData.content);

  if (emailData.cc) {
    formData.append("cc", emailData.cc);
  }

  if (emailData.bcc) {
    formData.append("bcc", emailData.bcc);
  }

  if (emailData.isHtml) {
    formData.append("isHtml", String(emailData.isHtml));
  }

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
    addLabelIds: ["INBOX"],
    removeLabelIds: ["CATEGORY_PERSONAL"],
  });
  return data;
};

export const replyToEmail = async (emailData: {
  id: string;
  message: string;
  attachments?: File[];
  isHtml?: boolean;
}) => {
  const formData = new FormData();
  formData.append("message", emailData.message);

  if (emailData.isHtml) {
    formData.append("isHtml", String(emailData.isHtml));
  }

  if (emailData.attachments) {
    emailData.attachments.forEach((file) => {
      formData.append("attachments", file);
    });
  }

  const { data } = await axios.post(
    `/api/emails/${emailData.id}/reply`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return data;
};

export const forwardEmail = async (emailData: {
  id: string;
  to: string;
  message?: string;
  attachments?: File[];
  isHtml?: boolean;
}) => {
  const formData = new FormData();
  formData.append("to", emailData.to);

  if (emailData.message) {
    formData.append("additionalMessage", emailData.message);
  }

  if (emailData.isHtml) {
    formData.append("isHtml", String(emailData.isHtml));
  }

  if (emailData.attachments) {
    emailData.attachments.forEach((file) => {
      formData.append("attachments", file);
    });
  }

  const { data } = await axios.post(
    `/api/emails/${emailData.id}/forward`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return data;
};

// AI Model methods
export const getModels = async (): Promise<AIModel[]> => {
  try {
    const { data } = await axios.get("/api/models");
    return data;
  } catch (error) {
    console.error("Error fetching models:", error);
    throw error;
  }
};

export const getModelById = async (
  id: string
): Promise<AIModel | undefined> => {
  try {
    const { data } = await axios.get(`/api/models/${id}`);
    return data;
  } catch (error) {
    console.error(`Error fetching model with ID ${id}:`, error);

    // Fallback to getting all models and finding the one we need
    try {
      const models = await getModels();
      return models.find((model) => model.id === id);
    } catch (fallbackError) {
      console.error("Error in fallback model fetching:", fallbackError);
      throw error;
    }
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
  console.log("AI Processing with emails:", context.emails);
  try {
    const { data } = await axios.post("/api/ai/process", {
      content,
      action,
      modelId: model,
      context,
    });
    return data;
  } catch (error) {
    console.error("Error processing AI request:", error);
    throw error;
  }
};
