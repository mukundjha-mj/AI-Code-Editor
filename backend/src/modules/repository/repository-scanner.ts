import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { watch } from "node:fs";
import path from "node:path";
import type { Stats } from "node:fs";
import { SUPPORTED_EXTENSIONS, type SupportedExtension } from "./repository.types";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
]);

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  extension: SupportedExtension;
  stats: Stats;
}

export interface ScanDiscoveryResult {
  files: ScannedFile[];
  folders: string[];
}

type ChangeHandler = (relativePath: string) => Promise<void> | void;

const toPosixRelative = (rootPath: string, targetPath: string) =>
  path.relative(rootPath, targetPath).split(path.sep).join("/");

export class RepositoryScanner {
  private watcher: ReturnType<typeof watch> | null = null;
  private readonly changeQueue = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  async discover(rootPath: string): Promise<ScanDiscoveryResult> {
    const files: ScannedFile[] = [];
    const folders: string[] = [];

    const walk = async (absoluteDir: string): Promise<void> => {
      const relativeDir = toPosixRelative(rootPath, absoluteDir);
      if (relativeDir && !relativeDir.startsWith("..")) {
        folders.push(relativeDir);
      }

      const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
      await Promise.all(
        entries.map(async (entry) => {
          const absolutePath = path.join(absoluteDir, entry.name);

          if (entry.isDirectory()) {
            if (IGNORED_DIRECTORIES.has(entry.name)) {
              return;
            }
            await walk(absolutePath);
            return;
          }

          if (!entry.isFile()) {
            return;
          }

          const extension = path.extname(entry.name) as SupportedExtension;
          if (!SUPPORTED_EXTENSIONS.includes(extension)) {
            return;
          }

          const stats = await fs.stat(absolutePath);
          files.push({
            absolutePath,
            relativePath: toPosixRelative(rootPath, absolutePath),
            extension,
            stats,
          });
        }),
      );
    };

    await walk(rootPath);
    return { files, folders };
  }

  async readFile(absolutePath: string): Promise<string> {
    return fs.readFile(absolutePath, "utf-8");
  }

  computeHash(content: string): string {
    return createHash("sha1").update(content).digest("hex");
  }

  async exists(absolutePath: string): Promise<boolean> {
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  startWatching(rootPath: string, onChange: ChangeHandler): void {
    this.stopWatching();

    this.watcher = watch(rootPath, { recursive: true }, (_eventType, filename) => {
      if (!filename) {
        return;
      }

      const relativePath = filename.toString().split(path.sep).join("/");
      if (!relativePath || relativePath.startsWith("..")) {
        return;
      }

      if (relativePath.split("/").some((part) => IGNORED_DIRECTORIES.has(part))) {
        return;
      }

      const extension = path.extname(relativePath) as SupportedExtension;
      if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        return;
      }

      this.changeQueue.add(relativePath);
      if (this.flushTimer) {
        return;
      }

      this.flushTimer = setTimeout(async () => {
        const changes = [...this.changeQueue];
        this.changeQueue.clear();
        this.flushTimer = null;
        for (const changedPath of changes) {
          await onChange(changedPath);
        }
      }, 200);
    });
  }

  stopWatching(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.changeQueue.clear();
    this.watcher?.close();
    this.watcher = null;
  }
}
