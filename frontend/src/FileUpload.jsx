import { useState, useRef, useContext } from 'react';
import { Upload, X, File, Image, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { MyContext } from './MyContext';
import './FileUpload.css';
import { API_URL } from "./config.js";

const FileUpload = ({ onFileUploaded }) => {
  const { currThreadId } = useContext(MyContext);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localUploadedFiles, setLocalUploadedFiles] = useState([]); // Track locally for UI
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = {
    'application/pdf': { icon: FileText, color: 'icon-red' },
    'image/png': { icon: Image, color: 'icon-blue' },
    'image/jpeg': { icon: Image, color: 'icon-blue' },
    'image/jpg': { icon: Image, color: 'icon-blue' },
    'text/plain': { icon: File, color: 'icon-gray' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      icon: FileText,
      color: 'icon-blue-dark'
    },
    'text/csv': { icon: FileText, color: 'icon-green' }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES[file.type]) {
      setError(`File type ${file.type} is not supported`);
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('threadId', currThreadId);

    try {
      // Fake progress for UX since fetch doesn't support progress events easily
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
           if (prev >= 90) return prev;
           return prev + 10;
        });
      }, 200);

      const response = await fetch(`${API_URL}/api/upload/single`, {
        method: 'POST',
        headers: {
            // 'Content-Type': 'multipart/form-data' // Do NOT set this manually with FormData
        },
        credentials: 'include',
        body: formData
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      
      setUploadProgress(100);
      setLocalUploadedFiles(prev => [...prev, result.file]);
      
      // Notify parent component
      if (onFileUploaded) {
        onFileUploaded(result.file);
      }

      // Reset state for next upload
      setTimeout(() => {
        setSelectedFile(null);
        setUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 1000);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const FileIcon = selectedFile && ALLOWED_TYPES[selectedFile.type]?.icon;
  const iconColorClass = selectedFile && ALLOWED_TYPES[selectedFile.type]?.color;

  return (
    <div className="file-upload-wrapper">
      {/* File Input Trigger */}
      <div className="file-input-group">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".pdf,.png,.jpg,.jpeg,.docx,.txt,.csv"
          className="hidden-input"
          id="file-upload"
          disabled={uploading}
        />
        
        <label
          htmlFor="file-upload"
          className={`file-select-label ${uploading ? 'disabled' : ''}`}
        >
          <Upload size={18} />
          <span>{uploading ? 'Uploading...' : 'Attach File'}</span>
        </label>

        {selectedFile && !uploading && (
          <button
            onClick={uploadFile}
            className="upload-submit-btn"
          >
            Upload
          </button>
        )}
      </div>

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="selected-file-preview">
          {FileIcon && <FileIcon className={`file-icon-lucide ${iconColorClass}`} size={24} />}
          
          <div className="file-preview-info">
            <p className="file-name-text">{selectedFile.name}</p>
            <p className="file-size-text">{formatFileSize(selectedFile.size)}</p>
          </div>

          {uploading ? (
            <Loader2 className="spinner-icon" size={20} />
          ) : (
            <button
              onClick={removeSelectedFile}
              className="remove-btn-icon"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="upload-progress-container">
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="progress-text">
            {uploadProgress < 100 ? 'Processing file...' : 'Upload complete!'}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="upload-error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Locally Uploaded Files List (Visual Confirmation) */}
      {localUploadedFiles.length > 0 && (
        <div className="uploaded-list">
          <p className="uploaded-list-title">Attached Files:</p>
          {localUploadedFiles.map((file, index) => (
            <div key={index} className="uploaded-file-item">
              <CheckCircle2 size={16} className="success-icon" />
              <span className="uploaded-filename">{file.originalName}</span>
              {file.hasText && (
                <span className="processed-badge">✓ Processed</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
