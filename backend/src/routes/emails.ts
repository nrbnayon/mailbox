// backend\src\routes\emails.ts
import express from "express";
import { google } from "googleapis";
import { auth, AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";

const router = express.Router();

// Get emails
router.get("/", auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.googleAccessToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const response = await gmail.users.messages.list({
      userId: "me",
      q: req.query.q as string,
      maxResults: 20,
    });

    const messages = response.data.messages || [];
    const emails = await Promise.all(
      messages.map(async (message) => {
        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id!,
        });

        const headers = email.data.payload?.headers;
        const subject = headers?.find((h) => h.name === "Subject")?.value || "";
        const from = headers?.find((h) => h.name === "From")?.value || "";
        const date = headers?.find((h) => h.name === "Date")?.value || "";

        return {
          id: message.id,
          subject,
          from,
          date,
          preview: email.data.snippet,
          unread: email.data.labelIds?.includes("UNREAD") || false,
        };
      })
    );

    res.json(emails);
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

// Get single email
router.get("/:id", auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.googleAccessToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const email = await gmail.users.messages.get({
      userId: "me",
      id: req.params.id,
      format: "full",
    });

    res.json(email.data);
  } catch (error) {
    console.error("Error fetching email:", error);
    res.status(500).json({ error: "Failed to fetch email" });
  }
});

// Send email
router.post("/", auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.googleAccessToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const { to, subject, message } = req.body;

    const email = [
      'Content-Type: text/plain; charset="UTF-8"\r\n',
      "MIME-Version: 1.0\r\n",
      `To: ${to}\r\n`,
      `Subject: ${subject}\r\n`,
      "\r\n",
      message,
    ].join("");

    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
      },
    });

    res.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
