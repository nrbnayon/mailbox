import express from "express";
import { google, gmail_v1 } from "googleapis";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
import { auth, AuthRequest } from "../middleware/auth.js"; // Assumed auth middleware
import { User } from "../models/User.js"; // Assumed User model
import multer from "multer";
import path from "path";
import fs from "fs";
import mime from "mime-types";

// Token refresh service (assumed external implementation)
import { refreshTokenByProvider } from "../services/tokenService.js";

// Set up multer for file uploads
interface MulterFile extends Express.Multer.File {
  originalname: string;
  mimetype: string;
  path: string;
}

interface StorageCallback {
  (error: Error | null, destination: string): void;
}

interface FilenameCallback {
  (error: Error | null, filename: string): void;
}

const storage = multer.diskStorage({
  destination: (
    req: express.Request,
    file: MulterFile,
    cb: StorageCallback
  ) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: express.Request, file: MulterFile, cb: FilenameCallback) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });
const router = express.Router();

// Define email client types for Gmail and Outlook
interface GmailClient {
  provider: "gmail";
  client: gmail_v1.Gmail;
  refreshAccessToken?: never; // Not needed for Gmail
}

interface OutlookClient {
  provider: "outlook";
  client: Client;
  refreshAccessToken: () => Promise<string>;
}

type EmailClient = GmailClient | OutlookClient;

// Helper function to initialize email client based on provider
const getEmailClient = async (userId: string): Promise<EmailClient> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.provider) {
    throw new Error("User provider not specified");
  }

  if (user.provider === "outlook") {
    if (!user.microsoftAccessToken) {
      throw new Error("No access token available for Microsoft authentication");
    }

    const graphClient = Client.init({
      authProvider: async (done) => {
        try {
          let currentAccessToken = user.microsoftAccessToken!;
          if (!currentAccessToken) {
            const refreshedUser = await refreshTokenByProvider(
              userId,
              "outlook"
            );
            currentAccessToken = refreshedUser.microsoftAccessToken!;
          }
          done(null, currentAccessToken);
        } catch (error) {
          done(
            error instanceof Error ? error : new Error("Authentication failed"),
            null
          );
        }
      },
    });

    const refreshAccessToken = async (): Promise<string> => {
      try {
        await refreshTokenByProvider(userId, "outlook");
        const updatedUser = await User.findById(userId);
        if (!updatedUser) {
          throw new Error("User not found after token refresh");
        }
        if (!updatedUser.microsoftAccessToken) {
          throw new Error("No access token available after refresh");
        }
        return updatedUser.microsoftAccessToken;
      } catch (error) {
        console.error("Error refreshing Outlook token:", error);
        throw error;
      }
    };

    return {
      provider: "outlook",
      client: graphClient,
      refreshAccessToken,
    };
  } else if (user.provider === "gmail") {
    if (!user.googleAccessToken) {
      throw new Error("No access token available for Google authentication");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.refreshToken || undefined,
    });

    oauth2Client.on("tokens", async (tokens) => {
      try {
        if (tokens.access_token) {
          user.googleAccessToken = tokens.access_token;
        }
        if (tokens.refresh_token) {
          user.refreshToken = tokens.refresh_token;
        }
        await user.save();
      } catch (error) {
        console.error("Error updating Gmail tokens:", error);
      }
    });

    const gmailClient = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    return {
      provider: "gmail",
      client: gmailClient,
    };
  } else {
    throw new Error(`Unsupported provider: ${user.provider}`);
  }
};

// Helper function to extract body from Gmail parts
const extractBodyGmail = (
  parts: gmail_v1.Schema$MessagePart[] | undefined
): string => {
  if (!parts) return "";

  let body = "";
  parts.forEach((part: gmail_v1.Schema$MessagePart) => {
    if (part.mimeType === "text/html" && part.body?.data) {
      body += Buffer.from(part.body.data, "base64").toString("utf-8");
    } else if (part.mimeType === "text/plain" && part.body?.data) {
      body += Buffer.from(part.body.data, "base64").toString("utf-8");
    } else if (part.parts) {
      body += extractBodyGmail(part.parts);
    }
  });
  return body.trim();
};

// **Route: Fetch Emails**
router.get("/", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);
    const {
      q = "",
      maxResults = 5000,
      pageToken,
      labelIds,
      includeSpamTrash = false,
    } = req.query;

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      const params: any = {
        userId: "me",
        maxResults: Number(maxResults),
        q: q as string,
      };

      if (pageToken) params.pageToken = pageToken as string;
      if (labelIds) {
        params.labelIds = Array.isArray(labelIds) ? labelIds : [labelIds];
      }
      if (includeSpamTrash) params.includeSpamTrash = Boolean(includeSpamTrash);

      const response = await gmail.users.messages.list(params);

      if (!response.data.messages) {
        return res.json({
          messages: [],
          nextPageToken: response.data.nextPageToken || null,
          resultSizeEstimate: response.data.resultSizeEstimate || 0,
        });
      }

      const emails = await Promise.all(
        response.data.messages.map(async (message) => {
          const email = await gmail.users.messages.get({
            userId: "me",
            id: message.id!,
            format: "full",
            metadataHeaders: ["Subject", "From", "To", "Date", "Cc", "Bcc"],
          });

          const headers = email.data.payload?.headers || [];
          const subject =
            headers.find((h) => h.name === "Subject")?.value || "";
          const from = headers.find((h) => h.name === "From")?.value || "";
          const to = headers.find((h) => h.name === "To")?.value || "";
          const cc = headers.find((h) => h.name === "Cc")?.value || "";
          const bcc = headers.find((h) => h.name === "Bcc")?.value || "";
          const date = headers.find((h) => h.name === "Date")?.value || "";
          const hasAttachments =
            email.data.payload?.parts?.some(
              (part) => part.filename && part.filename.length > 0
            ) || false;
          return {
            id: message.id,
            threadId: email.data.threadId,
            subject,
            from,
            to,
            cc,
            bcc,
            date,
            preview: email.data.snippet,
            content: email.data.snippet,
            labelIds: email.data.labelIds || [],
            unread: email.data.labelIds?.includes("UNREAD") || false,
            hasAttachments,
            internalDate: email.data.internalDate,
          };
        })
      );

      res.json({
        messages: emails,
        nextPageToken: response.data.nextPageToken || null,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      });
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      let query = graphClient.api("/me/messages").top(Number(maxResults));

      if (q) {
        query = query.search(`"${q}"`);
      }
      if (labelIds) {
        const categories = Array.isArray(labelIds) ? labelIds : [labelIds];
        query = query.filter(`categories/any(c:c eq '${categories[0]}')`);
      }
      if (pageToken) {
        query = query.skipToken(pageToken as string);
      }
      if (!includeSpamTrash) {
        query = query.filter(
          "parentFolderId ne 'JUNKEMAIL' and parentFolderId ne 'DELETEDITEMS'"
        );
      }

      let response;
      try {
        response = await query
          .select([
            "id",
            "subject",
            "from",
            "toRecipients",
            "ccRecipients",
            "bccRecipients",
            "receivedDateTime",
            "bodyPreview",
            "isRead",
            "hasAttachments",
            "conversationId",
            "categories",
          ])
          .get();
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          query = graphClient.api("/me/messages").top(Number(maxResults));
          if (q) query = query.search(`"${q}"`);
          if (labelIds) {
            const categories = Array.isArray(labelIds) ? labelIds : [labelIds];
            query = query.filter(`categories/any(c:c eq '${categories[0]}')`);
          }
          if (pageToken) query = query.skipToken(pageToken as string);
          if (!includeSpamTrash) {
            query = query.filter(
              "parentFolderId ne 'JUNKEMAIL' and parentFolderId ne 'DELETEDITEMS'"
            );
          }
          response = await query
            .select([
              "id",
              "subject",
              "from",
              "toRecipients",
              "ccRecipients",
              "bccRecipients",
              "receivedDateTime",
              "bodyPreview",
              "isRead",
              "hasAttachments",
              "conversationId",
              "categories",
            ])
            .get();
        } else {
          throw error;
        }
      }

      const emails = response.value.map((email: any) => ({
        id: email.id,
        threadId: email.conversationId,
        subject: email.subject,
        from: email.from?.emailAddress?.address || "",
        to:
          email.toRecipients
            ?.map((r: any) => r.emailAddress.address)
            .join(", ") || "",
        cc:
          email.ccRecipients
            ?.map((r: any) => r.emailAddress.address)
            .join(", ") || "",
        bcc:
          email.bccRecipients
            ?.map((r: any) => r.emailAddress.address)
            .join(", ") || "",
        date: email.receivedDateTime,
        preview: email.bodyPreview,
        content: email.bodyPreview,
        labelIds: email.categories || [],
        unread: !email.isRead,
        hasAttachments: email.hasAttachments,
        internalDate: new Date(email.receivedDateTime).getTime().toString(),
      }));

      res.json({
        messages: emails,
        nextPageToken: response["@odata.nextLink"] || null,
        resultSizeEstimate: response.value.length,
      });
    }
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

// **Route: Fetch All Labels**
router.get("/labels", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      const response = await gmail.users.labels.list({ userId: "me" });
      res.json(response.data.labels || []);
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      let response;
      try {
        response = await graphClient.api("/me/mailFolders").get();
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          response = await graphClient.api("/me/mailFolders").get();
        } else {
          throw error;
        }
      }
      const labels = response.value.map((folder: any) => ({
        id: folder.id,
        name: folder.displayName,
        type: "user",
      }));
      res.json(labels);
    }
  } catch (error) {
    console.error("Error fetching labels:", error);
    res.status(500).json({ error: "Failed to fetch labels" });
  }
});

// **Route: Create a Label**
router.post("/labels", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);
    const {
      name,
      labelListVisibility = "labelShow",
      messageListVisibility = "show",
    } = req.body;

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      const response = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name,
          labelListVisibility,
          messageListVisibility,
        },
      });
      res.json(response.data);
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      let response;
      try {
        response = await graphClient.api("/me/mailFolders").post({
          displayName: name,
        });
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          response = await graphClient.api("/me/mailFolders").post({
            displayName: name,
          });
        } else {
          throw error;
        }
      }
      res.json({
        id: response.id,
        name: response.displayName,
        type: "user",
      });
    }
  } catch (error) {
    console.error("Error creating label:", error);
    res.status(500).json({ error: "Failed to create label" });
  }
});

// **Route: Update a Label**
router.put("/labels/:id", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);
    const { name, labelListVisibility, messageListVisibility } = req.body;

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      const response = await gmail.users.labels.update({
        userId: "me",
        id: req.params.id,
        requestBody: {
          name,
          labelListVisibility,
          messageListVisibility,
        },
      });
      res.json(response.data);
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      let response;
      try {
        response = await graphClient
          .api(`/me/mailFolders/${req.params.id}`)
          .patch({
            displayName: name,
          });
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          response = await graphClient
            .api(`/me/mailFolders/${req.params.id}`)
            .patch({
              displayName: name,
            });
        } else {
          throw error;
        }
      }
      res.json({
        id: response.id,
        name: response.displayName,
        type: "user",
      });
    }
  } catch (error) {
    console.error("Error updating label:", error);
    res.status(500).json({ error: "Failed to update label" });
  }
});

// **Route: Delete a Label**
router.delete("/labels/:id", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      await gmail.users.labels.delete({ userId: "me", id: req.params.id });
      res.json({ success: true });
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      try {
        await graphClient.api(`/me/mailFolders/${req.params.id}`).delete();
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          await graphClient.api(`/me/mailFolders/${req.params.id}`).delete();
        } else {
          throw error;
        }
      }
      res.json({ success: true });
    }
  } catch (error) {
    console.error("Error deleting label:", error);
    res.status(500).json({ error: "Failed to delete label" });
  }
});

// **Route: Fetch Email Thread**
router.get("/threads/:id", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: req.params.id,
        format: "full",
      });
      res.json(thread.data);
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      let response;
      try {
        response = await graphClient
          .api("/me/messages")
          .filter(`conversationId eq '${req.params.id}'`)
          .select([
            "id",
            "subject",
            "from",
            "toRecipients",
            "ccRecipients",
            "bccRecipients",
            "receivedDateTime",
            "body",
            "isRead",
            "hasAttachments",
            "conversationId",
            "categories",
          ])
          .get();
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          response = await graphClient
            .api("/me/messages")
            .filter(`conversationId eq '${req.params.id}'`)
            .select([
              "id",
              "subject",
              "from",
              "toRecipients",
              "ccRecipients",
              "bccRecipients",
              "receivedDateTime",
              "body",
              "isRead",
              "hasAttachments",
              "conversationId",
              "categories",
            ])
            .get();
        } else {
          throw error;
        }
      }
      res.json({
        id: req.params.id,
        messages: response.value.map((email: any) => ({
          id: email.id,
          threadId: email.conversationId,
          subject: email.subject,
          from: email.from?.emailAddress?.address || "",
          to:
            email.toRecipients
              ?.map((r: any) => r.emailAddress.address)
              .join(", ") || "",
          cc:
            email.ccRecipients
              ?.map((r: any) => r.emailAddress.address)
              .join(", ") || "",
          bcc:
            email.bccRecipients
              ?.map((r: any) => r.emailAddress.address)
              .join(", ") || "",
          date: email.receivedDateTime,
          content: email.body.content,
          labelIds: email.categories || [],
          unread: !email.isRead,
          hasAttachments: email.hasAttachments,
          internalDate: new Date(email.receivedDateTime).getTime().toString(),
        })),
      });
    }
  } catch (error) {
    console.error("Error fetching thread:", error);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// **Route: Fetch Email Attachment**
router.get(
  "/:messageId/attachments/:attachmentId",
  auth,
  async (req: AuthRequest, res) => {
    try {
      let emailClient = await getEmailClient(req.user!.userId);
      const { messageId, attachmentId } = req.params;
      const { filename } = req.query;

      if (emailClient.provider === "gmail") {
        const gmail = emailClient.client;
        const attachment = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId,
          id: attachmentId,
        });

        if (!attachment.data.data) {
          return res.status(404).json({ error: "Attachment data not found" });
        }

        const base64Data = attachment.data.data
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const buffer = Buffer.from(base64Data, "base64");

        if (filename) {
          const mimeType =
            mime.lookup(filename as string) || "application/octet-stream";
          res.setHeader("Content-Type", mimeType);
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );
        } else {
          res.setHeader("Content-Type", "application/octet-stream");
        }

        res.send(buffer);
      } else if (emailClient.provider === "outlook") {
        let graphClient = emailClient.client;
        let attachment;
        try {
          attachment = await graphClient
            .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
            .get();
        } catch (error: any) {
          if (error.statusCode === 401 && emailClient.refreshAccessToken) {
            const newAccessToken = await emailClient.refreshAccessToken();
            graphClient = Client.init({
              authProvider: async (done) => {
                done(null, newAccessToken);
              },
            });
            attachment = await graphClient
              .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
              .get();
          } else {
            throw error;
          }
        }

        if (!attachment.contentBytes) {
          return res.status(404).json({ error: "Attachment data not found" });
        }

        const buffer = Buffer.from(attachment.contentBytes, "base64");

        if (filename) {
          const mimeType =
            mime.lookup(filename as string) || "application/octet-stream";
          res.setHeader("Content-Type", mimeType);
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
          );
        } else {
          res.setHeader("Content-Type", "application/octet-stream");
        }

        res.send(buffer);
      }
    } catch (error) {
      console.error("Error fetching attachment:", error);
      res.status(500).json({ error: "Failed to fetch attachment" });
    }
  }
);

// **Route: Send Email**
router.post(
  "/",
  auth,
  upload.array("attachments"),
  async (req: AuthRequest, res) => {
    try {
      let emailClient = await getEmailClient(req.user!.userId);
      const { to, cc, bcc, subject, message, isHtml = false } = req.body;
      const files = req.files as Express.Multer.File[];

      if (emailClient.provider === "gmail") {
        const gmail = emailClient.client;
        const messageParts = [];
        messageParts.push(`From: ${req.user!.email}`, `To: ${to}`);
        if (cc) messageParts.push(`Cc: ${cc}`);
        if (bcc) messageParts.push(`Bcc: ${bcc}`);
        messageParts.push(`Subject: ${subject}`, "MIME-Version: 1.0");

        const boundary = `boundary_${Date.now().toString(16)}`;
        if (files.length > 0 || isHtml) {
          messageParts.push(
            `Content-Type: multipart/mixed; boundary=${boundary}`
          );
          messageParts.push("");
          messageParts.push(`--${boundary}`);
          if (isHtml) {
            messageParts.push(
              "Content-Type: multipart/alternative; boundary=alt_boundary"
            );
            messageParts.push("");
            messageParts.push("--alt_boundary");
            messageParts.push("Content-Type: text/plain; charset=UTF-8");
            messageParts.push("Content-Transfer-Encoding: 7bit");
            messageParts.push("");
            messageParts.push(message.replace(/<[^>]*>/g, ""));
            messageParts.push("");
            messageParts.push("--alt_boundary");
            messageParts.push("Content-Type: text/html; charset=UTF-8");
            messageParts.push("Content-Transfer-Encoding: 7bit");
            messageParts.push("");
            messageParts.push(message);
            messageParts.push("");
            messageParts.push("--alt_boundary--");
          } else {
            messageParts.push("Content-Type: text/plain; charset=UTF-8");
            messageParts.push("Content-Transfer-Encoding: 7bit");
            messageParts.push("");
            messageParts.push(message);
          }

          for (const file of files) {
            messageParts.push(`--${boundary}`);
            messageParts.push(
              `Content-Type: ${file.mimetype || "application/octet-stream"}`
            );
            messageParts.push("Content-Transfer-Encoding: base64");
            messageParts.push(
              `Content-Disposition: attachment; filename="${file.originalname}"`
            );
            messageParts.push("");
            const fileContent = fs.readFileSync(file.path);
            const base64Content = fileContent.toString("base64");
            for (let i = 0; i < base64Content.length; i += 76) {
              messageParts.push(base64Content.substring(i, i + 76));
            }
            messageParts.push("");
          }
          messageParts.push(`--${boundary}--`);
        } else {
          messageParts.push("Content-Type: text/plain; charset=UTF-8");
          messageParts.push("");
          messageParts.push(message);
        }

        const email = messageParts.join("\r\n");
        const encodedEmail = Buffer.from(email)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const response = await gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: encodedEmail,
          },
        });

        if (files.length > 0) {
          files.forEach((file) => {
            fs.unlinkSync(file.path);
          });
        }

        res.json({
          message: "Email sent successfully",
          id: response.data.id,
          threadId: response.data.threadId,
        });
      } else if (emailClient.provider === "outlook") {
        let graphClient = emailClient.client;
        const emailMessage: any = {
          subject,
          body: {
            content: message,
            contentType: isHtml ? "html" : "text",
          },
          toRecipients: to.split(",").map((email: string) => ({
            emailAddress: { address: email.trim() },
          })),
        };

        if (cc) {
          emailMessage.ccRecipients = cc.split(",").map((email: string) => ({
            emailAddress: { address: email.trim() },
          }));
        }
        if (bcc) {
          emailMessage.bccRecipients = bcc.split(",").map((email: string) => ({
            emailAddress: { address: email.trim() },
          }));
        }

        if (files.length > 0) {
          emailMessage.attachments = files.map((file) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: file.originalname,
            contentType: file.mimetype || "application/octet-stream",
            contentBytes: fs.readFileSync(file.path).toString("base64"),
          }));
        }

        let response;
        try {
          response = await graphClient.api("/me/sendMail").post({
            message: emailMessage,
            saveToSentItems: true,
          });
        } catch (error: any) {
          if (error.statusCode === 401 && emailClient.refreshAccessToken) {
            const newAccessToken = await emailClient.refreshAccessToken();
            graphClient = Client.init({
              authProvider: async (done) => {
                done(null, newAccessToken);
              },
            });
            response = await graphClient.api("/me/sendMail").post({
              message: emailMessage,
              saveToSentItems: true,
            });
          } else {
            throw error;
          }
        }

        if (files.length > 0) {
          files.forEach((file) => {
            fs.unlinkSync(file.path);
          });
        }

        res.json({
          message: "Email sent successfully",
          id: response.id,
          threadId: response.conversationId,
        });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  }
);

// **Route: Reply to Email**
router.post(
  "/:id/reply",
  auth,
  upload.array("attachments"),
  async (req: AuthRequest, res) => {
    try {
      let emailClient = await getEmailClient(req.user!.userId);
      const { message, isHtml = false } = req.body;
      const files = req.files as Express.Multer.File[];

      if (emailClient.provider === "gmail") {
        const gmail = emailClient.client;
        const originalEmail = await gmail.users.messages.get({
          userId: "me",
          id: req.params.id,
          format: "full",
          metadataHeaders: [
            "Subject",
            "From",
            "To",
            "Message-ID",
            "References",
            "In-Reply-To",
          ],
        });

        const headers = originalEmail.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === "Subject")?.value || "";
        const from = headers.find((h) => h.name === "From")?.value || "";
        const to = headers.find((h) => h.name === "To")?.value || "";
        const messageId =
          headers.find((h) => h.name === "Message-ID")?.value || "";
        const references =
          headers.find((h) => h.name === "References")?.value || "";

        const messageParts = [];
        messageParts.push(
          `From: ${req.user!.email}`,
          `To: ${from}`,
          `Subject: Re: ${subject.replace(/^Re: /i, "")}`,
          `In-Reply-To: ${messageId}`,
          `References: ${
            references ? `${references} ${messageId}` : messageId
          }`,
          "MIME-Version: 1.0"
        );

        const boundary = `boundary_${Date.now().toString(16)}`;
        if (files.length > 0 || isHtml) {
          messageParts.push(
            `Content-Type: multipart/mixed; boundary=${boundary}`
          );
          messageParts.push("");
          messageParts.push(`--${boundary}`);
          if (isHtml) {
            messageParts.push(
              "Content-Type: multipart/alternative; boundary=alt_boundary"
            );
            messageParts.push("");
            messageParts.push("--alt_boundary");
            messageParts.push("Content-Type: text/plain; charset=UTF-8");
            messageParts.push("Content-Transfer-Encoding: 7bit");
            messageParts.push("");
            messageParts.push(message.replace(/<[^>]*>/g, ""));
            messageParts.push("");
            messageParts.push("--alt_boundary");
            messageParts.push("Content-Type: text/html; charset=UTF-8");
            messageParts.push("Content-Transfer-Encoding: 7bit");
            messageParts.push("");
            messageParts.push(message);
            messageParts.push("");
            messageParts.push("--alt_boundary--");
          } else {
            messageParts.push("Content-Type: text/plain; charset=UTF-8");
            messageParts.push("Content-Transfer-Encoding: 7bit");
            messageParts.push("");
            messageParts.push(message);
          }

          for (const file of files) {
            messageParts.push(`--${boundary}`);
            messageParts.push(
              `Content-Type: ${file.mimetype || "application/octet-stream"}`
            );
            messageParts.push("Content-Transfer-Encoding: base64");
            messageParts.push(
              `Content-Disposition: attachment; filename="${file.originalname}"`
            );
            messageParts.push("");
            const fileContent = fs.readFileSync(file.path);
            const base64Content = fileContent.toString("base64");
            for (let i = 0; i < base64Content.length; i += 76) {
              messageParts.push(base64Content.substring(i, i + 76));
            }
            messageParts.push("");
          }
          messageParts.push(`--${boundary}--`);
        } else {
          messageParts.push("Content-Type: text/plain; charset=UTF-8");
          messageParts.push("");
          messageParts.push(message);
        }

        const email = messageParts.join("\r\n");
        const encodedEmail = Buffer.from(email)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const response = await gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: encodedEmail,
            threadId: originalEmail.data.threadId,
          },
        });

        if (files.length > 0) {
          files.forEach((file) => {
            fs.unlinkSync(file.path);
          });
        }

        res.json({
          message: "Reply sent successfully",
          id: response.data.id,
          threadId: response.data.threadId,
        });
      } else if (emailClient.provider === "outlook") {
        let graphClient = emailClient.client;
        let originalEmail;
        try {
          originalEmail = await graphClient
            .api(`/me/messages/${req.params.id}`)
            .get();
        } catch (error: any) {
          if (error.statusCode === 401 && emailClient.refreshAccessToken) {
            const newAccessToken = await emailClient.refreshAccessToken();
            graphClient = Client.init({
              authProvider: async (done) => {
                done(null, newAccessToken);
              },
            });
            originalEmail = await graphClient
              .api(`/me/messages/${req.params.id}`)
              .get();
          } else {
            throw error;
          }
        }

        const emailMessage: any = {
          subject: `Re: ${originalEmail.subject.replace(/^Re: /i, "")}`,
          body: {
            content: message,
            contentType: isHtml ? "html" : "text",
          },
          toRecipients: originalEmail.from.emailAddress.address
            .split(",")
            .map((email: string) => ({
              emailAddress: { address: email.trim() },
            })),
          inReplyTo: originalEmail.id,
          conversationId: originalEmail.conversationId,
        };

        if (originalEmail.ccRecipients) {
          emailMessage.ccRecipients = originalEmail.ccRecipients.map(
            (recipient: any) => ({
              emailAddress: { address: recipient.emailAddress.address },
            })
          );
        }

        if (files.length > 0) {
          emailMessage.attachments = files.map((file) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: file.originalname,
            contentType: file.mimetype || "application/octet-stream",
            contentBytes: fs.readFileSync(file.path).toString("base64"),
          }));
        }

        let response;
        try {
          response = await graphClient.api("/me/sendMail").post({
            message: emailMessage,
            saveToSentItems: true,
          });
        } catch (error: any) {
          if (error.statusCode === 401 && emailClient.refreshAccessToken) {
            const newAccessToken = await emailClient.refreshAccessToken();
            graphClient = Client.init({
              authProvider: async (done) => {
                done(null, newAccessToken);
              },
            });
            response = await graphClient.api("/me/sendMail").post({
              message: emailMessage,
              saveToSentItems: true,
            });
          } else {
            throw error;
          }
        }

        if (files.length > 0) {
          files.forEach((file) => {
            fs.unlinkSync(file.path);
          });
        }

        res.json({
          message: "Reply sent successfully",
          id: response.id,
          threadId: response.conversationId,
        });
      }
    } catch (error) {
      console.error("Error sending reply:", error);
      res.status(500).json({ error: "Failed to send reply" });
    }
  }
);

// **Route: Forward Email**
router.post(
  "/:id/forward",
  auth,
  upload.array("attachments"),
  async (req: AuthRequest, res) => {
    try {
      let emailClient = await getEmailClient(req.user!.userId);
      const { to, cc, bcc, additionalMessage, isHtml = false } = req.body;
      const additionalFiles = req.files as Express.Multer.File[];

      if (emailClient.provider === "gmail") {
        const gmail = emailClient.client;
        const originalEmail = await gmail.users.messages.get({
          userId: "me",
          id: req.params.id,
          format: "full",
        });

        const headers = originalEmail.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === "Subject")?.value || "";

        const messageParts = [];
        messageParts.push(`From: ${req.user!.email}`, `To: ${to}`);
        if (cc) messageParts.push(`Cc: ${cc}`);
        if (bcc) messageParts.push(`Bcc: ${bcc}`);
        messageParts.push(
          `Subject: Fwd: ${subject.replace(/^Fwd: /i, "")}`,
          "MIME-Version: 1.0"
        );

        const boundary = `boundary_${Date.now().toString(16)}`;
        messageParts.push(
          `Content-Type: multipart/mixed; boundary=${boundary}`
        );
        messageParts.push("");
        messageParts.push(`--${boundary}`);

        if (additionalMessage) {
          if (isHtml) {
            messageParts.push(
              "Content-Type: multipart/alternative; boundary=alt_boundary"
            );
            messageParts.push("");
            messageParts.push("--alt_boundary");
            messageParts.push("Content-Type: text/plain; charset=UTF-8");
            messageParts.push("Content-Transfer-Encoding: 7bit");
            messageParts.push("");
            messageParts.push(additionalMessage.replace(/<[^>]*>/g, ""));
            messageParts.push("");
            messageParts.push("--alt_boundary");
            messageParts.push("Content-Type: text/html; charset=UTF-8");
            messageParts.push("Content-Transfer-Encoding: 7bit");
            messageParts.push("");
            messageParts.push(additionalMessage);
            messageParts.push("");
            messageParts.push("--alt_boundary--");
          } else {
            messageParts.push("Content-Type: text/plain; charset=UTF-8");
            messageParts.push("Content-Transfer-Encoding: 7bit");
            messageParts.push("");
            messageParts.push(additionalMessage);
            messageParts.push("");
          }
          messageParts.push(`--${boundary}`);
        }

        messageParts.push("Content-Type: message/rfc822");
        messageParts.push("Content-Disposition: inline");
        messageParts.push("");
        headers.forEach((header) => {
          messageParts.push(`${header.name}: ${header.value}`);
        });

        const parts = originalEmail.data.payload?.parts || [];
        let originalBody = "";
        if (originalEmail.data.payload?.body?.data) {
          const buff = Buffer.from(
            originalEmail.data.payload.body.data,
            "base64"
          );
          originalBody = buff.toString();
        } else {
          originalBody = extractBodyGmail(parts);
        }

        messageParts.push("");
        messageParts.push(originalBody);

        const getAttachmentsGmail = async (
          parts: gmail_v1.Schema$MessagePart[],
          parentId: string = ""
        ): Promise<{ filename: string; mimeType: string; data: string }[]> => {
          if (!parts) return [];
          let attachments: {
            filename: string;
            mimeType: string;
            data: string;
          }[] = [];

          for (const part of parts) {
            const { partId, mimeType, filename, body, parts: subParts } = part;

            if (filename && filename.length > 0 && body?.attachmentId) {
              const attachment = await gmail.users.messages.attachments.get({
                userId: "me",
                messageId: originalEmail.data.id!,
                id: body.attachmentId,
              });

              attachments.push({
                filename,
                mimeType: mimeType || "application/octet-stream",
                data: attachment.data.data || "",
              });
            }

            if (subParts) {
              const currentPartId = partId || "";
              const subAttachments = await getAttachmentsGmail(
                subParts,
                parentId ? `${parentId}.${currentPartId}` : currentPartId
              );
              attachments = [...attachments, ...subAttachments];
            }
          }

          return attachments;
        };

        const originalAttachments = await getAttachmentsGmail(parts);
        for (const attachment of originalAttachments) {
          messageParts.push(`--${boundary}`);
          messageParts.push(`Content-Type: ${attachment.mimeType}`);
          messageParts.push("Content-Transfer-Encoding: base64");
          messageParts.push(
            `Content-Disposition: attachment; filename="${attachment.filename}"`
          );
          messageParts.push("");
          const base64Content = attachment
            .data!.replace(/-/g, "+")
            .replace(/_/g, "/");
          for (let i = 0; i < base64Content.length; i += 76) {
            messageParts.push(base64Content.substring(i, i + 76));
          }
          messageParts.push("");
        }

        for (const file of additionalFiles) {
          messageParts.push(`--${boundary}`);
          messageParts.push(
            `Content-Type: ${file.mimetype || "application/octet-stream"}`
          );
          messageParts.push("Content-Transfer-Encoding: base64");
          messageParts.push(
            `Content-Disposition: attachment; filename="${file.originalname}"`
          );
          messageParts.push("");
          const fileContent = fs.readFileSync(file.path);
          const base64Content = fileContent.toString("base64");
          for (let i = 0; i < base64Content.length; i += 76) {
            messageParts.push(base64Content.substring(i, i + 76));
          }
          messageParts.push("");
        }

        messageParts.push(`--${boundary}--`);
        const email = messageParts.join("\r\n");
        const encodedEmail = Buffer.from(email)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const response = await gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: encodedEmail,
          },
        });

        if (additionalFiles.length > 0) {
          additionalFiles.forEach((file) => {
            fs.unlinkSync(file.path);
          });
        }

        res.json({
          message: "Email forwarded successfully",
          id: response.data.id,
          threadId: response.data.threadId,
        });
      } else if (emailClient.provider === "outlook") {
        let graphClient = emailClient.client;
        let originalEmail;
        try {
          originalEmail = await graphClient
            .api(`/me/messages/${req.params.id}`)
            .get();
        } catch (error: any) {
          if (error.statusCode === 401 && emailClient.refreshAccessToken) {
            const newAccessToken = await emailClient.refreshAccessToken();
            graphClient = Client.init({
              authProvider: async (done) => {
                done(null, newAccessToken);
              },
            });
            originalEmail = await graphClient
              .api(`/me/messages/${req.params.id}`)
              .get();
          } else {
            throw error;
          }
        }

        const emailMessage: any = {
          subject: `Fwd: ${originalEmail.subject.replace(/^Fwd: /i, "")}`,
          body: {
            content: additionalMessage
              ? `${additionalMessage}\n\n--- Forwarded Message ---\n${originalEmail.body.content}`
              : originalEmail.body.content,
            contentType: isHtml ? "html" : "text",
          },
          toRecipients: to.split(",").map((email: string) => ({
            emailAddress: { address: email.trim() },
          })),
        };

        if (cc) {
          emailMessage.ccRecipients = cc.split(",").map((email: string) => ({
            emailAddress: { address: email.trim() },
          }));
        }
        if (bcc) {
          emailMessage.bccRecipients = bcc.split(",").map((email: string) => ({
            emailAddress: { address: email.trim() },
          }));
        }

        let originalAttachments;
        try {
          originalAttachments = await graphClient
            .api(`/me/messages/${req.params.id}/attachments`)
            .get();
        } catch (error: any) {
          if (error.statusCode === 401 && emailClient.refreshAccessToken) {
            const newAccessToken = await emailClient.refreshAccessToken();
            graphClient = Client.init({
              authProvider: async (done) => {
                done(null, newAccessToken);
              },
            });
            originalAttachments = await graphClient
              .api(`/me/messages/${req.params.id}/attachments`)
              .get();
          } else {
            throw error;
          }
        }

        if (originalAttachments.value.length > 0) {
          emailMessage.attachments = originalAttachments.value.map(
            (attachment: any) => ({
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: attachment.name,
              contentType: attachment.contentType,
              contentBytes: attachment.contentBytes,
            })
          );
        }

        if (additionalFiles.length > 0) {
          emailMessage.attachments = emailMessage.attachments || [];
          emailMessage.attachments.push(
            ...additionalFiles.map((file) => ({
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: file.originalname,
              contentType: file.mimetype || "application/octet-stream",
              contentBytes: fs.readFileSync(file.path).toString("base64"),
            }))
          );
        }

        let response;
        try {
          response = await graphClient.api("/me/sendMail").post({
            message: emailMessage,
            saveToSentItems: true,
          });
        } catch (error: any) {
          if (error.statusCode === 401 && emailClient.refreshAccessToken) {
            const newAccessToken = await emailClient.refreshAccessToken();
            graphClient = Client.init({
              authProvider: async (done) => {
                done(null, newAccessToken);
              },
            });
            response = await graphClient.api("/me/sendMail").post({
              message: emailMessage,
              saveToSentItems: true,
            });
          } else {
            throw error;
          }
        }

        if (additionalFiles.length > 0) {
          additionalFiles.forEach((file) => {
            fs.unlinkSync(file.path);
          });
        }

        res.json({
          message: "Email forwarded successfully",
          id: response.id,
          threadId: response.conversationId,
        });
      }
    } catch (error) {
      console.error("Error forwarding email:", error);
      res.status(500).json({ error: "Failed to forward email" });
    }
  }
);

// **Route: Move Email to Trash**
router.post("/:id/trash", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      await gmail.users.messages.trash({
        userId: "me",
        id: req.params.id,
      });
      res.json({ success: true, message: "Email moved to trash" });
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      try {
        await graphClient.api(`/me/messages/${req.params.id}/move`).post({
          destinationId: "deleteditems",
        });
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          await graphClient.api(`/me/messages/${req.params.id}/move`).post({
            destinationId: "deleteditems",
          });
        } else {
          throw error;
        }
      }
      res.json({ success: true, message: "Email moved to trash" });
    }
  } catch (error) {
    console.error("Error moving email to trash:", error);
    res.status(500).json({ error: "Failed to move email to trash" });
  }
});

// **Route: Restore Email from Trash**
router.post("/:id/untrash", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      await gmail.users.messages.untrash({
        userId: "me",
        id: req.params.id,
      });
      res.json({ success: true, message: "Email restored from trash" });
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      try {
        await graphClient.api(`/me/messages/${req.params.id}/move`).post({
          destinationId: "inbox",
        });
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          await graphClient.api(`/me/messages/${req.params.id}/move`).post({
            destinationId: "inbox",
          });
        } else {
          throw error;
        }
      }
      res.json({ success: true, message: "Email restored from trash" });
    }
  } catch (error) {
    console.error("Error restoring email from trash:", error);
    res.status(500).json({ error: "Failed to restore email from trash" });
  }
});

// **Route: Permanently Delete Email**
router.delete("/:id", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      await gmail.users.messages.delete({
        userId: "me",
        id: req.params.id,
      });
      res.json({ success: true, message: "Email permanently deleted" });
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      try {
        await graphClient.api(`/me/messages/${req.params.id}`).delete();
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          await graphClient.api(`/me/messages/${req.params.id}`).delete();
        } else {
          throw error;
        }
      }
      res.json({ success: true, message: "Email permanently deleted" });
    }
  } catch (error) {
    console.error("Error deleting email:", error);
    res.status(500).json({ error: "Failed to delete email" });
  }
});

// **Route: Fetch Single Email**
router.get("/:id", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      const email = await gmail.users.messages.get({
        userId: "me",
        id: req.params.id,
        format: "full",
      });

      const headers = email.data.payload?.headers || [];
      const parts = email.data.payload?.parts || [];
      let htmlBody = "";
      let plainBody = "";

      if (email.data.payload?.body?.data) {
        const buff = Buffer.from(email.data.payload.body.data, "base64");
        if (email.data.payload.mimeType === "text/html") {
          htmlBody = buff.toString();
        } else if (email.data.payload.mimeType === "text/plain") {
          plainBody = buff.toString();
        }
      } else {
        const extractedBody = extractBodyGmail(parts);
        if (extractedBody.includes("<")) {
          htmlBody = extractedBody;
        } else {
          plainBody = extractedBody;
        }
      }

      res.json({
        id: email.data.id,
        threadId: email.data.threadId,
        labelIds: email.data.labelIds,
        snippet: email.data.snippet,
        internalDate: email.data.internalDate,
        headers: headers.reduce((acc, header) => {
          if (header.name && header.value) {
            (acc as any)[header.name.toLowerCase()] = header.value;
          }
          return acc;
        }, {}),
        body: {
          html: htmlBody,
          plain: plainBody,
        },
        attachments:
          email.data.payload?.parts
            ?.filter((part) => part.filename)
            ?.map((part) => ({
              id: part.body?.attachmentId,
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body?.size,
            })) || [],
      });
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      let email;
      try {
        email = await graphClient.api(`/me/messages/${req.params.id}`).get();
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          email = await graphClient.api(`/me/messages/${req.params.id}`).get();
        } else {
          throw error;
        }
      }

      let attachments;
      try {
        attachments = await graphClient
          .api(`/me/messages/${req.params.id}/attachments`)
          .get();
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          attachments = await graphClient
            .api(`/me/messages/${req.params.id}/attachments`)
            .get();
        } else {
          throw error;
        }
      }

      res.json({
        id: email.id,
        threadId: email.conversationId,
        labelIds: email.categories || [],
        snippet: email.bodyPreview,
        internalDate: new Date(email.receivedDateTime).getTime().toString(),
        headers: {
          subject: email.subject,
          from: email.from?.emailAddress?.address || "",
          to:
            email.toRecipients
              ?.map((r: any) => r.emailAddress.address)
              .join(", ") || "",
          cc:
            email.ccRecipients
              ?.map((r: any) => r.emailAddress.address)
              .join(", ") || "",
          bcc:
            email.bccRecipients
              ?.map((r: any) => r.emailAddress.address)
              .join(", ") || "",
          date: email.receivedDateTime,
        },
        body: {
          html: email.body.contentType === "html" ? email.body.content : "",
          plain: email.body.contentType === "text" ? email.body.content : "",
        },
        attachments: attachments.value.map((attachment: any) => ({
          id: attachment.id,
          filename: attachment.name,
          mimeType: attachment.contentType,
          size: attachment.size,
        })),
      });
    }
  } catch (error) {
    console.error("Error fetching email:", error);
    res.status(500).json({ error: "Failed to fetch email" });
  }
});

// **Route: Modify Email Labels**
router.post("/:id/modify", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);
    const { addLabelIds = [], removeLabelIds = [] } = req.body;

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      const response = await gmail.users.messages.modify({
        userId: "me",
        id: req.params.id,
        requestBody: {
          addLabelIds,
          removeLabelIds,
        },
      });
      res.json({
        success: true,
        message: "Email labels modified",
        labelIds: response.data.labelIds,
      });
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      let email;
      try {
        email = await graphClient.api(`/me/messages/${req.params.id}`).get();
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          email = await graphClient.api(`/me/messages/${req.params.id}`).get();
        } else {
          throw error;
        }
      }

      let categories = email.categories || [];
      categories = categories.filter(
        (cat: string) => !removeLabelIds.includes(cat)
      );
      categories = [...new Set([...categories, ...addLabelIds])];

      try {
        await graphClient.api(`/me/messages/${req.params.id}`).patch({
          categories,
        });
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          await graphClient.api(`/me/messages/${req.params.id}`).patch({
            categories,
          });
        } else {
          throw error;
        }
      }

      res.json({
        success: true,
        message: "Email labels modified",
        labelIds: categories,
      });
    }
  } catch (error) {
    console.error("Error modifying email labels:", error);
    res.status(500).json({ error: "Failed to modify email labels" });
  }
});

// **Route: Batch Modify Emails**
router.post("/batchModify", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);
    const { ids, addLabelIds = [], removeLabelIds = [] } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No message IDs provided" });
    }

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      await gmail.users.messages.batchModify({
        userId: "me",
        requestBody: {
          ids,
          addLabelIds,
          removeLabelIds,
        },
      });
      res.json({
        success: true,
        message: `Modified labels for ${ids.length} emails`,
      });
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      for (const id of ids) {
        let email;
        try {
          email = await graphClient.api(`/me/messages/${id}`).get();
        } catch (error: any) {
          if (error.statusCode === 401 && emailClient.refreshAccessToken) {
            const newAccessToken = await emailClient.refreshAccessToken();
            graphClient = Client.init({
              authProvider: async (done) => {
                done(null, newAccessToken);
              },
            });
            email = await graphClient.api(`/me/messages/${id}`).get();
          } else {
            throw error;
          }
        }

        let categories = email.categories || [];
        categories = categories.filter(
          (cat: string) => !removeLabelIds.includes(cat)
        );
        categories = [...new Set([...categories, ...addLabelIds])];

        try {
          await graphClient.api(`/me/messages/${id}`).patch({
            categories,
          });
        } catch (error: any) {
          if (error.statusCode === 401 && emailClient.refreshAccessToken) {
            const newAccessToken = await emailClient.refreshAccessToken();
            graphClient = Client.init({
              authProvider: async (done) => {
                done(null, newAccessToken);
              },
            });
            await graphClient.api(`/me/messages/${id}`).patch({
              categories,
            });
          } else {
            throw error;
          }
        }
      }
      res.json({
        success: true,
        message: `Modified labels for ${ids.length} emails`,
      });
    }
  } catch (error) {
    console.error("Error batch modifying emails:", error);
    res.status(500).json({ error: "Failed to batch modify emails" });
  }
});

// **Route: Mark Email as Read/Unread**
router.post("/:id/markRead", auth, async (req: AuthRequest, res) => {
  try {
    let emailClient = await getEmailClient(req.user!.userId);
    const { read = true } = req.body;

    if (emailClient.provider === "gmail") {
      const gmail = emailClient.client;
      await gmail.users.messages.modify({
        userId: "me",
        id: req.params.id,
        requestBody: {
          removeLabelIds: read ? ["UNREAD"] : [],
          addLabelIds: read ? [] : ["UNREAD"],
        },
      });
      res.json({
        success: true,
        message: `Email marked as ${read ? "read" : "unread"}`,
      });
    } else if (emailClient.provider === "outlook") {
      let graphClient = emailClient.client;
      try {
        await graphClient.api(`/me/messages/${req.params.id}`).patch({
          isRead: read,
        });
      } catch (error: any) {
        if (error.statusCode === 401 && emailClient.refreshAccessToken) {
          const newAccessToken = await emailClient.refreshAccessToken();
          graphClient = Client.init({
            authProvider: async (done) => {
              done(null, newAccessToken);
            },
          });
          await graphClient.api(`/me/messages/${req.params.id}`).patch({
            isRead: read,
          });
        } else {
          throw error;
        }
      }
      res.json({
        success: true,
        message: `Email marked as ${read ? "read" : "unread"}`,
      });
    }
  } catch (error) {
    console.error(
      `Error marking email as ${req.body.read ? "read" : "unread"}:`,
      error
    );
    res.status(500).json({
      error: `Failed to mark email as ${req.body.read ? "read" : "unread"}`,
    });
  }
});

export default router;
