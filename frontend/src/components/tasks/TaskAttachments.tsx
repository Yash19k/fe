import React, { useState, useEffect, useRef } from 'react';
import { Paperclip, X, Image as ImageIcon, Video as VideoIcon, AlertCircle } from 'lucide-react';
import { TaskAttachment } from '../../types';
import { saveMediaBlob, getMediaBlob, deleteMediaBlob, formatFileSize } from '../../utils/mediaStorage';

export interface TaskAttachmentsProps {
  attachments?: TaskAttachment[];
  onChange: (attachments: TaskAttachment[]) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB limit

export function TaskAttachments({
  attachments = [],
  onChange,
  disabled = false,
}: TaskAttachmentsProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore/generate Object URLs from IndexedDB for attachments on mount/change
  useEffect(() => {
    let isMounted = true;
    const activeUrls: string[] = [];

    async function loadPreviews() {
      const urls: Record<string, string> = {};

      for (const att of attachments) {
        if (att.url && att.url.startsWith('blob:')) {
          urls[att.id] = att.url;
        } else if (att.blobKey) {
          const blob = await getMediaBlob(att.blobKey);
          if (blob && isMounted) {
            const objectUrl = URL.createObjectURL(blob);
            activeUrls.push(objectUrl);
            urls[att.id] = objectUrl;
          }
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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: TaskAttachment[] = [];
    const newUrls: Record<string, string> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate MIME type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        setErrorMessage(
          `"${file.name}" is not a supported media file. Only image and video files are supported.`
        );
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(
          `"${file.name}" (${formatFileSize(file.size)}) exceeds the maximum 25 MB limit.`
        );
        continue;
      }

      const id = `att-${Date.now()}-${Math.random().toString(36).substring(5)}`;
      try {
        await saveMediaBlob(id, file);
        const objectUrl = URL.createObjectURL(file);
        newUrls[id] = objectUrl;

        newAttachments.push({
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          blobKey: id,
          url: objectUrl,
          uploadedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Failed to store attachment:', err);
        setErrorMessage(`Could not process "${file.name}".`);
      }
    }

    if (newAttachments.length > 0) {
      setPreviewUrls((prev) => ({ ...prev, ...newUrls }));
      onChange([...attachments, ...newAttachments]);
    }

    // Reset native input so user can re-select the same file if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleRemove(attId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const target = attachments.find((a) => a.id === attId);
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

    setPreviewUrls((prev) => {
      const copy = { ...prev };
      delete copy[attId];
      return copy;
    });

    onChange(attachments.filter((a) => a.id !== attId));
  }

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
            <span>+ Add image/video</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
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
          <span>No image or video attached. Click to attach media (up to 25 MB).</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((att) => {
            const isImage = att.type.startsWith('image/');
            const isVideo = att.type.startsWith('video/');
            const previewUrl = previewUrls[att.id] || att.url;

            return (
              <div
                key={att.id}
                className="p-2 rounded-lg bg-surface-elevated border border-border flex items-center gap-2.5 relative group overflow-hidden"
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
                  ) : (
                    <ImageIcon size={18} className="text-blue-400" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 pr-6">
                  <p className="font-medium text-text-primary text-[11px] truncate" title={att.name}>
                    {att.name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                    <span className="uppercase font-mono px-1 py-0.2 rounded bg-surface border border-border/40">
                      {isImage ? 'IMG' : 'VID'}
                    </span>
                    <span>{formatFileSize(att.size)}</span>
                  </div>
                </div>

                {/* Remove Button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemove(att.id, e)}
                    className="p-1 rounded text-text-muted hover:text-rose-400 hover:bg-surface transition-colors absolute right-1.5 top-1.5"
                    title="Remove attachment"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
