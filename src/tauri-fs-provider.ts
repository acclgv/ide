/**
 * TauriFileSystemProvider
 *
 * Implements VS Code's IFileSystemProvider interface backed by Hanzo's native
 * Rust filesystem IPC (`ide_stat`, `ide_list_dir`, `ide_read_file_bytes`,
 * `ide_write_file_bytes`, `ide_mkdir`, `ide_delete_file`, `ide_rename_file`).
 *
 * Unlike `@tauri-apps/plugin-fs` (which rejects paths outside `$HOME/**` such
 * as `/data/...`, `/tmp/...`, `/Volumes/...`, or secondary Windows drives),
 * routing through `hanzo_shell::ide_mcp` works for EVERY user-opened folder
 * across Linux (`/`), macOS (`/`), and Windows (`C:\`, `D:\`, UNC).
 */

import {
  FileChangeType,
  FileSystemProviderCapabilities,
  FileSystemProviderErrorCode,
  FileType,
  type IFileChange,
  type IFileDeleteOptions,
  type IFileOverwriteOptions,
  type IFileSystemProviderWithFileReadWriteCapability,
  type IStat,
  type IWatchOptions,
} from '@codingame/monaco-vscode-files-service-override'

import { createFileSystemProviderError } from '@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files'
import { URI } from '@codingame/monaco-vscode-api/vscode/vs/base/common/uri'
import { Emitter, type Event } from '@codingame/monaco-vscode-api/vscode/vs/base/common/event'
import { Disposable } from '@codingame/monaco-vscode-api/vscode/vs/base/common/lifecycle'
import { invoke } from '@tauri-apps/api/core'
import { listen, tauri } from './hanzo/tauri.ts'

function uriToPath(resource: URI): string {
  return resource.fsPath || resource.path
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i)
  }
  return out
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)))
  }
  return btoa(parts.join(''))
}

function mapError(err: unknown): Error {
  const e = err as { kind?: string; code?: string; message?: string } | null
  if (e?.kind === 'NotFound' || e?.code === 'ENOENT') {
    return createFileSystemProviderError(String(err), FileSystemProviderErrorCode.FileNotFound)
  }
  if (e?.kind === 'PermissionDenied' || e?.code === 'EACCES') {
    return createFileSystemProviderError(String(err), FileSystemProviderErrorCode.NoPermissions)
  }
  if (e?.kind === 'AlreadyExists' || e?.code === 'EEXIST') {
    return createFileSystemProviderError(String(err), FileSystemProviderErrorCode.FileExists)
  }
  const msg = String(err)
  if (/no such file|not found|os error 2\b|system cannot find/i.test(msg)) {
    return createFileSystemProviderError(msg, FileSystemProviderErrorCode.FileNotFound)
  }
  if (/permission denied|access is denied|os error 13\b/i.test(msg)) {
    return createFileSystemProviderError(msg, FileSystemProviderErrorCode.NoPermissions)
  }
  if (/already exists|os error 17\b/i.test(msg)) {
    return createFileSystemProviderError(msg, FileSystemProviderErrorCode.FileExists)
  }
  return createFileSystemProviderError(msg, FileSystemProviderErrorCode.Unknown)
}

export class TauriFileSystemProvider
  extends Disposable
  implements IFileSystemProviderWithFileReadWriteCapability
{
  readonly capabilities =
    FileSystemProviderCapabilities.FileReadWrite |
    FileSystemProviderCapabilities.PathCaseSensitive

  private readonly _onDidChangeCapabilities = this._register(new Emitter<void>())
  readonly onDidChangeCapabilities: Event<void> = this._onDidChangeCapabilities.event

  private readonly _onDidChangeFile = this._register(new Emitter<readonly IFileChange[]>())
  readonly onDidChangeFile: Event<readonly IFileChange[]> = this._onDidChangeFile.event

  async stat(resource: URI): Promise<IStat> {
    if (!tauri()) {
      throw createFileSystemProviderError('Not in Tauri host', FileSystemProviderErrorCode.Unavailable)
    }
    const path = uriToPath(resource)
    try {
      const s = await invoke<{ type: number; size: number; ctime: number; mtime: number }>('ide_stat', {
        path,
      })
      return {
        type: s.type as FileType,
        ctime: s.ctime || 0,
        mtime: s.mtime || Date.now(),
        size: s.size ?? 0,
      }
    } catch (err) {
      throw mapError(err)
    }
  }

  async readdir(resource: URI): Promise<[string, FileType][]> {
    if (!tauri()) return []
    const path = uriToPath(resource)
    try {
      const listing = await invoke<{
        path: string
        entries: Array<{ name: string; is_dir: boolean; size: number }>
      }>('ide_list_dir', {
        path,
        includeHidden: true,
      })
      return (listing?.entries ?? []).map((entry) => [
        entry.name,
        entry.is_dir ? FileType.Directory : FileType.File,
      ])
    } catch (err) {
      throw mapError(err)
    }
  }

  async readFile(resource: URI): Promise<Uint8Array> {
    if (!tauri()) return new Uint8Array(0)
    const path = uriToPath(resource)
    try {
      const b64 = await invoke<string>('ide_read_file_bytes', { path })
      return base64ToUint8Array(b64)
    } catch (err) {
      throw mapError(err)
    }
  }

  async writeFile(
    resource: URI,
    content: Uint8Array,
    _opts: IFileOverwriteOptions,
  ): Promise<void> {
    if (!tauri()) return
    const path = uriToPath(resource)
    try {
      await invoke('ide_write_file_bytes', {
        path,
        contentBase64: uint8ArrayToBase64(content),
      })
      this._onDidChangeFile.fire([
        {
          type: FileChangeType.UPDATED,
          resource,
        },
      ])
    } catch (err) {
      throw mapError(err)
    }
  }

  async mkdir(resource: URI): Promise<void> {
    if (!tauri()) return
    const path = uriToPath(resource)
    try {
      await invoke('ide_mkdir', { path })
    } catch (err) {
      throw mapError(err)
    }
  }

  async delete(resource: URI, opts: IFileDeleteOptions): Promise<void> {
    if (!tauri()) return
    const path = uriToPath(resource)
    try {
      await invoke('ide_delete_file', {
        path,
        recursive: opts.recursive ?? false,
      })
      this._onDidChangeFile.fire([{ type: FileChangeType.DELETED, resource }])
    } catch (err) {
      throw mapError(err)
    }
  }

  async rename(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
    if (!tauri()) return
    const fromPath = uriToPath(from)
    const toPath = uriToPath(to)
    try {
      await invoke('ide_rename_file', {
        fromPath,
        toPath,
        overwrite: Boolean(opts.overwrite),
      })
      this._onDidChangeFile.fire([
        { type: FileChangeType.DELETED, resource: from },
        { type: FileChangeType.ADDED, resource: to },
      ])
    } catch (err) {
      throw mapError(err)
    }
  }

  watch(resource: URI, opts: IWatchOptions): { dispose(): void } {
    if (!tauri()) return { dispose() {} }
    const path = uriToPath(resource)
    let watchId: string | null = null
    let unlisten: (() => void) | null = null

    const setup = async () => {
      watchId = await invoke<string>('fs_watch', {
        path,
        recursive: opts.recursive ?? false,
      })

      unlisten = await listen<{ kind: string; path: string }>('fs-change', ({ payload }) => {
        const normalizedRoot = path.replace(/[\\/]+$/, '')
        if (
          payload.path !== normalizedRoot &&
          !payload.path.startsWith(`${normalizedRoot}/`) &&
          !payload.path.startsWith(`${normalizedRoot}\\`)
        ) {
          return
        }

        const changeType =
          payload.kind === 'created'
            ? FileChangeType.ADDED
            : payload.kind === 'deleted'
              ? FileChangeType.DELETED
              : FileChangeType.UPDATED

        this._onDidChangeFile.fire([
          {
            type: changeType,
            resource: URI.file(payload.path),
          },
        ])
      })
    }

    setup().catch((e) => console.warn('[hanzo-fs] watch setup failed:', e))

    return {
      dispose() {
        unlisten?.()
        if (watchId) {
          invoke('fs_unwatch', { watchId }).catch(() => {})
        }
      },
    }
  }
}
