import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer({
    storage: multer.memoryStorage()

});


const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const client = new S3Client({
    region: process.env.AWS_REGION,
});

app.post("/upload", upload.single("file"), async (req, res) => {

    try {
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
                `https://ganesh-aws-learning-storage.s3.ap-south-1.amazonaws.com/${s3Key}`,
            ]

       );
        res.json({
            message: "File uploaded successfully!"
        });

    } catch (err) {
        res.status(500).json({
            message: "Upload failed"
        });

    }
});

app.get("/files", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM files");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({
              message: "Failed to fetch files"
        });
    }
});


app.delete("/files/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const [rows] = await pool.query(
            "SELECT * FROM files WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        const command = new DeleteObjectCommand({
            Bucket: "ganesh-aws-learning-storage",
            Key: rows[0].s3_key,
        });

        await client.send(command);

        await pool.query(
            "DELETE FROM files WHERE id = ?",
            [id]
        );

        res.json({
            message: "File deleted successfully"
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Delete failed"
        });
    }
});


app.listen(3000, () => {
    console.log("Server running on port 3000");
});
