#!/usr/bin/env bash
set -e
awslocal s3 mb s3://ace-media-vault || true
awslocal s3api put-bucket-cors --bucket ace-media-vault --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "*"],
    "ExposeHeaders": ["ETag"]
  }]
}' || true
