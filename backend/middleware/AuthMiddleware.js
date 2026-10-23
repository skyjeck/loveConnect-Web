import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization token is required",
            });
        }

        // Expected format:
        // Authorization: Bearer TOKEN
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format",
            });
        }

        // Verify token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "loveconnect_secret"
        );

        // Attach user ID to request
        req.user = {
            id: decoded.id,
        };

        next();

    } catch (error) {
        console.error("Auth Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};

export default authMiddleware;