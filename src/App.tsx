import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Upload, Maximize2, Minimize2, Link, Link2Off, RefreshCw, FileText, Tag, XCircle, MinusCircle, PlusCircle } from 'lucide-react';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

type PDFViewerProps = {
  file: File | null;
  scale: number;
  containerRef?: React.RefObject<HTMLDivElement>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
  className?: string;
};

function PDFViewer({ file, scale, containerRef, onScroll, onContextMenu, style, className }: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [visiblePages, setVisiblePages] = useState<number[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const onDocumentLoadSuccess = useCallback(({ numPages: nextNumPages }: { numPages: number }) => {
    setNumPages(nextNumPages);
    pageRefs.current = new Array(nextNumPages).fill(null);
  }, []);

  useEffect(() => {
    if (!file) return;

    const options = {
      root: containerRef?.current,
      rootMargin: '100px 0px',
      threshold: 0.1
    };

    const callback: IntersectionObserverCallback = (entries) => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .map(entry => Number(entry.target.getAttribute('data-page-number')))
        .filter(Boolean);
      
      setVisiblePages(prev => {
        const newPages = [...new Set([...prev, ...visible])];
        return newPages.sort((a, b) => a - b);
      });
    };

    observerRef.current = new IntersectionObserver(callback, options);
    return () => observerRef.current?.disconnect();
  }, [file, containerRef]);

  if (!file) {
    return (
      <div
        style={style}
        onContextMenu={onContextMenu}
        className={`flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg p-6 ${className || ''}`}
      >
        <Upload className="w-12 h-12 text-gray-400 mb-2" />
        <p className="text-gray-500">Arrastra o selecciona un PDF</p>
      </div>
    );
  }

  return (
    <div onContextMenu={onContextMenu} className={`flex flex-col items-center h-full ${className || ''}`} style={style}>
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        onScroll={onScroll}
        className="flex-1 overflow-auto w-full flex justify-center"
      >
        <Document 
          file={file} 
          onLoadSuccess={onDocumentLoadSuccess}
          className="max-w-full"
        >
          {Array.from(new Array(numPages), (_, index) => {
            const pageNumber = index + 1;
            return (
              <div
                key={`page_${pageNumber}`}
                ref={el => {
                  pageRefs.current[index] = el;
                  if (el && observerRef.current) {
                    observerRef.current.observe(el);
                  }
                }}
                data-page-number={pageNumber}
                className="mb-4"
              >
                {visiblePages.includes(pageNumber) && (
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    className="shadow-lg"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    loading={<div className="h-[800px] bg-gray-100 animate-pulse rounded-lg" />}
                  />
                )}
              </div>
            );
          })}
        </Document>
      </div>
    </div>
  );
}

function App() {
  // Función para intercambiar los documentos
  const swapDocuments = () => {
    setLeftPDF(rightPDF);
    setRightPDF(leftPDF);
    setLeftInputKey(Date.now());
    setRightInputKey(Date.now());
      // Intercambiar datos etiquetados
    setSummary(prevSummary => prevSummary.map(item => ({
      label: item.label,
      left: item.right,
      right: item.left
    })));
  };

  // Función para eliminar un documento
  const removeDocument = (side: 'left' | 'right') => {
    if (side === 'left') {
      setLeftPDF(null);
      setLeftInputKey(Date.now());
    } else {
      setRightPDF(null);
      setRightInputKey(Date.now());
    }
  };

  // Función para mostrar nombre de archivo con máximo 30 caracteres
  const getFileName = (file: File | null) => {
    if (!file) return '';
    return file.name.length > 30 ? file.name.slice(0, 27) + '...' : file.name;
  };
  const [leftPDF, setLeftPDF] = useState<File | null>(null);
  const [rightPDF, setRightPDF] = useState<File | null>(null);
  const [leftScale, setLeftScale] = useState(1);
  const [rightScale, setRightScale] = useState(1);
  const [syncZoom, setSyncZoom] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [syncScroll, setSyncScroll] = useState(false);
  const [showEtiquetasModal, setShowEtiquetasModal] = useState(false);
  const [showResumenModal, setShowResumenModal] = useState(false);
  const [enableEtiquetar, setEnableEtiquetar] = useState(false);
  const [labels, setLabels] = useState<string[]>(['Poliza', 'Inicio', 'Fin', 'Sum Aseg', 'P Total', 'Comision', 'Inicio Pago', 'Dedicible','Clausula','Condicion','Cobertura','Dato Contratante','Dato Asegurado','Dato Bien','Anexo','Corredor', 'Observacion']);
  const [summary, setSummary] = useState<any[]>([]);
  const [contextMenu, setContextMenu] = useState<any>(null);
  const [labelSearch, setLabelSearch] = useState('');
  const [leftInputKey, setLeftInputKey] = useState(Date.now());
  const [rightInputKey, setRightInputKey] = useState(Date.now());
  const [zoomDiff, setZoomDiff] = useState(0);
  const [scrollDiff, setScrollDiff] = useState(0);

  const leftContainerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu')) {
        setContextMenu(null);
        setLabelSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  useEffect(() => {
    if (syncZoom) {
      setZoomDiff(rightScale - leftScale);
    }
  }, [syncZoom]);

  useEffect(() => {
    if (syncScroll && leftContainerRef.current && rightContainerRef.current) {
      setScrollDiff(rightContainerRef.current.scrollTop - leftContainerRef.current.scrollTop);
    }
  }, [syncScroll]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'left' | 'right') => {
    const file = e.target.files?.[0];
    if (file) {
      if (side === 'left') setLeftPDF(file);
      else setRightPDF(file);
    }
  };

  const handleBothFilesChange = (files: File[]) => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 1) {
      if (!leftPDF) setLeftPDF(pdfFiles[0]);
      else if (!rightPDF) setRightPDF(pdfFiles[0]);
    } else if (pdfFiles.length >= 2) {
      setLeftPDF(pdfFiles[0]);
      setRightPDF(pdfFiles[1]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement | HTMLLabelElement>, side: 'left' | 'right') => {
    if ((side === 'left' && leftPDF) || (side === 'right' && rightPDF)) return;
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') {
      if (side === 'left') setLeftPDF(file);
      else setRightPDF(file);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const onLeftScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || isSyncing.current) return;
    isSyncing.current = true;
    const scrollTop = e.currentTarget.scrollTop;
    if (rightContainerRef.current) {
      rightContainerRef.current.scrollTop = scrollTop + scrollDiff;
    }
    setTimeout(() => (isSyncing.current = false), 0);
  };

  const onRightScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || isSyncing.current) return;
    isSyncing.current = true;
    const scrollTop = e.currentTarget.scrollTop;
    if (leftContainerRef.current) {
      leftContainerRef.current.scrollTop = scrollTop - scrollDiff;
    }
    setTimeout(() => (isSyncing.current = false), 0);
  };

  const refreshDocuments = () => {
    setLeftPDF(null);
    setRightPDF(null);
    setLeftInputKey(Date.now());
    setRightInputKey(Date.now());
  };

  const handleLeftContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableEtiquetar) return;
    e.preventDefault();
    const text = window.getSelection()?.toString() || '';
    setContextMenu({ x: e.clientX, y: e.clientY, selectedText: text, side: 'left' });
    setLabelSearch('');
  };

  const handleRightContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableEtiquetar) return;
    e.preventDefault();
    const text = window.getSelection()?.toString() || '';
    setContextMenu({ x: e.clientX, y: e.clientY, selectedText: text, side: 'right' });
    setLabelSearch('');
  };

  const handleLabelSelect = (label: string) => {
    if (!contextMenu) return;
    setSummary((prev) => {
      const newSummary = [...prev];
      const index = newSummary.findIndex((item) => item.label === label);
      if (index !== -1) {
        newSummary[index] = { ...newSummary[index], [contextMenu.side]: contextMenu.selectedText };
      } else {
        newSummary.push({ label, [contextMenu.side]: contextMenu.selectedText });
      }
      const currentItem = newSummary.find((item) => item.label === label);
      if (currentItem && currentItem.left && currentItem.right) {
        setLabels((prevLabels) => prevLabels.filter((l) => l !== label));
      }
      return newSummary;
    });
    setContextMenu(null);
    setLabelSearch('');
  };

  const removeFromSummary = (label: string) => {
    setSummary((prev) => prev.filter((item) => item.label !== label));
    if (!labels.includes(label)) {
      setLabels((prev) => [...prev, label]);
    }
  };

  const removeLabel = (labelToRemove: string) => {
    setLabels((prev) => prev.filter((label) => label !== labelToRemove));
    setSummary((prev) => prev.filter((item) => item.label !== labelToRemove));
  };

  const addNewLabel = (newLabel: string) => {
    if (newLabel && !labels.includes(newLabel)) {
      setLabels((prev) => [...prev, newLabel]);
    }
  };

  const filteredLabels = labels.filter((label) =>
    label.toLowerCase().includes(labelSearch.toLowerCase())
  );

  const changeLeftZoom = (delta: number) => {
    const newScale = Math.max(0.5, Math.min(2, leftScale + delta));
    setLeftScale(newScale);
    if (syncZoom) {
      setRightScale(newScale + zoomDiff);
    }
  };

  const changeRightZoom = (delta: number) => {
    const newScale = Math.max(0.5, Math.min(2, rightScale + delta));
    setRightScale(newScale);
    if (syncZoom) {
      setLeftScale(newScale - zoomDiff);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4">
      <div className="w-full max-w-[2200px] mx-auto bg-white rounded-xl shadow-lg p-2 sm:p-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          </div>
          {/* Botón de intercambio */}
          <div className="flex gap-4">
          <h1 className="text-2xl font-bold text-gray-800">Comparador</h1>
            <button
              onClick={swapDocuments}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
              disabled={!leftPDF && !rightPDF}
              title="Intercambiar documentos"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7h16m0 0-3-3m3 3-3 3 M20 17H4m0 0 3-3m-3 3 3 3"
                />
              </svg>
            </button>
            <button
              onClick={() => setSyncZoom((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                syncZoom ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {syncZoom ? <Link className="w-5 h-5" /> : <Link2Off className="w-5 h-5" />}
              <span className="text-sm">Zoom</span>
            </button>
            <button
              onClick={() => setSyncScroll((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                syncScroll ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {syncScroll ? <Link className="w-5 h-5" /> : <Link2Off className="w-5 h-5" />}
              <span className="text-sm">Scroll</span>
            </button>
            <button
              onClick={() => setEnableEtiquetar((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                enableEtiquetar ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Tag className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowEtiquetasModal(true)}
              className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
            >
              Etiquetas
            </button>
            <button
              onClick={() => setShowResumenModal(true)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button onClick={refreshDocuments} className="p-2 rounded-lg hover:bg-gray-100">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="flex flex-col">
            <div className="bg-white bg-opacity-90 px-4 py-2 rounded-full shadow-lg flex items-center gap-3 justify-center mb-4 w-fit mx-auto mt-4">
              {/* Nombre del documento */}
              {leftPDF && (
                <span className="text-xs text-gray-500 max-w-[180px] truncate" title={getFileName(leftPDF)}>
                  {getFileName(leftPDF)}
                </span>
              )}
              <button 
                onClick={() => changeLeftZoom(-0.1)}
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                <MinusCircle className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium min-w-[60px] text-center">
                {Math.round(leftScale * 100)}%
              </span>
              <button 
                onClick={() => changeLeftZoom(0.1)}
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
              {/* Botón eliminar */}
              {leftPDF && (
                <button onClick={() => removeDocument('left')} className="text-red-500 hover:text-red-700 ml-2" title="Eliminar PDF">
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="bg-white bg-opacity-90 px-4 py-2 rounded-full shadow-lg flex items-center gap-3 justify-center mb-4 w-fit mx-auto mt-4">
              {/* Nombre del documento */}
              {rightPDF && (
                <span className="text-xs text-gray-500 max-w-[180px] truncate" title={getFileName(rightPDF)}>
                  {getFileName(rightPDF)}
                </span>
              )}
              <button 
                onClick={() => changeRightZoom(-0.1)}
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                <MinusCircle className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium min-w-[60px] text-center">
                {Math.round(rightScale * 100)}%
              </span>
              <button 
                onClick={() => changeRightZoom(0.1)}
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
              {/* Botón eliminar */}
              {rightPDF && (
                <button onClick={() => removeDocument('right')} className="text-red-500 hover:text-red-700 ml-2" title="Eliminar PDF">
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 h-[calc(100vh-200px)] min-h-[500px] max-h-[1500px]">
            <div
            onDragOver={!leftPDF ? (e) => e.preventDefault() : undefined}
            onDrop={!leftPDF ? (e) => handleDrop(e, 'left') : undefined}
            onContextMenu={enableEtiquetar ? handleLeftContextMenu : undefined}
            className="relative"
            >
            {!leftPDF ? (
              <div className="w-full h-full">
              <input
                key={leftInputKey}
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileChange(e, 'left')}
                className="hidden"
                id="left-pdf"
              />
              <label
                htmlFor="left-pdf"
                className="absolute inset-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, 'left')}
              >
                <PDFViewer
                file={null}
                scale={leftScale}
                containerRef={leftContainerRef}
                onScroll={onLeftScroll}
                onContextMenu={enableEtiquetar ? handleLeftContextMenu : undefined}
                />
              </label>
              </div>
            ) : (
              <>
              <input
                key={leftInputKey}
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileChange(e, 'left')}
                className="hidden"
                id="left-pdf"
                disabled={!!leftPDF}
              />
              {leftPDF ? (
                <label htmlFor="left-pdf" className="absolute inset-0 cursor-pointer z-10">
                <PDFViewer
                  file={leftPDF}
                  scale={leftScale}
                  containerRef={leftContainerRef}
                  onScroll={onLeftScroll}
                  onContextMenu={enableEtiquetar ? handleLeftContextMenu : undefined}
                />
                </label>
              ) : (
                <div className="absolute inset-0 z-0">
                <PDFViewer
                  file={leftPDF}
                  scale={leftScale}
                  containerRef={leftContainerRef}
                  onScroll={onLeftScroll}
                  onContextMenu={enableEtiquetar ? handleLeftContextMenu : undefined}
                />
                </div>
              )}
              </>
            )}
            </div>

          <div
            onDragOver={!rightPDF ? (e) => e.preventDefault() : undefined}
            onDrop={!rightPDF ? (e) => handleDrop(e, 'right') : undefined}
            onContextMenu={enableEtiquetar ? handleRightContextMenu : undefined}
            className="relative"
          >
            <input
              key={rightInputKey}
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileChange(e, 'right')}
              className="hidden"
              id="right-pdf"
              disabled={!!rightPDF}
            />
            {!rightPDF ? (
              <label htmlFor="right-pdf" className="absolute inset-0 cursor-pointer z-10">
                <PDFViewer
                  file={rightPDF}
                  scale={rightScale}
                  containerRef={rightContainerRef}
                  onScroll={onRightScroll}
                  onContextMenu={enableEtiquetar ? handleRightContextMenu : undefined}
                />
              </label>
            ) : (
              <div className="absolute inset-0 z-0">
                <PDFViewer
                  file={rightPDF}
                  scale={rightScale}
                  containerRef={rightContainerRef}
                  onScroll={onRightScroll}
                  onContextMenu={enableEtiquetar ? handleRightContextMenu : undefined}
                />
              </div>
            )}
          </div>
        </div>

        {/* Panel central para cargar archivos cuando no hay ninguno cargado */}
        {!leftPDF && !rightPDF && (
          <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
            <div className="w-full max-w-xl p-6">
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => handleBothFilesChange(Array.from(e.target.files || []))}
                className="hidden"
                id="pdf-upload-central"
              />
              <label
                htmlFor="pdf-upload-central"
                className="flex flex-col items-center justify-center w-full border-2 border-dashed border-blue-300 rounded-lg p-8 cursor-pointer bg-blue-50 hover:bg-blue-100"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleBothFilesChange(Array.from(e.dataTransfer.files));
                }}
              >
                <Upload className="w-16 h-16 text-blue-400 mb-4" />
                <p className="text-lg text-blue-700 font-medium text-center mb-2">
                  Arrastra o selecciona los Documentos a comparar
                </p>
                <p className="text-sm text-gray-500">
                  Puedes seleccionar uno o dos archivos a la vez
                </p>
              </label>
            </div>
          </div>
        )}

        {showEtiquetasModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-20">
            <div className="bg-white p-6 rounded shadow-lg w-96 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">Etiquetas</h2>
              <ul className="mb-4">
                {labels.map((label) => (
                  <li key={label} className="py-1 border-b flex justify-between items-center">
                    <span>{label}</span>
                    <button
                      onClick={() => removeLabel(label)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Nueva etiqueta"
                  className="border p-1 rounded flex-1"
                  id="new-label"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('new-label') as HTMLInputElement;
                    addNewLabel(input.value);
                    input.value = '';
                  }}
                  className="bg-blue-500 text-white px-2 rounded"
                >
                  Agregar
                </button>
              </div>
              <button onClick={() => setShowEtiquetasModal(false)} className="px-4 py-2 bg-gray-200 rounded">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {showResumenModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-20">
            <div className="bg-white p-6 rounded shadow-lg max-w-lg w-full max-h-[90vh] flex flex-col overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">Reporte</h2>
              {summary.length === 0 ? (
                <p className="text-gray-600">No hay etiquetas asignadas</p>
              ) : (
                <table className="w-full border">
                  <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1">Etiqueta</th>
                    <th className="border px-2 py-1 text-left">{leftPDF ? getFileName(leftPDF) : "PDF 1"}</th>
                    <th className="border px-2 py-1 text-left">{rightPDF ? getFileName(rightPDF) : "PDF 2"}</th>
                    <th className="border px-2 py-1"></th>
                  </tr>
                  </thead>
                  <tbody>
                  {summary.map((item) => (
                    <tr key={item.label}>
                    <td className="border px-2 py-1">{item.label}</td>
                    <td className="border px-2 py-1">{item.left || '-'}</td>
                    <td className="border px-2 py-1">{item.right || '-'}</td>
                    <td className="border px-2 py-1">
                      <button
                      onClick={() => removeFromSummary(item.label)}
                      className="text-red-500 hover:text-red-700"
                      >
                      <XCircle className="w-4 h-4" />
                      </button>
                    </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              )}
              <button onClick={() => setShowResumenModal(false)} className="mt-4 px-4 py-2 bg-gray-200 rounded">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {contextMenu && (
          <div
            className="context-menu fixed bg-white border rounded shadow-lg z-30"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="p-2">
              <input
                type="text"
                placeholder="Buscar etiqueta..."
                className="border p-1 w-full mb-2"
                value={labelSearch}
                onChange={(e) => setLabelSearch(e.target.value)}
                autoFocus
              />
              <ul className="max-h-[200px] overflow-y-auto">
                {filteredLabels.map((label) => (
                  <li
                    key={label}
                    onClick={() => handleLabelSelect(label)}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
  );
}

export default App;