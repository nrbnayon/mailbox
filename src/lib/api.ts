import axios from "./axios";
import { AxiosError } from "axios";

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
  timeRange?: string;
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
    important: ["IMPORTANT"],
    draft: ["DRAFT"],
    spam: ["SPAM"],
  };

  return filter ? filterMapping[filter] || ["INBOX"] : undefined;
};

// Enhanced query builder for Gmail's search syntax
class GmailQueryBuilder {
  private query: string[] = [];

  addKeyword(keyword: string) {
    if (keyword) {
      this.query.push(keyword);
    }
    return this;
  }

  addTimeRange(range: string) {
    if (range) {
      const timeMap: Record<string, string> = {
        today: "newer_than:1d",
        yesterday: "newer_than:2d older_than:1d",
        week: "newer_than:7d",
        month: "newer_than:30d",
        year: "newer_than:1y",
        recent: "newer_than:3d",
      };
      const gmailTimeQuery = timeMap[range] || range;
      // Only add if not already present
      if (
        !this.query.some(
          (q) => q.includes("newer_than") || q.includes("older_than")
        )
      ) {
        this.query.push(gmailTimeQuery);
      }
    }
    return this;
  }

  addSubject(subject: string) {
    if (subject) {
      this.query.push(`subject:"${subject}"`);
    }
    return this;
  }

  addFrom(from: string) {
    if (from) {
      this.query.push(`from:${from}`);
    }
    return this;
  }

  build(): string {
    // Remove duplicate queries and join
    return [...new Set(this.query)].join(" ");
  }
}

// Enhanced keyword extraction and classification
class QueryAnalyzer {
  private static readonly TIME_INDICATORS = new Map([
    ["today", "today"],
    ["yesterday", "yesterday"],
    ["this week", "week"],
    ["last week", "week"],
    ["recent", "recent"],
    ["this month", "month"],
    ["last month", "month"],
    ["this year", "year"],
  ]);

  private static readonly FOLDER_INDICATORS: Record<string, string> = {
    sent: "SENT",
    draft: "DRAFT",
    spam: "SPAM",
    trash: "TRASH",
    archived: "ARCHIVE",
    inbox: "INBOX",
    "all mail": "ALL_MAIL",
  };

  static analyze(content: string) {
    const words = content.toLowerCase().split(/\s+/);
    const result = {
      keywords: [] as string[],
      timeRange: "",
      from: "",
      folder: "INBOX", // Default to inbox
    };

    // ✅ Detect if user is searching for SENT emails
    if (
      content.toLowerCase().includes("i send") ||
      content.toLowerCase().includes("i sent")
    ) {
      result.folder = "SENT";
    }

    // ✅ Detect if the user is searching for drafts, spam, trash, etc.
    for (const phrase in this.FOLDER_INDICATORS) {
      if (content.toLowerCase().includes(phrase)) {
        result.folder = this.FOLDER_INDICATORS[phrase];
        break;
      }
    }

    // ✅ Extract keywords (e.g., OTP)
    words.forEach((word) => {
      if (!["show", "that", "i", "send", "sent"].includes(word)) {
        result.keywords.push(word);
      }
    });

    // ✅ Detect time-based queries
    for (const [phrase, range] of this.TIME_INDICATORS.entries()) {
      if (content.toLowerCase().includes(phrase)) {
        result.timeRange = range;
        break;
      }
    }

    return result;
  }
}

export const getEmails = async (
  params: GetEmailsParams = {}
): Promise<EmailsResponse> => {
  try {
    const queryBuilder = new GmailQueryBuilder();

    if (params.query) {
      const analysis = QueryAnalyzer.analyze(params.query);

      // ✅ Add extracted keywords
      if (analysis.keywords.length > 0) {
        queryBuilder.addKeyword(analysis.keywords.join(" "));
      }

      // ✅ Add time-based filter
      if (analysis.timeRange) {
        queryBuilder.addTimeRange(analysis.timeRange);
      }

      // ✅ Get correct Gmail label for folder searches
      const labelIds = getLabelIdsForFilter(analysis.folder);
      if (labelIds && labelIds.length > 0) {
        labelIds.forEach((labelId) => {
          queryBuilder.addKeyword(`label:${labelId}`);
        });
      }
    }

    const searchQuery = queryBuilder.build();

    const { data } = await axios.get("/api/emails", {
      params: {
        q: searchQuery,
        maxResults: 10, // Limit to avoid excessive API calls
      },
    });

    return {
      messages: data.messages,
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate,
      totalPages: Math.ceil(data.resultSizeEstimate / 10),
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
  try {
    // Analyze the user's query
    const analysis = QueryAnalyzer.analyze(content);

    // Build targeted query
    const queryBuilder = new GmailQueryBuilder();

    if (analysis.timeRange) {
      queryBuilder.addTimeRange(analysis.timeRange);
    }

    // Build query parameters
    const queryParams: GetEmailsParams = {
      query: queryBuilder.build(),
      timeRange: analysis.timeRange,
      pageSize: 20, // Always fetch 20 emails
    };

    // Fetch relevant emails
    const relevantEmails = await getEmails(queryParams);

    // Filter security-related emails if needed
    let filteredEmails = relevantEmails.messages;

    // Use filtered emails for AI processing
    const emailContext =
      filteredEmails.length > 0 ? filteredEmails : context.emails;

    // Process with AI using filtered context
    try {
      const { data } = await axios.post("/api/ai/process", {
        content,
        action,
        modelId: model,
        context: {
          ...context,
          emails: emailContext,
        },
      });
      return data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 400) {
        return {
          success: false,
          response: analysis,
          model: model,
          timestamp: new Date().toISOString(),
        };
      }
      throw error;
    }
  } catch (error) {
    console.error("Error in AI processing:", error);
    throw error;
  }
};
