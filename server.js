import express from "express";
import multer from "multer";
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
    },

    fileFilter(req, file, cb) {
        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "application/pdf",
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"));
        }
    },
});

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
});

const client = new S3Client({
    region: process.env.AWS_REGION,
});


// ======================
// Upload File
// ======================

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded",
            });
        }

        const s3Key = `uploads/${Date.now()}-${req.file.originalname}`;

        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        });

        await client.send(command);

        await pool.query(
            `
            INSERT INTO files
            (file_name, file_type, file_size, s3_key, s3_url)
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                req.file.originalname,
                req.file.mimetype,
                req.file.size,
                s3Key,
                `https://${process.env.BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
            ]
        );

        res.json({
            message: "File uploaded successfully!",
        });

    } catch (err) {
        console.error(err);

        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                message: "Maximum file size is 10 MB",
            });
        }

        if (err.message === "Invalid file type") {
            return res.status(400).json({
                message: "Only PDF, PNG and JPEG files are allowed",
            });
        }

        res.status(500).json({
            message: "Upload failed",
        });
    }
});


// ======================
// List Files
// ======================

app.get("/files", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM files"
        );

        res.json(rows);

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Failed to fetch files",
        });
    }
});


// ======================
// Download File
// ======================

app.get("/files/:id/download", async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `
            SELECT
                s3_key,
                file_name,
                file_type
            FROM files
            WHERE id = ?
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "File not found",
            });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: rows[0].s3_key,
        });

        const response = await client.send(command);

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${rows[0].file_name}"`
        );

        res.setHeader(
            "Content-Type",
            rows[0].file_type
        );

        response.Body.pipe(res);

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Download failed",
        });
    }
});


// ======================
// Delete File
// ======================

app.delete("/files/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `
            SELECT s3_key
            FROM files
            WHERE id = ?
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "File not found",
            });
        }

        const command = new DeleteObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: rows[0].s3_key,
        });

        await client.send(command);

        await pool.query(
            "DELETE FROM files WHERE id = ?",
            [id]
        );

        res.json({
            message: "File deleted successfully",
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Delete failed",
        });
    }
});


// ======================
// Start Server
// ======================

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
