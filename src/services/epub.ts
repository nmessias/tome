import { Database } from "bun:sqlite";
import JSZip from "jszip";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { DB_PATH } from "../config";

const EPUB_DIR = "./data/epubs";
const COVER_DIR = "./data/covers";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export interface EpubBook {
  id: string;
  userId: string;
  fileHash: string;
  title: string;
  author: string | null;
  coverPath: string | null;
  cfi: string | null;
  progress: number;
  addedAt: number;
  lastReadAt: number | null;
}

interface EpubMetadata {
  title: string;
  author: string | null;
  coverData: Buffer | null;
  coverMimeType: string | null;
}

function getDb(): Database {
  return new Database(DB_PATH);
}

function ensureDirectories(): void {
  if (!fs.existsSync(EPUB_DIR)) {
    fs.mkdirSync(EPUB_DIR, { recursive: true });
  }
  if (!fs.existsSync(COVER_DIR)) {
    fs.mkdirSync(COVER_DIR, { recursive: true });
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function extractMetadata(zipBuffer: Buffer): Promise<EpubMetadata> {
  const zip = await JSZip.loadAsync(zipBuffer);
  
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) {
    return { title: "Unknown", author: null, coverData: null, coverMimeType: null };
  }
  
  const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!rootfileMatch) {
    return { title: "Unknown", author: null, coverData: null, coverMimeType: null };
  }
  
  const opfPath = rootfileMatch[1];
  const opfContent = await zip.file(opfPath)?.async("string");
  if (!opfContent) {
    return { title: "Unknown", author: null, coverData: null, coverMimeType: null };
  }
  
  const opfDir = path.dirname(opfPath);
  
  const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Unknown";
  
  const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
  const author = authorMatch ? authorMatch[1].trim() : null;
  
  let coverData: Buffer | null = null;
  let coverMimeType: string | null = null;
  
  const coverMetaMatch = opfContent.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/i) ||
                         opfContent.match(/<meta[^>]+content="([^"]+)"[^>]+name="cover"/i);
  
  if (coverMetaMatch) {
    const coverId = coverMetaMatch[1];
    const itemMatch = opfContent.match(new RegExp(`<item[^>]+id="${coverId}"[^>]+href="([^"]+)"[^>]*>`, "i")) ||
                      opfContent.match(new RegExp(`<item[^>]+href="([^"]+)"[^>]+id="${coverId}"[^>]*>`, "i"));
    
    if (itemMatch) {
      const coverHref = itemMatch[1];
      const coverPath = opfDir ? path.join(opfDir, coverHref) : coverHref;
      const coverFile = zip.file(coverPath);
      
      if (coverFile) {
        coverData = Buffer.from(await coverFile.async("arraybuffer"));
        coverMimeType = coverHref.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      }
    }
  }
  
  if (!coverData) {
    const coverItemMatch = opfContent.match(/<item[^>]+href="([^"]+)"[^>]+media-type="image\/(jpeg|png)"[^>]*>/i);
    if (coverItemMatch) {
      const coverHref = coverItemMatch[1];
      const coverPath = opfDir ? path.join(opfDir, coverHref) : coverHref;
      const coverFile = zip.file(coverPath);
      
      if (coverFile) {
        coverData = Buffer.from(await coverFile.async("arraybuffer"));
        coverMimeType = `image/${coverItemMatch[2].toLowerCase()}`;
      }
    }
  }
  
  return { title, author, coverData, coverMimeType };
}

export async function uploadEpub(
  userId: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ success: true; book: EpubBook } | { success: false; error: string }> {
  ensureDirectories();
  
  if (fileBuffer.length > MAX_FILE_SIZE) {
    return { success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` };
  }
  
  let metadata: EpubMetadata;
  try {
    metadata = await extractMetadata(fileBuffer);
  } catch (err) {
    return { success: false, error: "Invalid EPUB file. Could not read metadata." };
  }
  
  const fileHash = hashBuffer(fileBuffer);
  const bookId = generateId();
  const now = Math.floor(Date.now() / 1000);
  
  const db = getDb();
  try {
    const existingFile = db.query(`SELECT hash, refCount FROM epub_files WHERE hash = ?`).get(fileHash) as { hash: string; refCount: number } | null;
    
    if (existingFile) {
      db.run(`UPDATE epub_files SET refCount = refCount + 1 WHERE hash = ?`, [fileHash]);
    } else {
      const epubPath = path.join(EPUB_DIR, `${fileHash}.epub`);
      fs.writeFileSync(epubPath, fileBuffer);
      
      db.run(`INSERT INTO epub_files (hash, size, uploadedAt, refCount) VALUES (?, ?, ?, 1)`, [fileHash, fileBuffer.length, now]);
    }
    
    let coverPath: string | null = null;
    if (metadata.coverData) {
      const ext = metadata.coverMimeType === "image/png" ? "png" : "jpg";
      coverPath = `${bookId}.${ext}`;
      fs.writeFileSync(path.join(COVER_DIR, coverPath), metadata.coverData);
    }
    
    db.run(`
      INSERT INTO epub_books (id, userId, fileHash, title, author, coverPath, cfi, progress, addedAt, lastReadAt)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, NULL)
    `, [bookId, userId, fileHash, metadata.title, metadata.author, coverPath, now]);
    
    const book: EpubBook = {
      id: bookId,
      userId,
      fileHash,
      title: metadata.title,
      author: metadata.author,
      coverPath,
      cfi: null,
      progress: 0,
      addedAt: now,
      lastReadAt: null,
    };
    
    return { success: true, book };
  } finally {
    db.close();
  }
}

export function getUserLibrary(userId: string): EpubBook[] {
  const db = getDb();
  try {
    const rows = db.query(`
      SELECT id, userId, fileHash, title, author, coverPath, cfi, progress, addedAt, lastReadAt
      FROM epub_books
      WHERE userId = ?
      ORDER BY COALESCE(lastReadAt, 0) DESC, addedAt DESC
    `).all(userId) as EpubBook[];
    
    return rows;
  } finally {
    db.close();
  }
}

export function getBook(bookId: string, userId: string): EpubBook | null {
  const db = getDb();
  try {
    const row = db.query(`
      SELECT id, userId, fileHash, title, author, coverPath, cfi, progress, addedAt, lastReadAt
      FROM epub_books
      WHERE id = ? AND userId = ?
    `).get(bookId, userId) as EpubBook | null;
    
    return row;
  } finally {
    db.close();
  }
}

export function updateProgress(bookId: string, userId: string, cfi: string, progress: number): void {
  const db = getDb();
  try {
    const now = Math.floor(Date.now() / 1000);
    db.run(`
      UPDATE epub_books
      SET cfi = ?, progress = ?, lastReadAt = ?
      WHERE id = ? AND userId = ?
    `, [cfi, Math.min(100, Math.max(0, progress)), now, bookId, userId]);
  } finally {
    db.close();
  }
}

export function deleteBook(bookId: string, userId: string): boolean {
  const db = getDb();
  try {
    const book = db.query(`SELECT fileHash, coverPath FROM epub_books WHERE id = ? AND userId = ?`).get(bookId, userId) as { fileHash: string; coverPath: string | null } | null;
    
    if (!book) {
      return false;
    }
    
    db.run(`DELETE FROM epub_books WHERE id = ? AND userId = ?`, [bookId, userId]);
    
    if (book.coverPath) {
      const coverFullPath = path.join(COVER_DIR, book.coverPath);
      if (fs.existsSync(coverFullPath)) {
        fs.unlinkSync(coverFullPath);
      }
    }
    
    const fileInfo = db.query(`SELECT refCount FROM epub_files WHERE hash = ?`).get(book.fileHash) as { refCount: number } | null;
    
    if (fileInfo) {
      if (fileInfo.refCount <= 1) {
        db.run(`DELETE FROM epub_files WHERE hash = ?`, [book.fileHash]);
        const epubPath = path.join(EPUB_DIR, `${book.fileHash}.epub`);
        if (fs.existsSync(epubPath)) {
          fs.unlinkSync(epubPath);
        }
      } else {
        db.run(`UPDATE epub_files SET refCount = refCount - 1 WHERE hash = ?`, [book.fileHash]);
      }
    }
    
    return true;
  } finally {
    db.close();
  }
}

export function getEpubFilePath(fileHash: string): string | null {
  const epubPath = path.join(EPUB_DIR, `${fileHash}.epub`);
  if (fs.existsSync(epubPath)) {
    return epubPath;
  }
  return null;
}

export function getCoverPath(coverPath: string): string | null {
  const fullPath = path.join(COVER_DIR, coverPath);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}
