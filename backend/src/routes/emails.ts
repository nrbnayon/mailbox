// backend\src\routes\emails.ts
import express from "express";
import { google, gmail_v1 } from "googleapis";
import { auth, AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import mime from "mime-types";

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

// Helper function to initialize Gmail API client
const getGmailClient = async (userId: any) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.refreshToken,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
};

// Get emails with pagination, filtering, and advanced search
router.get("/", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);

    // Extract query parameters
    const {
      q = "",
      maxResults = 50,
      pageToken,
      labelIds,
      includeSpamTrash = false,
    } = req.query;

    // Build request parameters
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

    // Get messages list
    const response = await gmail.users.messages.list(params);

    // If no messages, return empty array
    if (!response.data.messages) {
      return res.json({
        messages: [],
        nextPageToken: response.data.nextPageToken || null,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      });
    }

    // Get detailed info for each message
    const emails = await Promise.all(
      response.data.messages.map(async (message) => {
        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id!,
          format: "full",
          metadataHeaders: ["Subject", "From", "To", "Date", "Cc", "Bcc"],
        });

        const headers = email.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === "Subject")?.value || "";
        const from = headers.find((h) => h.name === "From")?.value || "";
        const to = headers.find((h) => h.name === "To")?.value || "";
        const cc = headers.find((h) => h.name === "Cc")?.value || "";
        const bcc = headers.find((h) => h.name === "Bcc")?.value || "";
        const date = headers.find((h) => h.name === "Date")?.value || "";

        // Get attachment info if available
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
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

// Get all labels
router.get("/labels", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    const response = await gmail.users.labels.list({ userId: "me" });
    res.json(response.data.labels || []);
  } catch (error) {
    console.error("Error fetching labels:", error);
    res.status(500).json({ error: "Failed to fetch labels" });
  }
});

// Create a new label
router.post("/labels", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    const {
      name,
      labelListVisibility = "labelShow",
      messageListVisibility = "show",
    } = req.body;

    const response = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name,
        labelListVisibility,
        messageListVisibility,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error creating label:", error);
    res.status(500).json({ error: "Failed to create label" });
  }
});

// Update a label
router.put("/labels/:id", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    const { name, labelListVisibility, messageListVisibility } = req.body;

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
  } catch (error) {
    console.error("Error updating label:", error);
    res.status(500).json({ error: "Failed to update label" });
  }
});

// Delete a label
router.delete("/labels/:id", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    await gmail.users.labels.delete({ userId: "me", id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting label:", error);
    res.status(500).json({ error: "Failed to delete label" });
  }
});

// Get full thread
router.get("/threads/:id", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: req.params.id,
      format: "full",
    });

    res.json(thread.data);
  } catch (error) {
    console.error("Error fetching thread:", error);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// Get single email with detailed parsing
router.get("/:id", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);

    const email = await gmail.users.messages.get({
      userId: "me",
      id: req.params.id,
      format: "full",
    });

    // Process email to extract body content and attachments
    const headers = email.data.payload?.headers || [];
    const parts = email.data.payload?.parts || [];

    let htmlBody = "";
    let plainBody = "";
    const attachments: {
      id: string;
      filename: string;
      mimeType: string;
      size: number;
    }[] = [];

    // Function to process message parts recursively
    const processParts = (parts: any) => {
      if (!parts) return;

      for (const part of parts) {
        const { mimeType, body, filename, parts: subParts } = part;

        // Process attachments
        if (filename && filename.length > 0) {
          attachments.push({
            id: body.attachmentId,
            filename,
            mimeType,
            size: body.size,
          });
        }
        // Process HTML body
        else if (mimeType === "text/html" && body.data) {
          const buff = Buffer.from(body.data, "base64");
          htmlBody += buff.toString();
        }
        // Process plain text body
        else if (mimeType === "text/plain" && body.data) {
          const buff = Buffer.from(body.data, "base64");
          plainBody += buff.toString();
        }
        // Process nested parts
        else if (subParts) {
          processParts(subParts);
        }
      }
    };

    // Handle case where email body is directly in the payload
    if (email.data.payload?.body?.data) {
      const buff = Buffer.from(email.data.payload.body.data, "base64");
      if (email.data.payload.mimeType === "text/html") {
        htmlBody = buff.toString();
      } else if (email.data.payload.mimeType === "text/plain") {
        plainBody = buff.toString();
      }
    } else if (parts) {
      processParts(parts);
    }

    // Extract header information
    const emailData = {
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
      attachments,
    };

    res.json(emailData);
  } catch (error) {
    console.error("Error fetching email:", error);
    res.status(500).json({ error: "Failed to fetch email" });
  }
});

// Get email attachment
router.get(
  "/:messageId/attachments/:attachmentId",
  auth,
  async (req: AuthRequest, res) => {
    try {
      const gmail = await getGmailClient(req.user!.userId);

      const { messageId, attachmentId } = req.params;
      const { filename } = req.query;

      const attachment = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: attachmentId,
      });

      if (!attachment.data.data) {
        return res.status(404).json({ error: "Attachment data not found" });
      }

      // Convert from base64url to base64
      const base64Data = attachment.data.data
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const buffer = Buffer.from(base64Data, "base64");

      // Set content type if we have the filename
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
    } catch (error) {
      console.error("Error fetching attachment:", error);
      res.status(500).json({ error: "Failed to fetch attachment" });
    }
  }
);

// Send email with attachments
router.post(
  "/",
  auth,
  upload.array("attachments"),
  async (req: AuthRequest, res) => {
    try {
      const gmail = await getGmailClient(req.user!.userId);

      const { to, cc, bcc, subject, message, isHtml = false } = req.body;
      const files = req.files as Express.Multer.File[];

      // Start building email
      const messageParts = [];

      // Add headers
      messageParts.push(`From: ${req.user!.email}`, `To: ${to}`);

      if (cc) messageParts.push(`Cc: ${cc}`);
      if (bcc) messageParts.push(`Bcc: ${bcc}`);

      messageParts.push(`Subject: ${subject}`, "MIME-Version: 1.0");

      // Create a boundary for multipart messages
      const boundary = `boundary_${Date.now().toString(16)}`;

      // If we have attachments or HTML content, create a multipart message
      if (files.length > 0 || isHtml) {
        messageParts.push(
          `Content-Type: multipart/mixed; boundary=${boundary}`
        );
        messageParts.push("");
        messageParts.push(`--${boundary}`);

        // Add the body
        if (isHtml) {
          messageParts.push(
            "Content-Type: multipart/alternative; boundary=alt_boundary"
          );
          messageParts.push("");
          messageParts.push("--alt_boundary");
          messageParts.push("Content-Type: text/plain; charset=UTF-8");
          messageParts.push("Content-Transfer-Encoding: 7bit");
          messageParts.push("");
          // Add plain text version (strip HTML)
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

        // Add attachments
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

          // Read file and convert to base64
          const fileContent = fs.readFileSync(file.path);
          const base64Content = fileContent.toString("base64");

          // Split the base64 content into lines of 76 characters
          for (let i = 0; i < base64Content.length; i += 76) {
            messageParts.push(base64Content.substring(i, i + 76));
          }
          messageParts.push("");
        }

        messageParts.push(`--${boundary}--`);
      } else {
        // Simple text email
        messageParts.push("Content-Type: text/plain; charset=UTF-8");
        messageParts.push("");
        messageParts.push(message);
      }

      // Join all parts with proper line breaks
      const email = messageParts.join("\r\n");

      // Encode the email
      const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send the email
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedEmail,
        },
      });

      // Clean up temporary files if any
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
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  }
);

// Reply to an email
router.post(
  "/:id/reply",
  auth,
  upload.array("attachments"),
  async (req: AuthRequest, res) => {
    try {
      const gmail = await getGmailClient(req.user!.userId);

      const { message, isHtml = false } = req.body;
      const files = req.files as Express.Multer.File[];

      // Get the original message to extract headers
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

      // Start building reply email
      const messageParts = [];

      // Add headers for reply (swap from/to)
      messageParts.push(
        `From: ${req.user!.email}`,
        `To: ${from}`,
        `Subject: Re: ${subject.replace(/^Re: /i, "")}`,
        `In-Reply-To: ${messageId}`,
        `References: ${references ? `${references} ${messageId}` : messageId}`,
        "MIME-Version: 1.0"
      );

      // Create a boundary for multipart messages
      const boundary = `boundary_${Date.now().toString(16)}`;

      // If we have attachments or HTML content, create a multipart message
      if (files.length > 0 || isHtml) {
        messageParts.push(
          `Content-Type: multipart/mixed; boundary=${boundary}`
        );
        messageParts.push("");
        messageParts.push(`--${boundary}`);

        // Add the body
        if (isHtml) {
          messageParts.push(
            "Content-Type: multipart/alternative; boundary=alt_boundary"
          );
          messageParts.push("");
          messageParts.push("--alt_boundary");
          messageParts.push("Content-Type: text/plain; charset=UTF-8");
          messageParts.push("Content-Transfer-Encoding: 7bit");
          messageParts.push("");
          // Add plain text version (strip HTML)
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

        // Add attachments
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

          // Read file and convert to base64
          const fileContent = fs.readFileSync(file.path);
          const base64Content = fileContent.toString("base64");

          // Split the base64 content into lines of 76 characters
          for (let i = 0; i < base64Content.length; i += 76) {
            messageParts.push(base64Content.substring(i, i + 76));
          }
          messageParts.push("");
        }

        messageParts.push(`--${boundary}--`);
      } else {
        // Simple text email
        messageParts.push("Content-Type: text/plain; charset=UTF-8");
        messageParts.push("");
        messageParts.push(message);
      }

      // Join all parts with proper line breaks
      const email = messageParts.join("\r\n");

      // Encode the email
      const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send the email
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedEmail,
          threadId: originalEmail.data.threadId,
        },
      });

      // Clean up temporary files if any
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
    } catch (error) {
      console.error("Error sending reply:", error);
      res.status(500).json({ error: "Failed to send reply" });
    }
  }
);

// Forward an email
router.post(
  "/:id/forward",
  auth,
  upload.array("attachments"),
  async (req: AuthRequest, res) => {
    try {
      const gmail = await getGmailClient(req.user!.userId);

      const { to, cc, bcc, additionalMessage, isHtml = false } = req.body;
      const additionalFiles = req.files as Express.Multer.File[];

      // Get the original message
      const originalEmail = await gmail.users.messages.get({
        userId: "me",
        id: req.params.id,
        format: "full",
      });

      const headers = originalEmail.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "";

      // Start building forwarded email
      const messageParts = [];

      // Add headers
      messageParts.push(`From: ${req.user!.email}`, `To: ${to}`);

      if (cc) messageParts.push(`Cc: ${cc}`);
      if (bcc) messageParts.push(`Bcc: ${bcc}`);

      messageParts.push(
        `Subject: Fwd: ${subject.replace(/^Fwd: /i, "")}`,
        "MIME-Version: 1.0"
      );

      // Create a boundary for multipart messages
      const boundary = `boundary_${Date.now().toString(16)}`;
      messageParts.push(`Content-Type: multipart/mixed; boundary=${boundary}`);
      messageParts.push("");
      messageParts.push(`--${boundary}`);

      // Add the user's additional message if provided
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

      // Add forwarded message headers
      messageParts.push("Content-Type: message/rfc822");
      messageParts.push("Content-Disposition: inline");
      messageParts.push("");

      // Add original headers
      headers.forEach((header) => {
        messageParts.push(`${header.name}: ${header.value}`);
      });

      // Process original message body and attachments
      const parts = originalEmail.data.payload?.parts || [];
      let originalBody = "";

      // Function to extract body content
     const extractBody = (
       parts: gmail_v1.Schema$MessagePart[] | undefined
     ): string => {
       if (!parts) return "";

       let body = "";

       parts.forEach((part) => {
         if (part.mimeType === "text/html" && part.body?.data) {
           body += Buffer.from(part.body.data, "base64").toString("utf-8");
         } else if (part.mimeType === "text/plain" && part.body?.data) {
           body += Buffer.from(part.body.data, "base64").toString("utf-8");
         } else if (part.parts) {
           body += extractBody(part.parts); // Recursive call to extract nested content
         }
       });

       return body.trim();
     };

      // If body is directly in payload
      if (originalEmail.data.payload?.body?.data) {
        const buff = Buffer.from(
          originalEmail.data.payload.body.data,
          "base64"
        );
        originalBody = buff.toString();
      } else {
        originalBody = await extractBody(parts);
      }

      messageParts.push("");
      messageParts.push(originalBody);

      // Add original attachments
      const getAttachments = async (
        parts: any[],
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

          if (filename && filename.length > 0 && body.attachmentId) {
            // Get attachment data
            const attachment = await gmail.users.messages.attachments.get({
              userId: "me",
              messageId: originalEmail.data.id!,
              id: body.attachmentId,
            });

            attachments.push({
              filename,
              mimeType,
              data: attachment.data.data || "",
            });
          }

          if (subParts) {
            const subAttachments = await getAttachments(
              subParts,
              parentId ? `${parentId}.${partId}` : partId
            );
            attachments = [...attachments, ...subAttachments];
          }
        }

        return attachments;
      };

      const originalAttachments = await getAttachments(parts);

      // Add original attachments
      for (const attachment of originalAttachments) {
        messageParts.push(`--${boundary}`);
        messageParts.push(`Content-Type: ${attachment.mimeType}`);
        messageParts.push("Content-Transfer-Encoding: base64");
        messageParts.push(
          `Content-Disposition: attachment; filename="${attachment.filename}"`
        );
        messageParts.push("");

        // Process base64 data
        const base64Content = attachment
          .data!.replace(/-/g, "+")
          .replace(/_/g, "/");

        // Split the base64 content into lines of 76 characters
        for (let i = 0; i < base64Content.length; i += 76) {
          messageParts.push(base64Content.substring(i, i + 76));
        }
        messageParts.push("");
      }

      // Add additional attachments from the request
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

        // Read file and convert to base64
        const fileContent = fs.readFileSync(file.path);
        const base64Content = fileContent.toString("base64");

        // Split the base64 content into lines of 76 characters
        for (let i = 0; i < base64Content.length; i += 76) {
          messageParts.push(base64Content.substring(i, i + 76));
        }
        messageParts.push("");
      }

      messageParts.push(`--${boundary}--`);

      // Join all parts with proper line breaks
      const email = messageParts.join("\r\n");

      // Encode the email
      const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send the email
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedEmail,
        },
      });

      // Clean up temporary files if any
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
    } catch (error) {
      console.error("Error forwarding email:", error);
      res.status(500).json({ error: "Failed to forward email" });
    }
  }
);

// Move email to trash
router.post("/:id/trash", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    const response = await gmail.users.messages.trash({
      userId: "me",
      id: req.params.id,
    });
    res.json({ success: true, message: "Email moved to trash" });
  } catch (error) {
    console.error("Error moving email to trash:", error);
    res.status(500).json({ error: "Failed to move email to trash" });
  }
});

// Restore email from trash
router.post("/:id/untrash", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    const response = await gmail.users.messages.untrash({
      userId: "me",
      id: req.params.id,
    });
    res.json({ success: true, message: "Email restored from trash" });
  } catch (error) {
    console.error("Error restoring email from trash:", error);
    res.status(500).json({ error: "Failed to restore email from trash" });
  }
});

// Permanently delete email
router.delete("/:id", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    await gmail.users.messages.delete({
      userId: "me",
      id: req.params.id,
    });
    res.json({ success: true, message: "Email permanently deleted" });
  } catch (error) {
    console.error("Error deleting email:", error);
    res.status(500).json({ error: "Failed to delete email" });
  }
});

// Modify email labels (add/remove)
router.post("/:id/modify", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    const { addLabelIds = [], removeLabelIds = [] } = req.body;

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
  } catch (error) {
    console.error("Error modifying email labels:", error);
    res.status(500).json({ error: "Failed to modify email labels" });
  }
});

// Batch modify multiple emails (add/remove labels)
router.post("/batchModify", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    const { ids, addLabelIds = [], removeLabelIds = [] } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No message IDs provided" });
    }

    const response = await gmail.users.messages.batchModify({
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
  } catch (error) {
    console.error("Error batch modifying emails:", error);
    res.status(500).json({ error: "Failed to batch modify emails" });
  }
});

// Mark as read/unread
router.post("/:id/markRead", auth, async (req: AuthRequest, res) => {
  try {
    const gmail = await getGmailClient(req.user!.userId);
    const { read = true } = req.body;

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
