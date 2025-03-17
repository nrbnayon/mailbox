// backend/src/middleware/auth.js
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

// Export the interface so other files can use it
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    provider?: string;
  };
}

export const auth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      iat: number;
      exp: number;
    };

    // Check if token is close to expiration (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - currentTime;

    // Find the user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: user.email,
      provider: user.provider ?? undefined,
    };

    // If token is close to expiry, refresh it
    if (timeUntilExpiry < 300) {
      // less than 5 minutes left
      const newToken = jwt.sign(
        { userId: decoded.userId },
        process.env.JWT_SECRET!,
        {
          expiresIn: "7d",
        }
      );

      res.cookie("token", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.clearCookie("token");
    res.status(401).json({ error: "Invalid token" });
  }
};

// Middleware for handling token-based operations
export const tokenAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // First run the normal auth check
    await auth(req, res, async (err) => {
      if (err) return next(err);

      // If auth passed, ensure we have the provider information
      if (!req.user || !req.user.provider) {
        return res.status(401).json({ error: "Provider information missing" });
      }

      next();
    });
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" });
  }
};
