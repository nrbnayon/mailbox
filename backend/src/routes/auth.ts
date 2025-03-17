import express from "express";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { auth, AuthRequest, tokenAuth } from "../middleware/auth.js";
import * as msal from "@azure/msal-node";
import axios from "axios";
import { refreshTokenByProvider } from "../services/tokenService.js";

const router = express.Router();

// Define interfaces for API responses
interface MicrosoftUserResponse {
  id: string;
  mail?: string;
  userPrincipalName: string;
  displayName: string;
}

interface MicrosoftTokenResponse {
  accessToken: string;
}

interface YahooTokenResponse {
  access_token: string;
  refresh_token?: string;
}

interface YahooUserResponse {
  sub: string;
  email: string;
  name: string;
}

// Google OAuth configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Microsoft OAuth configuration
if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
  throw new Error("Microsoft OAuth client ID or secret is not defined");
}

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authority: "https://login.microsoftonline.com/common",
  },
};

const msalClient = new msal.ConfidentialClientApplication(msalConfig);

// Yahoo OAuth configuration
const YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";

// Google OAuth login
router.get("/google", (req, res) => {
  const redirectUrl = req.query.redirect_url;
  const requestedScopes = ((req.query.scopes || "") + "").split(" ");

  if (redirectUrl) {
    res.cookie("frontend_redirect", redirectUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  // Always use the full set of scopes in production for a consistent user experience
  // In development, limit to basic scopes as specified in the query
  const defaultScopes =
    process.env.NODE_ENV === "development"
      ? ["profile", "email"]
      : ["profile", "email", "https://www.googleapis.com/auth/gmail.modify"];

  const scopes = requestedScopes.length > 0 ? requestedScopes : defaultScopes;

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // Always show consent screen to ensure we get a refresh token
    include_granted_scopes: true,
  });

  res.redirect(url);
});

// Google OAuth callback route
router.get("/google/callback", async (req, res) => {
  const { code } = req.query;
  const frontendRedirect =
    req.cookies.frontend_redirect || process.env.FRONTEND_URL;

  if (!code) {
    return res.redirect(`${frontendRedirect}/login?error=no_code_provided`);
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);

    // Verify we have access token
    if (!tokens.access_token) {
      throw new Error("No access token received");
    }

    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });

    // Get user profile
    const { data } = await oauth2.userinfo.get();
    if (!data.id || !data.email) {
      throw new Error("Invalid user data received");
    }

    // Find or create user
    let user = await User.findOne({ googleId: data.id });

    if (!user) {
      // Create new user with explicit provider
      const userData = {
        email: data.email,
        name: data.name,
        provider: "gmail",
        googleId: data.id,
        googleAccessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };

      console.log("Creating new user:", {
        ...userData,
        googleAccessToken: "[REDACTED]",
        refreshToken: "[REDACTED]",
      });

      try {
        user = await User.create(userData);
      } catch (createError) {
        console.error("User creation error details:", createError);
        throw createError;
      }
    } else {
      // Update existing user
      user.googleAccessToken = tokens.access_token;
      if (tokens.refresh_token) {
        user.refreshToken = tokens.refresh_token;
      }
      await user.save();
    }

    // Generate JWT
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Redirect back to frontend
    res.redirect(frontendRedirect);
  } catch (error) {
    console.error("Google callback error:", error);
    res.redirect(`${frontendRedirect}/login?error=google_auth_failed`);
  }
});

// Token refresh endpoint (new)
router.post("/refresh", tokenAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.user.userId || !req.user.provider) {
      return res.status(401).json({ error: "Invalid user information" });
    }

    // Refresh the provider's access token
    await refreshTokenByProvider(req.user.userId, req.user.provider);

    // Get updated user info
    const user = await User.findById(req.user.userId).select(
      "-googleAccessToken -microsoftAccessToken -yahooAccessToken -refreshToken"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Refresh JWT token too
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(401).json({ error: "Failed to refresh token" });
  }
});

// Microsoft OAuth login
router.get("/microsoft", async (req, res) => {
  const redirectUrl = req.query.redirect_url as string;

  if (redirectUrl) {
    res.cookie("frontend_redirect", redirectUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  const authCodeUrlParameters = {
    scopes: [
      "user.read",
      "Mail.Read",
      "Mail.ReadWrite",
      "Mail.Send",
      "User.Read",
      "offline_access",
    ],
    options: { prompt: "select_account" },
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || "",
  };

  try {
    const response = await msalClient.getAuthCodeUrl(authCodeUrlParameters);
    res.redirect(response);
  } catch (error) {
    console.error("Microsoft auth error:", error);
    res.redirect(`${redirectUrl}/login?error=microsoft_auth_failed`);
  }
});

// Microsoft OAuth callback
router.get("/microsoft/callback", async (req, res) => {
  const { code } = req.query;
  const frontendRedirect =
    req.cookies.frontend_redirect || process.env.FRONTEND_URL;

  try {
    const tokenResponse = await msalClient.acquireTokenByCode({
      code: code as string,
      scopes: [
        "user.read",
        "Mail.Read",
        "Mail.ReadWrite",
        "Mail.Send",
        "User.Read",
        "offline_access",
      ],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || "",
    });

    // Get user info from Microsoft Graph API
    const userResponse = await axios.get<MicrosoftUserResponse>(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
      }
    );

    let user = await User.findOne({ microsoftId: userResponse.data.id });
    if (!user) {
      // Debug log
      console.log("Creating new user with provider 'outlook'");

      // Create new user with explicit provider
      const userData = {
        email: userResponse.data.mail || userResponse.data.userPrincipalName,
        name: userResponse.data.displayName,
        provider: "outlook",
        microsoftId: userResponse.data.id,
        microsoftAccessToken: tokenResponse.accessToken,
      };

      console.log("User data:", {
        ...userData,
        microsoftAccessToken: "[REDACTED]",
      });

      user = await User.create(userData);
    } else {
      user.microsoftAccessToken = tokenResponse.accessToken;
      await user.save();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(frontendRedirect);
  } catch (error) {
    console.error("Microsoft callback error:", error);
    res.redirect(`${frontendRedirect}/login?error=microsoft_auth_failed`);
  }
});

// Yahoo OAuth login
router.get("/yahoo", (req, res) => {
  const redirectUrl = req.query.redirect_url as string;

  if (redirectUrl) {
    res.cookie("frontend_redirect", redirectUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  const yahooClientId = process.env.YAHOO_CLIENT_ID;
  if (!yahooClientId) {
    throw new Error("YAHOO_CLIENT_ID is not defined");
  }

  const yahooRedirectUri = process.env.YAHOO_REDIRECT_URI;
  if (!yahooRedirectUri) {
    throw new Error("YAHOO_REDIRECT_URI is not defined");
  }

  const params = new URLSearchParams({
    client_id: yahooClientId,
    redirect_uri: yahooRedirectUri,
    response_type: "code",
    scope: "openid mail-r",
  });

  const authUrl = `${YAHOO_AUTH_URL}?${params.toString()}`;
  res.redirect(authUrl);
});

// Yahoo OAuth callback
router.get("/yahoo/callback", async (req, res) => {
  const { code } = req.query;
  const frontendRedirect =
    req.cookies.frontend_redirect || process.env.FRONTEND_URL;

  try {
    const yahooClientId = process.env.YAHOO_CLIENT_ID;
    if (!yahooClientId) {
      throw new Error("YAHOO_CLIENT_ID is not defined");
    }

    const yahooClientSecret = process.env.YAHOO_CLIENT_SECRET;
    if (!yahooClientSecret) {
      throw new Error("YAHOO_CLIENT_SECRET is not defined");
    }

    const yahooRedirectUri = process.env.YAHOO_REDIRECT_URI;
    if (!yahooRedirectUri) {
      throw new Error("YAHOO_REDIRECT_URI is not defined");
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post<YahooTokenResponse>(
      "https://api.login.yahoo.com/oauth2/get_token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: yahooRedirectUri,
        client_id: yahooClientId,
        client_secret: yahooClientSecret,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Get user info
    const userResponse = await axios.get<YahooUserResponse>(
      "https://api.login.yahoo.com/openid/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
      }
    );

    let user = await User.findOne({ yahooId: userResponse.data.sub });
    if (!user) {
      // Debug log
      console.log("Creating new user with provider 'yahoo'");

      // Create new user with explicit provider
      const userData = {
        email: userResponse.data.email,
        name: userResponse.data.name,
        provider: "yahoo",
        yahooId: userResponse.data.sub,
        yahooAccessToken: tokenResponse.data.access_token,
        refreshToken: tokenResponse.data.refresh_token,
      };

      console.log("User data:", {
        ...userData,
        yahooAccessToken: "[REDACTED]",
        refreshToken: "[REDACTED]",
      });

      user = await User.create(userData);
    } else {
      user.yahooAccessToken = tokenResponse.data.access_token;
      if (tokenResponse.data.refresh_token) {
        user.refreshToken = tokenResponse.data.refresh_token;
      }
      await user.save();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(frontendRedirect);
  } catch (error) {
    console.error("Yahoo callback error:", error);
    res.redirect(`${frontendRedirect}/login?error=yahoo_auth_failed`);
  }
});
// Get current user
router.get("/me", auth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.userId).select(
      "-googleAccessToken -microsoftAccessToken -yahooAccessToken -refreshToken"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

export default router;
