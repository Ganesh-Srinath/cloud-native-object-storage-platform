# Cloud-Native Object Storage Platform

## Overview

A cloud-native backend application that stores uploaded files in Amazon S3 while maintaining metadata in Amazon RDS.

## Features

- Upload files
- List uploaded files
- Delete files
- Amazon S3 Object Storage
- Amazon RDS Metadata Storage
- IAM Role Authentication
- EC2 Deployment

## Tech Stack

- Node.js
- Express.js
- Amazon EC2
- Amazon S3
- Amazon RDS
- AWS IAM
- Multer
- MySQL

## Architecture

Client
↓
Express
↓
Amazon S3
↓
Amazon RDS

## Future Improvements

- Download API
- Pre-signed URLs
- Validation
- Pagination
