import { useState, useRef, useContext } from 'react';
import { MyContext } from './MyContext';
import './FileUpload.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-plexus-cicd.onrender.com';

const ALLOWED_TYPES = {
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/jpg': 'JPEG',
    'image/webp': 'WebP',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'text/plain': 'TXT',
    'text/csv': 'CSV'
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

function FileUpload({ onUploadComplete }) {
    const { currThreadId } = useContext(MyContext);
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const validateFile = (file) => {
        if (!ALLOWED_TYPES[file.type]) {
            return `${file.name}: Unsupported file type`;
        }
        if (file.size > MAX_FILE_SIZE) {
            return `${file.name}: File size exceeds 10MB`;
        }
        return null;
    };

    const handleFiles = (newFiles) => {
        setError(null);
        const fileArray = Array.from(newFiles);
        
        if (files.length + fileArray.length > MAX_FILES) {
            setError(`Maximum ${MAX_FILES} files allowed`);
            return;
        }

        const validFiles = [];
        for (const file of fileArray) {
            const error = validateFile(file);
            if (error) {
                setError(error);
                return;
            }
            validFiles.push(file);
        }

        setFiles(prev => [...prev, ...validFiles]);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setError(null);
    };

    const uploadFiles = async () => {
        if (files.length === 0) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        formData.append('threadId', currThreadId);

        try {
            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.message || 'Upload failed');
                return;
            }
            
            const data = await response.json();
            setFiles([]);
            if (onUploadComplete) {
                onUploadComplete(data.files);
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to upload files. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="file-upload-container">
            <div
                className={`file-drop-zone ${dragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={Object.keys(ALLOWED_TYPES).join(',')}
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />
                <i className="fa-solid fa-cloud-arrow-up"></i>
                <p>Drag & drop files here or click to browse</p>
                <span>PNG, JPEG, WebP, PDF, DOCX, TXT, CSV (Max 10MB, 5 files)</span>
            </div>

            {error && (
                <div className="upload-error">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    {error}
                </div>
            )}

            {files.length > 0 && (
                <div className="file-list">
                    {files.map((file, index) => (
                        <div key={index} className="file-item">
                            <div className="file-info">
                                <i className={`fa-solid ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file'}`}></i>
                                <div className="file-details">
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">{formatFileSize(file.size)}</span>
                                </div>
                            </div>
                            <button
                                className="remove-file"
                                onClick={() => removeFile(index)}
                                disabled={uploading}
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {files.length > 0 && (
                <button
                    className="upload-button"
                    onClick={uploadFiles}
                    disabled={uploading}
                >
                    {uploading ? (
                        <>
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            Uploading...
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-upload"></i>
                            Upload {files.length} file{files.length > 1 ? 's' : ''}
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

export default FileUpload;
