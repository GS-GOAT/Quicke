import { useState } from 'react';

export default function TestUpload() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setStatus('Uploading...');
    try {
      const response = await fetch('/api/upload-test', { // Create a test endpoint
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStatus('Upload successful!');
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Test PDF Upload</h2>
      <input 
        type="file" 
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button type="submit" disabled={!file}>Upload</button>
      <div>{status}</div>
    </form>
  );
} 