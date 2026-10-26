import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  X,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  File as FileIcon,
  AlertCircle,
  Download,
  ExternalLink,
} from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { TaskAttachment } from '../../types';
import {
  saveMediaBlob,
  getMediaBlob,
  deleteMediaBlob,
  formatFileSize,
} from '../../utils/mediaStorage';

export interface TaskAttachmentsProps {
  attachments?: TaskAttachment[];
  onChange: (attachments: TaskAttachment[]) => void;
  onFilesChange?: (files: File[]) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB limit
const MAX_FILES = 5;

const allowedFileTypes = new Map<string, Set<string>>([
  ['.jpg', new Set(['image/jpeg'])],
  ['.jpeg', new Set(['image/jpeg'])],
  ['.png', new Set(['image/png'])],
  ['.webp', new Set(['image/webp'])],
  ['.gif', new Set(['image/gif'])],
  ['.mp4', new Set(['video/mp4'])],
  ['.webm', new Set(['video/webm'])],
  ['.pdf', new Set(['application/pdf'])],
  ['.txt', new Set(['text/plain'])],
  ['.doc', new Set(['application/msword'])],
  [
    '.docx',
    new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ],
  ['.xls', new Set(['application/vnd.ms-excel'])],
  [
    '.xlsx',
    new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ],
]);

function isImageFile(type?: string | null, name?: string | null): boolean {
  const lowerType = (type || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();
  return (
    lowerType.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|svg|bmp|ico)$/i.test(lowerName)
  );
}

function isVideoFile(type?: string | null, name?: string | null): boolean {
  const lowerType = (type || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();
  return (
    lowerType.startsWith('video/') ||
    /\.(mp4|webm|ogg|mov|m4v)$/i.test(lowerName)
  );
}

function isPdfFile(type?: string | null, name?: string | null): boolean {
  const lowerType = (type || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();
  return (
    lowerType === 'application/pdf' ||
    /\.pdf$/i.test(lowerName)
  );
}

export function TaskAttachments({
  attachments = [],
  onChange,
  onFilesChange,
  disabled = false,
}: TaskAttachmentsProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep original File objects separate from display metadata and preview URLs.
  const selectedFilesRef = useRef<Map<string, File>>(new Map());
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  // Restore/generate Object URLs from IndexedDB for attachments on mount/change
  useEffect(() => {
    let isMounted = true;
    const activeUrls: string[] = [];

    async function loadPreviews() {
      const urls: Record<string, string> = {};

      for (const att of attachments) {
        // If we already have a valid generated URL for this attachment in state, keep it
        if (previewUrls[att.id]) {
          urls[att.id] = previewUrls[att.id];
          continue;
        }

        // Always check IndexedDB for persisted blob if blobKey exists
        if (att.blobKey) {
          try {
            const blob = await getMediaBlob(att.blobKey);
            if (blob && isMounted) {
              const objectUrl = URL.createObjectURL(blob);
              activeUrls.push(objectUrl);
              urls[att.id] = objectUrl;
              continue;
            }
          } catch (err) {
            console.warn('Error reading media blob from storage:', err);
          }
        }

        // If it's a valid URL (http, https, active blob:, /api/...), use it directly
        if (att.url) {
          urls[att.id] = att.url;
        }
      }

      if (isMounted) {
        setPreviewUrls((prev) => ({ ...prev, ...urls }));
      }
    }

    loadPreviews();

    return () => {
      isMounted = false;
      activeUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
    };
  }, [attachments]);

  // Handle preview modal setup when an attachment is selected
  useEffect(() => {
    if (!previewAttachment) {
      setPreviewLoading(true);
      setPreviewError(false);
      return;
    }

    const currentUrl = previewUrls[previewAttachment.id] || previewAttachment.url;
    if (currentUrl) {
      setPreviewLoading(false);
      setPreviewError(false);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(false);

    // If previewUrl is not yet loaded for this attachment, attempt on-demand fetch
    if (previewAttachment.blobKey) {
      getMediaBlob(previewAttachment.blobKey)
        .then((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setPreviewUrls((prev) => ({ ...prev, [previewAttachment.id]: url }));
            setPreviewLoading(false);
          } else if (previewAttachment.url) {
            setPreviewUrls((prev) => ({ ...prev, [previewAttachment.id]: previewAttachment.url || '' }));
            setPreviewLoading(false);
          } else {
            setPreviewError(true);
            setPreviewLoading(false);
          }
        })
        .catch(() => {
          if (previewAttachment.url) {
            setPreviewUrls((prev) => ({ ...prev, [previewAttachment.id]: previewAttachment.url || '' }));
            setPreviewLoading(false);
          } else {
            setPreviewError(true);
            setPreviewLoading(false);
          }
        });
    } else if (previewAttachment.url) {
      setPreviewUrls((prev) => ({ ...prev, [previewAttachment.id]: previewAttachment.url || '' }));
      setPreviewLoading(false);
    } else {
      setPreviewError(true);
      setPreviewLoading(false);
    }
  }, [previewAttachment, previewUrls]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (selectedFilesRef.current.size + files.length > MAX_FILES) {
      setErrorMessage(`A maximum of ${MAX_FILES} attachments can be selected.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const newAttachments: TaskAttachment[] = [];
    const newUrls: Record<string, string> = {};
    let selectionError: string | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const acceptedMimeTypes = allowedFileTypes.get(extension);
      if (!acceptedMimeTypes?.has(file.type)) {
        selectionError = `"${file.name}" is not a supported attachment type.`;
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        selectionError =
          `"${file.name}" (${formatFileSize(file.size)}) exceeds the maximum 25 MB limit.`;
        continue;
      }

      const duplicate = Array.from(selectedFilesRef.current.values()).some(
        (selectedFile) =>
          selectedFile.name === file.name &&
          selectedFile.size === file.size &&
          selectedFile.lastModified === file.lastModified,
      );
      if (duplicate) {
        selectionError = `"${file.name}" is already selected.`;
        continue;
      }

      const id = `att-${crypto.randomUUID()}`;
      try {
        await saveMediaBlob(id, file);
        selectedFilesRef.current.set(id, file);
        const objectUrl = URL.createObjectURL(file);
        objectUrlsRef.current.set(id, objectUrl);
        newUrls[id] = objectUrl;

        newAttachments.push({
          id,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          blobKey: id,
          url: objectUrl,
          uploadedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Failed to store attachment:', err);
        selectionError = `Could not process "${file.name}".`;
      }
    }

    setErrorMessage(selectionError);

    if (newAttachments.length > 0) {
      setPreviewUrls((prev) => ({ ...prev, ...newUrls }));
      const nextAttachments = [...attachments, ...newAttachments];
      onChange(nextAttachments);
      onFilesChange?.(Array.from(selectedFilesRef.current.values()));
    }

    // Reset native input so user can re-select the same file if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleRemove(attId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const target = attachments.find((a) => a.id === attId);
    selectedFilesRef.current.delete(attId);
    onFilesChange?.(Array.from(selectedFilesRef.current.values()));
    if (target?.blobKey) {
      await deleteMediaBlob(target.blobKey);
    }
    if (previewUrls[attId]) {
      try {
        URL.revokeObjectURL(previewUrls[attId]);
      } catch {
        // ignore
      }
    }
    objectUrlsRef.current.delete(attId);

    setPreviewUrls((prev) => {
      const copy = { ...prev };
      delete copy[attId];
      return copy;
    });

    if (previewAttachment?.id === attId) {
      setPreviewAttachment(null);
    }

    onChange(attachments.filter((a) => a.id !== attId));
  }

  const currentPreviewUrl = previewAttachment
    ? previewUrls[previewAttachment.id] || previewAttachment.url || ''
    : '';

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-text-secondary flex items-center gap-1.5">
          <Paperclip size={12} className="text-text-muted" />
          <span>Attachments ({attachments.length})</span>
        </label>

        {!disabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] font-medium text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>+ Add file</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf,.txt,.doc,.docx,.xls,.xlsx"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {errorMessage && (
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {attachments.length === 0 ? (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`p-3 rounded-lg border border-dashed border-border/80 bg-surface-elevated/30 flex items-center justify-center gap-2 text-text-muted text-[11px] ${
            disabled ? 'opacity-60' : 'cursor-pointer hover:bg-surface-elevated/60 hover:border-border transition-colors'
          }`}
        >
          <Paperclip size={13} />
          <span>No attachments yet. Click to attach image, video, or document (up to 25 MB).</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((att) => {
            const isImage = isImageFile(att.type, att.name);
            const isVideo = isVideoFile(att.type, att.name);
            const isPdf = isPdfFile(att.type, att.name);
            const previewUrl = previewUrls[att.id] || att.url;

            let typeBadge = 'FILE';
            if (isImage) typeBadge = 'IMG';
            else if (isVideo) typeBadge = 'VID';
            else if (isPdf) typeBadge = 'PDF';

            return (
              <div
                key={att.id}
                onClick={() => setPreviewAttachment(att)}
                className="p-2 rounded-lg bg-surface-elevated border border-border flex items-center gap-2.5 relative group overflow-hidden cursor-pointer hover:border-brand-primary/60 hover:bg-surface-hover/80 transition-all select-none"
                title={`Click to preview ${att.name}`}
              >
                {/* Media Thumbnail */}
                <div className="w-12 h-12 rounded bg-surface shrink-0 overflow-hidden border border-border/60 flex items-center justify-center">
                  {isImage && previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={att.name}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo && previewUrl ? (
                    <video
                      src={previewUrl}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo ? (
                    <VideoIcon size={18} className="text-purple-400" />
                  ) : isPdf ? (
                    <FileText size={18} className="text-rose-400" />
                  ) : isImage ? (
                    <ImageIcon size={18} className="text-blue-400" />
                  ) : (
                    <FileIcon size={18} className="text-text-muted" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 pr-6">
                  <p
                    className="font-medium text-text-primary text-[11px] truncate group-hover:text-brand-primary transition-colors"
                    title={att.name}
                  >
                    {att.name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                    <span className="uppercase font-mono px-1 py-0.2 rounded bg-surface border border-border/40">
                      {typeBadge}
                    </span>
                    <span>{formatFileSize(att.size)}</span>
                  </div>
                </div>

                {/* Remove Button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemove(att.id, e)}
                    className="p-1 rounded text-text-muted hover:text-rose-400 hover:bg-surface transition-colors absolute right-1.5 top-1.5 z-10"
                    title="Remove attachment"
                    aria-label={`Remove ${att.name}`}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <Dialog
          isOpen={Boolean(previewAttachment)}
          onClose={() => setPreviewAttachment(null)}
          zIndex="z-[70]"
          title={
            <div className="flex items-center gap-2 min-w-0 pr-6">
              {isImageFile(previewAttachment.type, previewAttachment.name) ? (
                <ImageIcon size={16} className="text-blue-400 shrink-0" />
              ) : isVideoFile(previewAttachment.type, previewAttachment.name) ? (
                <VideoIcon size={16} className="text-purple-400 shrink-0" />
              ) : isPdfFile(previewAttachment.type, previewAttachment.name) ? (
                <FileText size={16} className="text-rose-400 shrink-0" />
              ) : (
                <FileIcon size={16} className="text-text-muted shrink-0" />
              )}
              <span className="font-semibold text-text-primary text-sm truncate" title={previewAttachment.name}>
                {previewAttachment.name}
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text-muted shrink-0">
                {formatFileSize(previewAttachment.size)}
              </span>
            </div>
          }
          maxWidth="max-w-4xl"
        >
          <div
            className="space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading Indicator */}
            {previewLoading && !previewError && (
              <div className="flex items-center justify-center p-8 text-text-muted text-xs gap-2">
                <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading preview...</span>
              </div>
            )}

            {/* Error Fallback */}
            {previewError ? (
              <div className="p-8 text-center space-y-3 bg-surface-elevated/40 rounded-xl border border-border">
                <AlertCircle size={32} className="mx-auto text-rose-400" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Preview Unavailable</p>
                  <p className="text-xs text-text-muted mt-1">
                    The file content could not be rendered inline or is inaccessible.
                  </p>
                </div>
                {currentPreviewUrl && (
                  <a
                    href={currentPreviewUrl}
                    download={previewAttachment.name}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    <Download size={14} />
                    <span>Download file</span>
                  </a>
                )}
              </div>
            ) : (
              /* Content Preview */
              <div>
                {/* 1. Image Preview */}
                {isImageFile(previewAttachment.type, previewAttachment.name) && currentPreviewUrl && (
                  <div className="flex items-center justify-center bg-black/40 rounded-xl p-3 max-h-[70vh] overflow-hidden border border-border/50">
                    <img
                      src={currentPreviewUrl}
                      alt={previewAttachment.name}
                      className={`max-h-[65vh] max-w-full object-contain rounded transition-opacity duration-200 ${
                        previewLoading ? 'opacity-0' : 'opacity-100'
                      }`}
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => {
                        setPreviewLoading(false);
                        setPreviewError(true);
                      }}
                    />
                  </div>
                )}

                {/* 2. Video Preview */}
                {isVideoFile(previewAttachment.type, previewAttachment.name) && currentPreviewUrl && (
                  <div className="flex items-center justify-center bg-black/50 rounded-xl p-2 max-h-[70vh] border border-border/50">
                    <video
                      src={currentPreviewUrl}
                      controls
                      autoPlay={false}
                      playsInline
                      className={`max-h-[65vh] max-w-full rounded transition-opacity duration-200 ${
                        previewLoading ? 'opacity-0' : 'opacity-100'
                      }`}
                      onLoadedData={() => setPreviewLoading(false)}
                      onError={() => {
                        setPreviewLoading(false);
                        setPreviewError(true);
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {/* 3. PDF Preview */}
                {isPdfFile(previewAttachment.type, previewAttachment.name) && currentPreviewUrl && (
                  <div className="space-y-2">
                    <iframe
                      src={currentPreviewUrl}
                      className="w-full h-[65vh] rounded-xl border border-border bg-white"
                      title={previewAttachment.name}
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => {
                        setPreviewLoading(false);
                        setPreviewError(true);
                      }}
                    />
                    <div className="flex items-center justify-between text-[11px] text-text-muted px-1">
                      <span>Inline PDF viewer</span>
                      <a
                        href={currentPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink size={12} />
                        <span>Open in new tab</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* 4. Other Documents Fallback */}
                {!isImageFile(previewAttachment.type, previewAttachment.name) &&
                  !isVideoFile(previewAttachment.type, previewAttachment.name) &&
                  !isPdfFile(previewAttachment.type, previewAttachment.name) && (
                    <div className="p-8 text-center space-y-4 bg-surface-elevated/40 rounded-xl border border-border">
                      <FileIcon size={36} className="mx-auto text-text-muted" />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {previewAttachment.name}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          Inline preview is not supported for this file format ({previewAttachment.type || 'document'}).
                        </p>
                      </div>
                      {currentPreviewUrl && (
                        <a
                          href={currentPreviewUrl}
                          download={previewAttachment.name}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary/90 transition-colors shadow-xs"
                        >
                          <Download size={14} />
                          <span>Download file</span>
                        </a>
                      )}
                    </div>
                  )}
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              {currentPreviewUrl ? (
                <a
                  href={currentPreviewUrl}
                  download={previewAttachment.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="px-3.5 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
