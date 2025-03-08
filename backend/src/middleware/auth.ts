// backend\src\middleware\auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Export the interface so other files can use it
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};
