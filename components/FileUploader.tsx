import React, { useRef } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';

interface FileUploaderProps {
  files: File[];
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  files,
  onFilesSelected,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      onFilesSelected([...files, ...newFiles]);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    if (disabled) return;
    const newFiles = files.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
  };

  return (
    <div className="w-full space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
          disabled
            ? 'border-zinc-800 bg-zinc-900 cursor-not-allowed opacity-60'
            : 'border-indigo-800/50 bg-indigo-900/10 hover:bg-indigo-900/20 hover:border-indigo-700 cursor-pointer'
        }`}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          type="file"
          ref={inputRef}
          onChange={handleInputChange}
          className="hidden"
          accept=".csv"
          multiple
          disabled={disabled}
        />
        <div className="p-3 bg-indigo-500/10 rounded-full mb-3 text-indigo-400">
          <Upload size={24} />
        </div>
        <h3 className="text-sm font-semibold text-zinc-100">
          Upload CSV Files
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Drag and drop or click to select multiple files
        </p>
      </div>

      {files.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg divide-y divide-zinc-800 max-h-60 overflow-y-auto shadow-sm">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between p-3"
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                <FileSpreadsheet size={18} className="text-emerald-500 shrink-0" />
                <span className="text-sm text-zinc-300 truncate font-medium">
                  {file.name}
                </span>
                <span className="text-xs text-zinc-500 shrink-0">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                aria-label="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};