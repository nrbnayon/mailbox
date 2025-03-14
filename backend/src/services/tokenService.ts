import { google } from "googleapis";
import axios from "axios";
import { User } from "../models/User.js";
import { Document } from "mongoose";

// Define the User document interface
interface UserDocument extends Document {
  email?: string;
  name?: string | null;
  provider?: string | null;
  googleId?: string | null;
  microsoftId?: string | null;
  yahooId?: string | null;
  googleAccessToken?: string | null;
  microsoftAccessToken?: string | null;
  yahooAccessToken?: string | null;
  refreshToken?: string | null;
  image?: string | null;
  save(): Promise<this>;
}

// Define interfaces for API responses
interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
}

interface YahooTokenResponse {
  access_token: string;
  refresh_token?: string;
}

/**
 * Refreshes access tokens based on provider type
 * @param userId - The user ID
 * @param provider - The auth provider (gmail, outlook, yahoo)
 * @returns The updated user document
 */
export const refreshTokenByProvider = async (
  userId: string,
  provider: string
): Promise<UserDocument> => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.refreshToken) {
    throw new Error("No refresh token available for user");
  }

  switch (provider) {
    case "gmail":
      return await refreshGoogleToken(user as unknown as UserDocument);
    case "outlook":
      return await refreshMicrosoftToken(user as unknown as UserDocument);
    case "yahoo":
      return await refreshYahooToken(user as unknown as UserDocument);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

/**
 * Refreshes Google access token
 * @param user - The user document
 * @returns The updated user document
 */
const refreshGoogleToken = async (user: any): Promise<any> => {
  try {
    // Check if environment variables are defined
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials are not properly configured");
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Make sure refresh token exists
    if (!user.refreshToken) {
      throw new Error("No refresh token available for Google authentication");
    }

    // Set the refresh token explicitly
    oauth2Client.setCredentials({
      refresh_token: user.refreshToken,
    });

    // Use the token refresh method to get new tokens
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update user with new tokens
    user.googleAccessToken = credentials.access_token;

    // If we get a new refresh token, update that too
    if (credentials.refresh_token) {
      user.refreshToken = credentials.refresh_token;
    }

    await user.save();
    return user;
  } catch (error) {
    console.error("Error refreshing Google token:", error);
    throw error;
  }
};

/**
 * Refreshes Microsoft access token
 * @param user - The user document
 * @returns The updated user document
 */
const refreshMicrosoftToken = async (
  user: UserDocument
): Promise<UserDocument> => {
  try {
    const response = await axios.post<MicrosoftTokenResponse>(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
        refresh_token: user.refreshToken || "",
        grant_type: "refresh_token",
        scope: "user.read mail.read",
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    user.microsoftAccessToken = response.data.access_token;

    // Update refresh token if we get a new one
    if (response.data.refresh_token) {
      user.refreshToken = response.data.refresh_token;
    }

    await user.save();
    return user;
  } catch (error) {
    console.error("Error refreshing Microsoft token:", error);
    throw error;
  }
};

/**
 * Refreshes Yahoo access token
 * @param user - The user document
 * @returns The updated user document
 */
const refreshYahooToken = async (user: UserDocument): Promise<UserDocument> => {
  try {
    const response = await axios.post<YahooTokenResponse>(
      "https://api.login.yahoo.com/oauth2/get_token",
      new URLSearchParams({
        client_id: process.env.YAHOO_CLIENT_ID || "",
        client_secret: process.env.YAHOO_CLIENT_SECRET || "",
        refresh_token: user.refreshToken || "",
        grant_type: "refresh_token",
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    user.yahooAccessToken = response.data.access_token;

    // Update refresh token if we get a new one
    if (response.data.refresh_token) {
      user.refreshToken = response.data.refresh_token;
    }

    await user.save();
    return user;
  } catch (error) {
    console.error("Error refreshing Yahoo token:", error);
    throw error;
  }
};
