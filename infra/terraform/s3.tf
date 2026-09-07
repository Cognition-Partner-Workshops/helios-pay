resource "aws_s3_bucket" "documents" {
  bucket = "${local.name_prefix}-documents"
  acl    = "public-read"

  tags = local.common_tags
}

resource "aws_s3_bucket_policy" "documents_public_read" {
  bucket = aws_s3_bucket.documents.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicDocumentRead"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.documents.arn}/*"
    }]
  })
}
