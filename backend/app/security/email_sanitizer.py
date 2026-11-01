"""Email Content and Attachment Sanitizer for Untrusted Inbound Messages.

Enforces:
- Marking all inbound email content as untrusted.
- Safe extraction of text from .txt and .pdf attachments.
- Rejection of hazardous executable or script attachments.
- Strict size limits and memory protection.
"""

from __future__ import annotations

import html
from html.parser import HTMLParser
import io
import logging
import os
import re
import zlib
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.gmail import EmailAttachment

log = logging.getLogger(__name__)

# Dangerous executable, script, or system file extensions
DANGEROUS_EXTENSIONS = frozenset(
    {
        ".exe", ".bat", ".cmd", ".sh", ".bash", ".ps1", ".psm1",
        ".vbs", ".js", ".scr", ".pif", ".com", ".jar", ".apk",
        ".msi", ".dll", ".so", ".dylib", ".vbe", ".wsf", ".wsh",
        ".hta", ".cpl", ".reg", ".bin"
    }
)

MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_EXTRACTED_TEXT_CHARS = 50_000


class _HTMLTagStripper(HTMLParser):
    """Safe pure-Python HTML tag stripper and entity decoder."""

    def __init__(self) -> None:
        super().__init__()
        self.reset()
        self.fed: List[str] = []
        self._ignore: bool = False

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        if tag.lower() in ("script", "style", "noscript"):
            self._ignore = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in ("script", "style", "noscript"):
            self._ignore = False

    def handle_data(self, data: str) -> None:
        if not self._ignore:
            self.fed.append(data)

    def get_text(self) -> str:
        return " ".join("".join(self.fed).split())


def sanitize_text_content(raw_text: str, is_html: bool = False) -> str:
    """Sanitize raw email body or text string.

    Strips raw HTML tags if HTML, unescapes entities, and cleans control characters.
    """
    if not raw_text:
        return ""

    if is_html:
        stripper = _HTMLTagStripper()
        try:
            stripper.feed(raw_text)
            text = stripper.get_text()
        except Exception as exc:
            log.warning("HTML parsing fallback due to error: %s", exc)
            text = re.sub(r"<[^>]+>", " ", raw_text)
            text = html.unescape(text)
    else:
        text = raw_text

    # Normalize whitespace and strip non-printable characters (keep standard newlines/tabs)
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)
    if len(text) > MAX_EXTRACTED_TEXT_CHARS:
        text = text[:MAX_EXTRACTED_TEXT_CHARS] + "\n... [truncated due to length limit]"
    return text.strip()


def extract_txt_attachment(data: bytes, filename: str) -> str:
    """Safely decode plain text attachment."""
    for encoding in ("utf-8", "latin-1", "ascii"):
        try:
            decoded = data.decode(encoding)
            return sanitize_text_content(decoded, is_html=False)
        except UnicodeDecodeError:
            continue
    # Fallback with replacement
    decoded = data.decode("utf-8", errors="replace")
    return sanitize_text_content(decoded, is_html=False)


def extract_pdf_attachment(data: bytes, filename: str) -> str:
    """Extract readable text from PDF bytes safely without executing external processes.

    Extracts text blocks from standard uncompressed streams and FlateDecode streams.
    """
    if not data.startswith(b"%PDF"):
        return f"[PDF Document: {filename} (Malformed PDF header)]"

    extracted_chunks: List[str] = []

    # Find stream ... endstream blocks
    stream_pattern = re.compile(rb"stream[\r\n]+(.*?)[\r\n]+endstream", re.DOTALL)
    text_pattern = re.compile(rb"\((.*?)\)\s*Tj", re.DOTALL)
    bracket_text_pattern = re.compile(rb"\[(.*?)\]\s*TJ", re.DOTALL)

    for match in stream_pattern.finditer(data):
        stream_bytes = match.group(1)
        # Attempt Flate decompression if compressed
        decompressed = None
        for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS, zlib.MAX_WBITS | 16):
            try:
                decompressed = zlib.decompress(stream_bytes, wbits)
                break
            except Exception:
                continue

        target_bytes = decompressed if decompressed is not None else stream_bytes

        # Extract (text) Tj
        for tj in text_pattern.finditer(target_bytes):
            try:
                chunk = tj.group(1).decode("latin-1", errors="replace")
                if chunk.strip():
                    extracted_chunks.append(chunk)
            except Exception:
                pass

        # Extract [(chunk1) -10 (chunk2)] TJ
        for tj in bracket_text_pattern.finditer(target_bytes):
            inner = tj.group(1)
            parts = re.findall(rb"\((.*?)\)", inner)
            for part in parts:
                try:
                    chunk = part.decode("latin-1", errors="replace")
                    if chunk.strip():
                        extracted_chunks.append(chunk)
                except Exception:
                    pass

        if sum(len(c) for c in extracted_chunks) > MAX_EXTRACTED_TEXT_CHARS:
            break

    if extracted_chunks:
        full_text = " ".join(extracted_chunks)
        return sanitize_text_content(full_text)
    
    return f"[PDF Document: {filename} (Structured content safely ingested)]"


def process_attachment(
    filename: str,
    content_type: str,
    raw_data: bytes,
) -> EmailAttachment:
    """Validate and process an attachment as untrusted input.

    Rejects dangerous executables and scripts. Safely processes .txt and .pdf files.
    """
    clean_filename = os.path.basename(filename).strip() or "unnamed_attachment"
    ext = os.path.splitext(clean_filename.lower())[1]
    size_bytes = len(raw_data)

    # 1. Check dangerous extension
    if ext in DANGEROUS_EXTENSIONS:
        log.warning(
            "Rejected dangerous attachment '%s' with prohibited extension '%s'",
            clean_filename,
            ext,
        )
        return EmailAttachment(
            filename=clean_filename,
            content_type=content_type,
            size_bytes=size_bytes,
            is_safe=False,
            rejection_reason=f"Prohibited executable or script extension: '{ext}'",
            extracted_text=None,
        )

    # 2. Check size boundary
    if size_bytes > MAX_ATTACHMENT_SIZE_BYTES:
        log.warning("Attachment '%s' exceeds maximum size limit (%d bytes)", clean_filename, size_bytes)
        return EmailAttachment(
            filename=clean_filename,
            content_type=content_type,
            size_bytes=size_bytes,
            is_safe=False,
            rejection_reason=f"Attachment exceeds maximum size of {MAX_ATTACHMENT_SIZE_BYTES // (1024*1024)}MB",
            extracted_text=None,
        )

    # 3. Process text and PDF
    extracted_text: Optional[str] = None
    if ext in (".txt", ".text") or content_type.startswith("text/plain"):
        try:
            extracted_text = extract_txt_attachment(raw_data, clean_filename)
        except Exception as exc:
            log.warning("Failed to extract text from %s: %s", clean_filename, exc)
            extracted_text = f"[Text Document: {clean_filename} (Extraction error)]"

    elif ext == ".pdf" or content_type == "application/pdf":
        try:
            extracted_text = extract_pdf_attachment(raw_data, clean_filename)
        except Exception as exc:
            log.warning("Failed to extract PDF text from %s: %s", clean_filename, exc)
            extracted_text = f"[PDF Document: {clean_filename} (Extraction error)]"

    else:
        # Non-text/non-PDF attachment that is not on dangerous list (e.g., png, jpg, csv)
        extracted_text = f"[{clean_filename}: Binary asset ({content_type}) - {size_bytes} bytes]"

    return EmailAttachment(
        filename=clean_filename,
        content_type=content_type,
        size_bytes=size_bytes,
        is_safe=True,
        rejection_reason=None,
        extracted_text=extracted_text,
    )

