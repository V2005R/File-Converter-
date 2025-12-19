import React, { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { CategorySelector } from './components/CategorySelector';
import { processFiles } from './services/processor';
import { Category, ProcessingStatus, ProcessedResult } from './types';
import { Loader2, Download, CheckCircle2, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedResult | null>(null);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    if (status === 'success' || status === 'error') {
      setStatus('idle');
      setResult(null);
      setError(null);
    }
  };

  const handleProcess = async () => {
    if (!category || files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const zipBlob = await processFiles(files, category);
      const timestamp = new Date().toISOString().slice(0, 10);
      
      setResult({
        zipBlob,
        fileName: `${category.toLowerCase()}_processed_${timestamp}.zip`,
        count: files.length,
      });
      setStatus('success');
    } catch (err) {
      console.error(err);
      setError('An error occurred while processing the files. Please check the CSV format.');
      setStatus('error');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
      setFiles([]);
      setCategory(null);
      setStatus('idle');
      setResult(null);
      setError(null);
  };

  const isProcessing = status === 'processing';

  return (
    <div className="min-h-screen bg-black py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl">
        
        {/* Main Card */}
        <div className="bg-zinc-950 rounded-2xl shadow-2xl overflow-hidden border border-zinc-800">
          <div className="p-8 space-y-8">
            
            {/* Step 1: Upload */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold mr-3 border border-indigo-500/30">1</span>
                Upload Files
              </h2>
              <FileUploader 
                files={files} 
                onFilesSelected={handleFilesSelected} 
                disabled={isProcessing}
              />
            </section>

            {/* Step 2: Category */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold mr-3 border border-indigo-500/30">2</span>
                Select Category
              </h2>
              <CategorySelector 
                selectedCategory={category} 
                onSelectCategory={setCategory} 
                disabled={isProcessing}
              />
            </section>

            {/* Action Area */}
            <div className="pt-4 border-t border-zinc-800">
              {status === 'idle' && (
                <button
                  onClick={handleProcess}
                  disabled={files.length === 0 || !category}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Process {files.length > 0 ? `${files.length} Files` : 'Files'}
                </button>
              )}

              {status === 'processing' && (
                <div className="w-full py-4 flex flex-col items-center justify-center space-y-3 bg-indigo-900/10 border border-indigo-900/30 rounded-lg">
                  <Loader2 className="animate-spin text-indigo-400" size={32} />
                  <span className="text-sm font-medium text-indigo-300">Processing files locally...</span>
                </div>
              )}

              {status === 'success' && result && (
                <div className="space-y-4">
                    <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-4 flex items-start space-x-3">
                        <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="text-sm font-medium text-emerald-400">Conversion Successful!</h3>
                            <p className="text-sm text-emerald-600/80 mt-1">
                                Successfully processed {result.count} files.
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleReset}
                            className="flex justify-center items-center py-3 px-4 border border-zinc-700 rounded-lg shadow-sm text-sm font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Start Over
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            <Download size={18} className="mr-2" />
                            Download ZIP
                        </button>
                    </div>
                </div>
              )}

              {status === 'error' && (
                  <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 flex items-start space-x-3">
                      <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                      <div className="flex-1">
                          <h3 className="text-sm font-medium text-red-400">Processing Failed</h3>
                          <p className="text-sm text-red-500/80 mt-1">{error}</p>
                          <button 
                            onClick={() => setStatus('idle')}
                            className="mt-3 text-sm text-red-400 hover:text-red-300 font-medium underline"
                          >
                              Try Again
                          </button>
                      </div>
                  </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default App;