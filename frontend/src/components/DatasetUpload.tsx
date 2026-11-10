import { useState, useEffect } from 'react'

const API = 'http://127.0.0.1:8000'

type DatasetItem = {
  filename: string
  columns: string[]
}

export default function DatasetUpload({
  onUploaded,
  onDeleted,
  currentFilename,
}: {
  onUploaded: (filename: string) => void
  onDeleted?: (deletedFilename: string) => void
  currentFilename?: string
}) {
  const [datasets, setDatasets] = useState<DatasetItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadDatasets = async () => {
      try {
        const res = await fetch(`${API}/api/datasets`)
        if (!res.ok) throw new Error('Failed to fetch dataset list')
        const data = await res.json()
        if (isMounted && Array.isArray(data)) {
          setDatasets(data)
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Could not connect to backend server.'
          setError(message)
        }
      }
    }

    void loadDatasets()

    return () => {
      isMounted = false
    }
  }, [])

  const refreshList = async () => {
    try {
      const res = await fetch(`${API}/api/datasets`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setDatasets(data)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error refreshing dataset list.'
      setError(message)
    }
  }

  const handleDelete = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) return

    setError('')
    setSuccessMsg('')

    try {
      const res = await fetch(`${API}/api/datasets/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Delete failed' }))
        throw new Error(data.detail || 'Delete failed')
      }

      setSuccessMsg(`Successfully deleted "${filename}".`)
      await refreshList()

      if (onDeleted && filename === currentFilename) {
        onDeleted(filename)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during deletion.'
      setError(message)
    }
  }

  const handleFileProcess = async (file: File) => {
    setError('')
    setSuccessMsg('')

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Invalid file format. Please upload a valid .csv file.')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('File size exceeds the 20 MB limit.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)

    try {
      const res = await fetch(`${API}/api/datasets/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload failed')

      setSuccessMsg(`Successfully uploaded "${file.name}"!`)
      await refreshList()
      onUploaded(data.dataset.filename)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during upload.'
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <section className="panel" style={{ borderTop: '4px solid #2563EB' }}>
        <div className="panel-head">
          <div>
            <span className="tag" style={{ marginBottom: '8px', display: 'inline-block' }}>DATA MANAGEMENT · INGESTION</span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>Dataset Upload &amp; Instructions</h2>
            <p style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>
              Import your electricity consumption CSV files. Files are safely stored in your repository for multi-dataset analysis.
            </p>
          </div>
        </div>

        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '16px 20px', borderRadius: '12px', marginBottom: '20px', fontSize: '13px', color: '#1E3A8A', lineHeight: '1.6' }}>
          📌 <b>Instructions for CSV Upload:</b>
          <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
            <li>Ensure your CSV file contains a timestamp column (<code style={{ background: '#DBEAFE', padding: '2px 4px', borderRadius: '4px' }}>timestamp</code>, <code style={{ background: '#DBEAFE', padding: '2px 4px', borderRadius: '4px' }}>date</code>) and an energy consumption column (<code style={{ background: '#DBEAFE', padding: '2px 4px', borderRadius: '4px' }}>energy_kwh</code>, <code style={{ background: '#DBEAFE', padding: '2px 4px', borderRadius: '4px' }}>kwh</code>).</li>
            <li>Maximum supported file size is <b>20 MB</b>.</li>
            <li>You can upload multiple CSV files; they will all appear in your Saved Datasets Repository table below for instant switching or deletion.</li>
          </ul>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: `2px dashed ${dragActive ? '#2563EB' : '#CBD5E1'}`,
            borderRadius: '12px',
            padding: '40px 24px',
            textAlign: 'center',
            background: dragActive ? '#EFF6FF' : '#F8FAFC',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>
            {uploading ? 'Processing and saving CSV...' : 'Drag and drop your CSV file here'}
          </p>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>
            Supported format: CSV · Maximum file size: 20 MB
          </p>

          <input
            type="file"
            accept=".csv"
            id="csv-upload-input"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files && e.target.files[0]) {
                handleFileProcess(e.target.files[0])
              }
            }}
          />
          <label
            htmlFor="csv-upload-input"
            style={{
              background: '#2563EB',
              color: '#FFF',
              padding: '10px 22px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
              display: 'inline-block',
            }}
          >
            Browse Files
          </label>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px 16px', borderRadius: '8px', marginTop: '16px', color: '#DC2626', fontSize: '13px', fontWeight: 600 }}>
            ⚠️ <b>Error:</b> {error}
          </div>
        )}
        {successMsg && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px 16px', borderRadius: '8px', marginTop: '16px', color: '#16A34A', fontSize: '13px', fontWeight: 600 }}>
            ✅ {successMsg}
          </div>
        )}
      </section>

      <section className="panel" style={{ borderTop: '4px solid #10B981' }}>
        <div className="panel-head">
          <div>
            <span className="tag" style={{ marginBottom: '8px', display: 'inline-block' }}>REPOSITORY · MULTI-CSV STORAGE</span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>Saved Datasets Repository</h2>
            <p style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>
              All uploaded CSV files are stored here. Choose any dataset below to inspect its analytics or remove old files.
            </p>
          </div>
          <span className="tag" style={{ fontSize: '13px', padding: '6px 12px' }}>
            {datasets.length} {datasets.length === 1 ? 'Dataset' : 'Datasets'} Available
          </span>
        </div>

        {datasets.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ fontSize: '14px' }}>Filename ID</th>
                  <th style={{ fontSize: '14px' }}>Detected Columns Preview</th>
                  <th style={{ fontSize: '14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map(item => {
                  const isLoaded = item.filename === currentFilename
                  return (
                    <tr key={item.filename} style={{ background: isLoaded ? '#F0FDF4' : 'transparent' }}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        📄 <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>{item.filename}</code>
                        {isLoaded && <span style={{ marginLeft: '8px', background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>Active</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                          {item.columns.slice(0, 5).join(', ')}{item.columns.length > 5 ? ' ...' : ''}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            style={{
                              background: isLoaded ? '#059669' : '#10B981',
                              color: '#FFF',
                              border: isLoaded ? '2px solid #047857' : 'none',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: isLoaded ? 'default' : 'pointer',
                              boxShadow: isLoaded ? '0 0 0 3px rgba(16,185,129,0.2)' : '0 1px 3px rgba(16,185,129,0.2)'
                            }}
                            onClick={() => {
                              if (!isLoaded) onUploaded(item.filename)
                            }}
                          >
                            {isLoaded ? 'Loaded ✓' : 'Load Dataset ⚡'}
                          </button>
                          <button
                            type="button"
                            style={{
                              background: '#EF4444',
                              color: '#FFF',
                              border: 'none',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(239,68,68,0.2)'
                            }}
                            title="Delete dataset"
                            onClick={(e) => handleDelete(item.filename, e)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
            <p style={{ fontSize: '14px', margin: 0 }}>No datasets uploaded yet. Upload a CSV above to populate your repository table.</p>
          </div>
        )}
      </section>
    </div>
  )
}