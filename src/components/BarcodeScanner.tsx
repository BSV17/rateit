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
    let stream: MediaStream | null = null

    function stopCamera() {
      scannerControls?.stop()
      stream?.getTracks().forEach((track) => track.stop())
      const videoStream = videoRef.current?.srcObject
      if (videoStream instanceof MediaStream) {
        videoStream.getTracks().forEach((track) => track.stop())
      }
      if (videoRef.current) videoRef.current.srcObject = null
      stream = null
    }

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (!active || !videoRef.current) {
          stopCamera()
          return
        }

        scannerControls = await reader.decodeFromStream(stream, videoRef.current, (result, error) => {
          if (!active) return
          if (result) {
            const barcode = result.getText()
            active = false
            setMessage('Штрихкод зчитано')
            stopCamera()
            onDetected(barcode)
            return
          }
          if (error) setMessage('Наведіть камеру на штрихкод')
        })
      } catch {
        stopCamera()
        if (active) setMessage('Камера недоступна. Введіть штрихкод вручну.')
      }
    }

    startCamera()

    return () => {
      active = false
      stopCamera()
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
