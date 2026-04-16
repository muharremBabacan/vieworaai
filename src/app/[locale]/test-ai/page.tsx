'use client';

import { useState } from 'react';
import { testUploadAndAnalyze } from '@/lib/image/test-actions';

export default function TestAiPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRunTest = async () => {
    if (!file) return alert('Select a file first');
    
    setLoading(true);
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await testUploadAndAnalyze(formData);
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', color: 'black', minHeight: '100vh' }}>
      <h1 style={{ color: 'black' }}>🛠️ Naked AI Test Page</h1>
      <p style={{ color: '#333' }}>This is a zero-style test to isolate Storage and AI logic.</p>
      
      <div style={{ padding: '20px', border: '2px dashed #ccc', borderRadius: '10px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
        <input 
          type="file" 
          onChange={(e) => setFile(e.target.files?.[0] || null)} 
          accept="image/*"
          style={{ color: 'black' }}
        />
      </div>

      <button 
        onClick={handleRunTest}
        disabled={loading || !file}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Running Test (Check Terminal Logs)...' : 'Run Test (Upload & Analyze)'}
      </button>

      {result && (
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f4f4f4', borderRadius: '10px', color: 'black' }}>
          <h3 style={{ color: 'black' }}>Result:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'black' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
          
          {result.imageUrl && (
            <div style={{ marginTop: '20px' }}>
              <p>Uploaded Image:</p>
              <img src={result.imageUrl} alt="Uploaded" style={{ maxWidth: '100%', borderRadius: '5px' }} />
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '40px', fontSize: '14px', color: '#666' }}>
        <p><strong>Terminal Check:</strong> While this test runs, look at your terminal (npm run dev screen).</p>
      </div>
    </div>
  );
}