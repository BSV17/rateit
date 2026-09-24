import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { useEffect, useRef, useState } from 'react'

export function BarcodeScanner({ onDetected }: { onDetected: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [message, setMessage] = useState('Запитуємо доступ до камери...')

  useEffect(() => {
    let active = true
    const reader = new BrowserMultiFormatReader()
    let scannerControls: IScannerControls | null = null

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, error, controls) => {
        scannerControls = controls
        if (!active) return
        if (result) {
          controls.stop()
          setMessage('Штрихкод зчитано')
          onDetected(result.getText())
        }
        if (error) setMessage('Наведіть камеру на штрихкод')
      })
      .catch(() => {
        setMessage('Камера недоступна. Введіть штрихкод вручну.')
      })

    return () => {
      active = false
      scannerControls?.stop()
    }
  }, [onDetected])

  return (
    <div className="scanner">
      <video ref={videoRef} muted playsInline />
      <div className="scan-frame" />
      <p>{message}</p>
    </div>
  )
}
